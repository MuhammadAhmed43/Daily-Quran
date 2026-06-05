// PRAYER (onyx) — prayer times, countdown, the private fard tracker, adhan toggle, and a Qibla entry.
// A pushed stack screen (reached from Today's My Prayer card + the Reminders settings), so it has a
// proper back button. Logic preserved verbatim (adhan-js times, notif scheduling, prayer-log).
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { PrayerTracker } from '@/components/prayer/prayer-tracker';
import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { Toggle } from '@/components/ui/settings';
import { haptic } from '@/lib/haptics';
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
import { c, font, radius, space } from '@/lib/theme';

type State = 'loading' | 'ready' | 'denied' | 'error';

export default function PrayerScreen() {
  const router = useRouter();
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
  const times = useMemo(() => (coords ? computeTimes(coords.lat, coords.lng, new Date(dayKey)) : null), [coords, dayKey]);
  const next = useMemo(() => (coords ? nextPrayer(coords.lat, coords.lng, now) : null), [coords, now]);

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
    haptic.light();
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
    <Screen stars>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.topBar}>
        <IconButton
          name="chevron-back"
          onPress={() => {
            haptic.light();
            router.back();
          }}
          diameter={38}
          size={22}
          bg={c.surface2}
          color={c.textPrimary}
        />
        <Txt variant="cardTitle">Prayer</Txt>
        <View style={styles.topSpacer} />
      </View>

      {state === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
          <Txt variant="body" color={c.textMuted} style={styles.muted}>
            Getting your location…
          </Txt>
        </View>
      )}

      {state === 'denied' && (
        <View style={styles.center}>
          <Txt variant="h2">Location needed</Txt>
          <Txt variant="body" color={c.textMuted} style={styles.muted}>
            Prayer times are calculated from your location. Enable location access to continue.
          </Txt>
          <PressableScale style={styles.primaryBtn} onPress={load}>
            <Txt style={styles.primaryBtnText}>Try again</Txt>
          </PressableScale>
        </View>
      )}

      {state === 'error' && (
        <View style={styles.center}>
          <Txt variant="body" color={c.textSecondary}>
            Couldn’t get your location.
          </Txt>
          <PressableScale style={styles.primaryBtn} onPress={load}>
            <Txt style={styles.primaryBtnText}>Retry</Txt>
          </PressableScale>
        </View>
      )}

      {state === 'ready' && times && next && (
        <ScrollView style={styles.fill} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Txt variant="caption" color={c.textMuted} style={styles.dateLine}>
            {place ?? 'Your location'} · {now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
          </Txt>

          <View style={styles.nextCard}>
            <Txt variant="eyebrow" color={c.accent}>
              Next · {LABELS[next.name]}
            </Txt>
            <Txt style={styles.nextCountdown}>{countdown()}</Txt>
            <Txt variant="caption" color={c.textMuted}>
              at {formatTime(next.time)}
            </Txt>
          </View>

          <PrayerTracker times={times} now={now} />

          <View style={styles.listCard}>
            {DISPLAY_ORDER.map((p, i) => {
              const isNext = p === next.name;
              const last = i === DISPLAY_ORDER.length - 1;
              return (
                <View key={p} style={[styles.row, last && styles.rowLast, isNext && styles.rowActive]}>
                  <Txt style={[styles.rowLabel, isNext && styles.rowActiveText]}>{LABELS[p]}</Txt>
                  <Txt style={[styles.rowTime, isNext && styles.rowActiveText]}>{formatTime(times[p])}</Txt>
                </View>
              );
            })}
          </View>

          <View style={styles.alertCard}>
            <Ionicons name="notifications-outline" size={20} color={c.accent} />
            <View style={styles.alertText}>
              <Txt variant="cardTitle">Adhan alerts</Txt>
              <Txt variant="caption" color={c.textMuted}>
                {busy ? 'Updating…' : alertsOn ? 'On for today’s prayers' : 'A gentle call at each prayer time'}
              </Txt>
            </View>
            <Toggle value={alertsOn} onValueChange={() => toggleAlerts()} disabled={busy} />
          </View>

          <PressableScale
            style={styles.qiblaBtn}
            onPress={() => {
              haptic.light();
              router.push({ pathname: '/qibla', params: { lat: String(coords!.lat), lng: String(coords!.lng) } });
            }}>
            <Ionicons name="compass-outline" size={18} color={c.accent} />
            <Txt style={styles.qiblaText}>Find the Qibla</Txt>
          </PressableScale>

          <Txt variant="caption" color={c.textMuted} style={styles.footer}>
            Muslim World League · Shafiʿi (Asr) · your local timezone
          </Txt>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: space.sm },
  topSpacer: { width: 38 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  muted: { textAlign: 'center' },
  primaryBtn: { backgroundColor: c.primary, paddingVertical: 13, paddingHorizontal: 28, borderRadius: radius.full, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { color: c.bg, fontFamily: font.sansSemi, fontSize: 15.5 },
  content: { paddingHorizontal: space.gutter, gap: 16, paddingBottom: 28 },
  dateLine: { marginTop: 2 },
  nextCard: {
    alignItems: 'center',
    gap: 5,
    paddingVertical: 24,
    borderRadius: radius.lg,
    backgroundColor: c.surface1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  nextCountdown: { fontFamily: font.serif, fontSize: 40, lineHeight: 48, color: c.textPrimary, fontVariant: ['tabular-nums'] },
  listCard: { borderRadius: radius.lg, backgroundColor: c.surface1, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairline,
  },
  rowLast: { borderBottomWidth: 0 },
  rowActive: { backgroundColor: 'rgba(201,189,166,0.10)', borderRadius: radius.sm, paddingHorizontal: 10, marginHorizontal: -10 },
  rowLabel: { fontFamily: font.sansMed, fontSize: 16, color: c.textSecondary },
  rowTime: { fontFamily: font.sansMed, fontSize: 16, color: c.textSecondary, fontVariant: ['tabular-nums'] },
  rowActiveText: { color: c.textPrimary, fontFamily: font.sansSemi },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: c.surface1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  alertText: { flex: 1, gap: 2 },
  qiblaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,189,166,0.45)',
    backgroundColor: 'rgba(201,189,166,0.08)',
  },
  qiblaText: { fontFamily: font.sansSemi, fontSize: 15.5, color: c.accent },
  footer: { textAlign: 'center', paddingBottom: 8 },
});
