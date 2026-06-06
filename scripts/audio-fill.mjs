// Fill in ONLY the missing narration clips across all new stories, SEQUENTIALLY and gently
// (one Edge connection at a time, extra retries) — recovers from a flaky parallel run where
// the Edge endpoint reset some connections. Safe to re-run; it skips clips that already exist.
//   node scripts/audio-fill.mjs
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, '..', 'mobile', 'assets', 'stories');
const IDS = ['nuh', 'ibrahim', 'musa', 'adam', 'maryam', 'sulayman', 'yunus', 'kahf', 'ayyub'];

const VOICE = process.env.TTS_VOICE || 'en-US-ChristopherNeural';
const RATE = process.env.TTS_RATE || '-8%';
const PITCH = process.env.TTS_PITCH || '-4%';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ttsClean(s) {
  return s
    .replace(/Qur['’]an/gu, 'Quran')
    .replace(/[ʿʾ]/gu, '')
    .replace(/[‘’]/gu, "'")
    .replace(/[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]+/gu, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
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

async function synth(text, file) {
  let lastErr;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      return await synthOnce(text, file);
    } catch (e) {
      lastErr = e;
      await sleep(1500 * attempt);
    }
  }
  throw lastErr;
}

let ok = 0;
let miss = 0;
for (const id of IDS) {
  const story = JSON.parse(readFileSync(join(DIR, `${id}.json`), 'utf8'));
  const out = join(DIR, `${id}-audio`);
  mkdirSync(out, { recursive: true });
  for (const p of story.panels) {
    const file = join(out, `p${String(p.n).padStart(2, '0')}.mp3`);
    if (existsSync(file)) continue;
    miss++;
    try {
      const bytes = await synth(ttsClean(p.narration), file);
      ok++;
      console.log(`[${id} p${String(p.n).padStart(2, '0')}] OK  ${Math.round(bytes / 1024)} KB`);
    } catch (e) {
      console.log(`[${id} p${String(p.n).padStart(2, '0')}] FAIL  ${e.message}`);
    }
    await sleep(2500);
  }
}
console.log(`\nfilled ${ok}/${miss} missing clips`);
