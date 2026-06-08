// Vercel serverless function — Speech-to-Text for voice search.
//
// The app records a short audio clip, base64-encodes it, and POSTs it here.
// We forward it to Groq's free Whisper endpoint and return the transcribed text.
// The GROQ_API_KEY lives only on the server (Vercel env var) — never in the app.
//
// Body (JSON): { audioBase64: string, mimeType?: string, language?: string, prompt?: string }
// Response:    { text: string }

// Bias Whisper toward Qur'an surah-name spellings, and (with language='en') keep
// output in Latin script so it matches our Latin, fuzzy reference resolver — instead
// of coming back in Arabic/Urdu/Hindi script, which the resolver can't read.
const DEFAULT_PROMPT =
  'The user is asking to open a chapter (surah) or verse of the Quran. Likely names include ' +
  'Al-Fatiha, Al-Baqarah, Aal-e-Imran, An-Nisa, Al-Maidah, Yusuf, Maryam, Ya-Sin, Ar-Rahman, ' +
  'Al-Waqiah, Al-Mulk, Al-Kahf, Al-Ikhlas, Al-Falaq, An-Nas, and Ayat al-Kursi.';

const { rateLimited } = require('./_ratelimit');

module.exports = async (req, res) => {
  // The request comes from the device (Expo Go), so allow cross-origin.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (rateLimited(req, 40)) return res.status(429).json({ error: 'Too many requests — please slow down a moment.' });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Server is missing GROQ_API_KEY' });

  try {
    const { audioBase64, mimeType, language, prompt } = req.body || {};
    if (!audioBase64) return res.status(400).json({ error: 'audioBase64 is required' });

    const bytes = Buffer.from(audioBase64, 'base64');
    const type = mimeType || 'audio/m4a';
    const ext = type.includes('wav') ? 'wav' : type.includes('mp3') ? 'mp3' : 'm4a';

    // OpenAI-compatible multipart form for Groq's transcription endpoint.
    const form = new FormData();
    form.append('file', new Blob([bytes], { type }), `audio.${ext}`);
    form.append('model', 'whisper-large-v3-turbo');
    form.append('response_format', 'json');
    form.append('temperature', '0');
    form.append('language', language || 'en'); // force Latin-script output for our resolver
    form.append('prompt', prompt || DEFAULT_PROMPT); // bias toward correct surah-name spellings

    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: 'Transcription failed', detail });
    }

    const data = await r.json();
    return res.status(200).json({ text: (data.text || '').trim() });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
