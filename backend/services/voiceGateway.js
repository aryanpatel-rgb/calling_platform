import url from 'url';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { startDeepgramSession } from './deepgramService.js';
import { generateResponse, buildSystemPrompt } from './aiService.js';
import { generateSpeech } from './elevenLabsService.js';
import { speakReply, speakAudioReply } from './twilioService.js';
import { getAgentIdByCallSid, setStreamSid, appendConversation, getConversation, storeAudio, isCallActive } from '../utils/callStore.js';
import { getAgentById } from '../db/repositories/agentRepository.js';

dotenv.config();

/**
 * Sets up a WebSocket voice gateway at path `/voice-stream`.
 * Supports two sources: `twilio` (Twilio Media Streams) and `browser`.
 * - Receives audio frames, forwards to Deepgram for streaming STT.
 * - On transcript segments, generates AI response and TTS audio.
 * - For browser source, sends base64 audio back to client over WebSocket.
 * - For twilio source, currently logs and awaits bidirectional support.
 */

export function setupVoiceGateway(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/voice-stream' });

  // Log handshake attempts (helps detect Twilio trying to connect)
  wss.on('headers', (headers, req) => {
    try {
      const ua = req.headers['user-agent'] || 'unknown';
      const ip = req.socket?.remoteAddress || 'unknown';
      console.log('[VoiceGateway] WS handshake:', { ip, ua, url: req.url });
    } catch {}
  });

  wss.on('connection', async (ws, req) => {
    const { query } = url.parse(req.url, true);
    const ua = (req.headers && req.headers['user-agent']) || '';
    const isTwilioUA = ua.toLowerCase().includes('twilio');
    const source = (query.source === 'twilio' || isTwilioUA) ? 'twilio' : 'browser';
    let agentId = query.agentId || null;

    console.log('[VoiceGateway] New connection:', { source, agentId, ua });

    // Prefetch agent for context if available
    let agent = null;
    try {
      if (agentId) {
        agent = await getAgentById(agentId);
        if (agent) {
          console.log('[VoiceGateway] Loaded agent context:', { id: agentId, name: agent.name || agentId });
        } else {
          console.warn('[VoiceGateway] Agent not found for agentId:', agentId);
        }
      }
    } catch (e) {
      console.error('[VoiceGateway] Error loading agent:', e?.message || e);
    }

    // Track connection active state to prevent post-close work
    let active = true;

    // Simple utterance aggregation for faster responses on interim results
    let pendingText = '';
    let finalizeTimer = null;

    const processFinalTranscript = async (finalText) => {
      if (!active || !finalText) return;
      // Guard: only process for Twilio when call is active
      if (source === 'twilio' && (!callSidRef || !isCallActive(callSidRef))) {
        return;
      }
      try {
        // Get AI response text using agent prompt when available
        const history = callSidRef ? getConversation(callSidRef) : [];
        const messages = [
          { role: 'system', content: buildSystemPrompt(agent || {}) },
          ...history,
          { role: 'user', content: finalText }
        ];
        const ai = await generateResponse(messages, { maxTokens: 120 });
        const replyText = typeof ai === 'string' ? ai : (ai?.message || ai?.text || 'Okay.');

        console.log('[VoiceGateway] AI reply:', replyText);
        console.log(`[Conversation] AGENT [agent:${agentId || 'n/a'} sid:${callSidRef || 'n/a'}]: ${replyText}`);

        // Persist conversation memory
        try {
          if (callSidRef) {
            appendConversation(callSidRef, 'user', finalText);
            appendConversation(callSidRef, 'assistant', replyText);
            const memLen = getConversation(callSidRef)?.length || 0;
            console.log('[VoiceGateway] Memory size for call:', { callSid: callSidRef, messages: memLen });
          }
        } catch {}

        // Generate speech with ElevenLabs using agent-selected voice when available
        const vs = (agent ? (agent.voiceSettings || agent.voice_settings || {}) : {});
        const audioBase64 = await generateSpeech(replyText, {
          voiceId: vs.voiceId || 'default',
          stability: vs.stability,
          similarityBoost: vs.similarityBoost,
          speed: vs.speed
        });
        console.log('[VoiceGateway] TTS length (base64 chars):', audioBase64?.length || 0);

        if (source === 'browser') {
          try { ws.send(JSON.stringify({ type: 'audio', format: 'audio/mpeg', data: audioBase64 })); } catch {}
          try { ws.send(JSON.stringify({ type: 'text', data: replyText })); } catch {}
        } else {
          // For Twilio, play ElevenLabs audio via <Play>, then resume <Stream>
          try {
            const { VOICE_GATEWAY_WS_URL, SERVER_URL } = process.env;
            const wsUrl = VOICE_GATEWAY_WS_URL || (SERVER_URL ? SERVER_URL.replace('http', 'ws') + '/voice-stream' : 'ws://localhost:3000/voice-stream');
            const httpBase = SERVER_URL || null;
            const effectiveAgentId = agentId || getAgentIdByCallSid(callSidRef) || null;
            if (!effectiveAgentId) {
              console.warn('[VoiceGateway] No agentId available; skipping speak update.');
            } else if (!httpBase) {
              console.warn('[VoiceGateway] SERVER_URL not set; cannot serve audio to Twilio. Falling back to <Say>.');
              if (isCallActive(callSidRef)) {
                await speakReply(effectiveAgentId, callSidRef, replyText, `${wsUrl}?source=twilio&agentId=${encodeURIComponent(effectiveAgentId)}`);
                console.log('[VoiceGateway] Spoke reply via Twilio <Say> and resumed stream.');
              }
            } else {
              if (isCallActive(callSidRef)) {
                const audioId = storeAudio(audioBase64, 'audio/mpeg');
                const audioUrl = `${httpBase}/api/twilio/audio/${audioId}`;
                await speakAudioReply(effectiveAgentId, callSidRef, audioUrl, `${wsUrl}?source=twilio&agentId=${encodeURIComponent(effectiveAgentId)}`);
                console.log('[VoiceGateway] Spoke reply via Twilio <Play> (ElevenLabs) and resumed stream.');
              }
            }
          } catch (err) {
            console.error('[VoiceGateway] Error speaking audio reply to Twilio:', err?.message || err);
            // Fallback to text <Say>
            try {
              const { VOICE_GATEWAY_WS_URL, SERVER_URL } = process.env;
              const wsUrl = VOICE_GATEWAY_WS_URL || (SERVER_URL ? SERVER_URL.replace('http', 'ws') + '/voice-stream' : 'ws://localhost:3000/voice-stream');
              const effectiveAgentId = agentId || getAgentIdByCallSid(callSidRef) || null;
              if (callSidRef && effectiveAgentId && isCallActive(callSidRef)) {
                await speakReply(effectiveAgentId, callSidRef, replyText, `${wsUrl}?source=twilio&agentId=${encodeURIComponent(effectiveAgentId)}`);
                console.log('[VoiceGateway] Fallback <Say> spoken and stream resumed.');
              } else {
                console.warn('[VoiceGateway] Fallback skipped; call not active.');
              }
            } catch {}
          }
        }
      } catch (error) {
        console.error('[VoiceGateway] processFinalTranscript error:', error?.message || error);
      }
    };
    const dg = await startDeepgramSession({
      source,
      onTranscript: async (transcript, isFinal) => {
        // Emit transcript to client for UI feedback
        try { ws.send(JSON.stringify({ type: 'transcript', data: transcript, final: !!isFinal })); } catch {}

        if (transcript) {
          console.log('[VoiceGateway] Transcript:', { text: transcript, final: !!isFinal });
          console.log(`[Conversation] USER [agent:${agentId || 'n/a'} sid:${callSidRef || 'n/a'}]: ${transcript}`);
        }

        if (!active || !transcript) return;

        if (isFinal) {
          // Clear any pending interim aggregation and process immediately
          if (finalizeTimer) { try { clearTimeout(finalizeTimer); } catch {} finalizeTimer = null; }
          const text = transcript.trim();
          pendingText = '';
          if (text) await processFinalTranscript(text);
          return;
        }

        // Debounce interim transcript: finalize if no new text arrives shortly
        pendingText = transcript.trim();
        if (finalizeTimer) { try { clearTimeout(finalizeTimer); } catch {} finalizeTimer = null; }
        finalizeTimer = setTimeout(() => {
          finalizeTimer = null;
          const text = pendingText;
          pendingText = '';
          if (text) processFinalTranscript(text);
        }, 800);
      }
    });

    // Keep the current Twilio Call SID if provided in 'start' event
    let callSidRef = null;

    ws.on('message', async (message) => {
      try {
        const msg = JSON.parse(message.toString());

        // Handle Twilio Media Stream payloads
        if (source === 'twilio') {
          if (msg.event === 'start') {
            callSidRef = msg?.start?.callSid || callSidRef;
            // Record streamSid and try to resolve agentId via call store if missing
            try { if (callSidRef) setStreamSid(callSidRef, msg.streamSid); } catch {}
            if (!agentId && callSidRef) {
              const mapped = getAgentIdByCallSid(callSidRef);
              if (mapped) {
                agentId = mapped;
                console.log('[VoiceGateway] Resolved agentId from callSid mapping:', { agentId, callSid: callSidRef });
                // Load agent context if not already loaded
                try {
                  if (!agent) {
                    agent = await getAgentById(agentId);
                    if (agent) {
                      console.log('[VoiceGateway] Loaded agent context (late):', { id: agentId, name: agent.name || agentId });
                    }
                  }
                } catch (e) {
                  console.warn('[VoiceGateway] Failed to load agent context late:', e?.message || e);
                }
              }
            }
            console.log('[VoiceGateway] Twilio stream started:', { streamSid: msg.streamSid, callSid: callSidRef, agentId });
            try { ws.send(JSON.stringify({ type: 'status', message: 'Twilio stream started', callSid: callSidRef })); } catch {}
          } else if (msg.event === 'media' && msg.media && msg.media.payload) {
            // mu-law base64 payload at 8000 Hz
            dg.writeTwilioBase64(msg.media.payload);
            // Occasionally log media frames for observability
            if ((Math.random() * 100) < 1) {
              console.log('[VoiceGateway] Received Twilio media frame');
            }
          } else if (msg.event === 'stop') {
            console.log('[VoiceGateway] Twilio stream stop received');
            active = false;
            dg.end();
            ws.close();
          }
          return;
        }

        // Browser audio frames
        if (msg.type === 'audio' && msg.encoding === 'pcm16' && msg.sampleRate) {
          dg.writePcm16Base64(msg.data, msg.sampleRate);
        }
      } catch (error) {
        console.error('[VoiceGateway] Message handling error:', error?.message || error);
        try { ws.send(JSON.stringify({ type: 'error', message: error.message })); } catch {}
      }
    });

    ws.on('close', () => {
      console.log('[VoiceGateway] Connection closed');
      active = false;
      dg.end();
    });
  });
}

export default { setupVoiceGateway };