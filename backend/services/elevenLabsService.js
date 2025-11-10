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
 * Generate speech using ElevenLabs and return base64 audio/mpeg.
 * Options: { voiceId, stability, similarityBoost, speed }
 */
export async function generateSpeech(text, options = {}) {
  try {
    let requested = options.voiceId || '21m00Tcm4TlvDq8ikWAM';
    // Support either alias (rachel, adam, etc.) or a raw ElevenLabs voice ID
    const voiceId = VOICE_IDS[requested] || requested || '21m00Tcm4TlvDq8ikWAM';

    const payload = {
      text,
      voice_settings: {
        stability: typeof options.stability === 'number' ? options.stability : 0.5,
        similarity_boost: typeof options.similarityBoost === 'number' ? options.similarityBoost : 0.75,
        style: 0,
        use_speaker_boost: true
      },
      // ElevenLabs speed setting may be in the model params or prosody; basic payload covers defaults
    };

    if (!ELEVENLABS_API_KEY) {
      // No API key; return empty audio
      return '';
    }

    const response = await axios({
      method: 'POST',
      url: `${ELEVENLABS_API_BASE}/text-to-speech/${voiceId}/stream`,
      responseType: 'arraybuffer',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      data: payload
    });

    const audioBuffer = Buffer.from(response.data);
    return audioBuffer.toString('base64');
  } catch (error) {
    console.error('Generate speech error:', error.message || error);
    return '';
  }
}

export default {
  generateSpeech
};

