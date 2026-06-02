// Storyboard ("Stories") data + helpers.
//
// A story is a sequence of panels. Each panel carries app-authored narration and
// art direction, but its scripture is stored ONLY as a reference (e.g. "12:4") —
// the actual Arabic + translation is rendered from the verified bundled Qur'an
// (lib/quran.ts), never hand-typed here. Prophets are never depicted; see
// content/stories/yusuf.md for the full aniconic art spec.

import yusuf from '@/assets/stories/yusuf.json';
import { getAyah, getSurah } from '@/lib/quran';

export type Panel = {
  n: number;
  title: string;
  ref: string; // citation label as shown, e.g. "12:8–9"
  verse: string; // the single ayah to render, "surah:ayah"
  narration: string; // app voice — a retelling, NOT scripture
  visual: string; // aniconic art direction (shown as placeholder until the image exists)
  color: string; // tonal background for the panel, following the indigo→gold arc
  motion?: string; // per-scene Ken Burns "camera move" (see MOTIONS in the player)
  image?: string | null; // remote URL once the illustration is generated + reviewed
  audio?: string | null; // remote URL once the narration MP3 is generated
};

export type Story = {
  id: string;
  title: string;
  subtitle: string;
  arabicName: string;
  surah: number;
  blurb: string;
  panels: Panel[];
};

const STORIES: Story[] = [yusuf as Story];

export function getStories(): Story[] {
  return STORIES;
}

export function getStory(id: string | undefined): Story | undefined {
  if (!id) return undefined;
  return STORIES.find((s) => s.id === id);
}

export type PanelVerse = {
  ar: string;
  en: string;
  ref: string;
  surahEnglish: string;
};

// Resolve a panel's verse reference to the verified Arabic + translation.
export function panelVerse(p: Panel): PanelVerse | null {
  const [s, a] = p.verse.split(':').map(Number);
  const ayah = getAyah(s, a);
  if (!ayah) return null;
  return {
    ar: ayah.ar,
    en: ayah.en,
    ref: p.ref,
    surahEnglish: getSurah(s)?.englishName ?? '',
  };
}
