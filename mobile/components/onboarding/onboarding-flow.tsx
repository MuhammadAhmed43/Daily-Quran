// First-run onboarding (onyx) — short & skippable. Writes the on-device Profile that curates the rest of
// the app. Sensitive answers (journey, focuses) never leave the device. Rendered by the root gate until
// profile.onboarded is true. Onyx reskin only — all step/save logic is preserved.
import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { SealMedallion } from '@/components/atlas-tile';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Txt } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { haptic } from '@/lib/haptics';
import { completeOnboarding, type Journey } from '@/lib/profile';
import { c, font, radius, space } from '@/lib/theme';

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
    else void completeOnboarding({ journey: journey ?? 'unspecified', goals, dailyMinutes: minutes ?? 5, focuses });
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
    step === 'journey' ? journey !== null : step === 'goals' ? goals.length > 0 : step === 'time' ? minutes !== null : true;

  const cta =
    step === 'welcome' ? 'Get started' : step === 'done' ? 'Enter' : step === 'focuses' ? (focuses.length ? 'Continue' : 'Skip this') : 'Continue';

  const showProgress = step !== 'welcome' && step !== 'done';
  const qIndex = i - 1; // 0..3 for journey / goals / time / focuses

  return (
    <Screen edges={['top', 'bottom']} stars>
      <View style={styles.top}>
        {i > 0 && step !== 'done' ? (
          <PressableScale onPress={back} hitSlop={10} style={styles.topBtn}>
            <Txt style={styles.topBtnText}>‹ Back</Txt>
          </PressableScale>
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
          <PressableScale onPress={() => finish(true)} hitSlop={10} style={styles.topBtnRight}>
            <Txt style={styles.topBtnText}>Skip</Txt>
          </PressableScale>
        ) : (
          <View style={styles.topBtn} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Animated.View key={step} entering={FadeIn.duration(280)}>
          {step === 'welcome' ? (
            <View style={styles.hero}>
              <SealMedallion name="star-crescent" frame={84} ring={60} glyph={34} glowStrength={0.34} />
              <Txt variant="display" style={styles.center}>
                Assalamu alaykum
              </Txt>
              <Txt variant="body" color={c.textSecondary} style={[styles.sub, styles.center]}>
                Let’s shape this around you. A few quick taps — and you can skip any of it.
              </Txt>
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
                <Chip key={o.id} label={o.label} selected={goals.includes(o.id)} onPress={() => toggle(goals, setGoals, o.id)} />
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
                <Chip key={o.id} label={o.label} selected={focuses.includes(o.id)} onPress={() => toggle(focuses, setFocuses, o.id)} />
              ))}
            </Step>
          ) : null}

          {step === 'done' ? (
            <View style={styles.hero}>
              <SealMedallion name="star-four-points" frame={84} ring={60} glyph={32} glowStrength={0.34} />
              <Txt variant="display" style={styles.center}>
                You’re all set
              </Txt>
              <Txt variant="body" color={c.textSecondary} style={[styles.sub, styles.center]}>
                Your space is ready. You can change any of this later in Settings.
              </Txt>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <PressableScale onPress={next} disabled={!canContinue} style={[styles.cta, !canContinue && styles.ctaOff]}>
          <Txt style={styles.ctaText}>{cta}</Txt>
        </PressableScale>
      </View>
    </Screen>
  );
}

function Step({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <View style={styles.step}>
      <Txt variant="h1">{title}</Txt>
      {subtitle ? (
        <Txt variant="body" color={c.textSecondary} style={styles.sub}>
          {subtitle}
        </Txt>
      ) : null}
      <View style={styles.opts}>{children}</View>
    </View>
  );
}

function Chip({ label, hint, selected, onPress }: { label: string; hint?: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      <Txt style={[styles.chipLabel, selected && styles.chipLabelOn]}>{label}</Txt>
      {hint ? (
        <Txt variant="caption" color={c.textMuted}>
          {hint}
        </Txt>
      ) : null}
      {selected ? <Ionicons name="checkmark-circle" size={18} color={c.accent} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, height: 44 },
  topBtn: { minWidth: 60, paddingVertical: 8 },
  topBtnRight: { minWidth: 60, paddingVertical: 8, alignItems: 'flex-end' },
  topBtnText: { fontFamily: font.sansSemi, fontSize: 15, color: c.accent },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotOn: { backgroundColor: c.accent, width: 18 },
  body: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  hero: { alignItems: 'center', gap: 16, paddingVertical: 36 },
  center: { textAlign: 'center' },
  sub: { lineHeight: 22 },
  step: { gap: 8 },
  opts: { gap: 10, marginTop: 18 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: c.hairline,
    backgroundColor: c.surface1,
    gap: 10,
  },
  chipOn: { borderColor: c.accent, backgroundColor: 'rgba(201,189,166,0.10)' },
  chipLabel: { fontFamily: font.serif, fontSize: 16.5, color: c.textPrimary, flex: 1 },
  chipLabelOn: { color: c.accentBright },
  chipHint: { fontSize: 13 },
  footer: { padding: 20, paddingTop: 8 },
  cta: { backgroundColor: c.primary, paddingVertical: 16, borderRadius: radius.full, alignItems: 'center' },
  ctaOff: { opacity: 0.4 },
  ctaText: { color: c.bg, fontFamily: font.sansSemi, fontSize: 16 },
});
