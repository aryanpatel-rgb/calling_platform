import dotenv from 'dotenv';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

dotenv.config();

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';

// Deepgram STT live transcription service using v3 SDK
// Streams PCM16 or mulaw audio to Deepgram and emits transcript events quickly.
export async function startDeepgramSession({ source = 'browser', onTranscript }) {
  if (!DEEPGRAM_API_KEY) {
    return {
      writeTwilioBase64: () => {},
      writePcm16Base64: () => {},
      end: () => {}
    };
  }

  const dg = createClient(DEEPGRAM_API_KEY);

  const encoding = source === 'twilio' ? 'mulaw' : 'linear16';
  const sampleRate = source === 'twilio' ? 8000 : 16000;

  const live = dg.listen.live({
    model: 'nova-2',
    encoding,
    sample_rate: sampleRate,
    smart_format: false,
    punctuate: false,
    interim_results: true
  });

  live.on(LiveTranscriptionEvents.Open, () => {
    try { console.log('Deepgram live connection established'); } catch {}
  });

  live.on(LiveTranscriptionEvents.Transcript, (data) => {
    try {
      const isFinal = !!data?.is_final;
      const alt = data?.channel?.alternatives?.[0];
      const text = alt?.transcript || '';
      if (text && onTranscript) onTranscript(text, isFinal);
    } catch (e) {
      console.error('Transcript parsing error:', e);
    }
  });

  live.on(LiveTranscriptionEvents.Error, (err) => {
    console.error('Deepgram error:', err);
  });

  live.on(LiveTranscriptionEvents.Close, () => {
    try { console.log('Deepgram live connection closed'); } catch {}
  });

  return {
    writeTwilioBase64: (base64) => {
      try {
        const buf = Buffer.from(base64, 'base64');
        live.send(buf);
      } catch (e) {
        console.error('Error sending Twilio audio:', e);
      }
    },
    writePcm16Base64: (base64) => {
      try {
        const buf = Buffer.from(base64, 'base64');
        live.send(buf);
      } catch (e) {
        console.error('Error sending PCM16 audio:', e);
      }
    },
    end: () => {
      try { live.finish(); } catch {}
    }
  };
}

export default { startDeepgramSession };