// prayer-times.ts — gates the Today prayer tracker so a prayer cannot be marked before its time has come
// (e.g. you cannot tick Isha before Isha). Today's times are computed from the user's location via adhan.
// Location is used SILENTLY: we reuse a cached position and only fetch GPS when we have none AND permission
// is ALREADY granted — we never prompt from Today (the dedicated Prayer screen handles the permission flow).
// If location is unknown, the gate is OPEN (all prayers markable) so the user is never blocked by missing data.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { computeTimes, FARD, type FardName } from './prayer';

const COORDS_KEY = 'daily-quran:coords';
type Coords = { lat: number; lng: number };
let coordsCache: Coords | null = null;

async function loadCoords(): Promise<Coords | null> {
  if (coordsCache) return coordsCache;
  try {
    const raw = await AsyncStorage.getItem(COORDS_KEY);
    coordsCache = raw ? (JSON.parse(raw) as Coords) : null;
  } catch {
    coordsCache = null;
  }
  return coordsCache;
}

function saveCoords(c: Coords): void {
  coordsCache = c;
  AsyncStorage.setItem(COORDS_KEY, JSON.stringify(c)).catch(() => {});
}

export type PrayerGate = { occurred: Record<FardName, boolean>; known: boolean };
const ALL_OPEN: Record<FardName, boolean> = { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true };

/** For each fard prayer, whether its time has come today (so it may be marked). See file header for the
 *  location policy. `known` is false when we have no location (gate open). */
export function usePrayerGate(): PrayerGate {
  const [coords, setCoords] = useState<Coords | null>(coordsCache);
  const [now, setNow] = useState(() => new Date());

  // re-check periodically so a prayer unlocks shortly after its time passes (no need for second precision)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const cached = await loadCoords();
      if (cached) {
        if (active) setCoords(cached);
        return; // have a position (city-level is plenty for prayer times) — skip GPS
      }
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) return; // never prompt from Today
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        const c = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        saveCoords(c);
        if (active) setCoords(c);
      } catch {
        // best-effort; gate stays open if this fails
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!coords) return { occurred: ALL_OPEN, known: false };
  const times = computeTimes(coords.lat, coords.lng, now);
  const occurred = { ...ALL_OPEN };
  for (const p of FARD) occurred[p] = now.getTime() >= times[p].getTime();
  return { occurred, known: true };
}
