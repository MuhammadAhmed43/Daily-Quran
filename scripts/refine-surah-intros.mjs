// Second pass: rephrase summaries that open formulaically ("The surah…") or run too long — mostly
// the 8b batch — so the voice stays consistent with the rest. Rewrites the SUMMARY text ONLY,
// preserving every fact; themes and nameReason are untouched. Keeps the original if a rewrite is
// not actually better (still formulaic, wrong length, or empty). Resumable & idempotent.
//
//   node scripts/refine-surah-intros.mjs                 # all flagged
//   node scripts/refine-surah-intros.mjs 67 113          # specific surahs
//   node scripts/refine-surah-intros.mjs --model=llama-3.1-8b-instant

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
const GROQ_KEY = loadEnv().GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL =
  process.argv.find((a) => a.startsWith('--model='))?.slice('--model='.length) ||
  'llama-3.1-8b-instant';

const URL_ = new URL('../mobile/assets/quran/surah-intros.json', import.meta.url);
const d = JSON.parse(readFileSync(URL_, 'utf8'));

const FORMULAIC = /^(the surah|this surah|this chapter)\b/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SYSTEM = `You polish a single-paragraph overview of a Qur'an surah. Rewrite the text you are given so that:
- it does NOT begin with "The surah", "This surah", or "This chapter" — start instead with the subject, the story, or a vivid noun phrase;
- every fact, name, and nuance is preserved EXACTLY — do not add, drop, or change any claim;
- it is 2-3 sentences and under 470 characters, calm and plain;
- use "God" for Allah; write no Arabic.
Return ONLY the rewritten paragraph — no quotes, no preface, no JSON.

Example
In:  "The surah warns of the fleeting nature of life and the inevitability of loss for those who do not live virtuously. It contrasts the lost with those who believe, do good, and promote truth and patience."
Out: "By the passing of time, humanity stands at loss — except those who believe, do good, and counsel one another to truth and patience. A few short verses make the case that a life is measured by faith and what it builds."`;

async function rewrite(text) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: text },
        ],
        temperature: 0.45,
        max_tokens: 260,
      }),
    });
    if (res.status === 429) {
      await sleep(4000 * attempt);
      continue;
    }
    if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 120)}`);
    const j = await res.json();
    return (j.choices?.[0]?.message?.content || '').trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('rate limited repeatedly');
}

function targets() {
  const nums = process.argv.filter((a) => /^\d+$/.test(a)).map(Number);
  if (nums.length) return nums;
  const out = [];
  for (let n = 1; n <= 114; n++) {
    const e = d[String(n)];
    if (!e) continue;
    if (FORMULAIC.test(e.summary.trim()) || e.summary.length > 500) out.push(n);
  }
  return out;
}

async function main() {
  const list = targets();
  console.log(`Refining ${list.length} summaries on ${MODEL}…\n`);
  let fixed = 0;
  let kept = 0;
  for (const n of list) {
    const e = d[String(n)];
    const original = e.summary;
    try {
      const next = await rewrite(original);
      const ok =
        next &&
        next.length >= 100 &&
        next.length <= 520 &&
        !FORMULAIC.test(next) &&
        !/\b(whoever recit|halal|haram|obligatory)\b/i.test(next);
      if (ok) {
        e.summary = next;
        writeFileSync(URL_, JSON.stringify(d, null, 2) + '\n', 'utf8');
        fixed++;
        console.log(`✓ ${n}: ${next}\n`);
      } else {
        kept++;
        console.log(`· ${n}: kept original (rewrite rejected)\n`);
      }
    } catch (err) {
      kept++;
      console.log(`! ${n}: ${String((err && err.message) || err)} — kept original`);
    }
    await sleep(1200);
  }
  console.log(`\nDone. ${fixed} refined, ${kept} kept. → ${URL_.pathname}`);
}

main();
