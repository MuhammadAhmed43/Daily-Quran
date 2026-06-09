// Reading-plan WIZARD (onyx, Bible Chat frames 56-63). A slide-up flow: intro (gold orb + serif) ->
// "what to read" (the 8 presets + a custom range) -> "your pace" -> a staged relay loader that builds
// the plan -> reveal the dashboard. Re-skin + compose only: the corpus model, pacing (avgPerDay), and
// createPlan are unchanged; the plan is created when the loader finishes, then we replace into /reading.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { haptic } from '@/lib/haptics';
import { SURAHS } from '@/lib/quran';
import { avgPerDay, corpusLabel, estimateMinutes, PACES, READING_PRESETS, surahName, WHOLE, type Corpus } from '@/lib/quran-plan';
import { createPlan, useQuranPlan } from '@/lib/quran-plan-progress';
import { useProfile } from '@/lib/profile';
import { c, font, grad, radius, space } from '@/lib/theme';

export default function NewQuranPlan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const existing = useQuranPlan().plan;
  const [step, setStep] = useState(0); // 0 intro · 1 read · 2 pace · 3 building
  const [goal, setGoal] = useState<string>('whole'); // a READING_PRESETS id, or 'custom'
  const [fromS, setFromS] = useState(1);
  const [toS, setToS] = useState(114);
  const [days, setDays] = useState(120);
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const prog = useSharedValue(0);

  const corpus: Corpus =
    goal === 'custom'
      ? { fromSurah: Math.min(fromS, toS), toSurah: Math.max(fromS, toS) }
      : (READING_PRESETS.find((p) => p.id === goal)?.corpus ?? WHOLE);
  const perDay = avgPerDay(corpus, days);
  const mins = estimateMinutes(perDay);
  const overBudget = mins > profile.dailyMinutes * 1.6;

  const GOALS: { id: string; title: string; sub: string }[] = [
    ...READING_PRESETS.map((p) => ({ id: p.id, title: p.title, sub: p.sub })),
    { id: 'custom', title: 'A custom range', sub: 'Pick the surahs to read' },
  ];

  // The relay loader fills over ~2.7s, then the plan is created and the dashboard is revealed.
  useEffect(() => {
    if (step !== 3) return;
    prog.value = 0;
    prog.value = withTiming(1, { duration: 2700, easing: Easing.inOut(Easing.ease) }, (fin) => {
      if (fin) runOnJS(commit)();
    });
    function commit() {
      createPlan(corpus, days);
      // Pop back to the dashboard we came from (it updates reactively to the new plan) instead of pushing a
      // SECOND /reading on top of it — otherwise "back" makes the user step through a duplicate dashboard.
      if (router.canGoBack()) router.back();
      else router.replace('/reading');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const back = () => {
    haptic.light();
    if (step > 0 && step < 3) setStep((s) => s - 1);
    else router.back();
  };

  return (
    <Screen stars>
      <Stack.Screen options={{ headerShown: false, animation: 'slide_from_bottom' }} />

      {step < 3 ? (
        <View style={styles.topBar}>
          <IconButton name={step === 0 ? 'close' : 'chevron-back'} onPress={back} diameter={38} size={22} color={c.textPrimary} />
          <View style={styles.dots}>
            {step > 0 ? [1, 2].map((s) => <View key={s} style={[styles.dot, step >= s && styles.dotOn]} />) : null}
          </View>
          <View style={styles.spacer} />
        </View>
      ) : null}

      {step === 0 ? (
        <Animated.View key="s0" entering={FadeIn.duration(320)} style={styles.introWrap}>
          <View style={styles.introCenter}>
            <View style={styles.orb}>
              <LinearGradient colors={c.goldGrad} start={grad.diagStart} end={grad.diagEnd} style={StyleSheet.absoluteFill} />
            </View>
            <Txt variant="h1" style={styles.center}>
              Your reading plan awaits
            </Txt>
            <Txt variant="body" color={c.textSecondary} style={styles.introSub}>
              A personal path through the Qur&apos;an, paced around your goal and your day — with understanding always on tap.
            </Txt>
          </View>
          <PressableScale
            style={styles.cta}
            onPress={() => {
              haptic.light();
              setStep(1);
            }}>
            <Txt style={styles.ctaText}>Build my plan</Txt>
            <Ionicons name="arrow-forward" size={18} color={c.bg} />
          </PressableScale>
        </Animated.View>
      ) : step === 1 ? (
        <Animated.View key="s1" entering={FadeIn.duration(280)} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {existing ? (
              <View style={styles.replaceNote}>
                <Ionicons name="information-circle-outline" size={16} color={c.accent} />
                <Txt variant="caption" color={c.textSecondary} style={styles.flexShrink}>
                  Starting a new plan replaces your current one ({corpusLabel(existing.corpus)}).
                </Txt>
              </View>
            ) : null}
            <Txt variant="h2" style={styles.stepTitle}>
              What would you like to read?
            </Txt>
            {GOALS.map((g, i) => {
              const on = goal === g.id;
              return (
                <Animated.View key={g.id} entering={FadeInDown.delay(i * 28).duration(260)}>
                  <PressableScale
                    style={[styles.card, on && styles.cardOn]}
                    onPress={() => {
                      haptic.light();
                      setGoal(g.id);
                    }}>
                    <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                    <View style={styles.cardBody}>
                      <Txt variant="cardTitle">{g.title}</Txt>
                      <Txt variant="caption" color={c.textSecondary}>
                        {g.sub}
                      </Txt>
                    </View>
                  </PressableScale>
                </Animated.View>
              );
            })}
            {goal === 'custom' ? (
              <View style={styles.rangeRow}>
                <PressableScale style={styles.rangePick} onPress={() => setPicking('from')}>
                  <Txt variant="eyebrow" color={c.accent}>
                    FROM
                  </Txt>
                  <Txt variant="body" numberOfLines={1} style={styles.rangeVal}>
                    {surahName(fromS)}
                  </Txt>
                </PressableScale>
                <Ionicons name="arrow-forward" size={16} color={c.textMuted} />
                <PressableScale style={styles.rangePick} onPress={() => setPicking('to')}>
                  <Txt variant="eyebrow" color={c.accent}>
                    TO
                  </Txt>
                  <Txt variant="body" numberOfLines={1} style={styles.rangeVal}>
                    {surahName(toS)}
                  </Txt>
                </PressableScale>
              </View>
            ) : null}
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
            <PressableScale
              style={styles.cta}
              onPress={() => {
                haptic.light();
                setStep(2);
              }}>
              <Txt style={styles.ctaText}>Continue</Txt>
              <Ionicons name="arrow-forward" size={18} color={c.bg} />
            </PressableScale>
          </View>
        </Animated.View>
      ) : step === 2 ? (
        <Animated.View key="s2" entering={FadeIn.duration(280)} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <Txt variant="h2" style={styles.stepTitle}>
              Your pace
            </Txt>
            {PACES.map((p, i) => {
              const pd = avgPerDay(corpus, p.days);
              const on = days === p.days;
              return (
                <Animated.View key={p.id} entering={FadeInDown.delay(i * 28).duration(260)}>
                  <PressableScale
                    style={[styles.card, on && styles.cardOn]}
                    onPress={() => {
                      haptic.light();
                      setDays(p.days);
                    }}>
                    <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                    <View style={styles.cardBody}>
                      <Txt variant="cardTitle">{p.label}</Txt>
                      <Txt variant="caption" color={c.textSecondary}>
                        ~{pd} ayahs/day · about {estimateMinutes(pd)} min
                      </Txt>
                    </View>
                  </PressableScale>
                </Animated.View>
              );
            })}
            {overBudget ? (
              <Txt variant="caption" color={c.textMuted} style={styles.budgetNote}>
                That&apos;s more than your usual {profile.dailyMinutes} min/day — a slower pace might be easier to keep. Totally your call.
              </Txt>
            ) : null}
            <View style={styles.summary}>
              <Txt variant="caption" color={c.accent} style={styles.summaryText}>
                {corpusLabel(corpus)} · ~{perDay} ayahs a day · about {mins} min
              </Txt>
            </View>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
            <PressableScale
              style={styles.cta}
              onPress={() => {
                haptic.success();
                setStep(3);
              }}>
              <Ionicons name="sparkles" size={17} color={c.bg} />
              <Txt style={styles.ctaText}>Create my plan</Txt>
            </PressableScale>
          </View>
        </Animated.View>
      ) : (
        <Animated.View key="s3" entering={FadeIn.duration(320)} style={styles.loadWrap}>
          <View style={styles.orb}>
            <LinearGradient colors={c.goldGrad} start={grad.diagStart} end={grad.diagEnd} style={StyleSheet.absoluteFill} />
          </View>
          <Txt variant="h2" style={styles.center}>
            Building your plan…
          </Txt>
          <View style={styles.stages}>
            <StageBar prog={prog} index={0} label="Pacing to your goal" />
            <StageBar prog={prog} index={1} label="Snapping to surah boundaries" />
            <StageBar prog={prog} index={2} label="Preparing your first portion" />
          </View>
        </Animated.View>
      )}

      {/* Custom range — surah picker */}
      <Modal visible={picking !== null} animationType="slide" transparent onRequestClose={() => setPicking(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setPicking(null)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHead}>
              <Txt variant="cardTitle">{picking === 'from' ? 'Start from' : 'End at'}</Txt>
              <IconButton name="close" onPress={() => setPicking(null)} diameter={34} size={20} color={c.accent} />
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {SURAHS.map((s) => (
                <PressableScale
                  key={s.number}
                  style={styles.surahRow}
                  onPress={() => {
                    haptic.light();
                    if (picking === 'from') setFromS(s.number);
                    else setToS(s.number);
                    setPicking(null);
                  }}>
                  <Txt style={styles.surahNum}>{s.number}</Txt>
                  <View style={styles.surahBody}>
                    <Txt variant="cardTitle">{s.englishName}</Txt>
                    <Txt variant="caption" color={c.textSecondary}>
                      {s.englishNameTranslation} · {s.numberOfAyahs} ayahs
                    </Txt>
                  </View>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function StageBar({ prog, index, label }: { prog: SharedValue<number>; index: number; label: string }) {
  const fillA = useAnimatedStyle(() => {
    const f = Math.min(1, Math.max(0, (prog.value - index / 3) * 3));
    return { width: `${f * 100}%` };
  });
  const rowA = useAnimatedStyle(() => {
    const f = Math.min(1, Math.max(0, (prog.value - index / 3) * 3));
    return { opacity: 0.4 + 0.6 * Math.min(1, f * 6) };
  });
  return (
    <Animated.View style={[styles.stageRow, rowA]}>
      <Txt variant="caption" color={c.textPrimary} style={styles.stageLabel}>
        {label}
      </Txt>
      <View style={styles.stageTrack}>
        <Animated.View style={[styles.stageFill, fillA]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  flexShrink: { flexShrink: 1 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: space.sm },
  spacer: { width: 38 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.surface3 },
  dotOn: { width: 18, backgroundColor: c.accent },

  // Intro
  introWrap: { flex: 1, paddingHorizontal: space.section, paddingBottom: 20 },
  introCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  orb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: c.accent,
    shadowOpacity: 0.55,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
  },
  introSub: { textAlign: 'center', lineHeight: 23, paddingHorizontal: 6 },

  // Steps
  scroll: { paddingHorizontal: space.gutter, paddingTop: space.xs, paddingBottom: 20, gap: 10 },
  stepTitle: { marginBottom: 4 },
  replaceNote: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: radius.md, backgroundColor: 'rgba(201,189,166,0.08)' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    backgroundColor: c.surface1,
  },
  cardOn: { borderColor: c.accent, backgroundColor: 'rgba(201,189,166,0.10)' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.textMuted, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: c.accent },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: c.accent },
  cardBody: { flex: 1, gap: 2 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  rangePick: { flex: 1, padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(201,189,166,0.4)', backgroundColor: 'rgba(201,189,166,0.06)', gap: 2 },
  rangeVal: { fontFamily: font.sansSemi },
  budgetNote: { lineHeight: 19, fontStyle: 'italic', paddingHorizontal: 2, marginTop: 4 },
  summary: { marginTop: 10, padding: 14, borderRadius: radius.md, backgroundColor: 'rgba(201,189,166,0.10)', alignItems: 'center' },
  summaryText: { fontFamily: font.sansSemi, textAlign: 'center' },

  // Footer CTA
  footer: { paddingHorizontal: space.gutter, paddingTop: 10 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.primary, paddingVertical: 15, borderRadius: radius.full },
  ctaText: { fontFamily: font.sansBold, fontSize: 15.5, color: c.bg },

  // Loader
  loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.section, gap: 22 },
  stages: { alignSelf: 'stretch', gap: 12, marginTop: 6 },
  stageRow: { padding: 14, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, backgroundColor: c.surface1, gap: 10 },
  stageLabel: { fontFamily: font.sansSemi },
  stageTrack: { height: 4, borderRadius: 2, backgroundColor: c.surface3, overflow: 'hidden' },
  stageFill: { height: 4, borderRadius: 2, backgroundColor: c.accent },

  // Surah picker
  modalScrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  modalSheet: { maxHeight: '78%', backgroundColor: c.surface1, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.card, borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  surahRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.hairlineSoft },
  surahNum: { width: 28, fontFamily: font.serifMed, fontSize: 14, color: c.accent, textAlign: 'center' },
  surahBody: { flex: 1 },
});
