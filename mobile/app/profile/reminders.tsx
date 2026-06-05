// MANAGE YOUR REMINDERS (onyx settings sub-screen, Bible Chat frame 34). The daily-verse reminder as a
// hero block (label + big serif time + preset chips + toggle + Preview), reusing lib/daily-verse verbatim,
// plus a link to the Prayer screen for the adhan. Bible Chat's per-plan reminders map to our one
// devotional reminder; the adhan lives with the prayer times.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Txt } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { SettingsCard, SettingsHeaderSub, SettingsRow, Toggle } from '@/components/ui/settings';
import { getVerseNotifPrefs, previewDailyVerse, setVerseNotif, type VerseNotifPrefs } from '@/lib/daily-verse';
import { haptic } from '@/lib/haptics';
import { c, font, radius, space } from '@/lib/theme';

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

export default function RemindersScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<VerseNotifPrefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    getVerseNotifPrefs().then(setPrefs);
  }, []);

  const apply = async (enabled: boolean, hour: number, minute: number) => {
    if (busy) return;
    setBusy(true);
    haptic.light();
    const next = await setVerseNotif(enabled, hour, minute);
    setPrefs(next);
    setDenied(enabled && !next.enabled);
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
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SettingsHeaderSub title="Manage your reminders" onBack={() => router.back()} />

        {prefs ? (
          <View style={styles.block}>
            <View style={styles.blockTop}>
              <View style={styles.blockLabel}>
                <Ionicons name="sparkles-outline" size={15} color={c.accent} />
                <Txt variant="caption" color={c.textSecondary}>
                  Daily verse
                </Txt>
              </View>
              <Toggle value={prefs.enabled} onValueChange={(v) => apply(v, prefs.hour, prefs.minute)} disabled={busy} />
            </View>

            <Txt style={[styles.time, !prefs.enabled && styles.timeOff]}>{fmt(prefs.hour, prefs.minute)}</Txt>
            <Txt variant="caption" color={c.textMuted} style={styles.blockSub}>
              {prefs.enabled ? 'A verse to greet you each day' : 'A gentle verse to greet you each day'}
            </Txt>

            {prefs.enabled ? (
              <>
                <View style={styles.chips}>
                  {PRESETS.map((p) => {
                    const on = prefs.hour === p.hour && prefs.minute === p.minute;
                    return (
                      <PressableScale
                        key={p.label}
                        style={[styles.chip, on && styles.chipOn]}
                        onPress={() => apply(true, p.hour, p.minute)}>
                        <Txt style={[styles.chipText, on && styles.chipTextOn]}>{p.label}</Txt>
                      </PressableScale>
                    );
                  })}
                </View>
                <PressableScale onPress={preview} style={styles.preview} hitSlop={8}>
                  <Txt style={styles.previewText}>{sent ? 'Sent — check your notifications' : 'Preview now'}</Txt>
                </PressableScale>
              </>
            ) : null}

            {denied ? (
              <Txt variant="caption" color={c.textMuted} style={styles.denied}>
                Notifications are off for Daily Qur’an. Turn them on in your phone’s Settings to get reminders.
              </Txt>
            ) : null}
          </View>
        ) : null}

        <SettingsCard>
          <SettingsRow
            icon="moon-outline"
            title="Prayer-time adhan"
            subtitle="Set the call to prayer in the Prayer screen"
            onPress={() => {
              haptic.light();
              router.push('/prayer');
            }}
          />
        </SettingsCard>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: space.sm, paddingBottom: space.section, gap: space.card },
  block: {
    padding: space.card,
    borderRadius: radius.lg,
    backgroundColor: c.surface1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    gap: 6,
  },
  blockTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  blockLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  time: { fontFamily: font.serif, fontSize: 38, lineHeight: 44, color: c.textPrimary, marginTop: 2 },
  timeOff: { color: c.textMuted },
  blockSub: { marginTop: -2 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: c.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  chipOn: { backgroundColor: c.accent, borderColor: c.accent },
  chipText: { fontFamily: font.sansSemi, fontSize: 13, color: c.textSecondary },
  chipTextOn: { color: c.bg },
  preview: { alignSelf: 'center', paddingVertical: 6, marginTop: 6 },
  previewText: { fontFamily: font.sansMed, fontSize: 13.5, color: c.accent },
  denied: { lineHeight: 17, marginTop: 8 },
});
