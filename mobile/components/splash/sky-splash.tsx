// CONCEPT 1 — Time-aware sky + gold-leaf seal.
// An onyx canvas lit for the local time of day: a volumetric bloom traces the sun's arc (low-left at dawn,
// high at midday, low-right at dusk, a cool moon-glow at night), the constellation fades up, a crescent
// rises, and the gold-leaf seal kindles at centre with Ayat an-Nur beneath. Pure light imagery — aniconic.
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import Animated, { Easing, Extrapolation, interpolate, type SharedValue, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { SkyBand } from '@/components/sky-band';
import { BEAT, Brandmark, Crescent, RadialBloom, Seal, SKY, SplashVerse, type Phase } from '@/components/splash/common';
import { CornerOrnament } from '@/components/splash/corner-ornament';
import { haptic } from '@/lib/haptics';
import { c } from '@/lib/theme';

// The four gold-leaf corner flourishes — one source (an L-shaped piece whose angle sits at the BOTTOM-LEFT)
// mirrored so the angle nestles into each screen corner: bottom-left is the source orientation (identity),
// the others mirror across the relevant axis. Each gets a soft champagne glow + a staggered fade-in.
type Flip = ({ scaleX: number } | { scaleY: number })[];
const CORNERS: { pos: ViewStyle; glowAt: { x: number; y: number }; flip: Flip; at: number }[] = [
  { pos: { top: 0, left: 0 }, glowAt: { x: 0.3, y: 0.3 }, flip: [{ scaleY: -1 }], at: 0 },
  { pos: { top: 0, right: 0 }, glowAt: { x: 0.7, y: 0.3 }, flip: [{ scaleX: -1 }, { scaleY: -1 }], at: 0.1 },
  { pos: { bottom: 0, left: 0 }, glowAt: { x: 0.3, y: 0.7 }, flip: [], at: 0.2 },
  { pos: { bottom: 0, right: 0 }, glowAt: { x: 0.7, y: 0.7 }, flip: [{ scaleX: -1 }], at: 0.3 },
];

function Corner({
  orn,
  idx,
  at,
  pos,
  glowAt,
  flip,
  color,
  size,
}: {
  orn: SharedValue<number>;
  idx: number;
  at: number;
  pos: ViewStyle;
  glowAt: { x: number; y: number };
  flip: Flip;
  color: string;
  size: number;
}) {
  const wrapStyle = useAnimatedStyle(() => ({ opacity: interpolate(orn.value, [at, at + 0.5], [0, 1], Extrapolation.CLAMP) }));
  const ornStyle = useAnimatedStyle(() => {
    const p = interpolate(orn.value, [at, at + 0.5], [0, 1], Extrapolation.CLAMP);
    return { transform: [...flip, { scale: 0.92 + 0.08 * p }] };
  });
  return (
    <Animated.View style={[styles.corner, pos, { width: size, height: size }, wrapStyle]} pointerEvents="none">
      <RadialBloom id={`ornglow-${idx}`} cx={glowAt.x} cy={glowAt.y} r={0.7} stops={[{ offset: 0, color, opacity: 0.16 }, { offset: 1, color, opacity: 0 }]} />
      <Animated.View style={[StyleSheet.absoluteFill, ornStyle]}>
        <CornerOrnament size={size} color={color} />
      </Animated.View>
    </Animated.View>
  );
}

export function SkySplash({ phase, onDone }: { phase: Phase; onDone?: () => void }) {
  const { width, height } = useWindowDimensions();
  const meta = SKY[phase];
  const cornerSize = Math.round(Math.min(width * 0.46, 196));

  const mark = useSharedValue(0); // seal kindle
  const sky = useSharedValue(0); // bloom + stars + crescent
  const reveal = useSharedValue(0); // verse stagger
  const orn = useSharedValue(0); // corner ornaments

  useEffect(() => {
    mark.value = withDelay(BEAT.markIn.delay, withTiming(1, { duration: BEAT.markIn.dur, easing: Easing.out(Easing.cubic) }));
    sky.value = withDelay(BEAT.sky.delay, withTiming(1, { duration: BEAT.sky.dur, easing: Easing.out(Easing.quad) }));
    reveal.value = withDelay(BEAT.reveal.delay, withTiming(1, { duration: BEAT.reveal.dur, easing: Easing.out(Easing.cubic) }));
    orn.value = withDelay(900, withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }));
    const h = setTimeout(() => haptic.light(), BEAT.hapticAt);
    const d = onDone ? setTimeout(onDone, BEAT.doneAt) : undefined;
    return () => {
      clearTimeout(h);
      if (d) clearTimeout(d);
    };
  }, [phase, mark, sky, reveal, orn, onDone]);

  // The sky simply brightens in place (pure opacity) — no scale, so the off-centre glow never drifts sideways.
  const skyStyle = useAnimatedStyle(() => ({ opacity: sky.value }));
  const starStyle = useAnimatedStyle(() => ({ opacity: sky.value }));
  const crescentStyle = useAnimatedStyle(() => ({ opacity: sky.value, transform: [{ translateY: (1 - sky.value) * 8 }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: 0.45 * reveal.value }));

  // Seal kindle: a soft glow blooms behind it while it scales up and settles with a faint overshoot.
  const sealStyle = useAnimatedStyle(() => {
    const m = mark.value;
    return { opacity: Math.min(1, m * 1.8), transform: [{ scale: 0.86 + 0.18 * m - 0.04 * Math.max(0, m - 0.75) * 4 }] };
  });
  const sealGlowStyle = useAnimatedStyle(() => ({ opacity: 0.65 * mark.value }));

  return (
    <View style={styles.root}>
      {/* faint horizon wash over the onyx (dawn cool top, dusk deep top) */}
      {meta.base ? (
        <LinearGradient colors={meta.base} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
      ) : null}

      {/* the sky light, tracing the sun's arc */}
      <Animated.View style={[StyleSheet.absoluteFill, skyStyle]} pointerEvents="none">
        <RadialBloom id={`sky-${phase}`} cx={meta.cx} cy={meta.cy} r={meta.r} stops={meta.stops} />
      </Animated.View>

      {/* the constellation */}
      {meta.stars > 0 ? (
        <Animated.View style={[StyleSheet.absoluteFill, starStyle]} pointerEvents="none">
          <SkyBand height={height} count={meta.stars} seed={meta.starSeed} />
        </Animated.View>
      ) : null}

      {/* the crescent (night) */}
      {meta.crescent ? (
        <Animated.View
          style={[{ position: 'absolute', left: width * meta.crescent.x, top: height * meta.crescent.y }, crescentStyle]}
          pointerEvents="none">
          <Crescent size={meta.crescent.size} bright={meta.crescent.bright} />
        </Animated.View>
      ) : null}

      {/* a soft dark halo behind the centre column for text legibility over stars/bloom */}
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]} pointerEvents="none">
        <RadialBloom
          id={`scrim-${phase}`}
          cx={0.5}
          cy={0.46}
          r={0.6}
          stops={[
            { offset: 0, color: '#050505', opacity: 0.62 },
            { offset: 0.7, color: '#050505', opacity: 0.3 },
            { offset: 1, color: '#050505', opacity: 0 },
          ]}
        />
      </Animated.View>

      {/* ornamental gold-leaf corners framing the splash, with a soft champagne glow */}
      {CORNERS.map((cn, i) => (
        <Corner key={i} orn={orn} idx={i} at={cn.at} pos={cn.pos} glowAt={cn.glowAt} flip={cn.flip} color={meta.tone} size={cornerSize} />
      ))}

      {/* centre column: kindling seal + the verse */}
      <View style={styles.center} pointerEvents="none">
        <View style={styles.sealWrap}>
          <Animated.View style={[StyleSheet.absoluteFill, sealGlowStyle]} pointerEvents="none">
            <RadialBloom
              id={`sealglow-${phase}`}
              cx={0.5}
              cy={0.5}
              r={0.55}
              stops={[
                { offset: 0, color: meta.tone, opacity: 0.5 },
                { offset: 1, color: meta.tone, opacity: 0 },
              ]}
            />
          </Animated.View>
          <Animated.View style={sealStyle}>
            <Seal size={64} color={meta.tone} />
          </Animated.View>
        </View>
        <Brandmark anim={mark} />
        <SplashVerse reveal={reveal} greeting={meta.greeting} tone={meta.tone} hideGreeting style={styles.verse} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 30, marginTop: -8 },
  sealWrap: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
  verse: { marginTop: -8 },
  corner: { position: 'absolute' },
});
