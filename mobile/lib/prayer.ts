import { CalculationMethod, Coordinates, Madhab, PrayerTimes, Qibla } from 'adhan';
import * as Notifications from 'expo-notifications';

// Show the adhan alert even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

export async function ensureNotifPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: true },
  });
  return req.granted;
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
  await Notifications.cancelAllScheduledNotificationsAsync();
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
  await Notifications.cancelAllScheduledNotificationsAsync();
}
