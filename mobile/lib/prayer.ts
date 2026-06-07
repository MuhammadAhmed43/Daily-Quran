import AsyncStorage from '@react-native-async-storage/async-storage';
import { CalculationMethod, Coordinates, Madhab, PrayerTimes, Qibla } from 'adhan';
import * as Notifications from 'expo-notifications';

import { cancelByType, ensureNotifPermission } from './notifications';

// Re-exported so existing callers (app/(tabs)/prayer.tsx) keep importing it from here. The notification
// handler + permission prompt now live in lib/notifications.ts (shared with the daily-verse reminder).
export { ensureNotifPermission };

export type PrayerName = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export type Method =
  | 'MuslimWorldLeague'
  | 'Egyptian'
  | 'Karachi'
  | 'UmmAlQura'
  | 'NorthAmerica'
  | 'Dubai'
  | 'Qatar'
  | 'Kuwait'
  | 'Singapore'
  | 'Turkey';
export type MadhabName = 'shafi' | 'hanafi';

// Sunrise is displayed but is not a prayer (no notification, not "next").
export const DISPLAY_ORDER: PrayerName[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

// The five obligatory (fard) prayers — sunrise is shown in the list but is not a prayer.
export type FardName = Exclude<PrayerName, 'sunrise'>;
export const FARD: FardName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export const LABELS: Record<PrayerName, string> = {
  fajr: 'Fajr',
  sunrise: 'Sunrise',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

function buildParams(method: Method, madhab: MadhabName) {
  const params = (CalculationMethod as Record<string, () => any>)[method]();
  params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  return params;
}

export function computeTimes(
  lat: number,
  lng: number,
  date: Date = new Date(),
  method: Method = 'MuslimWorldLeague',
  madhab: MadhabName = 'shafi',
): Record<PrayerName, Date> {
  const pt = new PrayerTimes(new Coordinates(lat, lng), date, buildParams(method, madhab));
  return {
    fajr: pt.fajr,
    sunrise: pt.sunrise,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  };
}

export function nextPrayer(
  lat: number,
  lng: number,
  now: Date = new Date(),
  method: Method = 'MuslimWorldLeague',
  madhab: MadhabName = 'shafi',
): { name: PrayerName; time: Date } {
  const today = computeTimes(lat, lng, now, method, madhab);
  for (const p of FARD) {
    if (today[p].getTime() > now.getTime()) return { name: p, time: today[p] };
  }
  // After Isha → tomorrow's Fajr
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return { name: 'fajr', time: computeTimes(lat, lng, tomorrow, method, madhab).fajr };
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function qiblaDirection(lat: number, lng: number): number {
  return Qibla(new Coordinates(lat, lng));
}

// Schedule adhan notifications for upcoming prayers over the next `days`.
// Rolling window — re-run on app open (iOS caps pending notifications at 64).
export async function scheduleAdhan(
  lat: number,
  lng: number,
  method: Method = 'MuslimWorldLeague',
  madhab: MadhabName = 'shafi',
  days = 2,
): Promise<number> {
  await cancelByType('adhan');
  const now = new Date();
  let count = 0;
  for (let d = 0; d < days; d++) {
    const date = new Date(now);
    date.setDate(now.getDate() + d);
    const times = computeTimes(lat, lng, date, method, madhab);
    for (const p of FARD) {
      const t = times[p];
      if (t.getTime() > now.getTime()) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${LABELS[p]} 🕌`,
            body: `It's time for ${LABELS[p]} prayer.`,
            sound: true,
            data: { type: 'adhan', prayer: p },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: t },
        });
        count++;
      }
    }
  }
  return count;
}

export async function cancelAdhan(): Promise<void> {
  await cancelByType('adhan');
}

// ---- adhan on/off preference + app-open TOP-UP ----
// scheduleAdhan only schedules a rolling window; without a top-up the alerts silently STOP once the
// window runs out (a couple of days). We persist the on/off choice (so it survives relaunch) and
// re-schedule on app open. Mirrors the daily-verse reminder.
const ADHAN_KEY = 'daily-quran:adhan';
const COORDS_KEY = 'daily-quran:coords'; // shared with the prayer-time gate
const ADHAN_DAYS = 7; // 5 prayers x 7 = 35 pending — comfortably under iOS's 64 cap alongside the daily verse
let adhanEnabledCache: boolean | null = null;

export async function getAdhanEnabled(): Promise<boolean> {
  if (adhanEnabledCache != null) return adhanEnabledCache;
  try {
    const raw = await AsyncStorage.getItem(ADHAN_KEY);
    const v = raw ? JSON.parse(raw) : null;
    adhanEnabledCache = !!(v && v.enabled);
  } catch {
    adhanEnabledCache = false;
  }
  return adhanEnabledCache;
}
async function persistAdhanEnabled(enabled: boolean): Promise<void> {
  adhanEnabledCache = enabled;
  try {
    await AsyncStorage.setItem(ADHAN_KEY, JSON.stringify({ enabled }));
  } catch {}
}
async function loadSavedCoords(): Promise<{ lat: number; lng: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(COORDS_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v.lat === 'number' && typeof v.lng === 'number' ? { lat: v.lat, lng: v.lng } : null;
  } catch {
    return null;
  }
}

// Turn adhan alerts on/off and PERSIST the choice. Saves the location too, so the app-open top-up can
// reschedule even before the prayer screen is opened again. Returns the resulting enabled state.
export async function setAdhan(enabled: boolean, lat: number, lng: number): Promise<boolean> {
  if (enabled) {
    if (!(await ensureNotifPermission())) {
      await persistAdhanEnabled(false);
      return false;
    }
    try {
      await AsyncStorage.setItem(COORDS_KEY, JSON.stringify({ lat, lng }));
    } catch {}
    await scheduleAdhan(lat, lng, 'MuslimWorldLeague', 'shafi', ADHAN_DAYS);
  } else {
    await cancelAdhan();
  }
  await persistAdhanEnabled(enabled);
  return enabled;
}

// Top up the rolling window on app open. No-op unless adhan is enabled, permission is granted, and a
// saved location exists. In-flight guarded so concurrent calls can't double-schedule.
let refreshingAdhan = false;
export async function refreshAdhan(): Promise<void> {
  if (refreshingAdhan) return;
  if (!(await getAdhanEnabled())) return;
  if (!(await ensureNotifPermission())) return;
  const coords = await loadSavedCoords();
  if (!coords) return;
  refreshingAdhan = true;
  try {
    await scheduleAdhan(coords.lat, coords.lng, 'MuslimWorldLeague', 'shafi', ADHAN_DAYS);
  } finally {
    refreshingAdhan = false;
  }
}
