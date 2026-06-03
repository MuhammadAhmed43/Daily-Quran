// Build the AI->video matching index: for each Watch chapter, embed a search profile
// (title + era + blurb + AI-generated keywords) with the SAME Cloudflare bge-m3 the chat uses,
// and write api/video-index.json = [{ id, title, embedding }]. The chat then cosine-matches a
// question's embedding against these to (optionally) surface a ▶ video card. One-time + resumable.
//   node scripts/build-video-index.mjs
//
// Reads chapter data straight from mobile/lib/watch.ts (no duplication). Cloudflare + Groq keys
// come from the root .env (same as the chat / other scripts).

import { readFileSync, writeFileSync } from 'node:fs';

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
const CF_ACCT = env.CLOUDFLARE_ACCOUNT_ID;
const CF_TOKEN = env.CLOUDFLARE_API_TOKEN;
const GROQ_KEY = env.GROQ_API_KEY;
for (const [k, v] of Object.entries({ CF_ACCT, CF_TOKEN })) {
  if (!v) {
    console.error(`Missing ${k} in .env`);
    process.exit(1);
  }
}

const CF_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCT}/ai/run/@cf/baai/bge-m3`;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OUT = new URL('../api/video-index.json', import.meta.url);

// --- Pull chapters straight out of watch.ts (id, title, era, blurb) -------------------------------
function loadChapters() {
  const src = readFileSync(new URL('../mobile/lib/watch.ts', import.meta.url), 'utf8');
  const re =
    /id:\s*'([^']+)',\s*track:\s*'([^']+)',[\s\S]*?title:\s*'([^']+)',\s*era:\s*'([^']+)',\s*blurb:\s*'([^']+)',/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    out.push({ id: m[1], track: m[2], title: m[3], era: m[4], blurb: m[5] });
  }
  return out;
}

// Users type without diacritics ("abu bakr", "hudaybiyyah", "taif"), so strip diacritics + the
// ʿ/ʾ modifier letters from the profile text before embedding — it aligns the match much better.
const stripDiacritics = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ʿʾ‘’]/g, '')
    .replace(/ﷺ/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cfEmbed(text) {
  const res = await fetch(CF_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: [text] }),
  });
  if (!res.ok) throw new Error(`CF embed ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const j = await res.json();
  return j.result.data[0];
}

// Optional keyword expansion (improves recall — how people actually phrase questions). Graceful:
// if Groq is unavailable, we just embed title+era+blurb, which already matches well.
async function keywords(title, era, blurb) {
  if (!GROQ_KEY) return '';
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0.3,
        max_tokens: 220,
        messages: [
          {
            role: 'system',
            content:
              'You expand a video chapter into search keywords for matching user questions to it. Given a title and description of a short video about the life of Prophet Muhammad or Islamic history, output ONLY a compact comma-separated list of the key people, places, events, dates, and the ways someone might phrase a question about this topic. No sentences, no preface. 15-30 keywords/phrases.',
          },
          { role: 'user', content: `Title: "${title} — ${era}". Description: "${blurb}".` },
        ],
      }),
    });
    if (!res.ok) return '';
    const j = await res.json();
    return (j.choices?.[0]?.message?.content || '').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

async function main() {
  const chapters = loadChapters();
  console.log(`Parsed ${chapters.length} chapters from watch.ts`);
  if (chapters.length !== 35) {
    console.error(`Expected 35 chapters, got ${chapters.length} — check the watch.ts parse. Aborting.`);
    process.exit(1);
  }

  const index = [];
  for (const c of chapters) {
    const kw = await keywords(c.title, c.era, c.blurb);
    // A LIGHT track tag so generic queries route to the right timeline ("history of Islam" -> a
    // history chapter, not a Seerah one) without diluting specific-topic matches. Seerah chapters
    // already match Seerah questions strongly on their own, so only the history track needs tagging,
    // and a short tag keeps specific queries (Badr, the Night Journey) well clear of the threshold.
    const trackCtx = c.track === 'seerah' ? '' : 'Islamic history. ';
    const profile = stripDiacritics(`${trackCtx}${c.title}. ${c.era}. ${c.blurb} ${kw}`);
    const embedding = await cfEmbed(profile);
    index.push({ id: c.id, title: c.title, embedding });
    console.log(`✓ ${c.id}  ${c.title}  (${embedding.length}d${kw ? ', +keywords' : ''})`);
    await sleep(500); // gentle on CF + Groq
  }

  writeFileSync(OUT, JSON.stringify(index) + '\n', 'utf8');
  console.log(`\nWrote ${index.length} vectors → ${OUT.pathname}`);
}

main();
