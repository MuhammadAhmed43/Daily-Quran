// Bookmarked ayahs, persisted on device. A tiny in-memory cache + pub/sub so the ribbon on a
// saved ayah, the focus-card toggle, and the bookmarks list all stay in sync instantly.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type Bookmark = { surah: number; ayah: number; at: number };

const KEY = 'daily-quran:bookmarks';
let cache: Bookmark[] | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<Bookmark[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Bookmark[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(cache ?? [])).catch(() => {});
  listeners.forEach((l) => l());
}

/** Re-read bookmarks from storage + notify - cloud sync calls this after writing a merged value. */
export async function reloadBookmarks(): Promise<void> {
  cache = null;
  await load();
  listeners.forEach((l) => l());
}

export function subscribeBookmarks(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Newest first.
export async function getBookmarks(): Promise<Bookmark[]> {
  const all = await load();
  return all.slice().sort((a, b) => b.at - a.at);
}

export function isBookmarked(surah: number, ayah: number): boolean {
  return !!cache?.some((b) => b.surah === surah && b.ayah === ayah);
}

// Returns true if it ended up bookmarked, false if removed.
export async function toggleBookmark(surah: number, ayah: number): Promise<boolean> {
  await load();
  const i = cache!.findIndex((b) => b.surah === surah && b.ayah === ayah);
  let added: boolean;
  if (i >= 0) {
    cache!.splice(i, 1);
    added = false;
  } else {
    cache!.push({ surah, ayah, at: Date.now() });
    added = true;
  }
  persist();
  return added;
}

// Subscribe a component to the bookmark list (re-renders on any change).
export function useBookmarks(): Bookmark[] {
  const [list, setList] = useState<Bookmark[]>(cache ? cache.slice().sort((a, b) => b.at - a.at) : []);
  useEffect(() => {
    let active = true;
    const refresh = () => getBookmarks().then((b) => active && setList(b));
    refresh();
    const unsub = subscribeBookmarks(refresh);
    return () => {
      active = false;
      unsub();
    };
  }, []);
  return list;
}
