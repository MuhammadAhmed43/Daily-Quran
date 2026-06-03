// Generate short, conservative, THEMATIC study overviews for each surah, grounded in the surah's
// own verses, and write them to mobile/assets/quran/surah-intros.json (bundled → the reader stays
// fully offline). One-time + resumable: existing entries are kept unless you pass --force.
//
//   node scripts/build-surah-intros.mjs                 # sample set (18, 36, 55, 114)
//   node scripts/build-surah-intros.mjs 18 36 55 114    # specific surahs
//   node scripts/build-surah-intros.mjs all             # every surah (skips ones already present)
//   node scripts/build-surah-intros.mjs 2 --force       # regenerate even if present
//
// HUMAN-REVIEW the output before shipping — this is sacred content. The prompt forbids rulings,
// virtue-of-recitation claims, asbab-as-fact, and sectarian framing, but always read it.

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
const GROQ_KEY = env.GROQ_API_KEY;
if (!GROQ_KEY) {
  console.error('Missing GROQ_API_KEY in .env');
  process.exit(1);
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Default to the stronger 70b; override with --model=<name> (e.g. llama-3.1-8b-instant when the
// 70b daily token cap is hit). Keep the default intact so a later high-quality regen is one flag away.
const MODEL =
  process.argv.find((a) => a.startsWith('--model='))?.slice('--model='.length) ||
  'llama-3.3-70b-versatile';

const QURAN_URL = new URL('../mobile/assets/quran/quran.json', import.meta.url);
const OUT_URL = new URL('../mobile/assets/quran/surah-intros.json', import.meta.url);

const quran = JSON.parse(readFileSync(QURAN_URL, 'utf8'));
const SURAHS = quran.surahs;
const existing = (() => {
  try {
    return JSON.parse(readFileSync(OUT_URL, 'utf8'));
  } catch {
    return {};
  }
})();

const SYSTEM = `You write brief, factual, well-crafted study overviews of Qur'an chapters (surahs) for a reading app. You are a neutral study aid, not a mufti or a preacher.

Given a surah's name, meaning, revelation period, and a sample of its verses, return ONLY a JSON object:
{
  "summary": "2-3 sentences on the surah's major themes and notable contents, calm, specific, plain English",
  "themes": ["3-5 short tags"],
  "nameReason": "one short clause on why the surah carries this name"
}

STYLE (match the examples below):
- Write naturally and specifically. Do NOT begin the summary with "Surah", "This surah", or "This chapter" — lead with the theme or the content.
- Where a surah is known for particular stories or passages, name them (e.g. Al-Kahf's four trials; Ya-Sin's town messengers; Ar-Rahman's recurring refrain). Be specific, never generic.
- themes: each tag is ONE concept in Title Case, usually a single word (two or three words ONLY for an inherent idea like "Day of Judgment" or "Oneness of God"). NEVER merge two ideas into one tag — write "Mercy" and "Forgiveness" as separate tags, not "Mercy Forgiveness".
- nameReason: one tight clause; do not pad with "The surah is named X, meaning Y, because...".

SAFETY (strict):
- Descriptive and thematic ONLY. No religious ruling (no halal/haram, no "must/must not").
- Do NOT state occasions of revelation as fact; hedge if you mention context ("traditionally associated with").
- NEVER claim rewards or virtues of reciting the surah ("whoever recites...").
- No sectarian framing; mainstream understanding; do not favour a school of law.
- Avoid weak or disputed narrations and any sensational or fearful tone.
- Use "God" for Allah. Do NOT write any Arabic. If unsure, stay general rather than invent specifics.

EXAMPLES (your output should match this calibre):
Input: Surah 1: Al-Faatiha ("The Opening") — Meccan, 7 verses.
Output: {"summary":"A short, complete prayer that opens the Qur'an: it praises God, the Most Merciful, affirms Him as Master of the Day of Judgment, then turns to asking — for guidance along the straight path. In a few lines it moves from praise, to devotion, to a heartfelt request that frames the rest of the Qur'an as the answer.","themes":["Praise","Mercy","Guidance","Prayer"],"nameReason":"Called 'The Opening' because it begins the Qur'an and is recited in every unit of prayer."}
Input: Surah 112: Al-Ikhlaas ("Sincerity") — Meccan, 4 verses.
Output: {"summary":"Four short verses that distil the Islamic understanding of God: He is One, Eternal and Self-Sufficient; He neither fathers nor is fathered; and nothing is comparable to Him. Brief as it is, it answers the most fundamental question — who is God — with striking clarity.","themes":["Oneness of God","Sincerity","Creed"],"nameReason":"Named 'Sincerity' because it states, purely and completely, what God is."}

Return ONLY the JSON object, nothing else.`;

function sampleVerses(s) {
  const A = s.ayahs;
  const fmt = (arr) => arr.map((a) => `${a.n}. ${a.en}`);
  let lines;
  if (A.length <= 36) {
    lines = fmt(A);
  } else {
    const mid = Math.floor(A.length / 2);
    lines = [
      ...fmt(A.slice(0, 18)),
      '…',
      ...fmt(A.slice(mid - 4, mid + 4)),
      '…',
      ...fmt(A.slice(-8)),
    ];
  }
  let text = lines.join('\n');
  if (text.length > 4200) text = text.slice(0, 4200) + '…';
  return text;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function groq(messages) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      }),
    });
    if (res.status === 429) {
      const wait = 4000 * attempt;
      console.log(`  …rate limited, waiting ${wait}ms`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const j = await res.json();
    return j.choices?.[0]?.message?.content || '';
  }
  throw new Error('rate limited repeatedly');
}

function parseIntro(content) {
  let obj;
  try {
    obj = JSON.parse(content);
  } catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('no JSON in response');
    obj = JSON.parse(m[0]);
  }
  const summary = String(obj.summary || '').trim();
  const themes = Array.isArray(obj.themes)
    ? obj.themes.map((t) => String(t).trim()).filter(Boolean).slice(0, 5)
    : [];
  const nameReason = obj.nameReason ? String(obj.nameReason).trim() : undefined;
  if (!summary) throw new Error('empty summary');
  return nameReason ? { summary, themes, nameReason } : { summary, themes };
}

function writeOut() {
  const sorted = {};
  for (const k of Object.keys(existing).sort((a, b) => +a - +b)) sorted[k] = existing[k];
  writeFileSync(OUT_URL, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const doAll = args.includes('all');
  const nums = args.filter((a) => /^\d+$/.test(a)).map(Number);
  const targets = doAll
    ? Array.from({ length: 114 }, (_, i) => i + 1)
    : nums.length
      ? nums
      : [18, 36, 55, 114];

  console.log(`Generating intros for ${targets.length} surah(s)${force ? ' (force)' : ''}…\n`);
  let made = 0;
  let skipped = 0;
  for (const n of targets) {
    const s = SURAHS.find((x) => x.number === n);
    if (!s) {
      console.log(`! ${n}: not found`);
      continue;
    }
    if (existing[String(n)] && !force) {
      skipped++;
      continue;
    }
    const user =
      `Surah ${n}: ${s.englishName} ("${s.englishNameTranslation}") — ${s.revelationType}, ${s.numberOfAyahs} verses.\n\n` +
      `Sample of its verses (English translation):\n${sampleVerses(s)}\n\n` +
      `Write the overview JSON.`;
    try {
      const content = await groq([
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user },
      ]);
      const intro = parseIntro(content);
      existing[String(n)] = intro;
      writeOut(); // save after each so an interrupted run keeps its progress
      made++;
      console.log(`✓ ${n} ${s.englishName} — [${intro.themes.join(', ')}]`);
      console.log(`    ${intro.summary}\n`);
    } catch (e) {
      console.log(`! ${n} ${s.englishName}: ${String((e && e.message) || e)}`);
    }
    await sleep(1200); // be gentle on the free-tier rate limit
  }
  console.log(`\nDone. ${made} generated, ${skipped} already present. → ${OUT_URL.pathname}`);
}

main();
