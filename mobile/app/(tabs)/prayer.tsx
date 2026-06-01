import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  DISPLAY_ORDER,
  LABELS,
  cancelAdhan,
  computeTimes,
  ensureNotifPermission,
  formatTime,
  nextPrayer,
  scheduleAdhan,
} from '@/lib/prayer';

type State = 'loading' | 'ready' | 'denied' | 'error';

export default function PrayerScreen() {
  const [state, setState] = useState<State>('loading');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [alertsOn, setAlertsOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  async function load() {
    setState('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState('denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setState('ready');
      try {
        const geo = await Location.reverseGeocodeAsync(loc.coords);
        if (geo[0]) setPlace([geo[0].city, geo[0].region].filter(Boolean).join(', ') || null);
      } catch {
        // reverse-geocode is best-effort
      }
    } catch {
      setState('error');
    }
  }

  useEffect(() => {
    load();
  }, []);

  const dayKey = now.toDateString();
  const times = useMemo(
    () => (coords ? computeTimes(coords.lat, coords.lng, new Date(dayKey)) : null),
    [coords, dayKey],
  );
  const next = useMemo(
    () => (coords ? nextPrayer(coords.lat, coords.lng, now) : null),
    [coords, now],
  );

  function countdown(): string {
    if (!next) return '';
    const ms = Math.max(0, next.time.getTime() - now.getTime());
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
  }

  async function toggleAlerts() {
    if (!coords) return;
    setBusy(true);
    try {
      if (alertsOn) {
        await cancelAdhan();
        setAlertsOn(false);
      } else {
        if (!(await ensureNotifPermission())) return;
        const n = await scheduleAdhan(coords.lat, coords.lng);
        setAlertsOn(n > 0);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.container}>
        {state === 'loading' && (
          <View style={styles.center}>
            <ActivityIndicator />
            <ThemedText style={styles.muted}>Getting your location…</ThemedText>
          </View>
        )}

        {state === 'denied' && (
          <View style={styles.center}>
            <ThemedText type="subtitle">Location needed</ThemedText>
            <ThemedText style={styles.muted}>
              Prayer times are calculated from your location. Enable location access to continue.
            </ThemedText>
            <Pressable style={styles.btn} onPress={load}>
              <ThemedText style={styles.btnText}>Try again</ThemedText>
            </Pressable>
          </View>
        )}

        {state === 'error' && (
          <View style={styles.center}>
            <ThemedText>Couldn&apos;t get your location.</ThemedText>
            <Pressable style={styles.btn} onPress={load}>
              <ThemedText style={styles.btnText}>Retry</ThemedText>
            </Pressable>
          </View>
        )}

        {state === 'ready' && times && next && (
          <View style={styles.content}>
            <View style={styles.header}>
              <ThemedText type="title">Prayer</ThemedText>
              <ThemedText style={styles.muted}>
                {place ?? 'Your location'} ·{' '}
                {now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
              </ThemedText>
            </View>

            <View style={styles.nextCard}>
              <ThemedText style={styles.nextLabel}>Next · {LABELS[next.name]}</ThemedText>
              <ThemedText style={styles.nextCountdown}>{countdown()}</ThemedText>
              <ThemedText style={styles.muted}>at {formatTime(next.time)}</ThemedText>
            </View>

            <View style={styles.listCard}>
              {DISPLAY_ORDER.map((p, i) => {
                const isNext = p === next.name;
                const last = i === DISPLAY_ORDER.length - 1;
                return (
                  <View key={p} style={[styles.row, last && styles.rowLast, isNext && styles.rowActive]}>
                    <ThemedText style={[styles.rowLabel, isNext && styles.rowActiveText]}>
                      {LABELS[p]}
                    </ThemedText>
                    <ThemedText style={[styles.rowTime, isNext && styles.rowActiveText]}>
                      {formatTime(times[p])}
                    </ThemedText>
                  </View>
                );
              })}
            </View>

            <Pressable
              style={[styles.btn, alertsOn && styles.btnOn]}
              onPress={toggleAlerts}
              disabled={busy}>
              <ThemedText style={styles.btnText}>
                {busy ? '…' : alertsOn ? '🔔 Adhan alerts on — tap to turn off' : 'Enable adhan alerts'}
              </ThemedText>
            </Pressable>

            <ThemedText style={styles.footer}>
              Muslim World League · Shafiʿi (Asr) · your local timezone
            </ThemedText>
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  muted: { opacity: 0.6, textAlign: 'center' },
  content: { flex: 1, paddingHorizontal: 16, gap: 16 },
  header: { paddingTop: 12, gap: 4 },
  nextCard: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(127,127,127,0.1)',
  },
  nextLabel: { fontSize: 14, opacity: 0.7 },
  nextCountdown: { fontSize: 40, lineHeight: 48, fontWeight: '700', fontVariant: ['tabular-nums'] },
  listCard: { borderRadius: 16, backgroundColor: 'rgba(127,127,127,0.06)', paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
  },
  rowLast: { borderBottomWidth: 0 },
  rowActive: { backgroundColor: 'rgba(10,126,164,0.12)', borderRadius: 10, paddingHorizontal: 10, marginHorizontal: -10 },
  rowLabel: { fontSize: 16 },
  rowTime: { fontSize: 16, fontVariant: ['tabular-nums'], opacity: 0.85 },
  rowActiveText: { fontWeight: '700', opacity: 1 },
  btn: { backgroundColor: '#0a7ea4', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnOn: { backgroundColor: '#2e7d32' },
  btnText: { color: '#fff', fontWeight: '600' },
  footer: { fontSize: 12, opacity: 0.5, textAlign: 'center', paddingBottom: 8 },
});
