// Journey detail (Bible Chat frames 40-41, onyx). A collapsing atmospheric hero (seal emblem + serif
// title) that condenses into a solid header bar on scroll, an ABOUT block with stat pills + the journey
// intro, a primary Start/Continue CTA, and a Day-timeline (dotted spine) where each step offers Listen
// (recite its verses) and Read (open the step). Re-skin only — the progress logic (usePlanProgress:
// progressive unlock, start/restart/setActive) is unchanged.
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SealMedallion } from '@/components/atlas-tile';
import { hashStr, mulberry32 } from '@/components/cosmic-field';
import { Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { haptic } from '@/lib/haptics';
import { getPlan } from '@/lib/plans';
import { usePlanProgress } from '@/lib/plan-progress';
import { planIcon } from '@/lib/plan-visuals';
import { c, font, radius, space } from '@/lib/theme';

const HERO_H = 280;

// A living starfield across the hero — warm twinkle + a slow per-star float (each drifts along its own
// vector), seeded by the plan id so it is deterministic. Pairs with a scroll-parallax on the container.
type HeroStar = {
  x: number; y: number; size: number; base: number; peak: number; color: string; near: boolean;
  dur: number; phase: number; driftX: number; driftY: number; driftDur: number;
};

function makeHeroStars(seed: number): HeroStar[] {
  const rnd = mulberry32(seed);
  const out: HeroStar[] = [];
  const N = 22;
  for (let i = 0; i < N; i++) {
    const big = i < 4;
    const ang = rnd() * Math.PI * 2;
    const amp = 5 + rnd() * 9;
    out.push({
      x: 0.04 + rnd() * 0.92,
      y: 0.05 + rnd() * 0.64, // upper area, above the bottom-left title
      size: big ? 2 + rnd() : 1 + rnd() * 0.8,
      base: big ? 0.3 : 0.12,
      peak: big ? 0.85 : 0.48,
      color: i === 0 ? c.scriptureInk : big ? 'rgba(234,226,208,0.92)' : 'rgba(224,210,176,0.85)',
      near: big,
      dur: 1700 + rnd() * 1600,
      phase: rnd() * 3000,
      driftX: Math.cos(ang) * amp,
      driftY: Math.sin(ang) * amp,
      driftDur: 5000 + rnd() * 4500,
    });
  }
  return out;
}

function FloatingStarDot({ s, w, h }: { s: HeroStar; w: number; h: number }) {
  const t = useSharedValue(0); // twinkle
  const d = useSharedValue(0); // drift
  useEffect(() => {
    t.value = withDelay(
      s.phase,
      withRepeat(
        withSequence(
          withTiming(1, { duration: s.dur, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: s.dur, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    d.value = withDelay(s.phase, withRepeat(withTiming(1, { duration: s.driftDur, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [d, s.dur, s.driftDur, s.phase, t]);

  const aStyle = useAnimatedStyle(() => {
    const op = s.base + (s.peak - s.base) * t.value;
    const k = d.value - 0.5;
    return {
      opacity: op,
      transform: [{ translateX: k * s.driftX }, { translateY: k * s.driftY }, { scale: s.near ? 1 + 0.16 * t.value : 1 }],
    };
  });

  return (
    <Animated.View
      collapsable={false}
      pointerEvents="none"
      style={[
        { position: 'absolute', left: s.x * w, top: s.y * h, width: s.size, height: s.size, borderRadius: s.size / 2, backgroundColor: s.color },
        s.near && { shadowColor: c.scriptureInk, shadowOpacity: 0.7, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } },
        aStyle,
      ]}
    />
  );
}

export default function PlanOverview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const progress = usePlanProgress();
  const plan = id ? getPlan(String(id)) : undefined;
  const { width } = useWindowDimensions();
  const stars = useMemo(() => makeHeroStars(hashStr(String(id ?? 'journey'))), [id]);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HERO_H - 130, HERO_H - 64], [0, 1], 'clamp'),
  }));
  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HERO_H - 90], [1, 0], 'clamp'),
    transform: [{ translateY: interpolate(scrollY.value, [-120, 0, HERO_H], [-60, 0, HERO_H * 0.35], 'clamp') }],
  }));
  const starsParallax = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [0, HERO_H], [0, -38], 'clamp') }],
  }));

  if (!plan) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Txt variant="body" color={c.textMuted}>
          This journey isn&apos;t available.
        </Txt>
      </View>
    );
  }

  const s = progress.summary(plan.id);
  const cur = Math.min(s.currentOrder, plan.steps.length);
  const totalVerses = plan.steps.reduce((n, st) => n + st.verses.length, 0);

  const openStep = (order: number, play?: boolean) => {
    haptic.light();
    progress.startPlan(plan.id);
    router.push({
      pathname: '/plan/[id]/[order]',
      params: play ? { id: plan.id, order: String(order), play: '1' } : { id: plan.id, order: String(order) },
    });
  };
  const restart = () => {
    haptic.medium();
    progress.restartPlan(plan.id);
    router.push({ pathname: '/plan/[id]/[order]', params: { id: plan.id, order: '1' } });
  };

  return (
    <View style={styles.fill}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* collapsing solid header bar */}
      <Animated.View style={[styles.headerBar, { height: insets.top + 52 }, barStyle]} pointerEvents="none">
        <View style={[styles.headerTitleWrap, { top: insets.top + 14 }]}>
          <Txt variant="cardTitle" numberOfLines={1} style={styles.headerTitle}>
            {plan.title}
          </Txt>
        </View>
      </Animated.View>

      {/* floating frosted back button */}
      <PressableScale style={[styles.backBtn, { top: insets.top + 6 }]} onPress={() => router.back()}>
        <BlurView intensity={26} tint="systemThinMaterialDark" style={StyleSheet.absoluteFill} pointerEvents="none" />
        <Ionicons name="chevron-back" size={22} color={c.textPrimary} />
      </PressableScale>

      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* HERO */}
        <Animated.View style={[styles.hero, heroStyle]}>
          <View style={[StyleSheet.absoluteFill, styles.heroBase]} pointerEvents="none" />
          <LinearGradient
            colors={['rgba(201,189,166,0.16)', 'rgba(201,189,166,0.03)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Animated.View style={[StyleSheet.absoluteFill, starsParallax]} pointerEvents="none">
            {stars.map((s, i) => (
              <FloatingStarDot key={i} s={s} w={width} h={HERO_H} />
            ))}
          </Animated.View>
          <LinearGradient
            colors={c.cardScrim}
            locations={[0.45, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.heroContent}>
            <SealMedallion name={planIcon(plan.id)} frame={62} ring={46} glyph={28} glowStrength={0.28} />
            <Txt style={styles.heroEyebrow}>✦ JOURNEY</Txt>
            <Txt variant="h1" numberOfLines={3} style={styles.heroTitle}>
              {plan.title}
            </Txt>
          </View>
        </Animated.View>

        {/* BODY */}
        <View style={styles.body}>
          <Txt variant="eyebrow">About this journey</Txt>
          <View style={styles.pills}>
            <Stat icon="footsteps-outline" label={`${plan.steps.length} steps`} />
            <Stat icon="book-outline" label={`${totalVerses} verses`} />
            <Stat icon="time-outline" label="A few min a day" />
          </View>
          <Txt style={styles.intro}>{plan.intro}</Txt>

          {s.started && !s.finished ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.max(4, (s.done / plan.steps.length) * 100)}%` }]} />
              </View>
              <Txt variant="caption" color={c.textSecondary}>{`Step ${cur} of ${plan.steps.length}`}</Txt>
            </View>
          ) : null}

          <PressableScale style={styles.cta} onPress={() => (s.finished ? restart() : openStep(s.started ? cur : 1))}>
            <Txt style={styles.ctaText}>{s.finished ? 'Begin again' : s.started ? `Continue · Step ${cur}` : 'Start journey'}</Txt>
            <Ionicons name={s.finished ? 'refresh' : 'arrow-forward'} size={18} color={c.bg} />
          </PressableScale>

          {s.started && !s.isActive && !s.finished ? (
            <PressableScale style={styles.focusBtn} onPress={() => { haptic.light(); progress.setActive(plan.id); }}>
              <Ionicons name="bookmark-outline" size={15} color={c.accent} />
              <Txt variant="caption" color={c.accent} style={styles.focusText}>
                Make this today&apos;s focus
              </Txt>
            </PressableScale>
          ) : null}

          {/* DAY TIMELINE */}
          <View style={styles.timeline}>
            <View style={[styles.spine, { bottom: 34 }]} />
            {plan.steps.map((st) => {
              const isDone = st.order < s.currentOrder;
              const isCurrent = st.order === s.currentOrder && !s.finished;
              const locked = st.order > s.currentOrder;
              return (
                <View key={st.order} style={styles.dayRow}>
                  <View style={[styles.node, isDone && styles.nodeDone, isCurrent && styles.nodeCurrent]}>
                    {isDone ? <Ionicons name="checkmark" size={12} color={c.bg} /> : <View style={[styles.nodeDot, isCurrent && styles.nodeDotCurrent]} />}
                  </View>
                  <PressableScale disabled={locked} onPress={() => openStep(st.order)} style={[styles.dayCard, isCurrent && styles.dayCardCurrent, locked && styles.dayCardLocked]}>
                    <View style={styles.dayBody}>
                      <Txt variant="caption" style={[styles.dayLabel, isCurrent && { color: c.accent }]}>
                        Day {st.order}
                        {isCurrent ? ' · Continue here' : isDone ? ' · Done' : ''}
                      </Txt>
                      <Txt variant="cardTitle" numberOfLines={2} style={styles.dayTitle}>
                        {st.title}
                      </Txt>
                    </View>
                    {locked ? (
                      <View style={styles.actionBtn}>
                        <Ionicons name="lock-closed" size={14} color={c.textMuted} />
                      </View>
                    ) : (
                      <View style={styles.dayActions}>
                        {st.verses.length > 0 ? (
                          <Pressable onPress={() => openStep(st.order, true)} hitSlop={6} style={styles.actionBtn} accessibilityLabel="Listen and read">
                            <Ionicons name="headset-outline" size={17} color={c.accent} />
                          </Pressable>
                        ) : null}
                        <Pressable onPress={() => openStep(st.order)} hitSlop={6} style={styles.actionBtn} accessibilityLabel="Read">
                          <Ionicons name="book-outline" size={17} color={c.accent} />
                        </Pressable>
                      </View>
                    )}
                  </PressableScale>
                </View>
              );
            })}
          </View>

          <Txt variant="caption" color={c.textMuted} style={styles.disclaimer}>
            A study aid for reflection — not a fatwa or a substitute for a qualified scholar.
          </Txt>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

function Stat({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={13} color={c.accent} />
      <Txt variant="caption" color={c.textSecondary} style={styles.pillText}>
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: c.bg },
  center: { alignItems: 'center', justifyContent: 'center' },

  headerBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: c.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.hairline },
  headerTitleWrap: { position: 'absolute', left: 56, right: 56, alignItems: 'center' },
  headerTitle: { textAlign: 'center' },
  backBtn: { position: 'absolute', left: space.gutter, zIndex: 12, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(18,18,18,0.35)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },

  hero: { height: HERO_H, overflow: 'hidden', justifyContent: 'flex-end' },
  heroBase: { backgroundColor: '#141210' },
  heroContent: { paddingHorizontal: space.gutter, paddingBottom: space.card, gap: 8, alignItems: 'flex-start' },
  heroEyebrow: { fontFamily: font.sansBold, fontSize: 11, letterSpacing: 1.4, color: c.accent },
  heroTitle: { color: c.scriptureInk, lineHeight: 34 },

  body: { backgroundColor: c.bg, marginTop: -22, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: space.gutter, paddingTop: space.card, gap: 12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.full, backgroundColor: c.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
  pillText: { fontFamily: font.sansMed },
  intro: { fontFamily: font.serifReg, fontSize: 16, lineHeight: 25, color: c.scriptureInk },

  progressWrap: { gap: 6 },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: c.surface3, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: c.accent },

  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.primary, paddingVertical: 16, borderRadius: radius.full, marginTop: 2 },
  ctaText: { fontFamily: font.sansBold, fontSize: 16, color: c.bg },
  focusBtn: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, paddingVertical: 2 },
  focusText: { fontFamily: font.sansSemi },

  timeline: { marginTop: 8, position: 'relative' },
  spine: { position: 'absolute', left: 13, top: 14, width: 0, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: c.hairline },
  dayRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  node: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.surface3, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, alignItems: 'center', justifyContent: 'center', marginTop: 14, zIndex: 1 },
  nodeDone: { backgroundColor: c.accent, borderColor: c.accent },
  nodeCurrent: { borderColor: c.accent, borderWidth: 2 },
  nodeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.textMuted },
  nodeDotCurrent: { backgroundColor: c.accent },
  dayCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: c.surface1, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
  dayCardCurrent: { borderColor: 'rgba(201,189,166,0.5)', backgroundColor: c.surface2 },
  dayCardLocked: { opacity: 0.5 },
  dayBody: { flex: 1, gap: 3 },
  dayLabel: { fontFamily: font.sansMed },
  dayTitle: { lineHeight: 21 },
  dayActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface3, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },

  disclaimer: { textAlign: 'center', lineHeight: 16, marginTop: 10 },
});
