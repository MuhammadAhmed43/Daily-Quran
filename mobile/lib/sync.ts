/* eslint-disable @typescript-eslint/no-explicit-any */
// Cloud sync orchestrator. On a permanent (non-guest) account it runs PULL -> MERGE (lib/sync-merge) ->
// WRITE-LOCAL + reload caches -> PUSH, on app start, on every auth change, and on app-foreground/-
// background. Guests never sync. Best-effort: any failure just retries next time, never blocks the UI.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

import { reloadBookmarks, subscribeBookmarks } from './bookmarks';
import { refreshDailyVerse } from './daily-verse';
import { reloadAffinity, subscribeAffinity } from './hub-affinity';
import { reloadPlans, subscribePlans } from './plan-progress';
import { reloadPrayerLog, subscribePrayerLog } from './prayer-log';
import { reloadProfile, subscribeProfile } from './profile';
import { reloadQuiz, subscribeQuiz } from './quiz';
import { reloadQuranPlan, subscribeQuranPlan } from './quran-plan-progress';
import { reloadStreak, subscribeStreak } from './streak';
import { supabase } from './supabase';
import {
  SYNC_KEYS,
  mergeAffinity,
  mergeBookmarks,
  mergeJourneys,
  mergeKeepLocal,
  mergeLedger,
  mergePrayerLog,
  mergeProfile,
  mergeQuiz,
  mergeQuranPlan,
  mergeTranslation,
} from './sync-merge';
import { hydrateTranslation } from './translations';

type Entry = {
  key: string;
  raw?: boolean; // value stored as a bare string (translation), not JSON
  merge: (local: any, remote: any) => any;
  apply: () => Promise<void>; // refresh the store's cache + notify listeners after the key is rewritten
};

const noop = async () => {};

// Order matters only for readability; each store is independent.
const ENTRIES: Entry[] = [
  { key: SYNC_KEYS.profile, merge: mergeProfile, apply: reloadProfile },
  { key: SYNC_KEYS.activity, merge: mergeLedger, apply: reloadStreak },
  { key: SYNC_KEYS.bookmarks, merge: mergeBookmarks, apply: reloadBookmarks },
  { key: SYNC_KEYS.prayerLog, merge: mergePrayerLog, apply: reloadPrayerLog },
  { key: SYNC_KEYS.quranPlan, merge: mergeQuranPlan, apply: reloadQuranPlan },
  { key: SYNC_KEYS.journeys, merge: mergeJourneys, apply: reloadPlans },
  { key: SYNC_KEYS.affinity, merge: mergeAffinity, apply: reloadAffinity },
  { key: SYNC_KEYS.quiz, merge: mergeQuiz, apply: reloadQuiz },
  { key: SYNC_KEYS.translation, raw: true, merge: mergeTranslation, apply: hydrateTranslation },
  { key: SYNC_KEYS.verseNotif, merge: mergeKeepLocal, apply: refreshDailyVerse },
  { key: SYNC_KEYS.lastRead, merge: mergeKeepLocal, apply: noop },
];

const UID_KEY = 'daily-quran:sync-uid';
let running = false;
let started = false;
let lastSyncedAt: number | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// Push local changes a few seconds after they settle. Guarded by `running` so the notifications our own
// merge-reloads emit never re-trigger a sync (no loop).
function scheduleSync(): void {
  if (running) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void syncNow();
  }, 4000);
}

async function readLocal(key: string, raw?: boolean): Promise<any> {
  const v = await AsyncStorage.getItem(key);
  if (v == null) return null;
  if (raw) return v;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}
async function writeLocal(key: string, value: any, raw?: boolean): Promise<void> {
  if (value == null) await AsyncStorage.removeItem(key);
  else await AsyncStorage.setItem(key, raw ? String(value) : JSON.stringify(value));
}

async function permanentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  return u && !u.is_anonymous ? u.id : null;
}

// One full sync pass. Returns true if it actually ran (permanent user + not already running).
export async function syncNow(): Promise<boolean> {
  if (running || !supabase) return false;
  const uid = await permanentUserId();
  if (!uid) return false; // guests + signed-out never sync
  running = true;
  try {
    const { data: row, error: selErr } = await supabase
      .from('user_state')
      .select('state')
      .eq('user_id', uid)
      .maybeSingle();
    if (selErr) return false; // can't read (e.g. table/RLS not set up) -> bail, leave local untouched
    const remote: Record<string, any> = (row?.state as Record<string, any>) ?? {};
    const lastUid = await AsyncStorage.getItem(UID_KEY);
    // A DIFFERENT account synced on this device before -> adopt the cloud account's data wholesale
    // (don't merge the previous user's leftovers in). First-ever / same-user -> merge (true multi-device).
    const accountSwitch = lastUid != null && lastUid !== uid;

    const bundle: Record<string, any> = {};
    for (const e of ENTRIES) {
      const local = await readLocal(e.key, e.raw);
      const remoteVal = Object.prototype.hasOwnProperty.call(remote, e.key) ? remote[e.key] : null;
      const merged = accountSwitch ? remoteVal : e.merge(local, remoteVal);
      await writeLocal(e.key, merged, e.raw);
      await e.apply();
      if (merged != null) bundle[e.key] = merged;
    }
    const { error: upErr } = await supabase
      .from('user_state')
      .upsert({ user_id: uid, state: bundle, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (upErr) return false; // push failed -> report honestly; next trigger retries
    await AsyncStorage.setItem(UID_KEY, uid);
    lastSyncedAt = Date.now();
    return true;
  } catch {
    return false; // best-effort; next trigger retries
  } finally {
    running = false;
  }
}

export function getLastSyncedAt(): number | null {
  return lastSyncedAt;
}

// Start the sync loop once: now, on every auth change (sign-in/out), and on app foreground/background.
export function startSync(): void {
  if (started || !supabase) return;
  started = true;
  void syncNow();
  supabase.auth.onAuthStateChange(() => {
    void syncNow();
  });
  AppState.addEventListener('change', (s) => {
    if (s === 'active' || s === 'background') void syncNow();
  });
  // Auto-push shortly after any synced store changes (bookmark added, streak advanced, plan progressed).
  for (const sub of [
    subscribeProfile,
    subscribeStreak,
    subscribeBookmarks,
    subscribePrayerLog,
    subscribeQuranPlan,
    subscribePlans,
    subscribeAffinity,
    subscribeQuiz,
  ]) {
    sub(scheduleSync);
  }
}
