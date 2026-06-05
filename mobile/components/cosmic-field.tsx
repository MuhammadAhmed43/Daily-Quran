// cosmic-field.tsx — a per-CARD cosmic backdrop for the Explore-topics tiles. Each card is its own quiet
// galaxy on the SAME warm near-black onyx base: a soft champagne/gold nebula glow (the only per-card colour,
// varying in warmth + corner) + a few warm champagne stars that twinkle slowly and asynchronously + an edge
// vignette for depth. The gold identity leads — reverent, unmistakably onyx, never a colour show. Drop it as
// the first child of a `position:relative` + `overflow:hidden` card; it fills the card behind the content
// and never intercepts touches.
//
// Stars are seeded by the card id (a stable hash) so every topic has its own consistent layout, with NO
// runtime randomness. ~6 stars/card, ~4 animated — opacity + scale only, far inside Reanimated's budget.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { c } from '@/lib/theme';

// Every card shares one warm near-black onyx base — the gold identity leads. The ONLY differentiation is a
// soft champagne/gold nebula glow that varies in warmth + which corner it blooms from, plus each topic's
// own stars. Reverent and unmistakably onyx — a quiet shimmer, not a colour show.
const BASE: [string, string] = ['#121011', '#1C1916']; // warm near-black surface

type Glow = { color: string; from: { x: number; y: number }; to: { x: number; y: number } };
const GLOWS: Glow[] = [
  { color: 'rgba(201,189,166,0.30)', from: { x: 0.08, y: 1 }, to: { x: 0.85, y: 0.1 } }, // champagne · bottom-left
  { color: 'rgba(214,180,120,0.30)', from: { x: 0.92, y: 0.12 }, to: { x: 0.1, y: 0.9 } }, // gold · top-right
  { color: 'rgba(198,150,96,0.28)', from: { x: 0.9, y: 0.92 }, to: { x: 0.1, y: 0.1 } }, // amber · bottom-right
  { color: 'rgba(224,210,178,0.27)', from: { x: 0.1, y: 0.1 }, to: { x: 0.9, y: 0.92 } }, // pale gold · top-left
  { color: 'rgba(184,144,100,0.28)', from: { x: 0.5, y: 1 }, to: { x: 0.5, y: 0.05 } }, // bronze · bottom
  { color: 'rgba(228,220,198,0.26)', from: { x: 0.08, y: 0.95 }, to: { x: 0.9, y: 0.35 } }, // warm ivory · lower-left
];
const glowFor = (i: number): Glow => GLOWS[((i % GLOWS.length) + GLOWS.length) % GLOWS.length];

// A tiny seeded PRNG (mulberry32) — no Math.random() ever runs at render time or in a worklet.
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable FNV-1a hash so each topic id seeds a consistent, unique star layout.
export function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type Star = {
  x: number; // 0..1 fraction of the card
  y: number;
  size: number;
  base: number; // dim end of the twinkle
  peak: number; // bright end
  color: string;
  near: boolean; // brightest — soft bloom + micro-scale
  dur: number; // ms per fade leg
  phase: number; // ms start offset (desyncs the twinkle)
  twinkles: boolean;
};

function makeStars(seed: number): Star[] {
  const rnd = mulberry32(seed);
  const out: Star[] = [];
  const N = 6;
  for (let i = 0; i < N; i++) {
    const big = i < 2; // two brighter "near" stars per card
    out.push({
      x: 0.08 + rnd() * 0.84,
      y: 0.08 + rnd() * 0.84,
      size: big ? 2 + rnd() : 1 + rnd() * 0.8,
      base: big ? 0.5 : 0.22,
      peak: big ? 1 : 0.7,
      // warm starlight only — ivory / champagne / pale gold, in keeping with the onyx gold identity
      color: i === 0 ? c.scriptureInk : big ? 'rgba(234,226,208,0.95)' : 'rgba(224,210,176,0.9)',
      near: big,
      dur: 1500 + rnd() * 1300,
      phase: rnd() * 2400,
      twinkles: big || rnd() < 0.6,
    });
  }
  return out;
}

export function StarDot({ s, w, h }: { s: Star; w: number; h: number }) {
  const t = useSharedValue(0); // 0..1 twinkle driver (UI thread)
  useEffect(() => {
    if (!s.twinkles) return;
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
  }, [s.dur, s.phase, s.twinkles, t]);

  const aStyle = useAnimatedStyle(() => {
    const op = s.twinkles ? s.base + (s.peak - s.base) * t.value : s.peak;
    return { opacity: op, transform: [{ scale: s.near ? 1 + 0.18 * t.value : 1 }] };
  });

  return (
    <Animated.View
      collapsable={false}
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: s.x * w,
          top: s.y * h,
          width: s.size,
          height: s.size,
          borderRadius: s.size / 2,
          backgroundColor: s.color,
        },
        s.near && { shadowColor: c.scriptureInk, shadowOpacity: 0.7, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } },
        aStyle,
      ]}
    />
  );
}

/** A cosmic tile background — warm near-black onyx + a soft gold nebula glow + stars + vignette, clipped to
 *  its parent card. */
export function CosmicCardBg({ hueIndex, id }: { hueIndex: number; id: string }) {
  const glow = glowFor(hueIndex);
  const stars = useMemo(() => makeStars(hashStr(id)), [id]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {/* warm near-black onyx base — shared by every card */}
      <LinearGradient colors={BASE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {/* a soft champagne/gold nebula glow — the only per-card colour, blooming from its corner */}
      <LinearGradient colors={[glow.color, 'transparent']} start={glow.from} end={glow.to} style={StyleSheet.absoluteFill} />
      {size.w > 0 ? stars.map((s, i) => <StarDot key={i} s={s} w={size.w} h={size.h} />) : null}
      {/* vignette — darken top + bottom edges for depth and text contrast */}
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.42)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
