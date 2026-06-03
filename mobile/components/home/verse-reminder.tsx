// A small card on Home to switch on a once-a-day verse reminder, with a few preset times (so we need
// no native date-picker dependency). Toggling / picking a time schedules via lib/daily-verse.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { getVerseNotifPrefs, previewDailyVerse, setVerseNotif, type VerseNotifPrefs } from '@/lib/daily-verse';
import { haptic } from '@/lib/haptics';

const ACCENT = '#0a7ea4';
const PRESETS = [
  { label: 'Morning', hour: 8, minute: 0 },
  { label: 'Afternoon', hour: 14, minute: 0 },
  { label: 'Evening', hour: 20, minute: 0 },
] as const;

function fmt(hour: number, minute: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const ap = hour < 12 ? 'AM' : 'PM';
  return `${h12}:${String(minute).padStart(2, '0')} ${ap}`;
}

export function VerseReminder() {
  const [prefs, setPrefs] = useState<VerseNotifPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    getVerseNotifPrefs().then(setPrefs);
  }, []);

  if (!prefs) return null;

  const apply = async (enabled: boolean, hour: number, minute: number) => {
    if (busy) return;
    setBusy(true);
    haptic.light();
    const next = await setVerseNotif(enabled, hour, minute);
    setPrefs(next);
    setDenied(enabled && !next.enabled); // wanted it on, but permission was denied
    setBusy(false);
  };

  const preview = async () => {
    if (busy) return;
    haptic.light();
    const ok = await previewDailyVerse();
    if (!ok) {
      setDenied(true);
      return;
    }
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.left}>
          <ThemedText style={styles.title}>🔔 Daily verse reminder</ThemedText>
          <ThemedText style={styles.sub}>
            {prefs.enabled ? `Every day at ${fmt(prefs.hour, prefs.minute)}` : 'A verse to greet you each day'}
          </ThemedText>
        </View>
        <Switch
          value={prefs.enabled}
          onValueChange={(v) => apply(v, prefs.hour, prefs.minute)}
          trackColor={{ true: ACCENT, false: 'rgba(127,127,127,0.3)' }}
          disabled={busy}
        />
      </View>

      {prefs.enabled ? (
        <>
          <View style={styles.chips}>
            {PRESETS.map((p) => {
              const on = prefs.hour === p.hour && prefs.minute === p.minute;
              return (
                <Pressable
                  key={p.label}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => apply(true, p.hour, p.minute)}
                  disabled={busy}>
                  <ThemedText style={[styles.chipText, on && styles.chipTextOn]}>{p.label}</ThemedText>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={preview} disabled={busy} hitSlop={6} style={styles.preview}>
            <ThemedText style={styles.previewText}>
              {sent ? '✓ Sent — check your notifications' : 'Preview now'}
            </ThemedText>
          </Pressable>
        </>
      ) : null}

      {denied ? (
        <ThemedText style={styles.denied}>
          Notifications are off for Daily Qur’an. Turn them on in your phone’s Settings to get reminders.
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  left: { flex: 1, gap: 2 },
  title: { fontSize: 15.5, fontWeight: '700' },
  sub: { fontSize: 13, opacity: 0.6 },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(10,126,164,0.1)',
  },
  chipOn: { backgroundColor: ACCENT },
  chipText: { fontSize: 13, fontWeight: '700', color: ACCENT },
  chipTextOn: { color: '#fff' },
  preview: { alignSelf: 'center', paddingVertical: 2 },
  previewText: { fontSize: 13, fontWeight: '600', color: ACCENT, opacity: 0.9 },
  denied: { fontSize: 12.5, lineHeight: 18, opacity: 0.7 },
});
