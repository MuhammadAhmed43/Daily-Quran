// Mirror of lib/quiz-bank.ts engine + generators - verifies WITHOUT a device that the verified-data
// questions are correct by construction and the deterministic daily engine is sound. Keep in lockstep
// with lib/quiz-bank.ts.  node scripts/test-quiz.mjs
import { readFileSync } from 'node:fs';

const META = JSON.parse(readFileSync(new URL('../mobile/assets/quran/surahs.json', import.meta.url), 'utf8'));
const QURAN = JSON.parse(readFileSync(new URL('../mobile/assets/quran/quran.json', import.meta.url), 'utf8'));
const meta = (n) => META[n - 1];
const getAyah = (s, a) => QURAN.surahs[s - 1]?.ayahs.find((x) => x.n === a) ?? null;

// --- mirrored PRNG ---
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleWith(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function distractors(pool, correct, n, seed) {
  const uniq = Array.from(new Set(pool)).filter((x) => x !== correct);
  return shuffleWith(uniq, mulberry32(seed)).slice(0, n);
}
function shuffleOptions(q, rng) {
  const order = shuffleWith(q.options.map((_, i) => i), rng);
  return { ...q, options: order.map((i) => q.options[i]), answer: order.indexOf(q.answer) };
}

let fails = 0;
const ok = (c, m) => {
  if (!c) fails++;
  console.log((c ? '  OK  ' : '  XX  ') + m);
};

// --- rebuild + validate generated, verified-data questions ---
const generated = [];
const MEANING_IDS = [1, 2, 6, 7, 12, 16, 17, 18, 19, 24, 25, 27, 29, 53, 55, 57, 67, 71, 72, 76, 78, 96, 105, 106, 108, 109, 112, 113, 114];
const MEANING_POOL = MEANING_IDS.map((id) => meta(id).englishNameTranslation);
for (const id of MEANING_IDS) {
  const m = meta(id);
  generated.push({ kind: 'mean', surah: id, options: [m.englishNameTranslation, ...distractors(MEANING_POOL, m.englishNameTranslation, 3, hashStr('mean' + id))], answer: 0, correct: m.englishNameTranslation });
}
const COUNT_IDS = [1, 2, 18, 36, 55, 67, 78, 112, 108, 114, 113];
for (const id of COUNT_IDS) {
  const c = meta(id).numberOfAyahs;
  const opts = new Set([c]);
  const r = mulberry32(hashStr('count' + id));
  let d = 0;
  while (opts.size < 4 && d++ < 50) {
    const cand = c + (Math.floor(r() * 6) + 1) * (r() < 0.5 ? -1 : 1);
    if (cand > 0) opts.add(cand);
  }
  const options = shuffleWith([...opts], mulberry32(hashStr('count-opt' + id))).map(String);
  generated.push({ kind: 'count', surah: id, options, answer: options.indexOf(String(c)), correct: String(c) });
}
const REVS = [[2, 'Medinan'], [4, 'Medinan'], [5, 'Medinan'], [24, 'Medinan'], [48, 'Medinan'], [62, 'Medinan'], [18, 'Meccan'], [19, 'Meccan'], [36, 'Meccan'], [67, 'Meccan'], [112, 'Meccan'], [96, 'Meccan']];
for (const [id, type] of REVS) {
  const m = meta(id);
  const other = type === 'Medinan' ? 'Meccan' : 'Medinan';
  const otherNames = META.filter((s) => s.revelationType === other && s.number !== id).map((s) => s.englishName);
  const options = shuffleWith([m.englishName, ...distractors(otherNames, m.englishName, 3, hashStr('rev' + id))], mulberry32(hashStr('rev-opt' + id)));
  generated.push({ kind: 'rev', surah: id, type, options, answer: options.indexOf(m.englishName), correct: m.englishName });
}
const VERSES = [[1, 1], [2, 255], [112, 1], [94, 6], [1, 5], [67, 1], [103, 2]];
for (const [s, a] of VERSES) {
  if (!getAyah(s, a)) continue;
  const m = meta(s);
  const otherNames = META.filter((x) => x.number !== s).map((x) => x.englishName);
  const options = shuffleWith([m.englishName, ...distractors(otherNames, m.englishName, 3, hashStr(`verse${s}.${a}`))], mulberry32(hashStr(`verse-opt${s}.${a}`)));
  generated.push({ kind: 'verse', surah: s, options, answer: options.indexOf(m.englishName), correct: m.englishName });
}

console.log(`generated ${generated.length} verified-data questions`);
let structOk = true;
let correctOk = true;
for (const g of generated) {
  if (g.options.length !== 4 || new Set(g.options).size !== 4 || g.answer < 0 || g.answer > 3) structOk = false;
  if (g.options[g.answer] !== g.correct) correctOk = false;
  if (g.kind === 'count' && g.correct !== String(meta(g.surah).numberOfAyahs)) correctOk = false;
  if (g.kind === 'mean' && g.correct !== meta(g.surah).englishNameTranslation) correctOk = false;
  if (g.kind === 'rev' && meta(g.surah).revelationType !== g.type) correctOk = false;
}
ok(structOk, 'every generated question has 4 distinct options + a valid answer index');
ok(correctOk, 'every generated answer matches the verified surah data');

// --- engine: determinism, balance, distinctness, option remap (synthetic pool) ---
const TOPICS = ['quran', 'basics', 'seerah', 'vocab'];
const POOL = [];
for (const t of TOPICS) for (let i = 0; i < 6; i++) POOL.push({ id: `${t}-${i}`, topic: t, options: [`c-${t}-${i}`, 'x', 'y', 'z'], answer: 0 });
function getDaily(dayKey, n = 10) {
  const groups = TOPICS.map((t) => shuffleWith(POOL.filter((q) => q.topic === t), mulberry32(hashStr(`${dayKey}:${t}`))));
  const out = [];
  let i = 0;
  while (out.length < n) {
    let added = false;
    for (const g of groups) {
      if (g[i]) {
        out.push(g[i]);
        added = true;
        if (out.length >= n) break;
      }
    }
    if (!added) break;
    i++;
  }
  return out.map((q) => shuffleOptions(q, mulberry32(hashStr(`${dayKey}:${q.id}`))));
}
const d1 = getDaily('2024-06-01');
const d1b = getDaily('2024-06-01');
ok(d1.length === 10, 'daily set has 10 questions');
ok(new Set(d1.map((q) => q.id)).size === 10, 'all 10 are distinct');
ok(d1.map((q) => q.id).join() === d1b.map((q) => q.id).join(), 'same date -> identical quiz (deterministic)');
const counts = TOPICS.map((t) => d1.filter((q) => q.topic === t).length);
ok(counts.every((c) => c >= 2 && c <= 3), `balanced across topics (got ${counts.join('/')})`);
ok(d1.every((q) => q.options[q.answer] === `c-${q.id}`), 'option shuffle keeps answer pointing at the correct choice');
const days = new Set([0, 1, 2, 3, 4].map((i) => getDaily(`2024-06-0${i + 1}`).map((q) => q.id).join()));
ok(days.size > 1, 'different dates yield different quizzes');

console.log(fails === 0 ? '\nQUIZ ENGINE + GENERATED QUESTIONS VERIFIED' : `\n${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
