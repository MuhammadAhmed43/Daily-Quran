// Adaptive "For you" — which hubs to surface, evolving with the person while staying STABLE.
//
// score(hub) = focusBase (a stated onboarding focus = strong, stable) + Σ decayed behavioral bumps
// A hub joins "For you" only at score >= THRESHOLD, so:
//   • a stated focus always qualifies (base 3 >= 2),
//   • a non-focus hub needs SUSTAINED behavior (~2 opens, or a mood + an open) — one tap never
//     promotes it (no thrashing), and old behavior fades (exponential decay).
// Everything is on-device. Same cache + pub/sub pattern as bookmarks/streak.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { getHub, HUBS, hubsForFocuses, type Hub } from './hubs';

const KEY = 'daily-quran:hub-affinity';
const HALF_LIFE = 12 * 24 * 60 * 60 * 1000; // behavioral signals halve every ~12 days
const FOCUS_BASE = 3; // a stated onboarding focus — strong and stable (never decays)
export const HUB_OPEN_WEIGHT = 1; // opening a hub
export const HUB_MOOD_WEIGHT = 1; // a daily mood check-in that maps to a hub
const THRESHOLD = 2; // need a focus, or sustained behavior — guards against one-tap thrashing
const MAX_FORYOU = 4; // keep "For you" a tight, meaningful set

type Affinity = Record<string, { s: number; t: number }>; // score at last update + timestamp (ms)

let cache: Affinity | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<Affinity> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null; // validate shape so a corrupt blob can't crash rankForYou
    cache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Affinity) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(cache ?? {})).catch(() => {});
  listeners.forEach((l) => l());
}

// Exponential time-decay so recent engagement matters more and stale interest fades.
function decayed(s: number, t: number, now: number): number {
  if (s <= 0) return 0;
  return s * Math.pow(0.5, (now - t) / HALF_LIFE);
}

/** Record interest in a hub (opening it, or a mood that maps to it). Fire-and-forget. */
export function bumpHub(hubId: string, amount: number): void {
  void (async () => {
    await load();
    const now = Date.now();
    const cur = cache![hubId];
    const base = cur ? decayed(cur.s, cur.t, now) : 0;
    cache![hubId] = { s: base + amount, t: now };
    persist();
  })();
}

function rankForYou(focuses: string[], aff: Affinity, now: number): Hub[] {
  const focusIds = new Set(hubsForFocuses(focuses).map((h) => h.id));
  return HUBS.map((h) => {
    const beh = aff[h.id] ? decayed(aff[h.id].s, aff[h.id].t, now) : 0;
    return { id: h.id, score: (focusIds.has(h.id) ? FOCUS_BASE : 0) + beh };
  })
    .filter((x) => x.score >= THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_FORYOU)
    .map((x) => getHub(x.id))
    .filter((h): h is Hub => !!h);
}

export async function getForYou(focuses: string[]): Promise<Hub[]> {
  return rankForYou(focuses, await load(), Date.now());
}

/** Re-read affinity from storage + notify - cloud sync calls this after writing a merged value. */
export async function reloadAffinity(): Promise<void> {
  cache = null;
  await load();
  listeners.forEach((l) => l());
}

export function subscribeAffinity(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Reactive "For you". Seeds synchronously from onboarding focuses (no flash for onboarded users),
 *  then refines with behavioral affinity and updates whenever affinity changes. */
export function useForYou(focuses: string[]): Hub[] {
  const [list, setList] = useState<Hub[]>(() => hubsForFocuses(focuses).slice(0, MAX_FORYOU));
  useEffect(() => {
    let active = true;
    const refresh = () => getForYou(focuses).then((h) => active && setList(h));
    refresh();
    const unsub = subscribeAffinity(refresh);
    return () => {
      active = false;
      unsub();
    };
    // re-run only when the focus set actually changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focuses.join(',')]);
  return list;
}
