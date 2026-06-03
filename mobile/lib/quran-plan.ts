// The personalized Qur'an reading-plan engine: turn a GOAL (which verses) + a DURATION (how fast)
// into a daily PORTION, paced over the chosen corpus. Pure + deterministic — no content is authored
// or AI-generated; we simply schedule the real Qur'an and the existing reader/recitation/surah-intro/
// explain surfaces carry the experience. Progress is POSITION-BASED (never "behind"): the portion is
// recomputed from where you actually are, self-correcting so you still finish near the target date.
import type { Ref } from './today';
import { SURAHS } from './quran';

// A corpus is a contiguous run of whole surahs (from..to inclusive). Whole Qur'an = 1..114.
export type Corpus = { fromSurah: number; toSurah: number };

export const WHOLE: Corpus = { fromSurah: 1, toSurah: 114 };
export const JUZ_AMMA: Corpus = { fromSurah: 78, toSurah: 114 }; // Juz 30: An-Naba → An-Nas

type Meta = { number: number; count: number; name: string };
const META: Meta[] = SURAHS.map((s) => ({ number: s.number, count: s.numberOfAyahs, name: s.englishName }));
const byNum = new Map<number, Meta>(META.map((m) => [m.number, m]));

export function surahName(n: number): string {
  return byNum.get(n)?.name ?? `Surah ${n}`;
}

export function corpusLabel(c: Corpus): string {
  if (c.fromSurah === 1 && c.toSurah === 114) return 'The whole Qur’an';
  if (c.fromSurah === 78 && c.toSurah === 114) return 'Juz ʿAmma';
  return c.fromSurah === c.toSurah ? surahName(c.fromSurah) : `${surahName(c.fromSurah)} → ${surahName(c.toSurah)}`;
}

// Flat, ordered ayah list for a corpus (memoized). Each entry is a {surah, ayah} reference.
const flatCache = new Map<string, Ref[]>();
export function corpusAyahs(c: Corpus): Ref[] {
  const key = `${c.fromSurah}-${c.toSurah}`;
  const hit = flatCache.get(key);
  if (hit) return hit;
  const out: Ref[] = [];
  for (let s = c.fromSurah; s <= c.toSurah; s++) {
    const m = byNum.get(s);
    if (!m) continue;
    for (let a = 1; a <= m.count; a++) out.push({ surah: s, ayah: a });
  }
  flatCache.set(key, out);
  return out;
}

export function corpusLength(c: Corpus): number {
  return corpusAyahs(c).length;
}

export type Portion = {
  startIdx: number; // inclusive flat index into the corpus
  endIdx: number; // exclusive
  from: Ref;
  to: Ref;
  count: number;
};

// The portion to read NOW, given how far you've come (`position` ayahs done) and the plan's intended
// pace. `per` is recomputed from what's left ÷ days left, so missed/extra days self-correct. The end
// is snapped to a surah boundary when it's within tolerance, so a day rarely stops mid-surah. Always
// makes progress (end > position).
export function portionAt(c: Corpus, position: number, durationDays: number, portionsDone: number): Portion | null {
  const ayahs = corpusAyahs(c);
  const N = ayahs.length;
  const p = Math.max(0, Math.min(position, N));
  if (p >= N) return null; // finished
  const remainingDays = Math.max(1, durationDays - portionsDone);
  const per = Math.ceil((N - p) / remainingDays);
  let end = Math.min(p + per, N);

  // Snap `end` to the boundary of the surah it lands in, if that's a small nudge.
  const endSurah = ayahs[end - 1].surah;
  let sStart = end - 1;
  while (sStart > 0 && ayahs[sStart - 1].surah === endSurah) sStart--;
  let sEnd = end;
  while (sEnd < N && ayahs[sEnd].surah === endSurah) sEnd++;
  const tol = Math.max(3, Math.floor(per * 0.4));
  if (sEnd - end <= tol) {
    end = sEnd; // swallow the rest of this surah
  } else if (end - sStart <= tol && sStart > p) {
    end = sStart; // defer the whole surah to the next portion
  } // else: the surah is long — split it at `end`

  if (end <= p) end = Math.min(p + per, N); // safety: never an empty portion
  return { startIdx: p, endIdx: end, from: ayahs[p], to: ayahs[end - 1], count: end - p };
}

// How many portions remain from a given position (drives "portion N of M" + the projected finish).
export function remainingPortions(c: Corpus, position: number, durationDays: number, portionsDone: number): number {
  const N = corpusLength(c);
  let p = position;
  let done = portionsDone;
  let count = 0;
  let guard = 0;
  while (p < N && guard++ < 10000) {
    const portion = portionAt(c, p, durationDays, done);
    if (!portion) break;
    p = portion.endIdx;
    done++;
    count++;
  }
  return count;
}

// Total portions the whole plan takes (from the start) — for "of M" labels.
export function totalPortions(c: Corpus, durationDays: number): number {
  return remainingPortions(c, 0, durationDays, 0);
}

// ---- Duration presets ----
export type Pace = { id: string; label: string; days: number };
export const PACES: Pace[] = [
  { id: 'ramadan', label: 'Ramadan · 1 month', days: 30 },
  { id: '2mo', label: '2 months', days: 60 },
  { id: '4mo', label: '4 months', days: 120 },
  { id: '6mo', label: '6 months', days: 180 },
];

// Reflective reading (Arabic glance + translation) ≈ 2.5 ayahs/min — used only for the "~N min"
// estimates in the setup preview, so they stay honest about the commitment each pace asks for.
const AYAHS_PER_MIN = 2.5;
export function estimateMinutes(ayahCount: number): number {
  return Math.max(1, Math.round(ayahCount / AYAHS_PER_MIN));
}

// The average daily portion size for a (corpus, days) pick — the headline number in setup.
export function avgPerDay(c: Corpus, days: number): number {
  return Math.max(1, Math.ceil(corpusLength(c) / Math.max(1, days)));
}
