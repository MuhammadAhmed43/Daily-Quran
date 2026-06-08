// CONCEPT 1 — Time-aware sky + gold-leaf seal.
// An onyx canvas lit for the local time of day: a volumetric bloom traces the sun's arc (low-left at dawn,
// high at midday, low-right at dusk, a cool moon-glow at night), the constellation fades up, a crescent
// rises, and the gold-leaf seal kindles at centre with Ayat an-Nur beneath. Pure light imagery — aniconic.
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { SealMedallion } from '@/components/atlas-tile';
import { SkyBand } from '@/components/sky-band';
import { BEAT, Brandmark, Crescent, RadialBloom, SKY, SplashVerse, type Phase } from '@/components/splash/common';
import { haptic } from '@/lib/haptics';
import { c } from '@/lib/theme';

export function SkySplash({ phase, onDone }: { phase: Phase; onDone?: () => void }) {
  const { width, height } = useWindowDimensions();
  const meta = SKY[phase];

  const mark = useSharedValue(0); // seal kindle
  const sky = useSharedValue(0); // bloom + stars + crescent
  const reveal = useSharedValue(0); // verse stagger

  useEffect(() => {
    mark.value = withDelay(BEAT.markIn.delay, withTiming(1, { duration: BEAT.markIn.dur, easing: Easing.out(Easing.cubic) }));
    sky.value = withDelay(BEAT.sky.delay, withTiming(1, { duration: BEAT.sky.dur, easing: Easing.out(Easing.quad) }));
    reveal.value = withDelay(BEAT.reveal.delay, withTiming(1, { duration: BEAT.reveal.dur, easing: Easing.out(Easing.cubic) }));
    const h = setTimeout(() => haptic.light(), BEAT.hapticAt);
    const d = onDone ? setTimeout(onDone, BEAT.doneAt) : undefined;
    return () => {
      clearTimeout(h);
      if (d) clearTimeout(d);
    };
  }, [phase, mark, sky, reveal, onDone]);

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
            <SealMedallion name="star-crescent" frame={108} ring={76} glyph={46} glowStrength={0.34} />
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
});
