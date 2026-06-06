// Generalized narrator-audio generator for ANY Story via Microsoft Edge neural TTS
// (msedge-tts) — free, keyless, no quota. Deep male voice, slightly slowed for gravitas.
// Build-time tool — install first: npm i msedge-tts
//   node scripts/gen-stories-audio.mjs nuh           # all panels
//   node scripts/gen-stories-audio.mjs nuh 1 5       # only panels 1 and 5
// Output: mobile/assets/stories/<id>-audio/pNN.mp3 (third-person narrator; never a prophet's voice).
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const id = process.argv[2];
if (!id) {
  console.error('usage: node scripts/gen-stories-audio.mjs <story-id> [panel...]');
  process.exit(1);
}
const STORY = JSON.parse(readFileSync(join(HERE, '..', 'mobile', 'assets', 'stories', `${id}.json`), 'utf8'));
const OUT = join(HERE, '..', 'mobile', 'assets', 'stories', `${id}-audio`);

const VOICE = process.env.TTS_VOICE || 'en-US-ChristopherNeural';
const RATE = process.env.TTS_RATE || '-8%';
const PITCH = process.env.TTS_PITCH || '-4%';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// TTS reads plain ASCII best. Strip transliteration diacritics (ṣ ī ḥ ā), the ʿ/ʾ letters,
// any Arabic-script run (the on-screen verse carries the Arabic — the narrator reads English),
// straighten curly quotes, and turn dashes into comma pauses so the voice breathes naturally.
function ttsClean(s) {
  return s
    .replace(/Qur['’]an/gu, 'Quran')
    .replace(/[ʿʾ]/gu, '')
    .replace(/[‘’]/gu, "'")
    .replace(/[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]+/gu, '') // Arabic script
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '') // remaining combining diacritics
    .replace(/\s*[—–]\s*/gu, ', ')
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

const only = process.argv.slice(3).map(Number).filter(Boolean);
const panels = STORY.panels.filter((p) => (only.length ? only.includes(p.n) : true));
mkdirSync(OUT, { recursive: true });
console.log(`[${id}] voice ${VOICE} | rate ${RATE} | ${panels.length} clip(s) -> ${OUT}\n`);

let ok = 0;
for (const p of panels) {
  try {
    const bytes = await synth(ttsClean(p.narration), join(OUT, `p${String(p.n).padStart(2, '0')}.mp3`));
    ok++;
    console.log(`[${id} p${String(p.n).padStart(2, '0')}] OK  ${Math.round(bytes / 1024)} KB`);
  } catch (e) {
    console.log(`[${id} p${String(p.n).padStart(2, '0')}] FAIL  ${e.message}`);
  }
  await sleep(2200);
}
console.log(`\n[${id}] done: ${ok}/${panels.length}`);
