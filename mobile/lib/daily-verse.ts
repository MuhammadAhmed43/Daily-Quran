// Daily-verse reminder: a gentle once-a-day local notification carrying THAT day's verse. The verse is
// the deterministic resolveToday() pick for each date, rendered from the verified Qur'an bundle - never
// from an LLM. Like the adhan, it's a rolling window of dated notifications, topped up on app open
// (iOS caps pending notifications at 64; 14 verse + ~10 adhan stays well under).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { cancelByType, ensureNotifPermission } from './notifications';
import { getVerse, resolveToday } from './today';

const KEY = 'daily-quran:verse-notif';
const DAYS = 14;

export type VerseNotifPrefs = { enabled: boolean; hour: number; minute: number };
const DEFAULT: VerseNotifPrefs = { enabled: false, hour: 8, minute: 0 };

function clamp(n: unknown, max: number, fallback: number): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : fallback;
}

export async function getVerseNotifPrefs(): Promise<VerseNotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const p = JSON.parse(raw) as Partial<VerseNotifPrefs>;
    return { enabled: !!p.enabled, hour: clamp(p.hour, 23, 8), minute: clamp(p.minute, 59, 0) };
  } catch {
    return DEFAULT;
  }
}

async function savePrefs(p: VerseNotifPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
}

function trim(s: string, n = 170): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

// Schedule the next DAYS daily-verse reminders at hour:minute local time. Cancels existing daily-verse
// notifications first (leaves adhan untouched). Returns how many were scheduled.
export async function scheduleDailyVerse(hour: number, minute: number): Promise<number> {
  await cancelByType('daily_verse');
  const now = new Date();
  let count = 0;
  for (let d = 0; d < DAYS; d++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, hour, minute, 0, 0);
    if (date.getTime() <= now.getTime()) continue; // today's time already passed -> start tomorrow
    const r = resolveToday(date).refs[0];
    const v = r ? getVerse(r.surah, r.ayah) : null;
    if (!v) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🌙 Today's verse · ${v.surahEnglish} ${v.surah}:${v.ayah}`,
        body: trim(v.en),
        sound: false,
        data: { type: 'daily_verse', surah: v.surah, ayah: v.ayah },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
    count++;
  }
  return count;
}

// Turn the reminder on (asks permission) or off, and persist the choice. If permission is denied,
// `enabled` comes back false so the UI can reflect that.
export async function setVerseNotif(enabled: boolean, hour: number, minute: number): Promise<VerseNotifPrefs> {
  if (enabled) {
    if (!(await ensureNotifPermission())) {
      const prefs = { enabled: false, hour, minute };
      await savePrefs(prefs);
      return prefs;
    }
    await scheduleDailyVerse(hour, minute);
  } else {
    await cancelByType('daily_verse');
  }
  const prefs = { enabled, hour, minute };
  await savePrefs(prefs);
  return prefs;
}

// Top-up on app open so the rolling window never runs dry. Safe to call often - it only re-schedules
// daily-verse notifications, and no-ops when the reminder is off or permission was revoked.
export async function refreshDailyVerse(): Promise<void> {
  const prefs = await getVerseNotifPrefs();
  if (!prefs.enabled) return;
  if (!(await ensureNotifPermission())) return;
  await scheduleDailyVerse(prefs.hour, prefs.minute);
}

// Fire a one-off reminder a few seconds from now with TODAY's verse, so you can see exactly what the
// daily notification looks like without waiting until morning. Returns false if permission is denied.
export async function previewDailyVerse(): Promise<boolean> {
  if (!(await ensureNotifPermission())) return false;
  const r = resolveToday().refs[0];
  const v = r ? getVerse(r.surah, r.ayah) : null;
  if (!v) return false;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🌙 Today's verse · ${v.surahEnglish} ${v.surah}:${v.ayah}`,
      body: trim(v.en),
      sound: false,
      data: { type: 'daily_verse', surah: v.surah, ayah: v.ayah, preview: true },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 4, repeats: false },
  });
  return true;
}
