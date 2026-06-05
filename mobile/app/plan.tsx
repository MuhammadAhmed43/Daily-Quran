// Journeys library (Bible Chat frame 52, onyx). A featured journey hero (cosmic bg), theme filter-chips,
// and the full set of guided study-plans as seal-medallion cards with live progress. Re-skin + compose
// only — the progress logic (usePlanProgress) and the plan data (PLANS) are unchanged. The Qur'an reading
// plan now lives behind its own Explore tile (/reading), so this screen is journeys-only.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { SealMedallion } from '@/components/atlas-tile';
import { CosmicCardBg } from '@/components/cosmic-field';
import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { haptic } from '@/lib/haptics';
import { getPlan, PLANS, suggestedPlan } from '@/lib/plans';
import { usePlanProgress } from '@/lib/plan-progress';
import { planIcon } from '@/lib/plan-visuals';
import { useProfile } from '@/lib/profile';
import { c, font, radius, space } from '@/lib/theme';

const THEMES: { key: string; label: string; ids: string[] | null }[] = [
  { key: 'all', label: 'All', ids: null },
  { key: 'start', label: 'Start here', ids: ['new-to-quran', 'juz-amma'] },
  { key: 'heart', label: 'For the heart', ids: ['gratitude', 'mercy-forgiveness', 'patience-trust', 'contentment-provision', 'through-hardship'] },
  { key: 'worship', label: 'Worship', ids: ['understanding-salah', 'calling-on-allah', 'remembrance', 'ramadan-fasting'] },
  { key: 'knowing', label: 'Knowing Allah', ids: ['names-of-allah', 'reflection-knowledge', 'the-hereafter', 'stories-of-the-prophets'] },
  { key: 'living', label: 'Living it', ids: ['good-character', 'parents-family'] },
];

export default function PlansScreen() {
  const router = useRouter();
  const progress = usePlanProgress();
  const { profile } = useProfile();
  const [theme, setTheme] = useState('all');

  const featured = getPlan(suggestedPlan(profile)) ?? PLANS[0];
  const active = THEMES.find((t) => t.key === theme) ?? THEMES[0];
  const list = active.ids ? PLANS.filter((p) => active.ids!.includes(p.id)) : PLANS;

  const openPlan = (id: string) => {
    haptic.light();
    router.push({ pathname: '/plan/[id]', params: { id } });
  };

  return (
    <Screen edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <IconButton name="chevron-back" onPress={() => router.back()} diameter={38} size={22} color={c.textPrimary} />
        <Txt variant="cardTitle">Journeys</Txt>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Featured journey */}
        <PressableScale style={styles.featured} onPress={() => openPlan(featured.id)}>
          <CosmicCardBg hueIndex={1} id={featured.id} />
          <View style={styles.featuredContent}>
            <SealMedallion name={planIcon(featured.id)} frame={54} ring={40} glyph={25} glowStrength={0.26} />
            <View style={styles.featuredText}>
              <Txt style={styles.featuredEyebrow}>✦ FEATURED JOURNEY</Txt>
              <Txt variant="h2" numberOfLines={2} style={styles.featuredTitle}>
                {featured.title}
              </Txt>
              <Txt variant="caption" color={c.textSecondary} numberOfLines={1}>
                {featured.steps.length} steps · {featured.blurb}
              </Txt>
            </View>
            <View style={styles.featuredArrow}>
              <Ionicons name="arrow-forward" size={17} color={c.bg} />
            </View>
          </View>
        </PressableScale>

        {/* Theme filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {THEMES.map((t) => {
            const on = t.key === theme;
            return (
              <PressableScale
                key={t.key}
                onPress={() => {
                  haptic.light();
                  setTheme(t.key);
                }}
                style={[styles.chip, on && styles.chipOn]}>
                <Txt variant="caption" style={[styles.chipText, on && styles.chipTextOn]}>
                  {t.label}
                </Txt>
              </PressableScale>
            );
          })}
        </ScrollView>

        {/* Journey cards */}
        <View style={styles.cards}>
          {list.map((p, i) => {
            const s = progress.summary(p.id);
            const cur = Math.min(s.currentOrder, s.total);
            const pill = s.finished ? 'Completed' : s.started ? `Step ${cur} of ${s.total}` : `${s.total} steps`;
            return (
              <Animated.View key={`${theme}-${p.id}`} entering={FadeInDown.delay(i * 35).duration(300)}>
                <PressableScale style={styles.card} onPress={() => openPlan(p.id)}>
                <SealMedallion name={planIcon(p.id)} frame={50} ring={36} glyph={21} glowStrength={0.18} />
                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Txt variant="cardTitle" numberOfLines={1} style={styles.cardTitle}>
                      {p.title}
                    </Txt>
                    {s.isActive && !s.finished ? (
                      <View style={styles.focusTag}>
                        <Txt style={styles.focusTagText}>FOCUS</Txt>
                      </View>
                    ) : null}
                  </View>
                  <Txt variant="caption" color={c.textSecondary} numberOfLines={2} style={styles.cardBlurb}>
                    {p.blurb}
                  </Txt>
                  <Txt variant="caption" color={s.finished ? c.success : c.accent} style={styles.cardPill}>
                    {pill}
                  </Txt>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>

        <Txt variant="caption" color={c.textMuted} style={styles.disclaimer}>
          A study aid for reflection — not a fatwa or a substitute for a qualified scholar.
        </Txt>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: space.sm },
  spacer: { width: 38 },
  scroll: { paddingHorizontal: space.gutter, paddingBottom: space.section, gap: 16 },

  featured: { height: 150, borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, justifyContent: 'flex-end' },
  featuredContent: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: space.card },
  featuredText: { flex: 1, gap: 3 },
  featuredEyebrow: { fontFamily: font.sansBold, fontSize: 10, letterSpacing: 1.3, color: c.accent },
  featuredTitle: { lineHeight: 26 },
  featuredArrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },

  chips: { gap: 8, paddingRight: space.gutter },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, backgroundColor: c.surface1 },
  chipOn: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontFamily: font.sansSemi, color: c.textSecondary },
  chipTextOn: { color: c.bg },

  cards: { gap: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: c.surface1, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
  cardBody: { flex: 1, gap: 3 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flexShrink: 1 },
  focusTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, backgroundColor: c.accent },
  focusTagText: { fontFamily: font.sansBold, fontSize: 8.5, letterSpacing: 0.5, color: c.bg },
  cardBlurb: { lineHeight: 17 },
  cardPill: { fontFamily: font.sansSemi, marginTop: 1 },

  disclaimer: { textAlign: 'center', lineHeight: 16, marginTop: 4 },
});
