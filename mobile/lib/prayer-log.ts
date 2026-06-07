// The private daily prayer log — a quiet record of the five fard prayers, for the user alone. Same
// cache + pub/sub + hook pattern as the other on-device stores; day boundaries reuse streak.ts's
// dayKey. DELIBERATELY non-gamified: marking a prayer logs `prayer_logged`, which is NOT a streak-
// qualifying activity (see streak.ts QUALIFYING), so worship is never turned into a score. It IS backed
// up to the user's OWN private cloud row (RLS-protected, never shared or community-visible) like the
// other personal stores — "private" means not gamified / not social, not device-only.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { FARD, type FardName } from './prayer';
import { dayKey, recordActivity } from './streak';

type DayMark = Partial<Record<FardName, true>>; // only prayed prayers are stored
type Store = { v: 1; days: Record<string, DayMark> }; // keyed by local YYYY-MM-DD

const KEY = 'daily-quran:prayer-log';
const EMPTY: Store = { v: 1, days: {} };
let cache: Store | null = null;
const listeners = new Set<() => void>();

function migrate(raw: unknown): Store {
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<Store>;
    if (r.v === 1 && r.days && typeof r.days === 'object') return { v: 1, days: r.days as Record<string, DayMark> };
  }
  return { v: 1, days: {} };
}

async function load(): Promise<Store> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? migrate(JSON.parse(raw)) : { v: 1, days: {} };
  } catch {
    cache = { v: 1, days: {} };
  }
  return cache;
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(cache ?? EMPTY)).catch(() => {});
  listeners.forEach((l) => l());
}

/** Re-read the prayer log from storage + notify - cloud sync calls this after writing a merged value. */
export async function reloadPrayerLog(): Promise<void> {
  cache = null;
  await load();
  listeners.forEach((l) => l());
}

export function subscribePrayerLog(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export async function getPrayerLog(): Promise<Store> {
  return load();
}

/** Toggle a fard prayer for today. Marking ON logs `prayer_logged` (non-qualifying — never gamifies
 *  worship); unmarking does not log. Empty days are pruned so the store stays small. */
export function togglePrayer(name: FardName): void {
  void (async () => {
    await load();
    const k = dayKey(new Date());
    const day = (cache!.days[k] ??= {});
    if (day[name]) {
      delete day[name];
      if (Object.keys(day).length === 0) delete cache!.days[k];
    } else {
      day[name] = true;
      recordActivity('prayer_logged');
    }
    persist();
  })();
}

export type DayPrayers = { key: string; marks: Record<FardName, boolean>; count: number };

function marksFor(store: Store, key: string): Record<FardName, boolean> {
  const d = store.days[key] ?? {};
  return { fajr: !!d.fajr, dhuhr: !!d.dhuhr, asr: !!d.asr, maghrib: !!d.maghrib, isha: !!d.isha };
}
function countFor(store: Store, key: string): number {
  return FARD.reduce((n, p) => n + (store.days[key]?.[p] ? 1 : 0), 0);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export type PrayerLogView = {
  today: Record<FardName, boolean>;
  todayCount: number;
  last7: DayPrayers[]; // oldest -> today
  toggle: (name: FardName) => void;
};

function derive(store: Store): Omit<PrayerLogView, 'toggle'> {
  const todayKey = dayKey(new Date());
  const last7: DayPrayers[] = [];
  for (let i = 6; i >= 0; i--) {
    const key = dayKey(addDays(new Date(), -i));
    last7.push({ key, marks: marksFor(store, key), count: countFor(store, key) });
  }
  return { today: marksFor(store, todayKey), todayCount: countFor(store, todayKey), last7 };
}

export function usePrayerLog(): PrayerLogView {
  const [store, setStore] = useState<Store>(() => cache ?? EMPTY);
  useEffect(() => {
    let active = true;
    const refresh = () => getPrayerLog().then((s) => active && setStore({ ...s }));
    refresh();
    const unsub = subscribePrayerLog(refresh);
    return () => {
      active = false;
      unsub();
    };
  }, []);
  return { ...derive(store), toggle: togglePrayer };
}
