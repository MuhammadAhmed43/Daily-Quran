import data from '@/assets/quran/surah-intros.json';

// A short, vetted study overview of a surah, bundled so the reader stays fully offline.
// Generated once (grounded, conservative) and human-reviewed — see scripts/build-surah-intros.mjs.
export type SurahIntro = {
  number: number;
  summary: string; // 2-3 sentence thematic overview
  themes: string[]; // 3-5 short tags
  nameReason?: string; // one line on the surah's name
};

type IntroEntry = { summary: string; themes?: string[]; nameReason?: string };
const INTROS = data as Record<string, IntroEntry>;

export function getSurahIntro(n: number): SurahIntro | undefined {
  const e = INTROS[String(n)];
  if (!e || !e.summary) return undefined;
  return { number: n, summary: e.summary, themes: e.themes ?? [], nameReason: e.nameReason };
}
