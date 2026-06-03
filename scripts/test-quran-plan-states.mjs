// Rigorous state-machine test for the Qur'an reading plan. Mirrors the reducer in
// lib/quran-plan-progress.ts (completePortion + derive) and the engine in lib/quran-plan.ts, then
// drives a plan through every transition asserting invariants, and narrates what each surface shows.
// Run: node scripts/test-quran-plan-states.mjs
import { readFileSync } from 'node:fs';

const quran = JSON.parse(readFileSync('mobile/assets/quran/quran.json', 'utf8'));
const byNum = new Map(quran.surahs.map((s) => [s.number, { count: s.numberOfAyahs, name: s.englishName }]));
const surahName = (n) => byNum.get(n)?.name ?? `Surah ${n}`;

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
  return { startIdx: p, endIdx: end, from: ayahs[p], to: ayahs[end - 1], count: end - p };
}
function remainingPortions(ayahs, position, durationDays, portionsDone) {
  let p = position, done = portionsDone, count = 0, guard = 0;
  while (p < ayahs.length && guard++ < 20000) {
    const pr = portionAt(ayahs, p, durationDays, done);
    if (!pr) break;
    p = pr.endIdx; done++; count++;
  }
  return count;
}
// reducer (mirrors completePortion)
function complete(ayahs, state, durationDays, today) {
  const pr = portionAt(ayahs, state.position, durationDays, state.portionsDone);
  if (!pr) return state;
  return {
    position: pr.endIdx,
    portionsDone: state.portionsDone + 1,
    lastDay: today,
    finishedAt: pr.endIdx >= ayahs.length ? 'done' : state.finishedAt,
  };
}
// derive (mirrors the hook's derive)
function derive(ayahs, state, durationDays, today) {
  const N = ayahs.length;
  const finished = state.position >= N;
  const portion = finished ? null : portionAt(ayahs, state.position, durationDays, state.portionsDone);
  const remaining = finished ? 0 : remainingPortions(ayahs, state.position, durationDays, state.portionsDone);
  return {
    finished,
    portion,
    doneToday: state.lastDay === today,
    percent: N ? state.position / N : 0,
    portionNumber: state.portionsDone + 1,
    totalPortionsCount: state.portionsDone + remaining,
  };
}

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    failures++;
    console.log('   ✗ FAIL: ' + msg);
  }
}

// ---- Scenario A: full run, one portion/day, assert invariants throughout ----
function fullRun(from, to, days) {
  const ayahs = corpusAyahs(from, to);
  const N = ayahs.length;
  const totalAtStart = remainingPortions(ayahs, 0, days, 0);
  let state = { position: 0, portionsDone: 0, lastDay: null, finishedAt: null };
  let day = 1, prevPercent = -1, covered = 0, expectNum = 1, prevEnd = 0;
  while (true) {
    const v = derive(ayahs, state, days, `d${day}`);
    if (v.finished) break;
    check(v.portion !== null, `portion non-null @num${v.portionNumber}`);
    check(v.portionNumber === expectNum, `portionNumber ${v.portionNumber}===${expectNum}`);
    check(v.totalPortionsCount === totalAtStart, `total stable ${v.totalPortionsCount}===${totalAtStart} @num${v.portionNumber}`);
    check(v.percent >= prevPercent, `percent monotonic`);
    check(v.percent < 1 - 1e-9, `percent<1 before finish @num${v.portionNumber}`);
    check(v.portion.startIdx === prevEnd, `contiguous start`);
    check(v.portion.endIdx > v.portion.startIdx, `progress`);
    prevPercent = v.percent;
    covered += v.portion.count;
    prevEnd = v.portion.endIdx;
    state = complete(ayahs, state, days, `d${day}`);
    const after = derive(ayahs, state, days, `d${day}`);
    if (!after.finished) check(after.doneToday === true, `doneToday true right after complete @num${expectNum}`);
    expectNum++; day++;
    if (day > 5000) { check(false, 'runaway'); break; }
  }
  const end = derive(ayahs, state, days, `dEnd`);
  check(state.position === N, `position===N at finish (${state.position}/${N})`);
  check(end.finished === true, `finished flag`);
  check(Math.abs(end.percent - 1) < 1e-9, `percent===1 at finish`);
  check(covered === N, `covered all ayahs (${covered}/${N})`);
  check(end.totalPortionsCount === totalAtStart, `final total===start total`);
  console.log(`  [${from}-${to}]@${days}d: ${totalAtStart} portions, covered ${covered}/${N}, ${failures === 0 ? 'invariants OK' : 'see fails'}`);
}

console.log('Scenario A — full runs, invariants:');
fullRun(78, 114, 30); // Juz Amma, 1 month
fullRun(78, 114, 15);
fullRun(1, 114, 180); // whole, 6 months
fullRun(1, 114, 30); // whole, Ramadan
fullRun(114, 114, 7); // An-Nas alone (6 ayahs) over a week — must still finish & cover
fullRun(112, 114, 5); // 3 short surahs

// ---- Scenario B: done-today vs next-day; what each surface shows ----
console.log('\nScenario B — done-today / next-day labels (Juz Amma @ 15d):');
{
  const ayahs = corpusAyahs(78, 114);
  const days = 15;
  let state = { position: 0, portionsDone: 0, lastDay: null, finishedAt: null };
  const homeCard = (v) =>
    v.finished ? 'HOME: "Qur’an plan complete"'
      : v.doneToday ? `HOME: "Today’s reading is done 🌱 · ${Math.round(v.percent * 100)}% · next unlocks tomorrow"`
        : `HOME: "TODAY’S PORTION · ${surahName(v.portion.from.surah)} ${v.portion.from.surah}:${v.portion.from.ayah}→${v.portion.to.surah}:${v.portion.to.ayah} · Portion ${v.portionNumber}/${v.totalPortionsCount}"`;
  const dash = (v) =>
    v.finished ? 'DASH: finished'
      : `DASH kicker="${v.doneToday ? 'TODAY · DONE' : 'TODAY'}" range="${v.portion.from.surah}:${v.portion.from.ayah}→${v.portion.to.surah}:${v.portion.to.ayah}" cta="${v.doneToday ? 'Keep reading' : 'Read now'}"`;

  let v = derive(ayahs, state, days, 'd1');
  console.log('  start day1:        ' + homeCard(v));
  console.log('                     ' + dash(v));
  state = complete(ayahs, state, days, 'd1');
  v = derive(ayahs, state, days, 'd1');
  console.log('  after complete d1: ' + homeCard(v));
  console.log('                     ' + dash(v));
  check(v.doneToday, 'B: doneToday after completing on d1');
  check(v.portionNumber === 2, 'B: now portion 2');
  v = derive(ayahs, state, days, 'd2');
  console.log('  next day d2:       ' + homeCard(v));
  console.log('                     ' + dash(v));
  check(!v.doneToday, 'B: not doneToday on d2');
}

// ---- Scenario C: binge several in one day ----
console.log('\nScenario C — binge 3 portions same day (whole @ 180d):');
{
  const ayahs = corpusAyahs(1, 114);
  const days = 180;
  let state = { position: 0, portionsDone: 0, lastDay: null, finishedAt: null };
  for (let i = 0; i < 3; i++) state = complete(ayahs, state, days, 'd1');
  const v = derive(ayahs, state, days, 'd1');
  check(state.portionsDone === 3, 'C: 3 done');
  check(v.doneToday === true, 'C: still doneToday');
  check(v.portionNumber === 4, 'C: portion 4 next');
  console.log(`  done=${state.portionsDone} doneToday=${v.doneToday} next=Portion ${v.portionNumber}/${v.totalPortionsCount}`);
}

// ---- Scenario D: re-pace mid-run still covers everything ----
console.log('\nScenario D — re-pace mid-run (whole, start 180d → finish-in-30 after 20 portions):');
{
  const ayahs = corpusAyahs(1, 114);
  const N = ayahs.length;
  let days = 180;
  let state = { position: 0, portionsDone: 0, lastDay: null, finishedAt: null };
  for (let i = 0; i < 20; i++) state = complete(ayahs, state, days, `d${i}`);
  days = state.portionsDone + 30; // repace: finish the rest in 30
  const vAfter = derive(ayahs, state, days, 'x');
  check(vAfter.totalPortionsCount === state.portionsDone + 30 || vAfter.totalPortionsCount <= state.portionsDone + 31, 'D: total ~ done+30');
  // finish it out
  let guard = 0, covered = state.position;
  while (state.position < N && guard++ < 20000) {
    const pr = portionAt(ayahs, state.position, days, state.portionsDone);
    state = complete(ayahs, state, days, `r${guard}`);
    covered = state.position;
  }
  const end = derive(ayahs, state, days, 'z');
  check(state.position === N, 'D: covers full corpus after re-pace');
  check(end.finished, 'D: finished after re-pace');
  console.log(`  after re-pace finished in total ${state.portionsDone} portions, position ${state.position}/${N}`);
}

console.log(failures === 0 ? '\n✅ ALL STATE INVARIANTS HOLD' : `\n❌ ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
