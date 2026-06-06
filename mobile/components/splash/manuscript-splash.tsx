// CONCEPT 2 — Illuminated manuscript.
// The screen lights up like a gold-leaf manuscript page: a warm page-glow rises, a fine champagne double-rule
// frame settles in with four corner seal ornaments cascading, a gold-leaf glint sweeps the page, the central
// seal illuminates like an initial, and Ayat an-Nur is set within the frame. Time of day shifts the gold's
// warmth + the ambient glow (cool pale gold at dawn -> champagne by day -> deep amber at dusk -> antique at
// night) rather than the whole sky — the manuscript, not the firmament, is the subject.
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, Extrapolation, interpolate, type SharedValue, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Brandmark, Crescent, RadialBloom, Seal, SKY, SplashVerse, type Phase } from '@/components/splash/common';
import { haptic } from '@/lib/haptics';
import { c } from '@/lib/theme';

const T = { frame: { d: 0, dur: 720 }, mark: { d: 380, dur: 700 }, glint: { d: 760, dur: 760 }, reveal: { d: 1240, dur: 880 }, hapticAt: 1500, doneAt: 2680 };
const CORNER_AT = [0.28, 0.4, 0.52, 0.64]; // staggered start of each corner ornament along `frame`

export function ManuscriptSplash({ phase, onDone }: { phase: Phase; onDone?: () => void }) {
  const { width } = useWindowDimensions();
  const meta = SKY[phase];
  const tone = meta.tone;
  const panelW = Math.min(width - 56, 348);

  const frame = useSharedValue(0); // page + border + corner ornaments
  const mark = useSharedValue(0); // central illuminated seal
  const glint = useSharedValue(0); // gold-leaf sweep
  const reveal = useSharedValue(0); // verse

  useEffect(() => {
    frame.value = withDelay(T.frame.d, withTiming(1, { duration: T.frame.dur, easing: Easing.out(Easing.cubic) }));
    mark.value = withDelay(T.mark.d, withTiming(1, { duration: T.mark.dur, easing: Easing.out(Easing.cubic) }));
    glint.value = withDelay(T.glint.d, withTiming(1, { duration: T.glint.dur, easing: Easing.inOut(Easing.quad) }));
    reveal.value = withDelay(T.reveal.d, withTiming(1, { duration: T.reveal.dur, easing: Easing.out(Easing.cubic) }));
    const h = setTimeout(() => haptic.light(), T.hapticAt);
    const d = onDone ? setTimeout(onDone, T.doneAt) : undefined;
    return () => {
      clearTimeout(h);
      if (d) clearTimeout(d);
    };
  }, [phase, frame, mark, glint, reveal, onDone]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.7 * frame.value }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(frame.value, [0, 0.5], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(frame.value, [0, 1], [0.94, 1], Extrapolation.CLAMP) }],
  }));
  const innerRuleStyle = useAnimatedStyle(() => ({ opacity: interpolate(frame.value, [0.2, 0.7], [0, 1], Extrapolation.CLAMP) }));
  const sealStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, mark.value * 1.8), transform: [{ scale: 0.86 + 0.16 * mark.value }] }));
  const sealGlowStyle = useAnimatedStyle(() => ({ opacity: 0.6 * mark.value }));
  const glintStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(glint.value, [0, 1], [-panelW * 0.9, panelW * 0.9]) }, { rotate: '18deg' }],
    opacity: interpolate(glint.value, [0, 0.12, 0.85, 1], [0, 0.7, 0.7, 0]),
  }));
  const crescentStyle = useAnimatedStyle(() => ({ opacity: interpolate(frame.value, [0.4, 1], [0, 0.9], Extrapolation.CLAMP) }));

  return (
    <View style={styles.root}>
      {/* ambient page-glow, tinted by the hour */}
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]} pointerEvents="none">
        <RadialBloom
          id={`mglow-${phase}`}
          cx={0.5}
          cy={0.42}
          r={0.7}
          stops={[
            { offset: 0, color: tone, opacity: phase === 'night' ? 0.16 : 0.26 },
            { offset: 0.55, color: tone, opacity: 0.08 },
            { offset: 1, color: tone, opacity: 0 },
          ]}
        />
      </Animated.View>

      {/* a slim crescent watermark above the page (dusk / night) */}
      {meta.crescent ? (
        <Animated.View style={[styles.crescent, { left: width * 0.5 - 18 }, crescentStyle]} pointerEvents="none">
          <Crescent size={34} bright={meta.crescent.bright} />
        </Animated.View>
      ) : null}

      {/* the illuminated page */}
      <Animated.View style={[styles.panel, { width: panelW, borderColor: tone }, panelStyle]} pointerEvents="none">
        {/* faint warm page fill */}
        <LinearGradient colors={['rgba(255,250,240,0.045)', 'rgba(255,250,240,0.015)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* inner double-rule */}
        <Animated.View style={[styles.innerRule, { borderColor: tone }, innerRuleStyle]} pointerEvents="none" />

        {/* gold-leaf glint sweep, clipped to the page */}
        <Animated.View style={[styles.glint, glintStyle]} pointerEvents="none">
          <LinearGradient colors={['transparent', 'rgba(255,252,244,0.5)', 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>

        {/* four corner seal ornaments, cascading in */}
        {CORNER_AT.map((at, i) => (
          <CornerSeal key={i} frame={frame} at={at} tone={tone} index={i} />
        ))}

        {/* the illuminated initial + the verse */}
        <View style={styles.content}>
          <View style={styles.sealWrap}>
            <Animated.View style={[StyleSheet.absoluteFill, sealGlowStyle]} pointerEvents="none">
              <RadialBloom id={`mseal-${phase}`} cx={0.5} cy={0.5} r={0.55} stops={[{ offset: 0, color: tone, opacity: 0.5 }, { offset: 1, color: tone, opacity: 0 }]} />
            </Animated.View>
            <Animated.View style={sealStyle}>
              <Seal size={58} color={tone} />
            </Animated.View>
          </View>
          <Brandmark anim={mark} />
          <SplashVerse reveal={reveal} greeting={meta.greeting} tone={tone} style={styles.verse} />
        </View>
      </Animated.View>
    </View>
  );
}

function CornerSeal({ frame, at, tone, index }: { frame: SharedValue<number>; at: number; tone: string; index: number }) {
  const st = useAnimatedStyle(() => {
    const p = interpolate(frame.value, [at, at + 0.2], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ scale: 0.5 + 0.5 * p }] };
  });
  const pos: ViewPos = CORNERS[index];
  return (
    <Animated.View style={[styles.corner, pos, st]} pointerEvents="none">
      <Seal size={18} color={tone} sw={1} />
    </Animated.View>
  );
}

type ViewPos = { top?: number; bottom?: number; left?: number; right?: number };
const EDGE = 12;
const CORNERS: ViewPos[] = [
  { top: EDGE, left: EDGE },
  { top: EDGE, right: EDGE },
  { bottom: EDGE, left: EDGE },
  { bottom: EDGE, right: EDGE },
];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  crescent: { position: 'absolute', top: '14%' },
  panel: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingVertical: 40,
    paddingHorizontal: 26,
    backgroundColor: 'rgba(255,255,255,0.012)',
  },
  innerRule: { position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, opacity: 0.5 },
  glint: { position: 'absolute', top: -60, bottom: -60, width: 70, left: '40%' },
  corner: { position: 'absolute' },
  content: { alignItems: 'center', gap: 26 },
  sealWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  verse: { paddingHorizontal: 4 },
});
