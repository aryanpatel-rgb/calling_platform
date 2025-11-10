import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, MessageSquare, Send, Phone, Mic, Square } from 'lucide-react';
import toast from 'react-hot-toast';

const TestAgent = () => {
  const { id } = useParams();
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  // Voice test state
  const [wsConnected, setWsConnected] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [transcripts, setTranscripts] = useState([]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [calling, setCalling] = useState(false);
  const [callSid, setCallSid] = useState(null);
  const [callStatus, setCallStatus] = useState(null);
  const statusPollerRef = useRef(null);
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);
  const mediaStreamRef = useRef(null);

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const res = await axios.get(`http://localhost:3000/api/agents/${id}`);
        setAgent(res.data);
      } catch (error) {
        console.error('Error fetching agent:', error);
        toast.error('Failed to load agent');
      } finally {
        setLoading(false);
      }
    };
    fetchAgent();
    return () => {
      // Cleanup any status polling on unmount
      if (statusPollerRef.current) {
        clearInterval(statusPollerRef.current);
        statusPollerRef.current = null;
      }
    };
  }, [id]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setSending(true);
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    try {
      const res = await axios.post(`http://localhost:3000/api/agents/${id}/chat`, {
        message: text,
        conversationId: conversationId || undefined,
        stream: false
      });
      if (res.data?.conversationId && !conversationId) {
        setConversationId(res.data.conversationId);
      }
      const reply = res.data?.message || 'No response';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (error) {
      console.error('Chat send error:', error);
      const msg = error.response?.data?.message || 'Failed to send message';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-2">Agent Not Found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          The agent you're looking for doesn't exist
        </p>
        <Link to="/dashboard" className="btn-primary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  // Helpers for voice streaming
  const getWsUrl = () => {
    const envUrl = import.meta.env.VITE_VOICE_GATEWAY_WS_URL;
    return (envUrl && envUrl.length > 0)
      ? envUrl
      : 'ws://alive-distinctly-phoenix.ngrok-free.app/voice-stream?source=browser';
  };

  const floatTo16BitPCM = (float32Array) => {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Uint8Array(buffer);
  };

  const downsampleTo16k = (float32Array, inputSampleRate) => {
    const targetRate = 16000;
    if (inputSampleRate === targetRate) return float32Array;
    const ratio = inputSampleRate / targetRate;
    const newLength = Math.round(float32Array.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0, count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < float32Array.length; i++) {
        accum += float32Array[i];
        count++;
      }
      result[offsetResult] = accum / count;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  };

  const connectWs = () => {
    try {
      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;
      ws.onopen = () => {
        setWsConnected(true);
        toast.success('Connected to voice gateway');
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'audio' && msg.data) {
            const audio = new Audio('data:audio/mpeg;base64,' + msg.data);
            audio.play().catch(() => {});
          } else if (msg.type === 'transcript') {
            setTranscripts(prev => [...prev, { text: msg.data, final: !!msg.final }]);
          } else if (msg.type === 'error') {
            toast.error(msg.message || 'Voice gateway error');
          } else if (msg.type === 'status') {
            // optional status
          }
        } catch (e) {
          // ignore parse errors
        }
      };
      ws.onclose = () => {
        setWsConnected(false);
        stopMic();
      };
      ws.onerror = () => {
        toast.error('WebSocket error');
      };
    } catch (error) {
      toast.error('Failed to connect WebSocket');
    }
  };

  const startMic = async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error('Connect gateway first');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer.getChannelData(0);
        const downsampled = downsampleTo16k(inputBuffer, audioContext.sampleRate);
        const pcm16 = floatTo16BitPCM(downsampled);
        const base64 = btoa(String.fromCharCode(...pcm16));
        try {
          wsRef.current.send(JSON.stringify({ type: 'audio', encoding: 'pcm16', sampleRate: 16000, data: base64 }));
        } catch {}
      };
      source.connect(processor);
      processor.connect(audioContext.destination);
      setMicActive(true);
      toast.success('Microphone streaming started');
    } catch (error) {
      toast.error('Microphone access failed');
    }
  };

  const stopMic = () => {
    try {
      setMicActive(false);
      if (processorRef.current) {
        try { processorRef.current.disconnect(); } catch {}
      }
      if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch {}
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    } catch {}
  };

  const disconnectWs = () => {
    try {
      stopMic();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
      setWsConnected(false);
      toast.success('Disconnected from voice gateway');
    } catch {}
  };

  // Trigger Twilio outbound call and start status polling
  const startOutboundCall = async () => {
    try {
      const phone = phoneNumber.trim();
      if (!phone) {
        toast.error('Enter a phone number in E.164 format');
        return;
      }
      // Basic E.164 validation client-side
      if (!/^\+[1-9]\d{1,14}$/.test(phone)) {
        toast.error('Invalid phone format. Use +15551234567');
        return;
      }

      setCalling(true);
      setCallStatus('initiated');
      setCallSid(null);

      const res = await axios.post('http://localhost:3000/api/twilio/call', {
        agentId: id,
        phoneNumber: phone
      });

      const sid = res.data?.sid;
      if (!sid) {
        throw new Error('No call SID returned');
      }

      setCallSid(sid);
      setCallStatus(res.data?.status || 'queued');
      toast.success('Call initiated');

      // Begin status polling every 2 seconds
      if (statusPollerRef.current) clearInterval(statusPollerRef.current);
      statusPollerRef.current = setInterval(async () => {
        try {
          const st = await axios.get(`http://localhost:3000/api/twilio/call/${sid}?agentId=${id}`);
          const status = st.data?.status || null;
          if (status) setCallStatus(status);
          // Stop polling on terminal states
          if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(status)) {
            clearInterval(statusPollerRef.current);
            statusPollerRef.current = null;
            setCalling(false);
            toast.success(`Call ${status}`);
          }
        } catch (pollErr) {
          // On polling error, stop polling
          clearInterval(statusPollerRef.current);
          statusPollerRef.current = null;
          setCalling(false);
        }
      }, 2000);
    } catch (error) {
      console.error('Outbound call error:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to initiate call');
      setCalling(false);
      setCallSid(null);
      setCallStatus(null);
    }
  };

  // If voice agent, render voice test UI
  if (agent.type === 'voice_call') {
    return (
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link to={`/dashboard/agent/${id}`} className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Agent</span>
          </Link>
          <div className="flex items-center space-x-2 text-gray-700">
            <Phone className="w-5 h-5 text-purple-600" />
            <span className="font-medium">Testing Voice Call Agent</span>
          </div>
        </div>

        {/* Two-column: Agent Prompt (left) and Test Phone (right) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-2">Agent Prompt</h3>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 max-h-96 overflow-y-auto">
              <p className="text-sm font-mono whitespace-pre-wrap">{agent.system_prompt || 'No prompt configured.'}</p>
            </div>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold mb-2">Test Phone Call</h3>
            <label className="block text-sm font-medium mb-2">Phone Number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter phone (E.164, e.g., +15551234567)"
              className="input-field"
            />
            <div className="mt-3 flex items-center gap-2">
              <button onClick={startOutboundCall} disabled={calling} className="btn-primary flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span>{calling ? 'Calling...' : 'Call Now'}</span>
              </button>
              {callSid && (
                <span className="text-xs text-gray-600">SID: {callSid}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">This triggers an outbound Twilio call and streams audio via the voice gateway.</p>
            {callStatus && (
              <p className="text-sm mt-2"><span className="font-medium">Status:</span> {callStatus}</p>
            )}
          </div>
        </div>

        {/* Voice gateway controls and live events */}
        <div className="card">
          {/* Transcript and audio events */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border p-3">
              <h3 className="font-semibold mb-2">Transcripts</h3>
              <div className="h-64 overflow-y-auto space-y-2 text-sm">
                {transcripts.length === 0 ? (
                  <p className="text-gray-500">No transcripts yet. Speak after starting the mic.</p>
                ) : (
                  transcripts.map((t, i) => (
                    <div key={i} className={`px-2 py-1 rounded ${t.final ? 'bg-green-50 text-green-700' : 'bg-gray-100'}`}>{t.text}</div>
                  ))
                )}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <h3 className="font-semibold mb-2">Playback</h3>
              <p className="text-sm text-gray-600">Incoming audio is auto‑played when received.</p>
              <ul className="text-sm mt-2 list-disc ml-4 text-gray-600">
                <li>Connect gateway to open WebSocket.</li>
                <li>Start mic to stream PCM16 audio to server.</li>
                <li>Server transcribes (Deepgram), replies (OpenAI), and sends TTS audio (ElevenLabs).</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link to={`/dashboard/agent/${id}`} className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Agent</span>
        </Link>
        <div className="flex items-center space-x-2 text-gray-700">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <span className="font-medium">Testing Chatbot Agent</span>
        </div>
      </div>

      {/* Chat panel */}
      <div className="card">
        <div className="h-[420px] overflow-y-auto space-y-4 p-2">
          {messages.length === 0 ? (
            <p className="text-sm text-gray-500">Start the conversation to test your agent’s replies.</p>
          ) : (
            messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 dark:text-gray-100'}`}>
                  {m.content}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Composer */}
        <div className="mt-4 flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 input"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !sending) {
                sendMessage();
              }
            }}
          />
          <button onClick={sendMessage} disabled={sending} className="btn-primary flex items-center space-x-2">
            <Send className="w-4 h-4" />
            <span>{sending ? 'Sending...' : 'Send'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TestAgent;