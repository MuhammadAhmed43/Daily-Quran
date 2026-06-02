// Runtime text-to-speech for the voice assistant — the deep "Christopher" neural voice
// (the same one the storyboard narration uses), generated on demand.
//   GET /api/speak?text=...   ->   audio/mpeg
// msedge-tts (Microsoft Edge neural) is keyless and unlimited; loaded via dynamic import
// because it's an ES module and these functions are CommonJS.

const VOICE = 'en-US-ChristopherNeural';
const RATE = '-8%'; // slow, measured (matches the narration)
const PITCH = '-4%';

function clean(s) {
  return String(s)
    .replace(/aḥsan al-qaṣaṣ\s*[—–-]\s*/gu, '')
    .replace(/ṣabrun jamīl,?\s*/gu, '')
    .replace(/Qur['’]an/gu, 'Quran')
    .replace(/[ʿʾ]/gu, '')
    .replace(/[‘’]/gu, "'")
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/[*_#>`]/gu, '')
    .replace(/\s*[—–]\s*/gu, ', ')
    .replace(/\s{2,}/gu, ' ')
    .trim();
}

async function synth(text) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(text, { rate: RATE, pitch: PITCH });
      const chunks = [];
      await new Promise((resolve, reject) => {
        audioStream.on('data', (c) => chunks.push(c));
        audioStream.on('end', resolve);
        audioStream.on('error', reject);
      });
      try {
        tts.close();
      } catch {}
      const buf = Buffer.concat(chunks);
      if (buf.length < 1000) throw new Error('empty audio');
      return buf;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 700 * attempt));
    }
  }
  throw lastErr;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const raw = req.method === 'POST' ? (req.body || {}).text : req.query.text;
  const text = clean(String(raw || '').slice(0, 1500));
  if (!text) return res.status(400).json({ error: 'text is required' });

  try {
    const buf = await synth(text);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(502).json({ error: String((e && e.message) || e) });
  }
};
