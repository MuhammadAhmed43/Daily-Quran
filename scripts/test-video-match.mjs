// Calibrate AI->video matching WITHOUT deploying: embed a battery of questions with the same
// Cloudflare bge-m3, cosine them against api/video-index.json, and print the top match + score.
// Use this to pick the threshold (should-match scores high, should-NOT-match scores low).
//   node scripts/test-video-match.mjs

import { readFileSync } from 'node:fs';

function loadEnv() {
  const txt = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}
const env = loadEnv();
const CF_URL = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/baai/bge-m3`;
const INDEX = JSON.parse(readFileSync(new URL('../api/video-index.json', import.meta.url), 'utf8'));

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

async function embed(text) {
  const res = await fetch(CF_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: [text] }),
  });
  if (!res.ok) throw new Error(`CF ${res.status}`);
  return (await res.json()).result.data[0];
}

function top(emb, n = 2) {
  return INDEX.map((v) => ({ id: v.id, title: v.title, score: cosine(emb, v.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

// ✓ = expect a card (history/Seerah topic), ✗ = expect NO card (fiqh, emotional, verse, practical)
const SHOULD = [
  'what happened at the battle of badr',
  'history of islam',
  'tell me about the golden age of islam',
  'who was abu bakr',
  'why did the prophet go to taif',
  'how did salahuddin take back jerusalem',
  'the story of the night journey and ascension',
  'what was the treaty of hudaybiyyah about',
  'when the mongols destroyed baghdad',
  'who invented algebra',
  'the conquest of mecca',
  'tell me about uthman compiling the quran',
];
const SHOULDNT = [
  'can i combine prayers when traveling',
  'is music haram',
  'i feel hopeless and alone',
  'what does ayat al-kursi mean',
  'how do i make wudu',
  'what does the quran say about patience',
  'hello',
  'what does bismillah mean',
  'how should i pray when sick',
];

async function run(label, qs) {
  console.log(`\n=== ${label} ===`);
  for (const q of qs) {
    const t = top(await embed(q));
    const s = t[0].score.toFixed(3);
    console.log(`${s}  "${q}"  -> ${t[0].id} (${t[0].title})   [2nd ${t[1].score.toFixed(3)} ${t[1].id}]`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

await run('SHOULD match (expect HIGH)', SHOULD);
await run('SHOULD NOT match (expect LOW)', SHOULDNT);
console.log('\nPick a threshold between the two groups.');
