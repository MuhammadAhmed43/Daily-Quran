// CONCEPT 3 — Ayat an-Nur niche & lamp ("light upon light").
// The most literal reading of the verse, kept strictly abstract + aniconic: a mihrab niche (pointed arch)
// draws itself on in champagne line, a star-like lamp-glass ignites within it casting a soft ray-burst
// ("the glass as if a brilliant star ... light upon light"), and the verse settles beneath. A faint sky
// behind keeps the four times of day distinct. No figures, only architecture and light.
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { SkyBand } from '@/components/sky-band';
import { Brandmark, RadialBloom, Seal, SKY, SplashVerse, type Phase } from '@/components/splash/common';
import { haptic } from '@/lib/haptics';
import { c } from '@/lib/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
// A pointed mihrab arch in a 100x150 viewBox: up the left jamb, two curves meeting at the apex, down the right.
const ARCH_D = 'M14 148 L14 66 Q14 16 50 8 Q86 16 86 66 L86 148';
const ARCH_LEN = 340; // slight over-estimate of the path length, for the draw-on dash

const T = { arch: { d: 0, dur: 860 }, lamp: { d: 620, dur: 720 }, reveal: { d: 1320, dur: 880 }, hapticAt: 1560, doneAt: 2740 };

export function NicheSplash({ phase, onDone }: { phase: Phase; onDone?: () => void }) {
  const { height } = useWindowDimensions();
  const meta = SKY[phase];
  const tone = meta.tone;

  const arch = useSharedValue(0); // niche draw-on
  const lamp = useSharedValue(0); // lamp ignite + rays
  const reveal = useSharedValue(0); // verse

  useEffect(() => {
    arch.value = withDelay(T.arch.d, withTiming(1, { duration: T.arch.dur, easing: Easing.inOut(Easing.cubic) }));
    lamp.value = withDelay(T.lamp.d, withTiming(1, { duration: T.lamp.dur, easing: Easing.out(Easing.cubic) }));
    reveal.value = withDelay(T.reveal.d, withTiming(1, { duration: T.reveal.dur, easing: Easing.out(Easing.cubic) }));
    const h = setTimeout(() => haptic.light(), T.hapticAt);
    const d = onDone ? setTimeout(onDone, T.doneAt) : undefined;
    return () => {
      clearTimeout(h);
      if (d) clearTimeout(d);
    };
  }, [phase, arch, lamp, reveal, onDone]);

  const skyStyle = useAnimatedStyle(() => ({ opacity: 0.55 * interpolate(arch.value, [0, 1], [0, 1], Extrapolation.CLAMP) }));
  const archProps = useAnimatedProps(() => ({ strokeDashoffset: (1 - arch.value) * ARCH_LEN, opacity: interpolate(arch.value, [0, 0.1], [0, 1], Extrapolation.CLAMP) }));
  const lampGlowStyle = useAnimatedStyle(() => ({ opacity: interpolate(lamp.value, [0, 0.6, 1], [0, 0.85, 0.7], Extrapolation.CLAMP) }));
  const lampStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, lamp.value * 2), transform: [{ scale: 0.7 + 0.3 * lamp.value }] }));

  return (
    <View style={styles.root}>
      {/* a faint sky so the hour still reads behind the niche */}
      <Animated.View style={[StyleSheet.absoluteFill, skyStyle]} pointerEvents="none">
        <RadialBloom id={`nsky-${phase}`} cx={meta.cx} cy={meta.cy} r={meta.r} stops={meta.stops} />
      </Animated.View>
      {meta.stars > 0 ? (
        <Animated.View style={[StyleSheet.absoluteFill, skyStyle]} pointerEvents="none">
          <SkyBand height={height} count={Math.round(meta.stars * 0.7)} seed={meta.starSeed} />
        </Animated.View>
      ) : null}

      <View style={styles.center} pointerEvents="none">
        <View style={styles.niche}>
          {/* the lamp glow fills the niche interior */}
          <Animated.View style={[StyleSheet.absoluteFill, lampGlowStyle]} pointerEvents="none">
            <RadialBloom
              id={`lamp-${phase}`}
              cx={0.5}
              cy={0.46}
              r={0.5}
              stops={[
                { offset: 0, color: '#FFF6E6', opacity: 0.55 },
                { offset: 0.5, color: tone, opacity: 0.3 },
                { offset: 1, color: tone, opacity: 0 },
              ]}
            />
          </Animated.View>

          {/* the niche outline: a faint static ghost (always present) with the bright line drawing itself on over it */}
          <Svg width={168} height={252} viewBox="0 0 100 150" style={StyleSheet.absoluteFill}>
            <Path d={ARCH_D} stroke={tone} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.16} />
            <AnimatedPath d={ARCH_D} stroke={tone} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={ARCH_LEN} animatedProps={archProps} />
          </Svg>

          {/* the lamp-glass + ray burst */}
          <View style={styles.lampWrap} pointerEvents="none">
            <Rays lamp={lamp} tone={tone} />
            <Animated.View style={lampStyle}>
              <Seal size={40} color="#FBEFD8" sw={1.4} />
            </Animated.View>
          </View>
        </View>

        <Brandmark anim={lamp} />
        <SplashVerse reveal={reveal} greeting={meta.greeting} tone={tone} style={styles.verse} />
      </View>
    </View>
  );
}

// A soft sunburst of thin champagne rays radiating from the lamp — "light upon light".
function Rays({ lamp, tone, n = 12, len = 46 }: { lamp: SharedValue<number>; tone: string; n?: number; len?: number }) {
  const st = useAnimatedStyle(() => ({ opacity: interpolate(lamp.value, [0, 0.5, 1], [0, 0.45, 0.62], Extrapolation.CLAMP), transform: [{ scale: 0.55 + 0.45 * lamp.value }] }));
  return (
    <Animated.View style={[styles.rays, st]} pointerEvents="none">
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={[styles.ray, { height: len, backgroundColor: tone, transform: [{ rotate: `${(360 / n) * i}deg` }, { translateY: -len / 2 }] }]} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 36, marginTop: -6 },
  niche: { width: 168, height: 252, alignItems: 'center', justifyContent: 'center' },
  lampWrap: { position: 'absolute', top: '40%', alignItems: 'center', justifyContent: 'center' },
  rays: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ray: { position: 'absolute', width: 1.4, borderRadius: 1 },
  verse: { marginTop: 4 },
});
