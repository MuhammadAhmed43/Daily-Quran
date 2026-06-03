// Runtime text-to-speech for the voice assistant, generated on demand.
//   GET  /api/speak?text=...             ->  audio/mpeg
//   POST /api/speak {text, marks:true}   ->  JSON { audio(base64), marks[], spoken, dur }
// The `marks` form returns per-word timestamps so the app can switch caption cards exactly as
// each word is spoken (true sync, not an estimate).
// msedge-tts (Microsoft Edge neural) is keyless and unlimited; loaded via dynamic import
// because it's an ES module and these functions are CommonJS.

// Andrew is one of Edge's newest "conversational" neural voices — warm and natural, without
// the robotic, pitched-down feel of the older voices. Near-natural pace, no pitch shift.
const VOICE = 'en-US-AndrewNeural';
const RATE = '-4%';
const PITCH = '+0Hz';

function clean(s) {
  return String(s)
    .replace(/aḥsan al-qaṣaṣ\s*[—–-]\s*/gu, '')
    .replace(/ṣabrun jamīl,?\s*/gu, '')
    .replace(/Qur['’]an/gu, 'Quran')
    .replace(/[ʿʾ]/gu, '')
    .replace(/[‘’]/gu, "'")
    // drop the numeric ayah ref in parens, e.g. "(2:22)" — the surah name + "verse N" is already
    // spoken, so we don't want the voice reading out "two colon twenty-two".
    .replace(/\s*\(\d{1,3}:\d{1,3}(?:\s*[-–]\s*\d{1,3})?\)/gu, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/[*_#>`]/gu, '')
    .replace(/\s*[—–]\s*/gu, ', ')
    .replace(/\s{2,}/gu, ' ')
    .trim();
}

// Synthesise `text`, returning the MP3 buffer plus per-word timestamps (`marks`, offsets in ms)
// and a total duration. Word boundaries come from Edge's metadata stream, so caption cards can be
// switched the instant each word is spoken instead of being paced off a guessed speaking rate.
async function synth(text) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
        wordBoundaryEnabled: true,
      });
      const { audioStream, metadataStream } = tts.toStream(text, { rate: RATE, pitch: PITCH });
      const chunks = [];
      const marks = [];
      let durMs = 0;
      audioStream.on('data', (c) => chunks.push(c));
      if (metadataStream) {
        metadataStream.on('data', (c) => {
          try {
            const obj = JSON.parse(c.toString());
            for (const m of obj.Metadata || []) {
              if (m && m.Type === 'WordBoundary' && m.Data) {
                const off = Number(m.Data.Offset) || 0; // 100-ns ticks
                const dur = Number(m.Data.Duration) || 0;
                const w = (m.Data.text && m.Data.text.Text) || '';
                marks.push({ t: Math.round(off / 10000), w });
                const end = Math.round((off + dur) / 10000);
                if (end > durMs) durMs = end;
              }
            }
          } catch {}
        });
      }
      await Promise.all([
        new Promise((resolve, reject) => {
          audioStream.on('end', resolve);
          audioStream.on('error', reject);
        }),
        // the metadata stream can trail the audio slightly; wait for it, but never hang
        metadataStream
          ? Promise.race([
              new Promise((resolve) => {
                metadataStream.on('end', resolve);
                metadataStream.on('close', resolve);
                metadataStream.on('error', () => resolve());
              }),
              new Promise((resolve) => setTimeout(resolve, 8000)),
            ])
          : Promise.resolve(),
      ]);
      try {
        tts.close();
      } catch {}
      const buf = Buffer.concat(chunks);
      if (buf.length < 1000) throw new Error('empty audio');
      // CBR 48 kbit/s ≈ 6000 bytes/sec — a fallback total if no word marks came back at all.
      if (!durMs) durMs = Math.round((buf.length / 6000) * 1000);
      return { buf, marks, durMs };
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 700 * attempt));
    }
  }
  throw lastErr;
}

// Stream the synthesized mp3 chunk-by-chunk to `res`, so the client can begin playback almost
// immediately instead of waiting for the whole clip. Content-Type is set on the first chunk, so a
// total failure (no audio at all) can still fall back to the buffered path.
async function streamSynth(text, res) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text, { rate: RATE, pitch: PITCH });
  await new Promise((resolve, reject) => {
    let started = false;
    audioStream.on('data', (c) => {
      if (!started) {
        started = true;
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
      }
      res.write(c);
    });
    audioStream.on('end', () => (started ? resolve() : reject(new Error('empty audio'))));
    audioStream.on('error', reject);
  });
  try {
    tts.close();
  } catch {}
  res.end();
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const body = req.method === 'POST' ? req.body || {} : {};
  const raw = req.method === 'POST' ? body.text : req.query.text;
  const wantMarks =
    req.method === 'POST' ? !!body.marks : req.query.marks === '1' || req.query.marks === 'true';
  const text = clean(String(raw || '').slice(0, 1500));
  if (!text) return res.status(400).json({ error: 'text is required' });

  // Audio route (no marks): STREAM the mp3 as it's synthesized so playback can start right away.
  // If the stream can't even begin, fall back to the buffered synth (which retries on transient
  // msedge resets); the client ultimately falls back to on-device speech.
  if (!wantMarks) {
    try {
      await streamSynth(text, res);
    } catch (e) {
      if (!res.headersSent) {
        try {
          const { buf } = await synth(text);
          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('Cache-Control', 'no-store');
          return res.status(200).send(buf);
        } catch (e2) {
          return res.status(502).json({ error: String((e2 && e2.message) || e2) });
        }
      }
      try {
        res.end();
      } catch {}
    }
    return;
  }

  // Marks route: needs the whole buffer + word timestamps, so it stays buffered (JSON).
  try {
    const { buf, marks, durMs } = await synth(text);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ audio: buf.toString('base64'), marks, spoken: text, dur: durMs });
  } catch (e) {
    return res.status(502).json({ error: String((e && e.message) || e) });
  }
};
