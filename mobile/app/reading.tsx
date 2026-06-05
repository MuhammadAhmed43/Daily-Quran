// Reading-plan dashboard (onyx). The personalized read-through-the-Qur'an plan: a cosmic progress hero
// (ring + corpus label), stat pills, today's-portion card with an ivory CTA (3 states), and change-pace /
// restart. Re-skin + compose only — the pacing/progress engine (useQuranPlan, createPlan, repace) and all
// position-based logic are unchanged.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { CosmicCardBg } from '@/components/cosmic-field';
import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { ProgressRing } from '@/components/watch/progress-ring';
import { haptic } from '@/lib/haptics';
import { corpusAyahs, corpusLabel, estimateMinutes, surahName } from '@/lib/quran-plan';
import { createPlan, useQuranPlan } from '@/lib/quran-plan-progress';
import { c, font, radius, space } from '@/lib/theme';

const fmtDate = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

export default function QuranPlanDashboard() {
  const router = useRouter();
  const v = useQuranPlan();
  const [repacing, setRepacing] = useState(false);

  const header = (
    <View style={styles.header}>
      <IconButton name="chevron-back" onPress={() => router.back()} diameter={38} size={22} color={c.textPrimary} />
      <Txt variant="cardTitle">Reading plan</Txt>
      <View style={styles.spacer} />
    </View>
  );

  if (!v.plan) {
    return (
      <Screen stars>
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View style={styles.emptyWrap}>
          <View style={styles.emptyHero}>
            <CosmicCardBg hueIndex={3} id="reading-empty" />
            <Ionicons name="book-outline" size={30} color={c.accent} />
          </View>
          <Txt variant="h1" style={styles.center}>
            Read through the Qur&apos;an
          </Txt>
          <Txt variant="body" color={c.textSecondary} style={styles.emptyText}>
            A personal plan, paced to a goal that fits you — with understanding on tap, at your own speed.
          </Txt>
          <PressableScale
            style={styles.cta}
            onPress={() => {
              haptic.light();
              router.push('/reading/new');
            }}>
            <Txt style={styles.ctaText}>Build my plan</Txt>
            <Ionicons name="arrow-forward" size={18} color={c.bg} />
          </PressableScale>
        </View>
      </Screen>
    );
  }

  const plan = v.plan;
  const pct = Math.round(v.percent * 100);
  const lastRead = plan.position > 0 ? corpusAyahs(plan.corpus)[plan.position - 1] : null;

  return (
    <Screen stars>
      <Stack.Screen options={{ headerShown: false }} />
      {header}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Cosmic progress hero */}
        <Animated.View entering={FadeInDown.duration(320)} style={styles.hero}>
          <CosmicCardBg hueIndex={2} id={`reading:${plan.corpus.fromSurah}-${plan.corpus.toSurah}`} />
          <View style={styles.heroInner}>
            <ProgressRing size={94} stroke={7} pct={v.percent} color={c.accent}>
              <Txt style={styles.heroPct}>{pct}%</Txt>
            </ProgressRing>
            <View style={styles.heroText}>
              <Txt variant="eyebrow" color={c.accent}>
                READING PLAN
              </Txt>
              <Txt variant="h2" numberOfLines={2} style={styles.heroTitle}>
                {corpusLabel(plan.corpus)}
              </Txt>
              <Txt variant="caption" color={c.textSecondary} numberOfLines={2}>
                {v.finished
                  ? 'Completed — alhamdulillah'
                  : lastRead
                    ? `Up to ${surahName(lastRead.surah)} ${lastRead.surah}:${lastRead.ayah}`
                    : 'Ready to begin'}
              </Txt>
            </View>
          </View>
        </Animated.View>

        {/* Stat pills */}
        <Animated.View entering={FadeInDown.delay(60).duration(320)} style={styles.stats}>
          <View style={styles.stat}>
            <Txt style={styles.statVal}>
              {v.finished ? v.totalPortionsCount : v.portionNumber}
              <Txt style={styles.statDim}> / {v.totalPortionsCount}</Txt>
            </Txt>
            <Txt variant="eyebrow" color={c.textMuted}>
              PORTIONS
            </Txt>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Txt style={styles.statVal}>{v.projectedFinish ? fmtDate(v.projectedFinish) : '—'}</Txt>
            <Txt variant="eyebrow" color={c.textMuted}>
              {v.finished ? 'FINISHED' : 'ON THIS PACE'}
            </Txt>
          </View>
        </Animated.View>

        {/* Today card */}
        <Animated.View entering={FadeInDown.delay(120).duration(320)}>
          {v.finished ? (
            <View style={styles.todoCard}>
              <Txt variant="h2" style={styles.center}>
                You read it through
              </Txt>
              <Txt variant="caption" color={c.textSecondary} style={styles.center}>
                May it stay with you.
              </Txt>
              <PressableScale
                style={styles.cta}
                onPress={() => {
                  haptic.success();
                  createPlan(plan.corpus, plan.durationDays);
                }}>
                <Ionicons name="refresh" size={17} color={c.bg} />
                <Txt style={styles.ctaText}>Read it again</Txt>
              </PressableScale>
              <PressableScale
                style={styles.ghost}
                onPress={() => {
                  haptic.light();
                  router.push('/reading/new');
                }}>
                <Txt style={styles.ghostText}>Start a different plan</Txt>
              </PressableScale>
            </View>
          ) : v.doneToday ? (
            <View style={styles.todoCard}>
              <Txt variant="eyebrow" color={c.success}>
                ✓ TODAY&apos;S READING DONE
              </Txt>
              <Txt variant="caption" color={c.textSecondary}>
                Rest till tomorrow, or keep going — your call.
              </Txt>
              <View style={styles.upNext}>
                <Txt variant="eyebrow" color={c.textMuted}>
                  UP NEXT
                </Txt>
                <Txt variant="body" style={styles.upNextRange}>
                  {surahName(v.today!.from.surah)} {v.today!.from.surah}:{v.today!.from.ayah} → {v.today!.to.surah}:{v.today!.to.ayah} ·{' '}
                  {v.today!.count} ayahs
                </Txt>
              </View>
              <PressableScale
                style={styles.cta}
                onPress={() => {
                  haptic.light();
                  router.push('/reading/portion');
                }}>
                <Ionicons name="book" size={16} color={c.bg} />
                <Txt style={styles.ctaText}>Keep reading</Txt>
              </PressableScale>
            </View>
          ) : (
            <View style={styles.todoCard}>
              <Txt variant="eyebrow" color={c.accent}>
                TODAY
              </Txt>
              <Txt variant="h2" style={styles.todoRange}>
                {surahName(v.today!.from.surah)} {v.today!.from.surah}:{v.today!.from.ayah} → {v.today!.to.surah}:{v.today!.to.ayah}
              </Txt>
              <Txt variant="caption" color={c.textSecondary}>
                {v.today!.count} ayahs · about {estimateMinutes(v.today!.count)} min
              </Txt>
              <PressableScale
                style={styles.cta}
                onPress={() => {
                  haptic.light();
                  router.push('/reading/portion');
                }}>
                <Ionicons name="book" size={16} color={c.bg} />
                <Txt style={styles.ctaText}>Read now</Txt>
              </PressableScale>
            </View>
          )}
        </Animated.View>

        {/* Manage */}
        {!v.finished ? (
          <Animated.View entering={FadeInDown.delay(180).duration(320)}>
            <PressableScale
              style={styles.manageRow}
              onPress={() => {
                haptic.light();
                setRepacing((r) => !r);
              }}>
              <Ionicons name="speedometer-outline" size={18} color={c.accent} />
              <Txt variant="body" style={styles.manageText}>
                Change pace
              </Txt>
              <Ionicons name={repacing ? 'chevron-up' : 'chevron-down'} size={16} color={c.textMuted} />
            </PressableScale>
            {repacing ? (
              <View style={styles.repaceRow}>
                {[
                  { label: '1 month', days: 30 },
                  { label: '2 months', days: 60 },
                  { label: '3 months', days: 90 },
                ].map((opt, i) => (
                  <Animated.View key={opt.days} entering={FadeInDown.delay(i * 45).duration(240)}>
                    <PressableScale
                      style={styles.repaceBtn}
                      onPress={() => {
                        haptic.light();
                        v.repace(plan.portionsDone + opt.days);
                        setRepacing(false);
                      }}>
                      <Txt style={styles.repaceBtnText}>Finish in {opt.label}</Txt>
                    </PressableScale>
                  </Animated.View>
                ))}
              </View>
            ) : null}
          </Animated.View>
        ) : null}

        <PressableScale
          style={styles.manageRow}
          onPress={() => {
            haptic.light();
            router.push('/reading/new');
          }}>
          <Ionicons name="create-outline" size={18} color={c.accent} />
          <Txt variant="body" style={styles.manageText}>
            Start a different plan
          </Txt>
          <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
        </PressableScale>

        <Txt variant="caption" color={c.textMuted} style={styles.disclaimer}>
          Position-based — miss a day and the plan waits; the projected date just shifts. No catching up, no guilt.
        </Txt>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: space.sm },
  spacer: { width: 38 },
  scroll: { paddingHorizontal: space.gutter, paddingBottom: space.section, gap: 14 },
  center: { textAlign: 'center' },

  // Empty state
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.section, gap: 16, paddingBottom: 56 },
  emptyHero: {
    width: 116,
    height: 116,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  emptyText: { textAlign: 'center', lineHeight: 22 },

  // Cosmic progress hero
  hero: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, padding: space.card },
  heroInner: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroPct: { fontFamily: font.sansBold, fontSize: 20, color: c.scriptureInk },
  heroText: { flex: 1, gap: 3 },
  heroTitle: { lineHeight: 26 },

  // Stat pills
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    paddingVertical: 14,
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: c.hairline },
  statVal: { fontFamily: font.serifMed, fontSize: 17, color: c.scriptureInk },
  statDim: { fontFamily: font.serifMed, fontSize: 15, color: c.textMuted },

  // Today card
  todoCard: {
    padding: space.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,189,166,0.28)',
    backgroundColor: 'rgba(201,189,166,0.07)',
    gap: 8,
  },
  todoRange: { lineHeight: 27 },
  upNext: { marginTop: 2, padding: 12, borderRadius: radius.sm, backgroundColor: c.surface2 },
  upNextRange: { marginTop: 3, fontFamily: font.sansMed },

  // CTA (ivory)
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.primary, paddingVertical: 14, borderRadius: radius.full, marginTop: 4 },
  ctaText: { fontFamily: font.sansBold, fontSize: 15, color: c.bg },
  ghost: { alignItems: 'center', paddingVertical: 8 },
  ghostText: { fontFamily: font.sansSemi, fontSize: 14, color: c.accent },

  // Manage
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    backgroundColor: c.surface1,
  },
  manageText: { flex: 1, fontFamily: font.sansSemi },
  repaceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 10 },
  repaceBtn: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.full, backgroundColor: 'rgba(201,189,166,0.14)' },
  repaceBtnText: { fontFamily: font.sansSemi, fontSize: 13, color: c.accent },

  disclaimer: { textAlign: 'center', lineHeight: 16, marginTop: 4 },
});
