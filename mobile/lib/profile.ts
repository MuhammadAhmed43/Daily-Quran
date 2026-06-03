// The on-device user profile from onboarding — the INPUT that curates every surface: which Home
// modules render, which study-plan track is default, which topical hubs float up, and the
// assistant's tone. Local-first (sensitive fields never leave the device until an explicit sync
// consent). Same cache + pub/sub pattern as bookmarks.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type Journey = 'practicing' | 'learning' | 'exploring' | 'academic' | 'unspecified';
export type Knowledge = 'new' | 'some' | 'comfortable' | 'advanced';
export type AgeBand = 'u13' | '13-17' | '18-24' | '25-34' | '35-49' | '50+' | 'unspecified';

// Goals & focuses are open string lists so we can add options without a migration. Canonical ids:
//   goals:   'habit' | 'meaning' | 'hifz' | 'peace' | 'history' | 'prayer'
//   focuses: 'anxiety' | 'hopelessness' | 'doubt' | 'temptation' | 'grief' | 'relationships' | 'curious'
export type Profile = {
  onboarded: boolean;
  journey: Journey;
  knowledge: Knowledge;
  ageBand: AgeBand;
  goals: string[];
  focuses: string[]; // sensitive, optional
  dailyMinutes: number; // 2 | 5 | 10 | 15
  reminderAt: string | null; // 'HH:mm'
  lang: 'en';
  translit: boolean;
  lens: 'mainstream'; // Sunni-mainstream lane (locked for now)
  updatedAt: number;
};

export const DEFAULT_PROFILE: Profile = {
  onboarded: false,
  journey: 'unspecified',
  knowledge: 'new',
  ageBand: 'unspecified',
  goals: [],
  focuses: [],
  dailyMinutes: 5,
  reminderAt: null,
  lang: 'en',
  translit: false,
  lens: 'mainstream',
  updatedAt: 0,
};

const KEY = 'daily-quran:profile';
let cache: Profile | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<Profile> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    // merge over defaults so older saved profiles pick up any new fields
    cache = raw
      ? { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<Profile>) }
      : { ...DEFAULT_PROFILE };
  } catch {
    cache = { ...DEFAULT_PROFILE };
  }
  return cache;
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(cache ?? DEFAULT_PROFILE)).catch(() => {});
  listeners.forEach((l) => l());
}

export function subscribeProfile(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function getProfile(): Promise<Profile> {
  return load();
}

/** Merge a patch into the profile and persist. */
export async function updateProfile(patch: Partial<Profile>): Promise<Profile> {
  await load();
  cache = { ...cache!, ...patch, updatedAt: Date.now() };
  persist();
  return cache;
}

/** Save onboarding answers and mark setup complete (also used by "skip"). */
export async function completeOnboarding(patch: Partial<Profile> = {}): Promise<void> {
  await updateProfile({ ...patch, onboarded: true });
}

/** Reactive profile + a `loaded` flag so the onboarding gate doesn't flash before load. */
export function useProfile(): { profile: Profile; loaded: boolean } {
  const [profile, setProfile] = useState<Profile>(cache ?? DEFAULT_PROFILE);
  const [loaded, setLoaded] = useState<boolean>(cache !== null);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      getProfile().then((p) => {
        if (!active) return;
        setProfile({ ...p });
        setLoaded(true);
      });
    refresh();
    const unsub = subscribeProfile(refresh);
    return () => {
      active = false;
      unsub();
    };
  }, []);
  return { profile, loaded };
}
