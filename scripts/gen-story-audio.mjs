// Generate narrator audio for the Yusuf storyboard via Microsoft Edge neural TTS
// (msedge-tts) — the same engine as Edge's "Read Aloud". Free, keyless, no quota,
// and far more natural than basic TTS. Deep male voice, slightly slowed for gravitas.
//
// Build-time tool (not an app/Vercel dependency) — install first: npm i msedge-tts
//   node scripts/gen-story-audio.mjs              # all panels
//   node scripts/gen-story-audio.mjs 1            # just panel 1
//   $env:TTS_VOICE='en-GB-RyanNeural'; node scripts/gen-story-audio.mjs   # try another voice
//
// Good deep narrators: en-US-ChristopherNeural, en-GB-RyanNeural, en-US-GuyNeural,
// en-US-EricNeural, en-US-SteffanNeural (narration-tuned).
// Output: mobile/assets/stories/yusuf-audio/pNN.mp3 (third-person narrator; never a prophet's voice).

import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STORY = JSON.parse(
  readFileSync(join(HERE, '..', 'mobile', 'assets', 'stories', 'yusuf.json'), 'utf8'),
);
const OUT = join(HERE, '..', 'mobile', 'assets', 'stories', 'yusuf-audio');

const VOICE = process.env.TTS_VOICE || 'en-US-ChristopherNeural';
const RATE = process.env.TTS_RATE || '-8%'; // a touch slower than default = measured narrator
const PITCH = process.env.TTS_PITCH || '-4%'; // a touch darker/older than natural (chosen via A/B)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// TTS reads plain ASCII best. Transliteration diacritics (ṣ ī ḥ ā), the ʿ/ʾ letters,
// and em-dashes make voices stutter or pause in the wrong place. Strip them, drop the
// two Arabic phrases (their English meaning sits right beside them), and turn dashes
// into commas so the narrator breathes naturally. The on-screen text is untouched.
function ttsClean(s) {
  return s
    .replace(/aḥsan al-qaṣaṣ\s*[—–-]\s*/gu, '') // "aḥsan al-qaṣaṣ — "
    .replace(/ṣabrun jamīl,?\s*/gu, '') // "ṣabrun jamīl, "
    .replace(/Qur['’]an/gu, 'Quran')
    .replace(/[ʿʾ]/gu, '') // ʿ ʾ (ayn / hamza)
    .replace(/[‘’]/gu, "'") // curly quotes -> straight
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '') // strip remaining combining diacritics
    .replace(/\s*[—–]\s*/gu, ', ') // dashes -> comma pauses
    .replace(/\s{2,}/gu, ' ')
    .trim();
}

async function synthOnce(text, file) {
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
  writeFileSync(file, buf);
  return buf.length;
}

// The Edge endpoint resets rapid back-to-back connections — retry with backoff.
async function synth(text, file) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await synthOnce(text, file);
    } catch (e) {
      lastErr = e;
      await sleep(1200 * attempt);
    }
  }
  throw lastErr;
}

const only = process.argv.slice(2).map(Number).filter(Boolean);
const panels = STORY.panels.filter((p) => (only.length ? only.includes(p.n) : true));

mkdirSync(OUT, { recursive: true });
console.log(`Voice: ${VOICE} | rate ${RATE} | ${panels.length} clip(s) -> ${OUT}\n`);

let ok = 0;
for (const p of panels) {
  try {
    const bytes = await synth(ttsClean(p.narration), join(OUT, `p${String(p.n).padStart(2, '0')}.mp3`));
    ok++;
    console.log(`[p${String(p.n).padStart(2, '0')}] OK  ${Math.round(bytes / 1024)} KB`);
  } catch (e) {
    console.log(`[p${String(p.n).padStart(2, '0')}] FAIL  ${e.message}`);
  }
  await sleep(2200);
}
console.log(`\nDone: ${ok}/${panels.length}`);
