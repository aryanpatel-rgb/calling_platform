import twilio from 'twilio';
import { generateSpeech } from './elevenLabsService.js';
import { processMessage, buildSystemPrompt } from './aiService.js';
import { executeFunction } from './functionExecutor.js';
import cacheService from './cacheService.js';
import * as callHistoryRepo from '../db/repositories/callHistoryRepository.js';
import * as conversationRepo from '../db/repositories/conversationRepository.js';

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

    // Create conversation for this call
    const conversation = await conversationRepo.createConversation(agent.id, 'call');

    // Create call history record
    await callHistoryRepo.createCall({
      agentId: agent.id,
      conversationId: conversation.id,
      callSid: call.sid,
      fromNumber: fromNumber,
      toNumber: phoneNumber,
      status: 'initiated',
      direction: 'outbound',
      startedAt: new Date()
    });

    activeCalls.set(agent.id, {
      callSid: call.sid,
      phoneNumber,
      status: 'initiated',
      startedAt: new Date(),
      conversationId: conversation.id
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

    // Import agent repository to fetch agent data
    const { getAgentById } = await import('../db/repositories/agentRepository.js');
    
    // Get actual agent data from database
    const agent = await getAgentById(agentId);
    if (!agent) {
      twiml.say({ voice: 'Polly.Joanna' }, 'Agent not found. Goodbye!');
      twiml.hangup();
      return twiml.toString();
    }

    // Get greeting from agent's voice settings or use default
    let greeting = 'Hello! How can I help you today?';
    if (agent.voiceSettings && agent.voiceSettings.greeting) {
      greeting = agent.voiceSettings.greeting;
    }

    console.log(`Voice webhook for agent ${agent.name}: ${greeting}`);

    // Create gather element for user input with optimized speech recognition
    const gather = twiml.gather({
      input: 'speech',
      action: `${process.env.SERVER_URL || 'http://localhost:3000'}/api/twilio/voice/process?agentId=${agentId}`,
      speechTimeout: 8, // Increased to 8 seconds to wait for complete thoughts
      speechModel: 'phone_call', // Better model for phone conversations
      timeout: 60, // Increased total timeout to 60 seconds for longer responses
      finishOnKey: '#',
      enhanced: true, // Enable enhanced speech recognition
      language: 'en-US', // Specify language for better accuracy
      profanityFilter: false, // Don't filter speech for better accuracy
      // Removed partialResultCallback to prevent premature processing
    });

    // Generate speech using ElevenLabs within the gather with BARGE-IN support
    try {
      const voiceSettings = agent.voiceSettings || {};
      const audioUrl = await generateSpeech(greeting, {
        voiceId: voiceSettings.voiceId || 'default',
        stability: voiceSettings.stability || 0.5,
        similarityBoost: voiceSettings.similarityBoost || 0.75,
        speed: voiceSettings.speed || 1.0
      });

      // Check if audioUrl is a data URL (which Twilio can't play)
      if (audioUrl && !audioUrl.startsWith('data:')) {
        // Play the greeting within gather with BARGE-IN enabled (only if it's a real URL)
        gather.play({ bargein: true }, audioUrl);
      } else if (audioUrl && audioUrl.startsWith('data:')) {
        // Use our audio endpoint to serve the ElevenLabs audio with BARGE-IN
        const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
        const encodedText = encodeURIComponent(greeting);
        const audioEndpoint = `${serverUrl}/api/audio/tts?text=${encodedText}&voiceId=${voiceSettings.voiceId || 'default'}&stability=${voiceSettings.stability || 0.5}&similarityBoost=${voiceSettings.similarityBoost || 0.75}&speed=${voiceSettings.speed || 1.0}`;
        
        // Use Twilio's <Play> with our audio endpoint and BARGE-IN enabled
        gather.play({ bargein: true }, audioEndpoint);
      } else {
        // Use Twilio TTS if ElevenLabs returns nothing - with BARGE-IN
        console.warn('ElevenLabs returned no audio, using Twilio TTS instead');
        gather.say({ voice: 'Polly.Joanna', bargein: true }, greeting);
      }
    } catch (error) {
      console.warn('ElevenLabs failed, using Twilio TTS:', error.message);
      // Fallback to Twilio's TTS within gather with BARGE-IN enabled
      gather.say({ voice: 'Polly.Joanna', bargein: true }, greeting);
    }

    // If no input received, provide a helpful message
    twiml.say({ voice: 'Polly.Joanna' }, 'I didn\'t hear anything. Please try calling again. Goodbye!');
    twiml.hangup();

    return twiml.toString();
  } catch (error) {
    console.error('Voice webhook error:', error);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Joanna' }, 'I\'m sorry, there was an error. Please try again later.');
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

/**
 * Process user speech input and generate agent response (OPTIMIZED VERSION)
 */
export async function processUserSpeech(body, query) {
  const startTime = Date.now(); // Track response time
  
  try {
    const { agentId } = query;
    const userSpeech = body.SpeechResult || body.Digits || '';
    const confidence = parseFloat(body.Confidence) || 0; // Get speech confidence score
    
    console.log(`Processing speech for agent ${agentId}: "${userSpeech}" (confidence: ${confidence})`);

    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    // Import agent repository to fetch agent data
    const { getAgentById } = await import('../db/repositories/agentRepository.js');
    
    // Get actual agent data from database
    const agent = await getAgentById(agentId);
    if (!agent) {
      twiml.say({ voice: 'Polly.Joanna' }, 'Agent not found. Goodbye!');
      twiml.hangup();
      return twiml.toString();
    }

    // CONFIDENCE CHECK: If confidence is too low, ask user to repeat (but be more lenient)
    if (userSpeech && confidence > 0 && confidence < 0.3) {
      console.log(`Low confidence speech (${confidence}): "${userSpeech}" - asking user to repeat`);
      const gather = twiml.gather({
        input: 'speech',
        action: `${process.env.SERVER_URL || 'http://localhost:3000'}/api/twilio/voice/process?agentId=${agentId}`,
        speechTimeout: 8, // Increased to 8 seconds to wait for complete thoughts
        speechModel: 'phone_call', // Better model for phone conversations
        timeout: 60, // Increased total timeout to 60 seconds for longer responses
        finishOnKey: '#',
        enhanced: true, // Enable enhanced speech recognition
        language: 'en-US', // Specify language for better accuracy
        profanityFilter: false, // Don't filter speech for better accuracy
        // Removed partialResultCallback to prevent premature processing
      });
      
      gather.say({ voice: 'Polly.Joanna', bargein: true }, 'I didn\'t quite catch that clearly. Could you please speak a bit louder and repeat your question?');
      
      // REMOVED the immediate hangup - let the gather handle the retry
      return twiml.toString();
    }

    // If no speech detected, ask user to repeat with optimized settings
    if (!userSpeech || userSpeech.trim() === '') {
      const gather = twiml.gather({
        input: 'speech',
        action: `${process.env.SERVER_URL || 'http://localhost:3000'}/api/twilio/voice/process?agentId=${agentId}`,
        speechTimeout: 8, // Increased to 8 seconds to wait for complete thoughts
        speechModel: 'phone_call', // Better model for phone conversations
        timeout: 60, // Increased total timeout to 60 seconds for longer responses
        finishOnKey: '#',
        enhanced: true, // Enable enhanced speech recognition
        language: 'en-US', // Specify language for better accuracy
        profanityFilter: false, // Don't filter speech for better accuracy
        // Removed partialResultCallback to prevent premature processing
      });
      
      gather.say({ voice: 'Polly.Joanna', bargein: true }, 'I didn\'t catch that. Could you please speak clearly and repeat your question?');
      
      twiml.say({ voice: 'Polly.Joanna' }, 'I\'m having trouble hearing you. Please try calling again. Goodbye!');
      twiml.hangup();
      return twiml.toString();
    }

    // INPUT VALIDATION: Check for unclear or incomplete speech
    const isUnclearSpeech = (speech) => {
      const cleanSpeech = speech.toLowerCase().trim();
      
      // Check for very short or fragmented input
      if (cleanSpeech.length < 3) return true;
      
      // Check for incomplete questions or statements
      const incompletePatterns = [
        /^(what|how|when|where|why|who)\s*\?*$/i, // Single question words
        /^(it|that|this)\s*\.?\s*$/i, // Incomplete pronouns
        /^(the|a|an)\s*$/i, // Articles only
        /^(is|are|was|were|do|does|did)\s*\?*$/i, // Incomplete verbs
        /\s+(is|are|was|were|the)\s*\?*$/i, // Ending with incomplete words
      ];
      
      return incompletePatterns.some(pattern => pattern.test(cleanSpeech));
    };

    // Check if speech seems unclear or incomplete
    if (isUnclearSpeech(userSpeech)) {
      console.log(`Detected unclear speech: "${userSpeech}" - asking for clarification`);
      
      const gather = twiml.gather({
        input: 'speech',
        action: `${process.env.SERVER_URL || 'http://localhost:3000'}/api/twilio/voice/process?agentId=${agentId}`,
        speechTimeout: 8, // Increased to 8 seconds to wait for complete thoughts
        speechModel: 'phone_call',
        timeout: 60, // Increased total timeout to 60 seconds for longer responses
        finishOnKey: '#',
        enhanced: true,
        language: 'en-US',
        profanityFilter: false,
        // Removed partialResultCallback to prevent premature processing
      });
      
      const clarificationMessages = [
        'I heard you say something, but it wasn\'t clear. Could you please repeat your complete question?',
        'It sounds like your question was cut off. Please speak your full question clearly.',
        'I only caught part of what you said. Could you please rephrase your question completely?'
      ];
      
      const randomMessage = clarificationMessages[Math.floor(Math.random() * clarificationMessages.length)];
      gather.say({ voice: 'Polly.Joanna', bargein: true }, randomMessage);
      
      twiml.say({ voice: 'Polly.Joanna' }, 'Thank you for calling. Have a great day!');
      twiml.hangup();
      return twiml.toString();
    }

    // OPTIMIZATION: Check cache first, then generate AI response using FULL agent processing
    let agentResponse = 'I understand. How else can I help you?';
    let functionCalls = [];
    
    try {
      // Import AI service and cache service - use SAME processing as chatbot
      const { processMessage } = await import('./aiService.js'); // Use processMessage instead of generateResponse
      const { executeFunction } = await import('./functionExecutor.js'); // Add function execution support
      const cacheService = (await import('./cacheService.js')).default;
      
      // OPTIMIZATION: Check cache first - use SAME system prompt as chatbot
      const systemPrompt = buildSystemPrompt(agent);
      const cachedResponse = cacheService.get(userSpeech, agentId, systemPrompt);
      
      if (cachedResponse) {
        agentResponse = cachedResponse;
        console.log(`Using cached response (${Date.now() - startTime}ms): "${agentResponse}"`);
      } else {
        // Use SAME AI processing as chatbot - full agent configuration
        // TODO: Implement proper conversation history storage for voice calls
        // For now, use a simple in-memory conversation history per call
        let conversationHistory = activeCalls.get(agentId)?.conversationHistory || [];
        
        // Process message with FULL agent context (same as chatbot)
        const aiResponse = await processMessage(agent, userSpeech, conversationHistory);
        
        let finalMessage = aiResponse.message;
        
        // Handle function calls (same as chatbot)
        if (aiResponse.functionCall) {
          try {
            console.log('🔧 Voice agent executing function:', aiResponse.functionCall.name);
            
            const functionResult = await executeFunction(
              agent,
              aiResponse.functionCall.name,
              aiResponse.functionCall.parameters
            );
            
            functionCalls.push(aiResponse.functionCall.name);
            console.log('✅ Voice function executed successfully:', functionResult);
            
            // Get AI response with function result (same as chatbot)
            const functionContext = `The function "${aiResponse.functionCall.name}" was executed successfully. Here are the results:\n${JSON.stringify(functionResult, null, 2)}\n\nPlease provide a natural, brief response to the user based on these results. Keep it conversational for voice calls.`;
            
            const finalResponse = await processMessage(
              agent,
              functionContext,
              [...conversationHistory, { role: 'user', content: userSpeech }]
            );
            
            finalMessage = finalResponse.message;
            
          } catch (error) {
            console.error('❌ Voice function execution error:', error);
            finalMessage = `I tried to execute the ${aiResponse.functionCall.name} function, but encountered an error. How else can I help you?`;
          }
        }
        
        agentResponse = finalMessage;
        
        // Update conversation history for this call
        conversationHistory.push(
          { role: 'user', content: userSpeech },
          { role: 'assistant', content: agentResponse }
        );
        
        // Store updated conversation history
        if (!activeCalls.has(agentId)) {
          activeCalls.set(agentId, {});
        }
        activeCalls.get(agentId).conversationHistory = conversationHistory;
        
        // Cache the response for future use - use SAME system prompt as chatbot
        cacheService.set(userSpeech, agentId, systemPrompt, agentResponse);
        
        console.log(`Generated new response (${Date.now() - startTime}ms): "${agentResponse}"`);
      }
    } catch (error) {
      console.error('Error generating agent response:', error);
      agentResponse = 'I apologize, but I\'m having trouble processing your request right now. Is there anything else I can help you with?';
    }

    // Create gather for continued conversation with optimized speech recognition
    const gather = twiml.gather({
      input: 'speech',
      action: `${process.env.SERVER_URL || 'http://localhost:3000'}/api/twilio/voice/process?agentId=${agentId}`,
      speechTimeout: 8, // Increased to 8 seconds to wait for complete thoughts
      speechModel: 'phone_call', // Better model for phone conversations
      timeout: 60, // Increased total timeout to 60 seconds for longer responses
      finishOnKey: '#',
      enhanced: true, // Enable enhanced speech recognition
      language: 'en-US', // Specify language for better accuracy
      profanityFilter: false, // Don't filter speech for better accuracy
      // Removed partialResultCallback to prevent premature processing
    });

    // OPTIMIZATION: Always use ElevenLabs for best voice quality with BARGE-IN support
    try {
      const voiceSettings = agent.voiceSettings || {};
      
      // Always use ElevenLabs for better voice quality (no more Twilio TTS)
      const audioUrl = await generateSpeech(agentResponse, {
        voiceId: voiceSettings.voiceId || 'default',
        stability: voiceSettings.stability || 0.5,
        similarityBoost: voiceSettings.similarityBoost || 0.75,
        speed: voiceSettings.speed || 1.3 // Faster speech for quicker responses
      });

      // Check if audioUrl is a data URL (which Twilio can't play)
      if (audioUrl && !audioUrl.startsWith('data:')) {
        // Play the response within gather with BARGE-IN enabled (only if it's a real URL)
        gather.play({ bargein: true }, audioUrl);
        console.log(`Used ElevenLabs direct URL with barge-in (${Date.now() - startTime}ms)`);
      } else if (audioUrl && audioUrl.startsWith('data:')) {
        // Use our audio endpoint to serve the ElevenLabs audio with BARGE-IN
        const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
        const encodedText = encodeURIComponent(agentResponse);
        const audioEndpoint = `${serverUrl}/api/audio/tts?text=${encodedText}&voiceId=${voiceSettings.voiceId || 'default'}&stability=${voiceSettings.stability || 0.5}&similarityBoost=${voiceSettings.similarityBoost || 0.75}&speed=${voiceSettings.speed || 1.3}`;
        
        // Use Twilio's <Play> with our audio endpoint and BARGE-IN enabled
        gather.play({ bargein: true }, audioEndpoint);
        console.log(`Used ElevenLabs via audio endpoint with barge-in (${Date.now() - startTime}ms)`);
      } else {
        // Fallback to Twilio TTS only if ElevenLabs completely fails - with BARGE-IN
        console.warn('ElevenLabs returned no audio, using Twilio TTS as last resort');
        gather.say({ voice: 'Polly.Joanna', bargein: true }, agentResponse);
      }
    } catch (error) {
      console.warn('Error in audio generation, using Twilio TTS:', error.message);
      // Fallback to Twilio's TTS within gather with BARGE-IN enabled
      gather.say({ voice: 'Polly.Joanna', bargein: true }, agentResponse);
    }

    // Add fallback for no input
    twiml.say({ voice: 'Polly.Joanna' }, 'Thank you for calling. Have a great day!');
    twiml.hangup();

    const totalTime = Date.now() - startTime;
    console.log(`Total response time: ${totalTime}ms`);
    
    return twiml.toString();
  } catch (error) {
    console.error('Error in processUserSpeech:', error);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    twiml.say({ voice: 'Polly.Joanna' }, 'I apologize, but I\'m experiencing technical difficulties. Please try calling again later. Goodbye!');
    twiml.hangup();
    return twiml.toString();
  }
}

export default {
  initiateCall,
  handleVoiceWebhook,
  processVoiceInput,
  endCall,
  processUserSpeech
};





