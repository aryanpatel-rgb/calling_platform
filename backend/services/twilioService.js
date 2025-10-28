import twilio from 'twilio';
import { generateSpeech } from './elevenLabsService.js';

// Store active calls (in production, use a database)
const activeCalls = new Map();

/**
 * Initiate an outbound call
 */
export async function initiateCall(agent, phoneNumber) {
  try {
    const { accountSid, authToken, phoneNumber: fromNumber } = agent.twilioConfig;

    const client = twilio(accountSid, authToken);

    const call = await client.calls.create({
      url: `${process.env.SERVER_URL || 'http://localhost:3000'}/api/twilio/voice/webhook?agentId=${agent.id}`,
      to: phoneNumber,
      from: fromNumber,
      statusCallback: `${process.env.SERVER_URL || 'http://localhost:3000'}/api/twilio/voice/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      record: true,
      recordingStatusCallback: `${process.env.SERVER_URL || 'http://localhost:3000'}/api/twilio/voice/recording`
    });

    activeCalls.set(agent.id, {
      callSid: call.sid,
      phoneNumber,
      status: 'initiated',
      startedAt: new Date()
    });

    return call.sid;
  } catch (error) {
    console.error('Twilio call initiation error:', error);
    throw new Error(`Failed to initiate call: ${error.message}`);
  }
}

/**
 * Handle voice webhook from Twilio
 */
export async function handleVoiceWebhook(body, query) {
  try {
    const { agentId } = query;
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    // Get agent data (in production, fetch from database)
    // For now, we'll create a simple greeting response

    const greeting = body.greeting || 'Hello! How can I help you today?';

    // Generate speech using ElevenLabs
    try {
      const audioUrl = await generateSpeech(greeting, {
        voiceId: 'default',
        stability: 0.5,
        similarityBoost: 0.75
      });

      // Play the greeting
      twiml.play(audioUrl);
    } catch (error) {
      // Fallback to Twilio's TTS
      twiml.say({ voice: 'Polly.Joanna' }, greeting);
    }

    // Gather user speech
    const gather = twiml.gather({
      input: 'speech',
      action: `/api/twilio/voice/process?agentId=${agentId}`,
      speechTimeout: 'auto',
      speechModel: 'experimental_conversations',
    });

    // If no input, say goodbye
    twiml.say({ voice: 'Polly.Joanna' }, 'I didn\'t receive any input. Goodbye!');
    twiml.hangup();

    return twiml.toString();
  } catch (error) {
    console.error('Voice webhook error:', error);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    twiml.say('An error occurred. Please try again later.');
    twiml.hangup();
    return twiml.toString();
  }
}

/**
 * Process voice input
 */
export async function processVoiceInput(body, query) {
  try {
    const { agentId } = query;
    const { SpeechResult } = body;

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    if (!SpeechResult) {
      twiml.say({ voice: 'Polly.Joanna' }, 'I didn\'t catch that. Could you please repeat?');
      twiml.redirect('/api/twilio/voice/webhook?agentId=' + agentId);
      return twiml.toString();
    }

    // Process with AI (integrate with aiService)
    // For now, simple echo response
    const response = `I heard you say: ${SpeechResult}. How else can I help you?`;

    try {
      const audioUrl = await generateSpeech(response, {
        voiceId: 'default'
      });
      twiml.play(audioUrl);
    } catch (error) {
      twiml.say({ voice: 'Polly.Joanna' }, response);
    }

    // Continue conversation
    twiml.redirect('/api/twilio/voice/webhook?agentId=' + agentId);

    return twiml.toString();
  } catch (error) {
    console.error('Process voice input error:', error);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    twiml.say('An error occurred processing your request.');
    twiml.hangup();
    return twiml.toString();
  }
}

/**
 * End an active call
 */
export async function endCall(agent) {
  try {
    const activeCall = activeCalls.get(agent.id);
    
    if (!activeCall) {
      throw new Error('No active call found for this agent');
    }

    const { accountSid, authToken } = agent.twilioConfig;
    const client = twilio(accountSid, authToken);

    await client.calls(activeCall.callSid).update({ status: 'completed' });

    activeCalls.delete(agent.id);

    return {
      success: true,
      callSid: activeCall.callSid
    };
  } catch (error) {
    console.error('End call error:', error);
    throw new Error(`Failed to end call: ${error.message}`);
  }
}

export default {
  initiateCall,
  handleVoiceWebhook,
  processVoiceInput,
  endCall
};

