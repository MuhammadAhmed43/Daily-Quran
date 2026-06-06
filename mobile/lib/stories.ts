// Storyboard ("Stories") data + helpers.
//
// A story is a sequence of panels. Each panel carries app-authored narration and
// art direction, but its scripture is stored ONLY as a reference (e.g. "12:4") —
// the actual Arabic + translation is rendered from the verified bundled Qur'an
// (lib/quran.ts), never hand-typed here. Prophets are never depicted; the panel art
// is fully aniconic (objects, architecture, light, landscape — never a figure).

import adam from '@/assets/stories/adam.json';
import ayyub from '@/assets/stories/ayyub.json';
import ibrahim from '@/assets/stories/ibrahim.json';
import kahf from '@/assets/stories/kahf.json';
import maryam from '@/assets/stories/maryam.json';
import musa from '@/assets/stories/musa.json';
import nuh from '@/assets/stories/nuh.json';
import sulayman from '@/assets/stories/sulayman.json';
import yunus from '@/assets/stories/yunus.json';
import yusuf from '@/assets/stories/yusuf.json';
import { getAyah, getSurah } from '@/lib/quran';
import { STORY_AUDIO, STORY_IMAGES } from '@/lib/story-assets';

export type Panel = {
  n: number;
  title: string;
  ref: string; // citation label as shown, e.g. "12:8–9"
  verse: string; // the single ayah to render, "surah:ayah"
  narration: string; // app voice — a retelling, NOT scripture
  visual: string; // aniconic art direction (shown as placeholder until the image exists)
  scene?: string; // object-only art-generation prompt; see scripts/gen-stories-art.mjs
  color: string; // tonal background for the panel, following the story's color arc
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

// Display order in the Stories library (the prophets' arcs first; Yusuf last).
const STORIES: Story[] = [musa, ibrahim, nuh, adam, maryam, yunus, sulayman, kahf, ayyub, yusuf] as Story[];

export function getStories(): Story[] {
  return STORIES;
}

export function getStory(id: string | undefined): Story | undefined {
  if (!id) return undefined;
  return STORIES.find((s) => s.id === id);
}

// Bundled, reviewed panel art + narration audio. Metro needs static require() literals, so the
// maps are auto-generated into lib/story-assets.ts (scripts/gen-story-assets.mjs) from the bundled
// assets in mobile/assets/stories/<id>/ (images) and <id>-audio/ (mp3).
export function panelImage(storyId: string, n: number): number | undefined {
  return STORY_IMAGES[storyId]?.[n];
}

export function panelAudio(storyId: string, n: number): number | undefined {
  return STORY_AUDIO[storyId]?.[n];
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
