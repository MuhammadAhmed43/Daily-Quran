// reflections.ts — the user's private daily reflection journal + the guided-reflection content.
// Stored on-device, keyed by local day. Same tiny cache + pub/sub pattern as bookmarks/streak, so the
// Today card and the reflection sheet stay in sync. Religiously safe: the READINGS are non-doctrinal
// reflective framing (they never interpret scripture or issue rulings) and scripture itself is always
// rendered from the verified DB elsewhere.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { dayKey } from './streak';

// Reflective PROMPTS (a question to sit with) and READINGS (a gentle framing for the act of reflecting).
// Both are deliberately general — they guide the reader inward without interpreting the verse.
export const REFLECTION_PROMPTS = [
  'Where do you seek peace when the world feels overwhelming?',
  'What is one blessing you almost overlooked today?',
  'When did you last feel your heart truly at rest?',
  'What would it look like to trust Him with the thing you carry?',
  'Who could you show a little more mercy to today?',
];

export const REFLECTION_READINGS = [
  'Read the verse slowly, twice. Let the words land before you respond, and notice which phrase stays with you.',
  'Bring one moment from today to mind as you read. Where do these words meet your life right now? Write honestly; this is for you alone.',
  'Reflection is not about answers. Let the verse ask you a question, and follow it inward.',
  'Before you write, take one slow breath and set down what you are carrying. Then return to the verse and let it speak into this moment.',
  'There is no perfect reflection. A single honest sentence is enough.',
];

/** The prompt + reading for a given day seed (e.g. day-of-month), stable across the day. */
export function reflectionFor(seed: number): { prompt: string; reading: string } {
  return {
    prompt: REFLECTION_PROMPTS[seed % REFLECTION_PROMPTS.length],
    reading: REFLECTION_READINGS[seed % REFLECTION_READINGS.length],
  };
}

const KEY = 'daily-quran:reflections';
type Store = Record<string, string>; // local YYYY-MM-DD -> reflection text

let cache: Store | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<Store> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    cache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Store) : {};
  } catch {
    cache = {};
  }
  return cache;
}

/** Reset the private journal (+ AI-reading) cache from storage + notify — used by sign-out clearing. */
export async function reloadReflections(): Promise<void> {
  cache = null;
  readingCache = null;
  await load();
  listeners.forEach((l) => l());
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(cache ?? {})).catch(() => {});
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Save (non-empty) or clear (empty) the reflection for a given day. Fire-and-forget. */
export function saveReflection(day: string, text: string): void {
  void (async () => {
    await load();
    const t = text.trim();
    if (t) cache![day] = t;
    else delete cache![day];
    persist();
  })();
}

export function getReflection(day: string): string {
  return cache?.[day] ?? '';
}

/** Reactive reflection text for a given day. */
export function useReflection(day: string): string {
  const [text, setText] = useState<string>(cache?.[day] ?? '');
  useEffect(() => {
    let active = true;
    const refresh = () => load().then((s) => active && setText(s[day] ?? ''));
    refresh();
    const unsub = subscribe(refresh);
    return () => {
      active = false;
      unsub();
    };
  }, [day]);
  return text;
}

/** Reactive reflection text for today. */
export function useTodayReflection(): string {
  return useReflection(dayKey(new Date()));
}

/** Whether today has a saved (non-empty) reflection. */
export function useReflectedToday(): boolean {
  return useTodayReflection().trim().length > 0;
}

// --- AI reading cache: one grounded reading per day, generated once and reused (no re-cost on re-open).
// Kept separate from the journal; the reflection sheet manages generation. ---
const READING_KEY = 'daily-quran:readings';
let readingCache: Record<string, string> | null = null;

async function loadReadings(): Promise<Record<string, string>> {
  if (readingCache) return readingCache;
  try {
    const raw = await AsyncStorage.getItem(READING_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    readingCache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    readingCache = {};
  }
  return readingCache;
}

/** The cached AI reading for a day, or null if none yet. */
export async function getCachedReading(day: string): Promise<string | null> {
  const c = await loadReadings();
  return c[day] ?? null;
}

/** Persist the generated reading for a day. */
export function saveCachedReading(day: string, text: string): void {
  void (async () => {
    const c = await loadReadings();
    const t = text.trim();
    if (t) c[day] = t;
    AsyncStorage.setItem(READING_KEY, JSON.stringify(c)).catch(() => {});
  })();
}
