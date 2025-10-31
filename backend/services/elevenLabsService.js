import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

// Voice ID mapping
const VOICE_IDS = {
  'default': '21m00Tcm4TlvDq8ikWAM', // Rachel
  'rachel': '21m00Tcm4TlvDq8ikWAM',
  'adam': 'pNInz6obpgDQGcFmaJgB',
  'emily': 'LcfcDJNUP1GQjkzn1xUU',
  'daniel': 'onwK4e9ZLuTAKqWW03F9',
  'bella': 'EXAVITQu4vr4xnSDxMaL'
};

/**
 * Generate speech from text using ElevenLabs
 */
export async function generateSpeech(text, options = {}) {
  try {
    if (!ELEVENLABS_API_KEY) {
      console.warn('ElevenLabs API key not configured');
      return null;
    }

    const {
      voiceId = 'default',
      stability = 0.4, // Lower stability for faster generation
      similarityBoost = 0.7, // Slightly lower for speed
      speed = 1.3 // Faster speech
    } = options;

    const actualVoiceId = VOICE_IDS[voiceId] || VOICE_IDS['default'];
    
    console.log(`Generating speech with ElevenLabs for: "${text.substring(0, 50)}..."`);
    const startTime = Date.now();

    const response = await axios.post(
      `${ELEVENLABS_API_BASE}/text-to-speech/${actualVoiceId}`,
      {
        text: text,
        model_id: 'eleven_turbo_v2', // Use faster turbo model
        voice_settings: {
          stability: stability,
          similarity_boost: similarityBoost,
          speed: speed,
          use_speaker_boost: false // Disable for faster processing
        },
        output_format: 'mp3_22050_32' // Lower quality for faster generation
      },
      {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        responseType: 'arraybuffer',
        timeout: 10000 // 10 second timeout
      }
    );

    const generationTime = Date.now() - startTime;
    console.log(`ElevenLabs generation completed in ${generationTime}ms`);

    // In production, save to S3 or similar and return URL
    // For now, we'll return a base64 encoded data URL
    const audioBase64 = Buffer.from(response.data).toString('base64');
    const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;

    return audioUrl;
  } catch (error) {
    console.error('ElevenLabs TTS error:', error.response?.data || error.message);
    throw new Error(`Failed to generate speech: ${error.message}`);
  }
}

/**
 * Get available voices
 */
export async function getVoices() {
  try {
    if (!ELEVENLABS_API_KEY) {
      return Object.keys(VOICE_IDS).map(key => ({
        id: key,
        name: key.charAt(0).toUpperCase() + key.slice(1)
      }));
    }

    const response = await axios.get(`${ELEVENLABS_API_BASE}/voices`, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });

    return response.data.voices;
  } catch (error) {
    console.error('Get voices error:', error);
    return Object.keys(VOICE_IDS).map(key => ({
      id: key,
      name: key.charAt(0).toUpperCase() + key.slice(1)
    }));
  }
}

export default {
  generateSpeech,
  getVoices
};

