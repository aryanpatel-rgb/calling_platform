import express from 'express';
import twilio from 'twilio';
import * as agentRepo from '../db/repositories/agentRepository.js';
import { initiateCall, handleVoiceWebhook, endCall, processUserSpeech } from '../services/twilioService.js';

const router = express.Router();

// Validate Twilio credentials
router.post('/validate', async (req, res) => {
  try {
    const { accountSid, authToken, phoneNumber } = req.body;

    if (!accountSid || !authToken || !phoneNumber) {
      return res.status(400).json({
        valid: false,
        error: 'Missing required credentials'
      });
    }

    // Validate credentials by fetching account info
    const client = twilio(accountSid, authToken);
    
    try {
      await client.api.accounts(accountSid).fetch();
      
      // Validate phone number format
      if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
        return res.json({
          valid: false,
          error: 'Invalid phone number format. Use E.164 format (+1234567890)'
        });
      }

      res.json({
        valid: true,
        message: 'Credentials validated successfully'
      });
    } catch (error) {
      res.json({
        valid: false,
        error: 'Invalid Twilio credentials'
      });
    }
  } catch (error) {
    res.status(500).json({
      valid: false,
      error: error.message
    });
  }
});

// Initiate test call
router.post('/agents/:id/call', async (req, res) => {
  try {
    const agent = await agentRepo.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: true, message: 'Agent not found' });
    }

    if (agent.type !== 'voice_call') {
      return res.status(400).json({ error: true, message: 'Agent is not a voice call agent' });
    }

    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: true, message: 'Phone number is required' });
    }

    if (!agent.twilioConfig || !agent.twilioConfig.accountSid) {
      return res.status(400).json({ error: true, message: 'Twilio not configured for this agent' });
    }

    const callSid = await initiateCall(agent, phoneNumber);

    res.json({
      success: true,
      callSid,
      message: 'Call initiated successfully'
    });
  } catch (error) {
    console.error('Call initiation error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

// End call
router.post('/agents/:id/call/end', async (req, res) => {
  try {
    const agent = await agentRepo.getAgentById(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: true, message: 'Agent not found' });
    }

    await endCall(agent);

    res.json({
      success: true,
      message: 'Call ended successfully'
    });
  } catch (error) {
    console.error('End call error:', error);
    res.status(500).json({ error: true, message: error.message });
  }
});

// Twilio voice webhook
router.post('/voice/webhook', async (req, res) => {
  try {
    const twiml = await handleVoiceWebhook(req.body, req.query);
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('Voice webhook error:', error);
    res.status(500).send('Error processing call');
  }
});

// Handle user speech input and generate agent response
router.post('/voice/process', async (req, res) => {
  try {
    const twiml = await processUserSpeech(req.body, req.query);
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('Voice process error:', error);
    res.status(500).send('Error processing speech');
  }
});

// Handle partial speech recognition results for real-time feedback
router.post('/voice/partial', async (req, res) => {
  try {
    const { agentId } = req.query;
    const { UnstableSpeechResult, Confidence } = req.body;
    
    // Log partial results for debugging (optional)
    if (UnstableSpeechResult && UnstableSpeechResult.trim() !== '') {
      console.log(`Partial speech for agent ${agentId}: "${UnstableSpeechResult}" (confidence: ${Confidence})`);
    }
    
    // Return empty TwiML to continue listening
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Partial speech error:', error);
    res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
});

export default router;

