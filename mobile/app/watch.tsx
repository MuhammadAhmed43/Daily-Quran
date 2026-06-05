// Watch hub (Bible Chat frames 45-47, onyx). The beauty is the FEATURED hero (serif title + a frosted
// "N chapters" tag over the image, a white circular ARROW FAB half-overlapping the lower edge) that
// PARALLAXES as you scroll while a frosted "Watch" bar solidifies over it -> the image reads as pinned
// at the very top. Below: clean rows (rounded thumb with a duration badge -> serif title + meta -> a
// white play circle). Seerah/History chips switch the set and re-stagger it (smoothness rule).
// Re-skin only - data (watch.ts) + progress (watch-progress.ts) are unchanged.
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { SkyBand } from '@/components/sky-band';
import { Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { haptic } from '@/lib/haptics';
import { c, font, radius, shadow, space } from '@/lib/theme';
import { fmtDuration, getChapter, getChapters, TRACKS, ytThumb, type Track } from '@/lib/watch';
import { useWatchProgress } from '@/lib/watch-progress';

// Sharp 1280x720 thumbnail for the big hero (hqdefault is only 480x360 -> blurry when scaled up).
// Not every video has maxresdefault, so the hero falls back to ytThumb() on error.
const ytThumbMax = (youtubeId: string) => `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`;

function GlassDisc({ name, onPress }: { name: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <PressableScale style={styles.disc} onPress={onPress} hitSlop={8}>
      <BlurView intensity={30} tint="systemThinMaterialDark" style={StyleSheet.absoluteFill} />
      <View style={styles.discRim} pointerEvents="none" />
      <Ionicons name={name} size={20} color={c.textPrimary} />
    </PressableScale>
  );
}

export default function WatchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [track, setTrack] = useState<Track>('seerah');
  const [heroFallback, setHeroFallback] = useState(false);
  const progress = useWatchProgress();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const chapters = getChapters(track);
  const meta = TRACKS.find((t) => t.key === track)!;
  const { done, total } = progress.perTrack(track);

  // The FEATURED hero is GLOBAL (stable across the chip switch): resume what you were watching,
  // else the first unwatched Seerah chapter, else the opener.
  const cont = progress.continueChapter();
  const featured =
    (cont ? getChapter(cont.id) : undefined) ??
    getChapters('seerah').find((ch) => !progress.isWatched(ch.id)) ??
    getChapters('seerah')[0];
  const featTrack = featured ? TRACKS.find((t) => t.key === featured.track)! : meta;
  const featCount = featured ? getChapters(featured.track).length : 0;
  const featKicker = cont ? 'Continue watching' : progress.isWatched(featured?.id ?? '') ? 'Featured' : 'Start here';

  const BAR_H = insets.top + 52;

  const heroImg = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-160, 0, 320], [-14, 0, 9], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-160, 0], [1.26, 1.12], Extrapolation.CLAMP) },
    ],
  }));
  const openCh = (id: string) => {
    haptic.light();
    router.push({ pathname: '/watch/[id]', params: { id } });
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: BAR_H + 6, paddingBottom: insets.bottom + space.section }]}>
        {/* Featured hero */}
        {featured ? (
          <Animated.View entering={FadeIn.duration(360)}>
            <Txt variant="eyebrow" color={c.textSecondary} style={styles.featuredLabel}>
              Featured series
            </Txt>
            <PressableScale style={styles.featuredWrap} onPress={() => openCh(featured.id)}>
              <View style={styles.featuredCard}>
                <Animated.View style={[StyleSheet.absoluteFill, heroImg]}>
                  <Image
                    source={{ uri: heroFallback ? ytThumb(featured.videos[0].youtubeId) : ytThumbMax(featured.videos[0].youtubeId) }}
                    onError={() => setHeroFallback(true)}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={280}
                  />
                </Animated.View>
                <LinearGradient
                  colors={['transparent', 'rgba(6,6,6,0.35)', 'rgba(5,5,5,0.93)']}
                  locations={[0, 0.42, 1]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <View style={styles.featuredText}>
                  <View style={styles.tagRow}>
                    <View style={styles.tag}>
                      <BlurView intensity={24} tint="systemThinMaterialDark" style={StyleSheet.absoluteFill} />
                      <View style={styles.tagRim} pointerEvents="none" />
                      <Txt style={styles.tagText}>
                        {featCount} CHAPTERS
                      </Txt>
                    </View>
                    <Txt variant="eyebrow" color={c.accent} style={styles.kicker}>
                      {featKicker}
                    </Txt>
                  </View>
                  <Txt variant="h1" numberOfLines={2} style={styles.featuredTitle}>
                    {featured.title}
                  </Txt>
                  <Txt variant="caption" color={c.textSecondary} numberOfLines={1} style={styles.featuredMeta}>
                    {featTrack.label} · {featured.era}
                  </Txt>
                </View>
              </View>
              <View style={styles.featuredFab}>
                <MaterialCommunityIcons name="arrow-top-right" size={24} color={c.bg} />
              </View>
            </PressableScale>
          </Animated.View>
        ) : null}

        {/* Track chips */}
        <View style={styles.tracks}>
          {TRACKS.map((t) => {
            const on = t.key === track;
            return (
              <PressableScale
                key={t.key}
                style={[styles.track, on && styles.trackOn]}
                onPress={() => {
                  haptic.light();
                  setTrack(t.key);
                }}>
                <Txt variant="caption" style={[styles.trackText, on && styles.trackTextOn]}>
                  {t.label}
                </Txt>
              </PressableScale>
            );
          })}
        </View>

        {/* Section header */}
        <View style={styles.sectionHead}>
          <Txt variant="h2">{meta.subtitle}</Txt>
          <Txt variant="eyebrow" color={c.textMuted} style={styles.sectionCount}>
            {total} CHAPTERS · {done} WATCHED
          </Txt>
        </View>

        {/* Chapter rows */}
        <View style={styles.rows}>
          {chapters.map((ch, i) => {
            const watched = progress.isWatched(ch.id);
            const pct = progress.pctOf(ch.id);
            return (
              <Animated.View key={`${track}-${ch.id}`} entering={FadeInDown.delay(i * 26).duration(280)}>
                <PressableScale style={styles.row} onPress={() => openCh(ch.id)}>
                  <View style={styles.rowThumb}>
                    <Image source={{ uri: ytThumb(ch.videos[0].youtubeId) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                    {pct > 0 && !watched ? (
                      <View style={styles.rowBar}>
                        <View style={[styles.rowBarFill, { width: `${Math.round(pct * 100)}%` }]} />
                      </View>
                    ) : null}
                    <View style={styles.durBadge}>
                      <Txt style={styles.durText}>{fmtDuration(ch.videos[0].durationSec)}</Txt>
                    </View>
                  </View>
                  <View style={styles.rowBody}>
                    <Txt numberOfLines={2} style={styles.rowTitle}>
                      {ch.title}
                    </Txt>
                    <View style={styles.rowMeta}>
                      <Txt variant="caption" color={c.accent} numberOfLines={1} style={styles.rowEra}>
                        {ch.era}
                      </Txt>
                      {watched ? (
                        <Txt variant="caption" color={c.textMuted}>
                          {' · Watched'}
                        </Txt>
                      ) : pct > 0 ? (
                        <Txt variant="caption" color={c.textMuted}>
                          {' · In progress'}
                        </Txt>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.rowPlay}>
                    <Ionicons
                      name={watched ? 'checkmark' : 'play'}
                      size={16}
                      color={watched ? c.success : c.bg}
                      style={!watched ? styles.playGlyph : undefined}
                    />
                  </View>
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>

        <Txt variant="caption" color={c.textMuted} style={styles.disclaimer}>
          Videos are from third-party Sunni-mainstream creators, embedded from YouTube — a study aid, not an endorsement of
          every view expressed.
        </Txt>
      </Animated.ScrollView>

      {/* Floating top bar — a single soft gradient (no blurred rectangle / hairline = no seam line);
          the image just scrolls under it, like Bible Chat. */}
      <LinearGradient
        colors={['rgba(10,10,10,0.86)', 'rgba(10,10,10,0.46)', 'rgba(10,10,10,0)']}
        locations={[0, 0.5, 1]}
        style={[styles.topScrim, { height: BAR_H + 26 }]}
        pointerEvents="none"
      />
      {/* A magical constellation tucked into the status-bar / notch band (over the dark top). */}
      <SkyBand height={insets.top + 36} style={styles.sky} />
      <View style={[styles.bar, { height: BAR_H, paddingTop: insets.top }]}>
        <GlassDisc name="chevron-back" onPress={() => router.back()} />
        <Txt variant="cardTitle">Watch</Txt>
        <View style={styles.disc} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  scroll: { paddingHorizontal: space.gutter, gap: 18 },

  // Floating bar
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 },
  sky: { zIndex: 6 },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
  },
  disc: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  discRim: { ...StyleSheet.absoluteFillObject, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },

  // Featured hero
  featuredLabel: { marginBottom: 10, marginLeft: 2 },
  // Full-bleed edge-to-edge (no inset "border") — break out of the scroll's horizontal gutter.
  featuredWrap: { marginHorizontal: -space.gutter, marginBottom: 8 },
  featuredCard: { aspectRatio: 16 / 10, overflow: 'hidden', backgroundColor: c.surface2, justifyContent: 'flex-end' },
  featuredText: { padding: space.card, paddingBottom: 18, gap: 7 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  tagRim: { ...StyleSheet.absoluteFillObject, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)' },
  tagText: { fontFamily: font.sansBold, fontSize: 10, letterSpacing: 0.9, color: c.scriptureInk },
  kicker: { letterSpacing: 1 },
  featuredTitle: { color: c.scriptureInk, lineHeight: 31 },
  featuredMeta: { marginTop: 1 },
  featuredFab: {
    position: 'absolute',
    right: 18,
    bottom: -22,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },

  // Track chips
  tracks: { flexDirection: 'row', gap: 8 },
  track: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, backgroundColor: c.surface1 },
  trackOn: { backgroundColor: c.primary, borderColor: c.primary },
  trackText: { fontFamily: font.sansSemi, color: c.textSecondary },
  trackTextOn: { color: c.bg },

  // Section header
  sectionHead: { gap: 4 },
  sectionCount: { letterSpacing: 0.8 },

  // Rows
  rows: { gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  rowThumb: { width: 62, height: 62, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.surface2 },
  rowBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(0,0,0,0.5)' },
  rowBarFill: { height: '100%', backgroundColor: c.accent },
  durBadge: { position: 'absolute', left: 5, bottom: 5, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.72)' },
  durText: { fontFamily: font.sansBold, fontSize: 9.5, color: '#F4F1EA' },
  rowBody: { flex: 1, gap: 3 },
  rowTitle: { fontFamily: font.serif, fontSize: 16, lineHeight: 21, color: c.scriptureInk },
  rowMeta: { flexDirection: 'row', alignItems: 'center' },
  rowEra: { fontFamily: font.sansSemi, letterSpacing: 0.2, flexShrink: 1 },
  rowPlay: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  playGlyph: { marginLeft: 2 },

  disclaimer: { lineHeight: 16, marginTop: 4 },
});
