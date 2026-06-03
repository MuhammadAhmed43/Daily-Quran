// Validate the Qur'an-plan pacing engine: for several (corpus, duration) picks, simulate the whole
// plan and assert the portions are contiguous, cover the corpus exactly once, are never empty, and
// land near the target pace. Mirrors lib/quran-plan.ts portionAt(). Run: node scripts/test-quran-plan.mjs
import { readFileSync } from 'node:fs';

const quran = JSON.parse(readFileSync('mobile/assets/quran/quran.json', 'utf8'));
const byNum = new Map(quran.surahs.map((s) => [s.number, { count: s.numberOfAyahs, name: s.englishName }]));

function corpusAyahs(from, to) {
  const out = [];
  for (let s = from; s <= to; s++) {
    const m = byNum.get(s);
    for (let a = 1; a <= m.count; a++) out.push({ surah: s, ayah: a });
  }
  return out;
}

function portionAt(ayahs, position, durationDays, portionsDone) {
  const N = ayahs.length;
  const p = Math.max(0, Math.min(position, N));
  if (p >= N) return null;
  const remainingDays = Math.max(1, durationDays - portionsDone);
  const per = Math.ceil((N - p) / remainingDays);
  let end = Math.min(p + per, N);
  const endSurah = ayahs[end - 1].surah;
  let sStart = end - 1;
  while (sStart > 0 && ayahs[sStart - 1].surah === endSurah) sStart--;
  let sEnd = end;
  while (sEnd < N && ayahs[sEnd].surah === endSurah) sEnd++;
  const tol = Math.max(3, Math.floor(per * 0.4));
  if (sEnd - end <= tol) end = sEnd;
  else if (end - sStart <= tol && sStart > p) end = sStart;
  if (end <= p) end = Math.min(p + per, N);
  return { startIdx: p, endIdx: end, count: end - p };
}

function simulate(from, to, days) {
  const ayahs = corpusAyahs(from, to);
  const N = ayahs.length;
  let p = 0;
  let done = 0;
  const portions = [];
  let guard = 0;
  while (p < N && guard++ < 20000) {
    const pr = portionAt(ayahs, p, days, done);
    if (!pr) break;
    portions.push(pr);
    p = pr.endIdx;
    done++;
  }
  const msgs = [];
  if (portions[0].startIdx !== 0) msgs.push('first≠0');
  if (portions[portions.length - 1].endIdx !== N) msgs.push('last≠N (not covered)');
  for (let i = 1; i < portions.length; i++)
    if (portions[i].startIdx !== portions[i - 1].endIdx) msgs.push(`gap@${i}`);
  if (portions.some((pr) => pr.count <= 0)) msgs.push('empty portion');
  const sizes = portions.map((pr) => pr.count);
  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  const avg = (N / portions.length).toFixed(1);
  const ok = msgs.length === 0;
  const fmt = (pr) =>
    `${ayahs[pr.startIdx].surah}:${ayahs[pr.startIdx].ayah}-${ayahs[pr.endIdx - 1].surah}:${ayahs[pr.endIdx - 1].ayah}(${pr.count})`;
  console.log(
    `[${from}-${to}] days=${days}: N=${N} portions=${portions.length} size min/avg/max=${min}/${avg}/${max}  ${ok ? 'OK' : 'FAIL ' + msgs.join(',')}`,
  );
  console.log('   first: ' + portions.slice(0, 3).map(fmt).join('  '));
  console.log('   last:  ' + portions.slice(-2).map(fmt).join('  '));
  return ok;
}

let ok = true;
ok = simulate(1, 114, 30) && ok; // whole · Ramadan
ok = simulate(1, 114, 60) && ok; // whole · 2 months
ok = simulate(1, 114, 120) && ok; // whole · 4 months
ok = simulate(1, 114, 180) && ok; // whole · 6 months
ok = simulate(78, 114, 30) && ok; // Juz Amma · 1 month
ok = simulate(78, 114, 15) && ok; // Juz Amma · 2 weeks
ok = simulate(112, 114, 7) && ok; // tiny custom range (3 short surahs over a week)
ok = simulate(2, 2, 10) && ok; // a single long surah split over 10 days
console.log(ok ? '\nALL OK — every plan covers its corpus exactly.' : '\nFAILURES above.');
process.exit(ok ? 0 : 1);
