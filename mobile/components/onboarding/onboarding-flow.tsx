// First-run onboarding — short & skippable. Writes the on-device Profile that curates the rest of
// the app. Sensitive answers (journey, focuses) never leave the device. Rendered by the root gate
// until profile.onboarded is true; finishing/skipping flips that and the app appears.
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { haptic } from '@/lib/haptics';
import { completeOnboarding, type Journey } from '@/lib/profile';

const ACCENT = '#0a7ea4';

const STEPS = ['welcome', 'journey', 'goals', 'time', 'focuses', 'done'] as const;
type StepKey = (typeof STEPS)[number];

const JOURNEY_OPTS: { id: Journey; label: string }[] = [
  { id: 'practicing', label: 'Practicing Muslim' },
  { id: 'learning', label: 'Learning or returning' },
  { id: 'exploring', label: 'Exploring Islam' },
  { id: 'academic', label: 'Studying it academically' },
  { id: 'unspecified', label: 'Prefer not to say' },
];
const GOAL_OPTS = [
  { id: 'habit', label: 'Build a daily habit' },
  { id: 'meaning', label: 'Understand the meaning' },
  { id: 'hifz', label: 'Memorize (hifz)' },
  { id: 'peace', label: 'Find peace in hard times' },
  { id: 'history', label: 'Learn the story of Islam' },
  { id: 'prayer', label: 'Strengthen my prayer' },
];
const TIME_OPTS = [
  { id: 2, label: '2 min', hint: 'A verse a day' },
  { id: 5, label: '5 min', hint: 'A little, daily' },
  { id: 10, label: '10 min', hint: 'Steady study' },
  { id: 15, label: '15+ min', hint: 'Going deep' },
];
const FOCUS_OPTS = [
  { id: 'anxiety', label: 'Stress & anxiety' },
  { id: 'hopelessness', label: 'Hopelessness' },
  { id: 'doubt', label: 'Doubts about faith' },
  { id: 'temptation', label: 'Temptation' },
  { id: 'grief', label: 'Grief & loss' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'curious', label: 'Just curious' },
];

export function OnboardingFlow() {
  const [i, setI] = useState(0);
  const step: StepKey = STEPS[i];
  const [journey, setJourney] = useState<Journey | null>(null);
  const [goals, setGoals] = useState<string[]>([]);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [focuses, setFocuses] = useState<string[]>([]);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) => {
    haptic.light();
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const finish = (skipped = false) => {
    haptic.medium();
    if (skipped) void completeOnboarding({});
    else
      void completeOnboarding({
        journey: journey ?? 'unspecified',
        goals,
        dailyMinutes: minutes ?? 5,
        focuses,
      });
  };

  const next = () => {
    haptic.light();
    if (i < STEPS.length - 1) setI(i + 1);
    else finish();
  };
  const back = () => {
    haptic.light();
    if (i > 0) setI(i - 1);
  };

  const canContinue =
    step === 'journey'
      ? journey !== null
      : step === 'goals'
        ? goals.length > 0
        : step === 'time'
          ? minutes !== null
          : true;

  const cta =
    step === 'welcome'
      ? 'Get started'
      : step === 'done'
        ? 'Enter'
        : step === 'focuses'
          ? focuses.length
            ? 'Continue'
            : 'Skip this'
          : 'Continue';

  const showProgress = step !== 'welcome' && step !== 'done';
  const qIndex = i - 1; // 0..3 for journey / goals / time / focuses

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill}>
        <View style={styles.top}>
          {i > 0 && step !== 'done' ? (
            <Pressable onPress={back} hitSlop={10} style={styles.topBtn}>
              <ThemedText style={styles.topBtnText}>‹ Back</ThemedText>
            </Pressable>
          ) : (
            <View style={styles.topBtn} />
          )}
          {showProgress ? (
            <View style={styles.dots}>
              {[0, 1, 2, 3].map((d) => (
                <View key={d} style={[styles.dot, d === qIndex && styles.dotOn]} />
              ))}
            </View>
          ) : (
            <View />
          )}
          {step !== 'done' ? (
            <Pressable onPress={() => finish(true)} hitSlop={10} style={styles.topBtnRight}>
              <ThemedText style={styles.topBtnText}>Skip</ThemedText>
            </Pressable>
          ) : (
            <View style={styles.topBtn} />
          )}
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {step === 'welcome' ? (
            <View style={styles.hero}>
              <ThemedText style={styles.crescent}>☾</ThemedText>
              <ThemedText type="title" style={styles.h1}>
                Assalamu alaykum
              </ThemedText>
              <ThemedText style={[styles.sub, styles.center]}>
                Let’s shape this around you. A few quick taps — and you can skip any of it.
              </ThemedText>
            </View>
          ) : null}

          {step === 'journey' ? (
            <Step title="Where are you in your journey?" subtitle="So we set the right tone for you.">
              {JOURNEY_OPTS.map((o) => (
                <Chip
                  key={o.id}
                  label={o.label}
                  selected={journey === o.id}
                  onPress={() => {
                    haptic.light();
                    setJourney(o.id);
                  }}
                />
              ))}
            </Step>
          ) : null}

          {step === 'goals' ? (
            <Step title="What would you love from this?" subtitle="Pick any that fit — more than one is fine.">
              {GOAL_OPTS.map((o) => (
                <Chip
                  key={o.id}
                  label={o.label}
                  selected={goals.includes(o.id)}
                  onPress={() => toggle(goals, setGoals, o.id)}
                />
              ))}
            </Step>
          ) : null}

          {step === 'time' ? (
            <Step title="How much time feels right each day?" subtitle="We’ll size your daily step to match.">
              {TIME_OPTS.map((o) => (
                <Chip
                  key={o.id}
                  label={o.label}
                  hint={o.hint}
                  selected={minutes === o.id}
                  onPress={() => {
                    haptic.light();
                    setMinutes(o.id);
                  }}
                />
              ))}
            </Step>
          ) : null}

          {step === 'focuses' ? (
            <Step
              title="Anything you’re carrying right now?"
              subtitle="Optional, and it stays on your device. It just helps us show what may comfort.">
              {FOCUS_OPTS.map((o) => (
                <Chip
                  key={o.id}
                  label={o.label}
                  selected={focuses.includes(o.id)}
                  onPress={() => toggle(focuses, setFocuses, o.id)}
                />
              ))}
            </Step>
          ) : null}

          {step === 'done' ? (
            <View style={styles.hero}>
              <ThemedText style={styles.crescent}>✦</ThemedText>
              <ThemedText type="title" style={styles.h1}>
                You’re all set
              </ThemedText>
              <ThemedText style={[styles.sub, styles.center]}>
                Your space is ready. You can change any of this later in Settings.
              </ThemedText>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={next}
            disabled={!canContinue}
            style={[styles.cta, !canContinue && styles.ctaOff]}>
            <ThemedText style={styles.ctaText}>{cta}</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.step}>
      <ThemedText type="title" style={styles.h2}>
        {title}
      </ThemedText>
      {subtitle ? <ThemedText style={styles.sub}>{subtitle}</ThemedText> : null}
      <View style={styles.opts}>{children}</View>
    </View>
  );
}

function Chip({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      <ThemedText style={[styles.chipLabel, selected && styles.chipLabelOn]}>{label}</ThemedText>
      {hint ? <ThemedText style={styles.chipHint}>{hint}</ThemedText> : null}
      {selected ? <ThemedText style={styles.check}>✓</ThemedText> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 44,
  },
  topBtn: { minWidth: 60, paddingVertical: 8 },
  topBtnRight: { minWidth: 60, paddingVertical: 8, alignItems: 'flex-end' },
  topBtnText: { color: ACCENT, fontSize: 15, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(127,127,127,0.3)' },
  dotOn: { backgroundColor: ACCENT, width: 18 },
  body: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  hero: { alignItems: 'center', gap: 14, paddingVertical: 40 },
  crescent: { fontSize: 64, color: ACCENT, lineHeight: 72 },
  h1: { textAlign: 'center', fontSize: 30, lineHeight: 38 },
  h2: { fontSize: 24, lineHeight: 31 },
  sub: { fontSize: 15, lineHeight: 22, opacity: 0.7 },
  center: { textAlign: 'center' },
  step: { gap: 8 },
  opts: { gap: 10, marginTop: 18 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(127,127,127,0.25)',
    gap: 10,
  },
  chipOn: { borderColor: ACCENT, backgroundColor: 'rgba(10,126,164,0.10)' },
  chipLabel: { fontSize: 16, fontWeight: '600', flex: 1 },
  chipLabelOn: { color: ACCENT },
  chipHint: { fontSize: 13, opacity: 0.6 },
  check: { color: ACCENT, fontWeight: '800', fontSize: 16, marginLeft: 8 },
  footer: { padding: 20, paddingTop: 8 },
  cta: { backgroundColor: ACCENT, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  ctaOff: { opacity: 0.4 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
