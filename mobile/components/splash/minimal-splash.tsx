// CONCEPT 4 — Minimal / brand-forward ("luxury by subtraction").
// The onyx ethos applied literally: near-black, the "Daily Qur'an" wordmark as the hero in editorial serif,
// a single slow light-sweep across it, the verse set quietly beneath. Day = a faint warm glow rising from
// below; Night = the constellation, a faint moon-glow and a small crescent. Almost no ornament — restraint
// is the premium. Reliable to execute (type + gradient + fade), no fragile geometry.
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { SkyBand } from '@/components/sky-band';
import { APP_NAME, Crescent, RadialBloom, SplashVerse, type Phase } from '@/components/splash/common';
import { Txt } from '@/components/ui/primitives';
import { haptic } from '@/lib/haptics';
import { c, font } from '@/lib/theme';

const T = { ambient: { d: 0, dur: 900 }, brand: { d: 260, dur: 780 }, sweep: { d: 760, dur: 1000 }, reveal: { d: 1180, dur: 880 }, hapticAt: 1460, doneAt: 2640 };

export function MinimalSplash({ phase, onDone }: { phase: Phase; onDone?: () => void }) {
  const { width, height } = useWindowDimensions();
  const night = phase === 'night';
  const tone = c.accent;
  const greeting = night ? 'A peaceful night' : 'As-salāmu ʿalaykum';
  const bw = Math.min(width - 48, 320); // wordmark clip width

  const ambient = useSharedValue(0);
  const brand = useSharedValue(0);
  const sweep = useSharedValue(0);
  const reveal = useSharedValue(0);

  useEffect(() => {
    ambient.value = withDelay(T.ambient.d, withTiming(1, { duration: T.ambient.dur, easing: Easing.out(Easing.quad) }));
    brand.value = withDelay(T.brand.d, withTiming(1, { duration: T.brand.dur, easing: Easing.out(Easing.cubic) }));
    sweep.value = withDelay(T.sweep.d, withTiming(1, { duration: T.sweep.dur, easing: Easing.inOut(Easing.quad) }));
    reveal.value = withDelay(T.reveal.d, withTiming(1, { duration: T.reveal.dur, easing: Easing.out(Easing.cubic) }));
    const h = setTimeout(() => haptic.light(), T.hapticAt);
    const d = onDone ? setTimeout(onDone, T.doneAt) : undefined;
    return () => {
      clearTimeout(h);
      if (d) clearTimeout(d);
    };
  }, [phase, ambient, brand, sweep, reveal, onDone]);

  const ambientStyle = useAnimatedStyle(() => ({ opacity: ambient.value }));
  const brandStyle = useAnimatedStyle(() => {
    const p = brand.value;
    return { opacity: p, transform: [{ translateY: (1 - p) * 8 }] };
  });
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(sweep.value, [0, 1], [0, bw + 90]) }, { rotate: '14deg' }],
    opacity: interpolate(sweep.value, [0, 0.15, 0.85, 1], [0, 0.5, 0.5, 0]),
  }));

  return (
    <View style={styles.root}>
      {/* ambient: warm bottom glow (day) / cool stars + moon-glow (night) */}
      <Animated.View style={[StyleSheet.absoluteFill, ambientStyle]} pointerEvents="none">
        {night ? (
          <>
            <RadialBloom id="min-night" cx={0.5} cy={0.08} r={0.7} stops={[{ offset: 0, color: tone, opacity: 0.1 }, { offset: 1, color: tone, opacity: 0 }]} />
            <SkyBand height={height} count={22} seed={0x9a17} />
          </>
        ) : (
          <RadialBloom
            id="min-day"
            cx={0.5}
            cy={1.04}
            r={0.85}
            stops={[{ offset: 0, color: tone, opacity: 0.16 }, { offset: 0.6, color: tone, opacity: 0.05 }, { offset: 1, color: tone, opacity: 0 }]}
          />
        )}
      </Animated.View>
      {night ? (
        <Animated.View style={[{ position: 'absolute', left: width * 0.74, top: height * 0.12 }, ambientStyle]} pointerEvents="none">
          <Crescent size={36} bright={0.9} />
        </Animated.View>
      ) : null}

      <View style={styles.center} pointerEvents="none">
        {/* the wordmark — the hero — with a single light-sweep passing across it */}
        <View style={[styles.brandClip, { width: bw }]}>
          <Animated.View style={brandStyle}>
            <Txt style={styles.brand}>{APP_NAME}</Txt>
          </Animated.View>
          <Animated.View style={[styles.sweep, sweepStyle]} pointerEvents="none">
            <LinearGradient colors={['transparent', 'rgba(255,252,244,0.5)', 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
        <SplashVerse reveal={reveal} greeting={greeting} tone={tone} style={styles.verse} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 30 },
  brandClip: { overflow: 'hidden', paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: font.serif, fontSize: 36, lineHeight: 46, color: c.scriptureInk, letterSpacing: 0.5, textAlign: 'center' },
  sweep: { position: 'absolute', top: -30, bottom: -30, width: 90, left: -90 },
  verse: { marginTop: -6 },
});
