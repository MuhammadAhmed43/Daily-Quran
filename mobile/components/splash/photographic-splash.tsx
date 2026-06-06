// CONCEPT 5 — Photographic / atmospheric (the Calm / Headspace recipe, onyx-fied).
// A real, breathtaking sky photographed (a dark Milky Way by night, a soft dawn by day) under a slow
// Ken-Burns drift, with an onyx gradient scrim that holds the near-black brand + keeps the text legible,
// a champagne light bloom, and the "Daily Qur'an" wordmark + Ayat an-Nur verse revealing in the light.
// Real imagery is the reliable route to "premium beauty" that hand-drawn shapes/gradients can't reach.
// Time-of-day swaps the photo, the scrim weight, the bloom and the greeting. Assets are free-commercial
// (Unsplash / Pexels licenses, see assets/splash/CREDITS.txt).
import { useEffect } from 'react';
import { Image, type ImageSourcePropType, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { RadialBloom, SplashVerse, type Phase } from '@/components/splash/common';
import { Txt } from '@/components/ui/primitives';
import { haptic } from '@/lib/haptics';
import { c, font } from '@/lib/theme';

const NIGHT_IMG = require('../../assets/splash/night.jpg');
const DAWN_IMG = require('../../assets/splash/dawn.jpg');

type Look = {
  img: ImageSourcePropType;
  greeting: string;
  scrim: [string, string, string]; // top -> mid -> bottom vertical wash over the photo
  tint: number; // extra flat onyx veil (0..1) — tames a bright daytime photo
  bloom: { cx: number; cy: number; r: number; color: string; opacity: number };
};

const LOOK: Record<Phase, Look> = {
  day: {
    img: DAWN_IMG,
    greeting: 'As-salāmu ʿalaykum',
    scrim: ['rgba(10,10,10,0.5)', 'rgba(10,10,10,0.28)', 'rgba(10,10,10,0.86)'],
    tint: 0.34, // dawn photo is bright — veil it back toward onyx
    bloom: { cx: 0.5, cy: 0.7, r: 0.7, color: '#F0C079', opacity: 0.18 },
  },
  night: {
    img: NIGHT_IMG,
    greeting: 'A peaceful night',
    scrim: ['rgba(10,10,10,0.55)', 'rgba(10,10,10,0.12)', 'rgba(10,10,10,0.9)'],
    tint: 0.12,
    bloom: { cx: 0.5, cy: 0.22, r: 0.6, color: '#C9BDA6', opacity: 0.16 },
  },
};

const T = { enter: { d: 0, dur: 760 }, kb: { d: 0, dur: 4600 }, word: { d: 540, dur: 820 }, reveal: { d: 1140, dur: 900 }, hapticAt: 1440, doneAt: 2980 };

export function PhotographicSplash({ phase, onDone }: { phase: Phase; onDone?: () => void }) {
  const { width } = useWindowDimensions();
  const look = LOOK[phase];
  const tone = c.accent;

  const enter = useSharedValue(0); // backdrop fade-in from black
  const kb = useSharedValue(0); // slow ken-burns
  const word = useSharedValue(0); // wordmark
  const reveal = useSharedValue(0); // verse

  useEffect(() => {
    enter.value = withDelay(T.enter.d, withTiming(1, { duration: T.enter.dur, easing: Easing.out(Easing.quad) }));
    kb.value = withDelay(T.kb.d, withTiming(1, { duration: T.kb.dur, easing: Easing.out(Easing.cubic) }));
    word.value = withDelay(T.word.d, withTiming(1, { duration: T.word.dur, easing: Easing.out(Easing.cubic) }));
    reveal.value = withDelay(T.reveal.d, withTiming(1, { duration: T.reveal.dur, easing: Easing.out(Easing.cubic) }));
    const h = setTimeout(() => haptic.light(), T.hapticAt);
    const d = onDone ? setTimeout(onDone, T.doneAt) : undefined;
    return () => {
      clearTimeout(h);
      if (d) clearTimeout(d);
    };
  }, [phase, enter, kb, word, reveal, onDone]);

  const enterStyle = useAnimatedStyle(() => ({ opacity: enter.value }));
  const kbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(kb.value, [0, 1], [1.14, 1.0]) }, { translateY: interpolate(kb.value, [0, 1], [14, -6]) }],
  }));
  const wordStyle = useAnimatedStyle(() => {
    const p = word.value;
    return { opacity: p, transform: [{ translateY: (1 - p) * 10 }] };
  });
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.5 * reveal.value }));

  return (
    <View style={styles.root}>
      {/* the photographed sky + scrims, fading up from black together */}
      <Animated.View style={[StyleSheet.absoluteFill, enterStyle]} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, kbStyle]}>
          <Image source={look.img} style={styles.photo} resizeMode="cover" />
        </Animated.View>
        {/* champagne light bloom */}
        <RadialBloom
          id={`pbloom-${phase}`}
          cx={look.bloom.cx}
          cy={look.bloom.cy}
          r={look.bloom.r}
          stops={[{ offset: 0, color: look.bloom.color, opacity: look.bloom.opacity }, { offset: 1, color: look.bloom.color, opacity: 0 }]}
        />
        {/* flat onyx veil (keeps the near-black brand; tames a bright photo) */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0A0A', opacity: look.tint }]} />
        {/* vertical scrim: darken top + bottom for legibility, let the middle breathe */}
        <LinearGradient colors={look.scrim} locations={[0, 0.5, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* a soft dark halo behind the centre column for text legibility */}
      <Animated.View style={[StyleSheet.absoluteFill, haloStyle]} pointerEvents="none">
        <RadialBloom
          id={`phalo-${phase}`}
          cx={0.5}
          cy={0.5}
          r={0.55}
          stops={[{ offset: 0, color: '#050505', opacity: 0.6 }, { offset: 0.7, color: '#050505', opacity: 0.28 }, { offset: 1, color: '#050505', opacity: 0 }]}
        />
      </Animated.View>

      {/* centre: the wordmark (hero) + the verse */}
      <View style={[styles.center, { width: Math.min(width - 40, 360) }]} pointerEvents="none">
        <Animated.View style={wordStyle}>
          <Txt style={styles.brand}>Daily Qur’an</Txt>
        </Animated.View>
        <SplashVerse reveal={reveal} greeting={look.greeting} tone={tone} style={styles.verse} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 28 },
  brand: {
    fontFamily: font.serif,
    fontSize: 36,
    lineHeight: 46,
    color: c.scriptureInk,
    letterSpacing: 0.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 12,
  },
  verse: { marginTop: -4 },
});
