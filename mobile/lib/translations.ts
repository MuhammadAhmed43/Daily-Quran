// Translation picker: Itani (bundled in quran.json) is the default; Pickthall + Yusuf Ali (both
// public-domain) live in assets/quran/tr/<id>.json and are lazy-loaded only when selected. The choice
// is global module state + a tiny pub/sub so every scripture surface re-renders via useTranslation().
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { getAyah } from './quran';

export type TranslationId = 'itani' | 'pickthall' | 'yusufali';
export type TranslationMeta = { id: TranslationId; label: string; short: string; note: string };

export const TRANSLATIONS: TranslationMeta[] = [
  { id: 'itani', label: 'Clear & Easy', short: 'Itani', note: 'Talal Itani — modern, plain English' },
  { id: 'pickthall', label: 'Pickthall', short: 'Pickthall', note: 'Marmaduke Pickthall — classical (1930)' },
  { id: 'yusufali', label: 'Yusuf Ali', short: 'Yusuf Ali', note: 'Abdullah Yusuf Ali — literary (1934)' },
];

const KEY = 'daily-quran:translation';
const DEFAULT: TranslationId = 'itani';
const isId = (v: unknown): v is TranslationId => v === 'itani' || v === 'pickthall' || v === 'yusufali';

// Lazy alt-translation maps ({ "surah:ayah": text }). Parsed only on first use (require runs once);
// when the default Itani is kept, these are never touched, so there is no startup cost.
const maps: Partial<Record<TranslationId, Record<string, string>>> = {};
function loadMap(id: TranslationId): Record<string, string> {
  const cached = maps[id];
  if (cached) return cached;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = (id === 'pickthall' ? require('../assets/quran/tr/pickthall.json') : require('../assets/quran/tr/yusufali.json')) as Record<string, string>;
  maps[id] = m;
  return m;
}

// --- current selection: module state + pub/sub, hydrated from storage during the splash gate ---
let current: TranslationId = DEFAULT;
const listeners = new Set<() => void>();

export function getTranslationId(): TranslationId {
  return current;
}

export async function hydrateTranslation(): Promise<void> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (isId(v) && v !== current) {
      current = v;
      listeners.forEach((l) => l());
    }
  } catch {}
}

export async function setTranslationId(id: TranslationId): Promise<void> {
  if (id === current) return;
  current = id;
  listeners.forEach((l) => l());
  try {
    await AsyncStorage.setItem(KEY, id);
  } catch {}
}

// The English text for an ayah in the CURRENT translation (falls back to Itani if a verse is missing).
export function verseText(surah: number, ayah: number): string {
  if (current === 'itani') return getAyah(surah, ayah)?.en ?? '';
  return loadMap(current)[`${surah}:${ayah}`] ?? getAyah(surah, ayah)?.en ?? '';
}

export function translationMeta(id: TranslationId = current): TranslationMeta {
  return TRANSLATIONS.find((t) => t.id === id) ?? TRANSLATIONS[0];
}

// Subscribe a component to translation changes so it re-renders and re-reads verseText().
export function useTranslation(): { id: TranslationId; setId: (id: TranslationId) => void } {
  const [id, setId] = useState<TranslationId>(current);
  useEffect(() => {
    const update = () => setId(current);
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
    };
  }, []);
  return { id, setId: (next) => void setTranslationId(next) };
}
