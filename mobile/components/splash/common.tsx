// Shared foundation for the launch-splash concepts (see UI-REDESIGN-SPEC.md §4.1, frames 1-2).
// The splash opens onto the user's sky: an onyx canvas lit for the local time of day (Day / Night), with the
// app wordmark + the signature Ayat an-Nur verse + a gold-leaf mark. This module holds everything the concept
// components share: the time-of-day model, the per-phase palette, the verse (sliced from the verified DB by
// ID — never hand-typed), the volumetric radial-bloom + crescent + seal + wordmark primitives, and the
// staggered verse reveal. All animation is opacity/transform via Reanimated v4 (New-Arch safe); the bloom is
// drawn with react-native-svg's RadialGradient (LinearGradient can't do a true radial).
import { ReactNode, useId } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, Mask, RadialGradient as SvgRadialGradient, Rect, Stop } from 'react-native-svg';

import { Txt } from '@/components/ui/primitives';
import { c, font } from '@/lib/theme';
import { getVerse } from '@/lib/today';

export const APP_NAME = 'Daily Qur’an';

// ───────────────────────────── time of day ─────────────────────────────
export type Phase = 'day' | 'night';
// The splash is night-only for now (the day variant was dropped), so only Night is offered + used.
export const PHASES: Phase[] = ['night'];

export function phaseFromClock(): Phase {
  return 'night';
}

// ───────────────────────────── the verse (Ayat an-Nur 24:35) ─────────────────────────────
// Sliced from the verified bundle by ID. The Uthmani text marks a waqf (pause) right after "the heavens and
// the earth" (U+06DA), so we take the iconic opening clause at that natural boundary; the English is the
// verse's first sentence, verbatim (the bundled Itani translation renders "God"). Attributed by ref — an
// honest excerpt of a long ayah, never an LLM paraphrase.
function buildNur() {
  const v = getVerse(24, 35);
  const ar = v ? v.ar.split('ۚ')[0].replace(/[۝۞۩]/g, '').trim() : '';
  const en = v ? v.en.split('. ')[0].trim() : 'God is the Light of the heavens and the earth';
  return { ar, en, ref: 'An-Nūr · 24:35' };
}
export const NUR = buildNur();

// ───────────────────────────── motion rhythm (shared beats, ms) ─────────────────────────────
export const BEAT = {
  markIn: { delay: 0, dur: 900 },
  sky: { delay: 500, dur: 1400 },
  reveal: { delay: 1500, dur: 1100 },
  hapticAt: 1800,
  doneAt: 4400, // hold the finished splash a beat longer before it dissolves
} as const;

// ───────────────────────────── per-phase palette ─────────────────────────────
export type BloomStop = { offset: number; color: string; opacity?: number };
export type SkyMeta = {
  greeting: string; // eyebrow (uppercased at render)
  cx: number; // bloom centre (fraction of screen)
  cy: number;
  r: number; // bloom radius (fraction)
  stops: BloomStop[]; // core -> edge
  base?: [string, string]; // optional faint vertical wash over onyx (top -> transparent)
  stars: number; // SkyBand count
  starSeed: number;
  crescent: null | { x: number; y: number; size: number; bright: number };
  tone: string; // accent for the rule / ref / mark tint
};

export const SKY: Record<Phase, SkyMeta> = {
  // Daybreak — a warm golden dawn rising from the horizon: a deep warm sky up top, a gold sunrise glow
  // blooming from the lower centre. Premium and unmistakably "morning", staying within the onyx dark-premium
  // identity (no washed-out pale smudge).
  day: {
    greeting: 'As-salāmu ʿalaykum',
    cx: 0.5,
    cy: 0.96,
    r: 1.18,
    stops: [
      { offset: 0, color: '#F6C570', opacity: 0.6 }, // warm gold sun core, low
      { offset: 0.32, color: '#D89A50', opacity: 0.36 }, // amber
      { offset: 0.62, color: '#8A5A2E', opacity: 0.18 }, // bronze
      { offset: 1, color: '#8A5A2E', opacity: 0 },
    ],
    base: ['rgba(36,26,15,0.72)', 'transparent'], // warm-dark sky from the top
    stars: 0,
    starSeed: 0x2202,
    crescent: null,
    tone: '#EBB877', // warm gold accents for daybreak
  },
  // The night sky — deep onyx, a faint champagne moon-glow top-right, the full constellation, a bright
  // crescent. Contemplative and vast; our star engine at full strength.
  night: {
    greeting: 'A peaceful night',
    cx: 0.82,
    cy: 0.18,
    r: 0.62,
    stops: [
      { offset: 0, color: '#C9BDA6', opacity: 0.24 },
      { offset: 0.6, color: '#C9BDA6', opacity: 0.07 },
      { offset: 1, color: '#C9BDA6', opacity: 0 },
    ],
    stars: 34,
    starSeed: 0x4404,
    crescent: null,
    tone: '#C9BDA6',
  },
};

// ───────────────────────────── radial bloom (svg) ─────────────────────────────
// A soft volumetric light. Static SVG — wrap it in an Animated.View to fade/scale it in. Each instance needs
// a unique `id` (SVG gradient ids are document-global).
export function RadialBloom({
  id,
  cx = 0.5,
  cy = 0.5,
  r = 0.7,
  stops,
  style,
}: {
  id: string;
  cx?: number;
  cy?: number;
  r?: number;
  stops: BloomStop[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Svg style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Defs>
        <SvgRadialGradient id={id} cx={`${cx * 100}%`} cy={`${cy * 100}%`} r={`${r * 100}%`}>
          {stops.map((s, i) => (
            <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity ?? 1} />
          ))}
        </SvgRadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

// ───────────────────────────── crescent moon (svg, aniconic) ─────────────────────────────
// A true lune via an SVG mask (a full disc minus an offset disc) so the carved-out side is TRANSPARENT — not
// filled with the canvas colour (the old two-opaque-circles trick showed a dark disc over the moon-glow).
export function Crescent({ size = 50, color = c.scriptureInk, bright = 1 }: { size?: number; color?: string; bright?: number }) {
  const mid = `cres-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View
      style={{ width: size, height: size, shadowColor: color, shadowOpacity: 0.45 * bright, shadowRadius: size * 0.4, shadowOffset: { width: 0, height: 0 } }}
      pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <Mask id={mid}>
            <Circle cx="50" cy="50" r="42" fill="#fff" />
            <Circle cx="64" cy="44" r="37" fill="#000" />
          </Mask>
        </Defs>
        <Circle cx="50" cy="50" r="42" fill={color} opacity={0.45 + 0.55 * bright} mask={`url(#${mid})`} />
      </Svg>
    </View>
  );
}

// ───────────────────────────── the seal mark (rub el hizb 8-point) ─────────────────────────────
// Two thin squares rotated 45deg + a centre point = an 8-point gold-leaf star, no glyph. The cleanest mark.
export function Seal({ size = 66, color = c.accent, sw = 1.3 }: { size?: number; color?: string; sw?: number }) {
  const sq: ViewStyle = { position: 'absolute', width: size * 0.6, height: size * 0.6, borderRadius: 3, borderWidth: sw, borderColor: color };
  const dot: ViewStyle = { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: color };
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
      <View style={[sq, { transform: [{ rotate: '45deg' }] }]} />
      <View style={sq} />
      <View style={dot} />
    </View>
  );
}

// ───────────────────────────── the app wordmark ─────────────────────────────
// "Daily Qur'an" in editorial serif, fading up on the supplied driver (the concept's primary entrance value).
export function Brandmark({ anim, style }: { anim: SharedValue<number>; style?: StyleProp<ViewStyle> }) {
  const st = useAnimatedStyle(() => {
    const p = interpolate(anim.value, [0.4, 1], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: (1 - p) * 6 }] };
  });
  return (
    <Animated.View style={[st, style]} pointerEvents="none">
      <Txt style={styles.brand}>{APP_NAME}</Txt>
    </Animated.View>
  );
}

// ───────────────────────────── the verse reveal (shared across concepts) ─────────────────────────────
function RevealLine({ reveal, a, b, style, children }: { reveal: SharedValue<number>; a: number; b: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const st = useAnimatedStyle(() => {
    const p = interpolate(reveal.value, [a, b], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: (1 - p) * 10 }] };
  });
  return <Animated.View style={[style, st]}>{children}</Animated.View>;
}

// The greeting · Arabic clause · gold rule · English · ref, each rising in on its own slice of `reveal` (0..1).
// `hideGreeting` lets a concept render its own greeting elsewhere.
export function SplashVerse({
  reveal,
  greeting,
  tone,
  hideGreeting,
  style,
}: {
  reveal: SharedValue<number>;
  greeting: string;
  tone: string;
  hideGreeting?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.verse, style]} pointerEvents="none">
      {hideGreeting ? null : (
        <RevealLine reveal={reveal} a={0} b={0.32}>
          <Txt style={[styles.greeting, { color: tone }]}>{greeting.toUpperCase()}</Txt>
        </RevealLine>
      )}
      <RevealLine reveal={reveal} a={0.16} b={0.56}>
        <Txt style={styles.ar}>{NUR.ar}</Txt>
      </RevealLine>
      <RevealLine reveal={reveal} a={0.4} b={0.66} style={styles.ruleRow}>
        <View style={[styles.ruleLine, { backgroundColor: tone }]} />
        <View style={[styles.ruleDot, { backgroundColor: tone }]} />
        <View style={[styles.ruleLine, { backgroundColor: tone }]} />
      </RevealLine>
      <RevealLine reveal={reveal} a={0.46} b={0.82}>
        <Txt style={styles.en}>{NUR.en}.</Txt>
      </RevealLine>
      <RevealLine reveal={reveal} a={0.7} b={1}>
        <Txt style={[styles.ref, { color: tone }]}>{NUR.ref}</Txt>
      </RevealLine>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { fontFamily: font.serif, fontSize: 23, lineHeight: 30, color: c.scriptureInk, letterSpacing: 0.5, textAlign: 'center' },
  verse: { alignItems: 'center', gap: 16, paddingHorizontal: 20 },
  greeting: { fontFamily: font.sansBold, fontSize: 11, letterSpacing: 2.2 },
  ar: { fontFamily: font.arabic, fontSize: 40, lineHeight: 70, color: c.scriptureInk, textAlign: 'center', writingDirection: 'rtl' },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  ruleLine: { width: 30, height: StyleSheet.hairlineWidth },
  ruleDot: { width: 3, height: 3, borderRadius: 2 },
  en: { fontFamily: font.serifItalic, fontSize: 17, lineHeight: 26, color: c.scriptureInk, textAlign: 'center', maxWidth: 320 },
  ref: { fontFamily: font.sansSemi, fontSize: 11.5, letterSpacing: 2 },
});
