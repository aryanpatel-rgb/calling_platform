import express from 'express';
import { generateSpeech } from '../services/elevenLabsService.js';

const router = express.Router();

// Serve audio files for Twilio (GET endpoint for compatibility)
router.get('/tts', async (req, res) => {
  try {
    const { text, voiceId, stability, similarityBoost, speed } = req.query;
    
    if (!text) {
      return res.status(400).json({ error: 'Text parameter is required' });
    }

    // Generate speech using ElevenLabs
    const audioUrl = await generateSpeech(text, {
      voiceId: voiceId || 'default',
      stability: parseFloat(stability) || 0.5,
      similarityBoost: parseFloat(similarityBoost) || 0.75,
      speed: parseFloat(speed) || 1.0
    });

    if (!audioUrl) {
      return res.status(503).json({ error: 'TTS service unavailable' });
    }

    // If it's a data URL, convert to audio stream
    if (audioUrl.startsWith('data:audio/mpeg;base64,')) {
      const base64Data = audioUrl.replace('data:audio/mpeg;base64,', '');
      const audioBuffer = Buffer.from(base64Data, 'base64');
      
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      });
      
      return res.send(audioBuffer);
    }

    // If it's already a URL, redirect
    res.redirect(audioUrl);
  } catch (error) {
    console.error('Audio TTS error:', error);
    res.status(500).json({ error: 'Failed to generate audio' });
  }
});

// POST endpoint for more complex requests
router.post('/tts', async (req, res) => {
  try {
    const { text, voiceSettings = {} } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Generate speech using ElevenLabs
    const audioUrl = await generateSpeech(text, {
      voiceId: voiceSettings.voiceId || 'default',
      stability: voiceSettings.stability || 0.5,
      similarityBoost: voiceSettings.similarityBoost || 0.75,
      speed: voiceSettings.speed || 1.0
    });

    if (!audioUrl) {
      return res.status(503).json({ error: 'TTS service unavailable' });
    }

    // If it's a data URL, convert to audio stream
    if (audioUrl.startsWith('data:audio/mpeg;base64,')) {
      const base64Data = audioUrl.replace('data:audio/mpeg;base64,', '');
      const audioBuffer = Buffer.from(base64Data, 'base64');
      
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      });
      
      return res.send(audioBuffer);
    }

    // If it's already a URL, redirect
    res.redirect(audioUrl);
  } catch (error) {
    console.error('Audio TTS error:', error);
    res.status(500).json({ error: 'Failed to generate audio' });
  }
});

export default router;