// SkyBand — a small, magical constellation for a dark band (e.g. the status-bar / notch zone at the top
// of a screen). Warm champagne/ivory starlight only (the onyx-gold identity — never cool stars). Each star
// twinkles (opacity + a soft bloom on the bright ones) AND drifts gently along a seeded vector, so the field
// feels alive rather than static. Seeded by `seed` via mulberry32 -> deterministic, zero runtime randomness,
// New-Arch safe (opacity + transform only). Drop it as an absolutely-positioned overlay over a dark scrim;
// it never intercepts touches.
import { useEffect, useMemo } from 'react';
import { InteractionManager, StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
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
  near: boolean; // brighter — micro-scale on the twinkle
  dur: number; // ms per twinkle leg
  phase: number; // ms offset (desyncs the twinkle)
};

function makeStars(seed: number, n: number): Spec[] {
  const rnd = mulberry32(seed);
  const out: Spec[] = [];
  for (let i = 0; i < n; i++) {
    const big = rnd() < 0.3; // ~30% brighter "near" stars
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
    });
  }
  return out;
}

function Star({ s, w, h }: { s: Spec; w: number; h: number }) {
  const t = useSharedValue(0); // twinkle driver
  useEffect(() => {
    // Start the loop only AFTER the screen transition settles, so mounting a band of stars on a tab's
    // first visit never janks the navigation — the stars appear at rest, then begin to twinkle.
    const task = InteractionManager.runAfterInteractions(() => {
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
    });
    return () => task.cancel();
  }, [s, t]);

  // Twinkle only (opacity + a micro-scale on the bright stars). The gentle per-frame drift was dropped: it
  // was a second infinite loop per star moving a layer every frame — meaningful sustained CPU for a barely
  // visible effect. Twinkling in place still feels alive at a fraction of the cost.
  const aStyle = useAnimatedStyle(() => {
    const op = s.base + (s.peak - s.base) * t.value;
    return {
      opacity: op,
      transform: [{ scale: s.near ? 1 + 0.22 * t.value : 1 }],
    };
  });

  return (
    <Animated.View
      collapsable={false}
      pointerEvents="none"
      style={[
        { position: 'absolute', left: s.x * w, top: s.y * h, width: s.size, height: s.size, borderRadius: s.size / 2, backgroundColor: s.color },
        // No animated shadow — re-blurring it every frame is the single biggest per-star GPU/heat cost.
        aStyle,
      ]}
    />
  );
}

export function SkyBand({
  height,
  count = 14,
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
