// EXPLORE (tab) — the content home (Bible Chat frames 37-44). A rotating "Most Popular" hero, a 2x2 of
// emblem-led category tiles (Stories / Watch / Journeys / Qur'an Plan), a "Continue where you left off"
// peek-carousel driven by real on-device progress (Qur'an Plan portion, active Journey day, in-progress
// Watch), and a "Recommended for you" list. A search disc opens a live content search.
// Re-skin + compose only — all content + progress logic (plans / quran-plan / watch / stories) is reused.
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AtlasTile, type AtlasCategory, SealMedallion } from '@/components/atlas-tile';
import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { useAuth } from '@/lib/auth';
import { usePlanProgress } from '@/lib/plan-progress';
import { getPlan, PLANS, suggestedPlan } from '@/lib/plans';
import { useProfile } from '@/lib/profile';
import { useQuranPlan } from '@/lib/quran-plan-progress';
import { getStories, panelImage } from '@/lib/stories';
import { c, font, grad, radius, space } from '@/lib/theme';
import { getChapter, getChapters } from '@/lib/watch';
import { useWatchProgress } from '@/lib/watch-progress';

type Go = () => void;
type MciName = keyof typeof MaterialCommunityIcons.glyphMap;
type ContinueItem = { key: string; eyebrow: string; title: string; sub?: string; pct: number; go: Go };
type RowItem = { key: string; eyebrow: string; title: string; sub?: string; image?: number; mci?: MciName; go: Go };
type HeroItem = { key: string; eyebrow: string; title: string; sub?: string; image?: number; mci: MciName; glow: string; go: Go };

export default function ExploreScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const plans = usePlanProgress();
  const qplan = useQuranPlan();
  const watch = useWatchProgress();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const CARD_W = Math.round(width * 0.72);
  const HERO_W = width - 2 * space.gutter;

  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [heroIdx, setHeroIdx] = useState(0);

  // Time-aware top section (Bible Chat frame 38): a greeting that shifts with the hour, and the hero pager
  // leads with what fits the moment — study to begin the day, a video / narrated story to wind down.
  const tod = useMemo<'morning' | 'afternoon' | 'evening' | 'night'>(() => {
    const h = new Date().getHours();
    return h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
  }, []);
  const greeting = tod === 'morning' ? 'Good morning' : tod === 'afternoon' ? 'Good afternoon' : tod === 'evening' ? 'Good evening' : 'A peaceful night';
  const leadEyebrow = tod === 'morning' ? 'JOURNEY' : tod === 'evening' ? 'WATCH' : 'STORY';

  // The four category tiles. Stories has one finished story today, so it opens straight into it; the others
  // open their library/dashboard. (A Stories browse screen arrives with more stories.)
  const tiles: { category: AtlasCategory; title: string; sublabel: string; go: Go }[] = [
    { category: 'stories', title: 'Stories', sublabel: 'Illustrated & narrated', go: () => router.push({ pathname: '/stories/[id]', params: { id: 'yusuf' } }) },
    { category: 'watch', title: 'Watch', sublabel: 'Seerah & history', go: () => router.push('/watch') },
    { category: 'journeys', title: 'Journeys', sublabel: 'Guided study plans', go: () => router.push('/plan') },
    { category: 'quran-plan', title: 'Qur’an Plan', sublabel: 'Read it through', go: () => router.push('/reading') },
  ];

  const suggestedId = suggestedPlan(profile);
  const story = getStories()[0];

  // "Most Popular" — a small curated set: the story (with its art), the suggested journey, and a featured
  // chapter. Journey/Watch slides are atmospheric onyx; the story slide shows its illustration.
  const heroes: HeroItem[] = [];
  if (story) heroes.push({ key: `h-story:${story.id}`, eyebrow: 'STORY', title: story.title, sub: 'Illustrated & narrated', image: panelImage(story.id, 1), mci: 'script-text-outline', glow: 'rgba(201,189,166,0.30)', go: () => router.push({ pathname: '/stories/[id]', params: { id: story.id } }) });
  const heroPlan = getPlan(suggestedId);
  if (heroPlan) heroes.push({ key: `h-plan:${heroPlan.id}`, eyebrow: 'JOURNEY', title: heroPlan.title, sub: heroPlan.blurb, mci: 'map-marker-path', glow: 'rgba(214,180,120,0.26)', go: () => router.push({ pathname: '/plan/[id]', params: { id: heroPlan.id } }) });
  const heroWatch = getChapter('seerah-09') ?? getChapters('seerah')[3];
  if (heroWatch) heroes.push({ key: `h-watch:${heroWatch.id}`, eyebrow: 'WATCH', title: heroWatch.title, sub: heroWatch.era, mci: 'play', glow: 'rgba(228,220,198,0.24)', go: () => router.push({ pathname: '/watch/[id]', params: { id: heroWatch.id } }) });
  // Lead the pager with the time-appropriate hero (stable order for the rest).
  heroes.sort((a, b) => (b.eyebrow === leadEyebrow ? 1 : 0) - (a.eyebrow === leadEyebrow ? 1 : 0));
  const heroCount = heroes.length;

  // Auto-advance the hero gently — the slides CROSS-FADE (see FadeHero), they do not slide horizontally.
  useEffect(() => {
    if (heroCount <= 1) return;
    const t = setTimeout(() => setHeroIdx((i) => (i + 1) % heroCount), 6000);
    return () => clearTimeout(t);
  }, [heroIdx, heroCount]);

  // "Continue where you left off" — real, resumable progress only.
  const cont: ContinueItem[] = [];
  if (qplan.plan && !qplan.finished) {
    cont.push({ key: 'qplan', eyebrow: 'QUR’AN PLAN', title: `Portion ${qplan.portionNumber} of ${qplan.totalPortionsCount}`, sub: qplan.doneToday ? 'Done for today' : 'Today’s portion', pct: qplan.percent, go: () => router.push('/reading') });
  }
  if (plans.active) {
    const p = getPlan(plans.active);
    const s = plans.summary(plans.active);
    if (p && s.started && !s.finished) {
      cont.push({ key: `plan:${p.id}`, eyebrow: 'JOURNEY', title: p.title, sub: `Day ${s.currentOrder} of ${s.total}`, pct: s.total ? s.done / s.total : 0, go: () => router.push({ pathname: '/plan/[id]', params: { id: p.id } }) });
    }
  }
  const cw = watch.continueChapter();
  if (cw) {
    const ch = getChapter(cw.id);
    if (ch) cont.push({ key: `watch:${ch.id}`, eyebrow: 'WATCH', title: ch.title, sub: ch.era, pct: cw.pct, go: () => router.push({ pathname: '/watch/[id]', params: { id: ch.id } }) });
  }

  // "Recommended for you" — the suggested journey first, then other unstarted journeys, then a story.
  const rec: RowItem[] = [];
  const orderedPlans = [getPlan(suggestedId), ...PLANS.filter((p) => p.id !== suggestedId)];
  for (const p of orderedPlans) {
    if (!p) continue;
    const s = plans.summary(p.id);
    if (s.finished || plans.active === p.id) continue;
    rec.push({ key: `plan:${p.id}`, eyebrow: 'JOURNEY', title: p.title, sub: p.blurb, mci: 'map-marker-path', go: () => router.push({ pathname: '/plan/[id]', params: { id: p.id } }) });
    if (rec.length >= 3) break;
  }
  if (story) rec.push({ key: `story:${story.id}`, eyebrow: 'STORY', title: story.title, sub: story.blurb, image: panelImage(story.id, 1), go: () => router.push({ pathname: '/stories/[id]', params: { id: story.id } }) });

  // Live search across all content.
  const q = query.trim().toLowerCase();
  const results: RowItem[] = [];
  if (q.length > 0) {
    for (const p of PLANS) {
      if (p.title.toLowerCase().includes(q) || p.blurb.toLowerCase().includes(q)) {
        results.push({ key: `s-plan:${p.id}`, eyebrow: 'JOURNEY', title: p.title, sub: p.blurb, mci: 'map-marker-path', go: () => openFromSearch(() => router.push({ pathname: '/plan/[id]', params: { id: p.id } })) });
      }
    }
    for (const ch of [...getChapters('seerah'), ...getChapters('history')]) {
      if (ch.title.toLowerCase().includes(q) || ch.era.toLowerCase().includes(q) || ch.blurb.toLowerCase().includes(q)) {
        results.push({ key: `s-watch:${ch.id}`, eyebrow: 'WATCH', title: ch.title, sub: ch.era, mci: 'play', go: () => openFromSearch(() => router.push({ pathname: '/watch/[id]', params: { id: ch.id } })) });
      }
    }
    for (const st of getStories()) {
      if (st.title.toLowerCase().includes(q) || st.blurb.toLowerCase().includes(q)) {
        results.push({ key: `s-story:${st.id}`, eyebrow: 'STORY', title: st.title, sub: st.blurb, image: panelImage(st.id, 1), go: () => openFromSearch(() => router.push({ pathname: '/stories/[id]', params: { id: st.id } })) });
      }
    }
  }

  function openFromSearch(nav: Go) {
    setSearching(false);
    setQuery('');
    nav();
  }

  return (
    <Screen stars>
      <View style={styles.topBar}>
        <PressableScale onPress={() => router.push('/profile')}>
          <LinearGradient colors={c.goldGrad} start={grad.diagStart} end={grad.diagEnd} style={styles.avatar}>
            <AvatarInitial />
          </LinearGradient>
        </PressableScale>
        <Txt variant="h2" style={styles.topTitle}>
          Explore
        </Txt>
        <View style={styles.fill} />
        <IconButton name="search" onPress={() => setSearching(true)} diameter={38} size={19} color={c.textSecondary} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {heroes.length > 0 ? (
          <View style={styles.heroSection}>
            <View style={styles.heroHead}>
              <Txt variant="h2">{greeting}</Txt>
              <Txt variant="caption" color={c.textMuted}>
                Most popular right now
              </Txt>
            </View>
            <View style={[styles.heroStack, { height: HERO_W / 1.6 }]}>
              {heroes.map((h, i) => (
                <FadeHero key={h.key} item={h} active={i === heroIdx} width={HERO_W} />
              ))}
            </View>
            {heroes.length > 1 ? (
              <View style={styles.dots}>
                {heroes.map((h, i) => (
                  <PressableScale key={h.key} hitSlop={10} onPress={() => setHeroIdx(i)}>
                    <View style={[styles.dot, i === heroIdx && styles.dotActive]} />
                  </PressableScale>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.grid}>
          {tiles.map((t) => (
            <AtlasTile key={t.category} category={t.category} title={t.title} sublabel={t.sublabel} onPress={t.go} />
          ))}
        </View>

        {cont.length > 0 ? (
          <View style={styles.section}>
            <Txt variant="h2">Continue</Txt>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={CARD_W + 12} decelerationRate="fast" contentContainerStyle={styles.contRow}>
              {cont.map((it) => (
                <PressableScale key={it.key} style={[styles.contCard, { width: CARD_W }]} onPress={it.go}>
                  <Txt variant="eyebrow">{it.eyebrow}</Txt>
                  <Txt variant="cardTitle" numberOfLines={2} style={styles.contTitle}>
                    {it.title}
                  </Txt>
                  {it.sub ? (
                    <Txt variant="caption" numberOfLines={1}>
                      {it.sub}
                    </Txt>
                  ) : null}
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.max(4, Math.round(it.pct * 100))}%` }]} />
                  </View>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {rec.length > 0 ? (
          <View style={styles.section}>
            <Txt variant="h2">Recommended for you</Txt>
            <View style={styles.rows}>
              {rec.map((r) => (
                <ContentRow key={r.key} item={r} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {searching ? (
        <Animated.View entering={FadeIn.duration(160)} style={[StyleSheet.absoluteFill, styles.searchOverlay]}>
          <View style={[styles.searchBar, { paddingTop: insets.top + space.sm }]}>
            <View style={styles.searchField}>
              <Ionicons name="search" size={18} color={c.textMuted} />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder="Search content..."
                placeholderTextColor={c.textMuted}
                style={styles.searchInput}
                returnKeyType="search"
              />
              {query ? (
                <Pressable hitSlop={8} onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={18} color={c.textMuted} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => {
                setSearching(false);
                setQuery('');
              }}>
              <Txt variant="body" color={c.accent}>
                Cancel
              </Txt>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.searchResults}>
            {results.map((r) => (
              <ContentRow key={r.key} item={r} />
            ))}
            {q.length > 0 && results.length === 0 ? (
              <Txt variant="body" color={c.textMuted} style={styles.noResults}>
                Nothing found for &ldquo;{query.trim()}&rdquo;
              </Txt>
            ) : null}
          </ScrollView>
        </Animated.View>
      ) : null}
    </Screen>
  );
}

// A hero slide that CROSS-FADES in/out (no horizontal sliding) as the "Most popular" pager advances.
function FadeHero({ item, active, width }: { item: HeroItem; active: boolean; width: number }) {
  const op = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    op.value = withTiming(active ? 1 : 0, { duration: 450, easing: Easing.inOut(Easing.quad) });
  }, [active, op]);
  const style = useAnimatedStyle(() => ({ opacity: op.value }));
  return (
    <Animated.View style={[styles.heroLayer, style]} pointerEvents={active ? 'auto' : 'none'}>
      <HeroCard item={item} width={width} />
    </Animated.View>
  );
}

function HeroCard({ item, width }: { item: HeroItem; width: number }) {
  return (
    <PressableScale style={[styles.hero, { width }]} onPress={item.go}>
      {item.image ? (
        <Image source={item.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <>
          <LinearGradient colors={['#141210', '#1E1813']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={[item.glow, 'transparent']} start={{ x: 0.85, y: 0.1 }} end={{ x: 0.2, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.heroEmblem} pointerEvents="none">
            <SealMedallion name={item.mci} frame={84} ring={62} glyph={38} glowStrength={0.24} />
          </View>
        </>
      )}
      <LinearGradient colors={c.cardScrim} locations={[0.32, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.heroPill}>
        <Txt style={styles.heroPillTxt}>✦ {item.eyebrow}</Txt>
      </View>
      <View style={styles.heroText}>
        <Txt variant="h1" numberOfLines={2} style={styles.heroTitle}>
          {item.title}
        </Txt>
        {item.sub ? (
          <Txt variant="caption" color={c.textSecondary} numberOfLines={1}>
            {item.sub}
          </Txt>
        ) : null}
      </View>
    </PressableScale>
  );
}

function ContentRow({ item }: { item: RowItem }) {
  return (
    <PressableScale style={styles.recRow} onPress={item.go}>
      <View style={styles.recThumb}>
        {item.image ? <Image source={item.image} style={styles.recImg} /> : <SealMedallion name={item.mci ?? 'compass-outline'} frame={52} ring={34} glyph={20} glowStrength={0.2} />}
      </View>
      <View style={styles.recBody}>
        <Txt variant="eyebrow" color={c.accent}>
          {item.eyebrow}
        </Txt>
        <Txt variant="cardTitle" numberOfLines={1}>
          {item.title}
        </Txt>
        {item.sub ? (
          <Txt variant="caption" numberOfLines={2} style={styles.recSub}>
            {item.sub}
          </Txt>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </PressableScale>
  );
}

function AvatarInitial() {
  const { user } = useAuth();
  const initial = user && !user.isAnonymous && user.name ? user.name.charAt(0).toUpperCase() : null;
  return initial ? <Txt style={styles.avatarInitial}>{initial}</Txt> : <Ionicons name="person" size={18} color={c.bg} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.gutter, paddingTop: space.xs, paddingBottom: space.sm },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: font.sansBold, fontSize: 16, color: c.bg },
  topTitle: { marginLeft: 2 },

  scroll: { paddingHorizontal: space.gutter, paddingTop: space.xs, paddingBottom: space.section, gap: space.section },

  heroSection: { gap: 10 },
  heroHead: { gap: 2 },
  heroStack: { width: '100%' },
  heroLayer: { position: 'absolute', top: 0, left: 0 },
  hero: {
    aspectRatio: 1.6,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    justifyContent: 'flex-end',
  },
  heroEmblem: { position: 'absolute', right: 16, top: 14 },
  heroPill: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassLip,
  },
  heroPillTxt: { fontFamily: font.sansBold, fontSize: 10.5, letterSpacing: 1.2, color: c.accent },
  heroText: { position: 'absolute', left: 16, right: 16, bottom: 14, gap: 3 },
  heroTitle: { color: c.textPrimary },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.surface3 },
  dotActive: { width: 16, backgroundColor: c.accent },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },

  section: { gap: 12 },
  contRow: { gap: 12, paddingRight: space.gutter, paddingBottom: 2 },
  contCard: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    backgroundColor: c.surface1,
    padding: space.gutter,
    gap: 6,
    minHeight: 116,
    justifyContent: 'center',
  },
  contTitle: { lineHeight: 23 },
  progressTrack: { marginTop: 8, height: 4, borderRadius: 2, backgroundColor: c.surface3, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: c.accent },

  rows: { gap: 10 },
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    backgroundColor: c.surface1,
  },
  recThumb: { width: 54, height: 54, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  recImg: { width: 54, height: 54 },
  recBody: { flex: 1, gap: 2 },
  recSub: { lineHeight: 16 },

  searchOverlay: { backgroundColor: c.bg },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.gutter, paddingTop: space.sm, paddingBottom: space.sm },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#000000',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, fontFamily: font.sans, fontSize: 16, color: c.textPrimary, padding: 0 },
  searchResults: { paddingHorizontal: space.gutter, paddingTop: space.xs, paddingBottom: space.section, gap: 10 },
  noResults: { textAlign: 'center', marginTop: space.section },
});
