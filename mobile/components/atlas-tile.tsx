// atlas-tile.tsx — the Explore 2x2 CATEGORY tile: an emblem-led evolution of the Ask cosmic card.
// A gold-leaf line-art emblem is the HERO on quiet onyx, with a per-tile glow locus + a hushed starfield
// (the same seeded star DNA as cosmic-field, but calmer and dimmer — the emblem leads, not the stars) +
// a bottom scrim for the serif label. Each category carries its own aniconic, Qur'anic emblem drawn from
// the imagery of light (Ayat an-Nur): an open book rising into a crescent (Stories) / a play within a
// mihrab arch (Watch) / a path over dunes toward a star (Journeys) / a crescent cradling an 8-point star
// with a small constellation (Qur'an Plan). Deterministic (seeded by category id); ~5 animated nodes/tile.
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { hashStr, mulberry32, StarDot, type Star } from '@/components/cosmic-field';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Txt } from '@/components/ui/primitives';
import { c, glow, radius, space } from '@/lib/theme';

export type AtlasCategory = 'stories' | 'watch' | 'journeys' | 'quran-plan';

type TileSpec = {
  base: [string, string]; // warm near-black, value-stepped per tile
  glow: string; // champagne/gold bloom (the only colour, shared family palette)
  glowFrom: { x: number; y: number };
  glowTo: { x: number; y: number };
};

// Differentiation in one warm palette = glow LOCUS + a subtle value step (never hue). Stories blooms from
// the bottom-left like firelight on a page; Watch is a centred halo (lightest); Journeys is a low dawn
// horizon band (darkest); Qur'an Plan is a halo top-right behind the crescent.
const SPECS: Record<AtlasCategory, TileSpec> = {
  stories: { base: ['#151210', '#1D1815'], glow: 'rgba(201,189,166,0.26)', glowFrom: { x: 0.12, y: 1 }, glowTo: { x: 0.8, y: 0.18 } },
  watch: { base: ['#161412', '#221D17'], glow: 'rgba(224,210,178,0.24)', glowFrom: { x: 0.5, y: 0.04 }, glowTo: { x: 0.5, y: 0.92 } },
  journeys: { base: ['#100F0D', '#171311'], glow: 'rgba(214,180,120,0.24)', glowFrom: { x: 0.5, y: 1 }, glowTo: { x: 0.5, y: 0.22 } },
  'quran-plan': { base: ['#141210', '#1D1814'], glow: 'rgba(228,220,198,0.23)', glowFrom: { x: 0.78, y: 0.06 }, glowTo: { x: 0.18, y: 0.95 } },
};

// Hushed starfield — fewer, dimmer, slower than the Ask cosmic card, kept to the upper area so they never
// crowd the emblem or the label. The emblem is the subject; these are just atmosphere.
function makeQuietStars(seed: number): Star[] {
  const rnd = mulberry32(seed);
  const out: Star[] = [];
  const N = 4;
  for (let i = 0; i < N; i++) {
    const big = i === 0;
    out.push({
      x: 0.42 + rnd() * 0.5, // bias to the right so they avoid the top-left emblem
      y: 0.08 + rnd() * 0.46,
      size: big ? 2 : 1 + rnd() * 0.7,
      base: big ? 0.3 : 0.14,
      peak: big ? 0.75 : 0.46,
      color: big ? 'rgba(234,226,208,0.9)' : 'rgba(224,210,176,0.82)',
      near: big,
      dur: 2200 + rnd() * 1500,
      phase: rnd() * 2600,
      twinkles: true,
    });
  }
  return out;
}

// ───────────────────────────── the emblems ─────────────────────────────
// Refined line-art glyphs (MaterialCommunityIcons) in champagne, each lit with a soft glow — one consistent
// "house" weight across all four, and each clearly its own: an open story book, a play mark, a winding
// path, and the crescent-and-star. The gold-leaf feel comes from the champagne ink + the glow.
const EMBLEM: Record<AtlasCategory, keyof typeof MaterialCommunityIcons.glyphMap> = {
  stories: 'script-text-outline', // a scroll/manuscript — tales, distinct from the Qur'an tab's book
  watch: 'play', // a clean play mark; the seal medallion is its frame (no double-ring)
  journeys: 'map-marker-path',
  'quran-plan': 'star-crescent',
};

// A glyph framed by an 8-point seal (rub el hizb): two thin champagne squares rotated 45deg, lit by a soft
// champagne glow. Reused at tile scale (the Explore 2x2) and badge scale (the Recommended rows + hero) so
// the whole tab shares one emblem language.
export function SealMedallion({
  name,
  frame = 50,
  ring = 38,
  glyph = 24,
  glowStrength = 0.3,
}: {
  name: keyof typeof MaterialCommunityIcons.glyphMap;
  frame?: number;
  ring?: number;
  glyph?: number;
  glowStrength?: number;
}) {
  const sealStyle: ViewStyle = { position: 'absolute', width: ring, height: ring, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(201,189,166,0.55)' };
  return (
    <View style={[{ width: frame, height: frame, alignItems: 'center', justifyContent: 'center' }, glow(c.accentBright, glowStrength, 12)]}>
      <View style={[sealStyle, { transform: [{ rotate: '45deg' }] }]} pointerEvents="none" />
      <View style={sealStyle} pointerEvents="none" />
      <MaterialCommunityIcons name={name} size={glyph} color={c.accent} />
    </View>
  );
}

// ───────────────────────────── the tile ─────────────────────────────
export function AtlasTile({
  category,
  title,
  sublabel,
  onPress,
}: {
  category: AtlasCategory;
  title: string;
  sublabel: string;
  onPress: () => void;
}) {
  const spec = SPECS[category];
  const stars = useMemo(() => makeQuietStars(hashStr(category)), [category]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  // Idle glow-breath — each tile breathes on its own phase so the grid shimmers asynchronously.
  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withDelay(
      hashStr(category) % 1600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
  }, [breath, category]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.82 + 0.18 * breath.value }));

  // Press-bloom — a champagne wash that swells from the emblem corner on touch, then eases back out.
  const press = useSharedValue(0);
  const bloomStyle = useAnimatedStyle(() => ({ opacity: press.value * 0.6 }));

  return (
    <PressableScale
      style={styles.tile}
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) });
      }}
      onPressOut={() => {
        press.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) });
      }}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
        {/* warm near-black base, value-stepped per tile */}
        <LinearGradient colors={spec.base} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* the per-tile glow, blooming from its own locus, breathing slowly */}
        <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
          <LinearGradient colors={[spec.glow, 'transparent']} start={spec.glowFrom} end={spec.glowTo} style={StyleSheet.absoluteFill} />
        </Animated.View>
        {/* a hushed starfield */}
        {size.w > 0 ? stars.map((s, i) => <StarDot key={i} s={s} w={size.w} h={size.h} />) : null}
        {/* bottom scrim so the label always reads */}
        <LinearGradient colors={c.cardScrim} locations={[0.4, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      </View>

      {/* press-bloom: a soft champagne lift from the emblem corner on touch */}
      <Animated.View style={[StyleSheet.absoluteFill, bloomStyle]} pointerEvents="none">
        <LinearGradient colors={['rgba(227,217,196,0.5)', 'transparent']} start={{ x: 0.24, y: 0.22 }} end={{ x: 0.95, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* the emblem in an 8-point seal medallion (rub el hizb) — the hero */}
      <View style={styles.emblem}>
        <SealMedallion name={EMBLEM[category]} />
      </View>

      {/* the lit top edge (catches the light, like glass) */}
      <View style={styles.lip} pointerEvents="none" />

      {/* the label */}
      <View style={styles.labelWrap}>
        <Txt variant="cardTitle" numberOfLines={1} style={styles.title}>
          {title}
        </Txt>
        <Txt variant="caption" numberOfLines={1} color={c.textSecondary}>
          {sublabel}
        </Txt>
      </View>
      <Ionicons name="arrow-forward" size={15} color={c.accent} style={styles.chevron} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '48.5%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    justifyContent: 'flex-end',
  },
  emblem: { position: 'absolute', top: space.card, left: space.card },
  lip: { position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: c.glassLip },
  labelWrap: { paddingHorizontal: space.card, paddingBottom: space.card, paddingRight: 40, gap: 2 },
  title: { lineHeight: 22 },
  chevron: { position: 'absolute', right: space.card, bottom: space.card + 3, transform: [{ rotate: '-45deg' }] },
});
