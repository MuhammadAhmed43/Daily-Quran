// SkyBand — a small, magical constellation for a dark band (e.g. the status-bar / notch zone at the top
// of a screen). Warm champagne/ivory starlight only (the onyx-gold identity — never cool stars). Each star
// twinkles (opacity + a soft bloom on the bright ones) AND drifts gently along a seeded vector, so the field
// feels alive rather than static. Seeded by `seed` via mulberry32 -> deterministic, zero runtime randomness,
// New-Arch safe (opacity + transform only). Drop it as an absolutely-positioned overlay over a dark scrim;
// it never intercepts touches.
import { useEffect, useMemo } from 'react';
import { StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { mulberry32 } from '@/components/cosmic-field';
import { c } from '@/lib/theme';

type Spec = {
  x: number; // 0..1 of the band width
  y: number; // 0..1 of the band height
  size: number;
  base: number; // dim end of the twinkle
  peak: number; // bright end
  color: string;
  near: boolean; // brighter — soft bloom + micro-scale
  dur: number; // ms per twinkle leg
  phase: number; // ms offset (desyncs the twinkle)
  vx: number; // drift vector (px)
  vy: number;
  driftDur: number; // ms per drift leg
  driftPhase: number;
};

function makeStars(seed: number, n: number): Spec[] {
  const rnd = mulberry32(seed);
  const out: Spec[] = [];
  for (let i = 0; i < n; i++) {
    const big = rnd() < 0.3; // ~30% brighter "near" stars
    const ang = rnd() * Math.PI * 2;
    const amp = 2 + rnd() * 4; // 2–6px of drift
    out.push({
      x: 0.03 + rnd() * 0.94,
      y: 0.08 + rnd() * 0.64, // weighted toward the top (around the notch)
      size: big ? 1.8 + rnd() * 1.2 : 1 + rnd() * 0.9,
      base: big ? 0.45 : 0.16,
      peak: big ? 1 : 0.64,
      color: i % 5 === 0 ? c.scriptureInk : big ? 'rgba(236,228,210,0.95)' : 'rgba(226,212,178,0.9)',
      near: big,
      dur: 1400 + rnd() * 1500,
      phase: rnd() * 2600,
      vx: Math.cos(ang) * amp,
      vy: Math.sin(ang) * amp,
      driftDur: 4200 + rnd() * 4200,
      driftPhase: rnd() * 3200,
    });
  }
  return out;
}

function Star({ s, w, h }: { s: Spec; w: number; h: number }) {
  const t = useSharedValue(0); // twinkle driver
  const d = useSharedValue(0); // drift driver (0..1, auto-reversing)
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
    d.value = withDelay(s.driftPhase, withRepeat(withTiming(1, { duration: s.driftDur, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [s, t, d]);

  const aStyle = useAnimatedStyle(() => {
    const op = s.base + (s.peak - s.base) * t.value;
    const k = (d.value - 0.5) * 2; // -1..1
    return {
      opacity: op,
      transform: [{ translateX: s.vx * k }, { translateY: s.vy * k }, { scale: s.near ? 1 + 0.22 * t.value : 1 }],
    };
  });

  return (
    <Animated.View
      collapsable={false}
      pointerEvents="none"
      style={[
        { position: 'absolute', left: s.x * w, top: s.y * h, width: s.size, height: s.size, borderRadius: s.size / 2, backgroundColor: s.color },
        s.near && { shadowColor: c.scriptureInk, shadowOpacity: 0.8, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } },
        aStyle,
      ]}
    />
  );
}

export function SkyBand({
  height,
  count = 25,
  seed = 0x5eed,
  style,
}: {
  height: number;
  count?: number;
  seed?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { width } = useWindowDimensions();
  const stars = useMemo(() => makeStars(seed, count), [seed, count]);
  return (
    <View pointerEvents="none" style={[styles.band, { height }, style]}>
      {stars.map((s, i) => (
        <Star key={i} s={s} w={width} h={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', top: 0, left: 0, right: 0 },
});
