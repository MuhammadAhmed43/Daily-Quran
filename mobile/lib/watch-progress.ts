// Per-chapter watch progress, persisted on device — same tiny cache + pub/sub + hook pattern as
// bookmarks.ts / streak.ts, so the timeline nodes, the per-track summary, and the Home
// "continue watching" card all update the instant a video advances. Local-first; syncs later.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { getChapters, type Track } from './watch';

export type ChapterProgress = { watched: boolean; pct: number; at: number };
export type ProgressMap = Record<string, ChapterProgress>;

const KEY = 'daily-quran:watch';
const WATCHED_AT = 0.9; // auto-mark watched once you reach ~90%
let cache: ProgressMap | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<ProgressMap> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(cache ?? {})).catch(() => {});
  listeners.forEach((l) => l());
}

export function subscribeProgress(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function getProgress(): Promise<ProgressMap> {
  return load();
}

/** Record the furthest fraction watched (monotonic). Auto-flips to watched at ~90%. */
export function setPct(id: string, pct: number): void {
  void (async () => {
    await load();
    const cur = cache![id] ?? { watched: false, pct: 0, at: 0 };
    const next = Math.max(cur.pct, Math.min(1, pct || 0));
    cache![id] = { watched: cur.watched || next >= WATCHED_AT, pct: next, at: Date.now() };
    persist();
  })();
}

export function markWatched(id: string, watched = true): void {
  void (async () => {
    await load();
    const cur = cache![id] ?? { watched: false, pct: 0, at: 0 };
    cache![id] = { watched, pct: watched ? Math.max(cur.pct, 1) : cur.pct, at: Date.now() };
    persist();
  })();
}

function perTrack(map: ProgressMap, track: Track): { done: number; total: number } {
  const list = getChapters(track);
  const done = list.filter((c) => map[c.id]?.watched).length;
  return { done, total: list.length };
}

// The most-recently-touched chapter that's started but not finished — drives the Home card.
function continueChapter(map: ProgressMap): { id: string; track: Track; pct: number } | null {
  let best: { id: string; track: Track; pct: number; at: number } | null = null;
  for (const track of ['seerah', 'history'] as Track[]) {
    for (const c of getChapters(track)) {
      const p = map[c.id];
      if (!p || p.watched || p.pct <= 0) continue;
      if (!best || p.at > best.at) best = { id: c.id, track, pct: p.pct, at: p.at };
    }
  }
  return best ? { id: best.id, track: best.track, pct: best.pct } : null;
}

export function useWatchProgress() {
  const [map, setMap] = useState<ProgressMap>(cache ?? {});
  useEffect(() => {
    let active = true;
    const refresh = () => getProgress().then((m) => active && setMap({ ...m }));
    refresh();
    const unsub = subscribeProgress(refresh);
    return () => {
      active = false;
      unsub();
    };
  }, []);
  return {
    map,
    isWatched: (id: string) => !!map[id]?.watched,
    pctOf: (id: string) => map[id]?.pct ?? 0,
    perTrack: (track: Track) => perTrack(map, track),
    continueChapter: () => continueChapter(map),
    setPct,
    markWatched,
    toggleWatched: (id: string) => markWatched(id, !map[id]?.watched),
  };
}
