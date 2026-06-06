// CONCEPT 6 — Lottie (professional motion-designer animation), onyx-fied.
// Real designer-grade motion as the hero — not code-drawn shapes. Day and night swap the ANIMATION itself:
//   NIGHT → a slow rotating nebula starfield (native black, reverent, vast)
//   DAY   → drifting champagne-gold particles + a soft fan of dawn light-rays from above
// over the onyx canvas, with the "Daily Qur'an" wordmark + Ayat an-Nur revealing in a slow cinematic
// stagger. All assets are free-commercial (LottieFiles Simple License, see assets/splash/CREDITS.txt) and
// already on-palette (gold particles / white stars / pale-gold rays), so no recolor is needed for v1.
import LottieView from 'lottie-react-native';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { RadialBloom, SplashVerse, type Phase } from '@/components/splash/common';
import { Txt } from '@/components/ui/primitives';
import { haptic } from '@/lib/haptics';
import { c, font } from '@/lib/theme';

const NEBULA = require('../../assets/splash/lottie/nebula-stars.json');
const GOLD = require('../../assets/splash/lottie/golden-particle.json');
const RAYS = require('../../assets/splash/lottie/light-rays.json');

const T = { enter: { d: 0, dur: 820 }, word: { d: 520, dur: 820 }, reveal: { d: 1160, dur: 900 }, hapticAt: 1460, doneAt: 3000 };

export function LottieSplash({ phase, onDone }: { phase: Phase; onDone?: () => void }) {
  const { width } = useWindowDimensions();
  const night = phase === 'night';
  const tone = c.accent;
  const greeting = night ? 'A peaceful night' : 'As-salāmu ʿalaykum';

  const enter = useSharedValue(0);
  const word = useSharedValue(0);
  const reveal = useSharedValue(0);

  useEffect(() => {
    enter.value = withDelay(T.enter.d, withTiming(1, { duration: T.enter.dur, easing: Easing.out(Easing.quad) }));
    word.value = withDelay(T.word.d, withTiming(1, { duration: T.word.dur, easing: Easing.out(Easing.cubic) }));
    reveal.value = withDelay(T.reveal.d, withTiming(1, { duration: T.reveal.dur, easing: Easing.out(Easing.cubic) }));
    const h = setTimeout(() => haptic.light(), T.hapticAt);
    const d = onDone ? setTimeout(onDone, T.doneAt) : undefined;
    return () => {
      clearTimeout(h);
      if (d) clearTimeout(d);
    };
  }, [phase, enter, word, reveal, onDone]);

  const enterStyle = useAnimatedStyle(() => ({ opacity: enter.value }));
  const wordStyle = useAnimatedStyle(() => {
    const p = word.value;
    return { opacity: p, transform: [{ translateY: (1 - p) * 10 }] };
  });
  const haloStyle = useAnimatedStyle(() => ({ opacity: 0.5 * reveal.value }));

  return (
    <View style={styles.root}>
      {/* the motion layer + washes, fading up from black together */}
      <Animated.View style={[StyleSheet.absoluteFill, enterStyle]} pointerEvents="none">
        {/* a faint phase-tinted wash over the onyx */}
        <LinearGradient
          colors={night ? ['#070709', '#0A0A0A', '#0A0A0A'] : ['#0F0B06', '#0A0A0A', '#0A0A0A']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {night ? (
          // NIGHT — a slow rotating nebula starfield fills the screen
          <LottieView source={NEBULA} autoPlay loop speed={0.5} resizeMode="cover" style={StyleSheet.absoluteFill} />
        ) : (
          // DAY — drifting gold particles + a soft fan of light-rays from above
          <>
            <LottieView source={RAYS} autoPlay loop speed={0.5} resizeMode="cover" style={styles.rays} />
            <LottieView source={GOLD} autoPlay loop speed={0.6} resizeMode="cover" style={StyleSheet.absoluteFill} />
          </>
        )}

        {/* a champagne light bloom (cool moon-glow top by night, warm dawn glow by day) */}
        <RadialBloom
          id={`lbloom-${phase}`}
          cx={0.5}
          cy={night ? 0.2 : 0.32}
          r={night ? 0.6 : 0.7}
          stops={[
            { offset: 0, color: night ? '#C9BDA6' : '#F0C079', opacity: night ? 0.14 : 0.2 },
            { offset: 1, color: night ? '#C9BDA6' : '#F0C079', opacity: 0 },
          ]}
        />
      </Animated.View>

      {/* a soft dark halo behind the centre column for text legibility over the motion */}
      <Animated.View style={[StyleSheet.absoluteFill, haloStyle]} pointerEvents="none">
        <RadialBloom
          id={`lhalo-${phase}`}
          cx={0.5}
          cy={0.5}
          r={0.55}
          stops={[{ offset: 0, color: '#050505', opacity: 0.62 }, { offset: 0.7, color: '#050505', opacity: 0.3 }, { offset: 1, color: '#050505', opacity: 0 }]}
        />
      </Animated.View>

      {/* centre: the wordmark (hero) + the verse */}
      <View style={[styles.center, { width: Math.min(width - 40, 360) }]} pointerEvents="none">
        <Animated.View style={wordStyle}>
          <Txt style={styles.brand}>Daily Qur’an</Txt>
        </Animated.View>
        <SplashVerse reveal={reveal} greeting={greeting} tone={tone} style={styles.verse} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  rays: { position: 'absolute', top: 0, left: 0, right: 0, height: '58%', opacity: 0.55 },
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
