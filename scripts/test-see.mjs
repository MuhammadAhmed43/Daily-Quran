// Smoke-tester for the image-reflection endpoint (api/see.js). Reads a local photo, base64-encodes it,
// POSTs it (non-streaming) to the endpoint, and prints what the vision step saw, the grounded
// reflection, and the verse/tafsir cards -- so you can judge on real photos whether the vision model
// behaves (clean JSON, good description, declines the dodgy ones, never forces a verse) BEFORE we
// build the client UI.
//
// Usage:
//   node scripts/test-see.mjs <imagePath> <endpointUrl> [optional question...]
// Examples:
//   node scripts/test-see.mjs ./sunset.jpg http://localhost:3000/api/see
//   node scripts/test-see.mjs ./meal.jpg https://YOUR-APP.vercel.app/api/see  what does the Quran say about this
import { readFileSync } from 'node:fs';
import { extname, basename } from 'node:path';

const [, , imagePath, endpoint, ...rest] = process.argv;
if (!imagePath || !endpoint) {
  console.error('Usage: node scripts/test-see.mjs <imagePath> <endpointUrl> [score=0.5] [question...]');
  process.exit(2);
}
// Optional `score=0.55` token sets the relevance floor for this run (calibration); the rest is the question.
let minScore;
const questionParts = [];
for (const part of rest) {
  const m = /^score=([0-9.]+)$/.exec(part);
  if (m) minScore = Number(m[1]);
  else questionParts.push(part);
}
const question = questionParts.join(' ').trim();

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };
const ext = extname(imagePath).toLowerCase();
const mime = MIME[ext];
if (!mime) {
  console.error(`Unsupported image type "${ext}". Use jpg/png/webp/gif.`);
  process.exit(2);
}

let b64;
try {
  b64 = readFileSync(imagePath).toString('base64');
} catch (e) {
  console.error(`Could not read ${imagePath}: ${(e && e.message) || e}`);
  process.exit(2);
}
const dataUrl = `data:${mime};base64,${b64}`;
const approxMB = (dataUrl.length / 1_000_000).toFixed(2);

console.log(`\n=== test-see ===`);
console.log(`image:    ${basename(imagePath)}  (~${approxMB}MB base64)`);
console.log(`question: ${question || '(none)'}`);
console.log(`endpoint: ${endpoint}\n`);

const started = Date.now();
let res;
try {
  res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: dataUrl, question, stream: false, debug: true, ...(minScore !== undefined ? { minScore } : {}) }),
  });
} catch (e) {
  console.error(`Request failed (is the endpoint up?): ${(e && e.message) || e}`);
  process.exit(1);
}
const ms = Date.now() - started;

const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  console.error(`HTTP ${res.status} -- non-JSON response:\n${text.slice(0, 500)}`);
  process.exit(1);
}

if (!res.ok || json.error) {
  console.error(`HTTP ${res.status} error: ${json.error || text.slice(0, 300)}${json.detail ? `\n${json.detail}` : ''}`);
  process.exit(1);
}

console.log(`HTTP ${res.status}  (${ms}ms)`);
if (json.mode) console.log(`MODE: ${json.mode}`);
console.log('');
if (json.caption) console.log(`VISION SAW:\n  ${json.caption}\n`);
console.log(`RESPONSE:\n${(json.answer || '(empty)').split('\n').map((l) => '  ' + l).join('\n')}\n`);

const verses = json.verses || [];
console.log(`VERSE CARDS (${verses.length}) -- these are rendered from the DB, not the model:`);
for (const v of verses) console.log(`  (${v.surah}:${v.ayah})  ${v.translation}`);
if (!verses.length) console.log('  (none -- graceful, no forced verse)');

const tafsir = json.tafsir || [];
if (tafsir.length) {
  console.log(`\nTAFSIR CARDS (${tafsir.length}):`);
  for (const t of tafsir) console.log(`  ${t.source} on ${t.surah}:${t.ayah}: ${(t.snippet || '').slice(0, 120)}...`);
}

// Per-verse retrieval scores. In reflection mode a floor applies ("keep"/"drop"); in Q&A mode there's
// no floor (the scene gate + prompt + buildCards decide), so scores are shown without keep/drop.
if (json.debug && Array.isArray(json.debug.scored) && json.debug.scored.length) {
  const floor = typeof json.debug.minScore === 'number' ? json.debug.minScore : null;
  console.log(`\nRETRIEVAL SCORES${floor != null ? ` (floor = ${floor})` : ' (no floor)'}:`);
  for (const s of json.debug.scored) {
    const mark = floor != null ? (s.score != null && s.score >= floor ? 'keep  ' : 'drop  ') : '      ';
    console.log(`  ${mark}${String(s.ref).padEnd(8)} ${s.score}`);
  }
}

console.log(`\ndisclaimer: ${json.disclaimer || '(none)'}`);
console.log(`\n--- judge it: is the description accurate? the reflection reverent (not forced)? verses genuinely relevant? would a dodgy/off-topic image be declined? ---\n`);
