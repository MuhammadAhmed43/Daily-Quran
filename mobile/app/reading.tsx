import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ProgressRing } from '@/components/watch/progress-ring';
import { haptic } from '@/lib/haptics';
import { corpusAyahs, corpusLabel, estimateMinutes, surahName } from '@/lib/quran-plan';
import { createPlan, useQuranPlan } from '@/lib/quran-plan-progress';

const ACCENT = '#0a7ea4';
const fmtDate = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

export default function QuranPlanDashboard() {
  const router = useRouter();
  const v = useQuranPlan();
  const [repacing, setRepacing] = useState(false);

  if (!v.plan) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <Stack.Screen options={{ title: 'Qur’an Plan', headerBackTitle: 'Back' }} />
        <ThemedText style={styles.startEmoji}>📖</ThemedText>
        <ThemedText style={styles.startTitle}>Read through the Qur’an</ThemedText>
        <ThemedText style={styles.startText}>
          A personal plan, paced to a goal that fits you — with understanding on tap, at your own
          speed.
        </ThemedText>
        <Pressable
          style={styles.primary}
          onPress={() => {
            haptic.light();
            router.push('/reading/new');
          }}>
          <ThemedText style={styles.primaryText}>Build my plan</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const plan = v.plan;
  const pct = Math.round(v.percent * 100);
  const lastRead = plan.position > 0 ? corpusAyahs(plan.corpus)[plan.position - 1] : null;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: corpusLabel(plan.corpus), headerBackTitle: 'Back' }} />
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <ProgressRing size={92} stroke={7} pct={v.percent} color={ACCENT}>
              <ThemedText style={styles.heroPct}>{pct}%</ThemedText>
            </ProgressRing>
            <ThemedText style={styles.heroLabel}>
              {v.finished
                ? 'Completed — alhamdulillah'
                : lastRead
                  ? `Read through ${surahName(lastRead.surah)} ${lastRead.surah}:${lastRead.ayah}`
                  : 'Ready to begin'}
            </ThemedText>
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <ThemedText style={styles.statVal}>
                {v.finished ? v.totalPortionsCount : v.portionNumber}
                <ThemedText style={styles.statValDim}> / {v.totalPortionsCount}</ThemedText>
              </ThemedText>
              <ThemedText style={styles.statKey}>portions</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <ThemedText style={styles.statVal}>
                {v.projectedFinish ? fmtDate(v.projectedFinish) : '—'}
              </ThemedText>
              <ThemedText style={styles.statKey}>{v.finished ? 'finished' : 'on this pace'}</ThemedText>
            </View>
          </View>

          {/* primary action */}
          {v.finished ? (
            <View style={styles.todoCard}>
              <ThemedText style={styles.doneTitle}>🌟 You read it through</ThemedText>
              <Pressable
                style={styles.primaryRow}
                onPress={() => {
                  haptic.success();
                  createPlan(plan.corpus, plan.durationDays);
                }}>
                <Ionicons name="refresh" size={18} color="#fff" />
                <ThemedText style={styles.primaryRowText}>Read it again</ThemedText>
              </Pressable>
              <Pressable
                style={styles.ghost}
                onPress={() => {
                  haptic.light();
                  router.push('/reading/new');
                }}>
                <ThemedText style={styles.ghostText}>Start a different plan</ThemedText>
              </Pressable>
            </View>
          ) : v.doneToday ? (
            <View style={styles.todoCard}>
              <ThemedText style={styles.todoKicker}>✓ TODAY’S READING DONE</ThemedText>
              <ThemedText style={styles.doneHint}>Rest till tomorrow, or keep going — your call.</ThemedText>
              <View style={styles.upNext}>
                <ThemedText style={styles.upNextLabel}>UP NEXT</ThemedText>
                <ThemedText style={styles.upNextRange}>
                  {surahName(v.today!.from.surah)} {v.today!.from.surah}:{v.today!.from.ayah} →{' '}
                  {v.today!.to.surah}:{v.today!.to.ayah} · {v.today!.count} ayahs
                </ThemedText>
              </View>
              <Pressable
                style={styles.primaryRow}
                onPress={() => {
                  haptic.light();
                  router.push('/reading/portion');
                }}>
                <Ionicons name="book" size={17} color="#fff" />
                <ThemedText style={styles.primaryRowText}>Keep reading</ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.todoCard}>
              <ThemedText style={styles.todoKicker}>TODAY</ThemedText>
              <ThemedText style={styles.todoRange}>
                {surahName(v.today!.from.surah)} {v.today!.from.surah}:{v.today!.from.ayah} →{' '}
                {v.today!.to.surah}:{v.today!.to.ayah}
              </ThemedText>
              <ThemedText style={styles.todoMeta}>
                {v.today!.count} ayahs · about {estimateMinutes(v.today!.count)} min
              </ThemedText>
              <Pressable
                style={styles.primaryRow}
                onPress={() => {
                  haptic.light();
                  router.push('/reading/portion');
                }}>
                <Ionicons name="book" size={17} color="#fff" />
                <ThemedText style={styles.primaryRowText}>Read now</ThemedText>
              </Pressable>
            </View>
          )}

          {/* re-pace + manage */}
          {!v.finished ? (
            <View style={styles.manage}>
              <Pressable
                style={styles.manageRow}
                onPress={() => {
                  haptic.light();
                  setRepacing((r) => !r);
                }}>
                <Ionicons name="speedometer-outline" size={18} color={ACCENT} />
                <ThemedText style={styles.manageText}>Change pace</ThemedText>
                <Ionicons name={repacing ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(127,127,127,0.7)" />
              </Pressable>
              {repacing ? (
                <View style={styles.repaceRow}>
                  {[
                    { label: '1 month', days: 30 },
                    { label: '2 months', days: 60 },
                    { label: '3 months', days: 90 },
                  ].map((opt) => (
                    <Pressable
                      key={opt.days}
                      style={styles.repaceBtn}
                      onPress={() => {
                        haptic.light();
                        v.repace(plan.portionsDone + opt.days);
                        setRepacing(false);
                      }}>
                      <ThemedText style={styles.repaceBtnText}>Finish in {opt.label}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          <Pressable
            style={styles.manageRow}
            onPress={() => {
              haptic.light();
              router.push('/reading/new');
            }}>
            <Ionicons name="create-outline" size={18} color={ACCENT} />
            <ThemedText style={styles.manageText}>Start a different plan</ThemedText>
            <Ionicons name="chevron-forward" size={16} color="rgba(127,127,127,0.7)" />
          </Pressable>

          <ThemedText style={styles.disclaimer}>
            Position-based — miss a day and the plan waits; the projected date just shifts. No catching
            up, no guilt.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  scroll: { padding: 16, paddingBottom: 40, gap: 16 },
  startEmoji: { fontSize: 44 },
  startTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  startText: { fontSize: 15, lineHeight: 23, opacity: 0.8, textAlign: 'center' },
  hero: { alignItems: 'center', gap: 10, paddingTop: 6 },
  heroPct: { fontSize: 20, fontWeight: '800' },
  heroLabel: { fontSize: 14.5, fontWeight: '600', opacity: 0.8, textAlign: 'center' },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(127,127,127,0.07)',
    borderRadius: 16,
    paddingVertical: 14,
  },
  stat: { flex: 1, alignItems: 'center', gap: 3 },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(127,127,127,0.25)' },
  statVal: { fontSize: 17, fontWeight: '800' },
  statValDim: { fontSize: 15, fontWeight: '700', opacity: 0.45 },
  statKey: { fontSize: 12, opacity: 0.55, textTransform: 'uppercase', letterSpacing: 0.4 },
  todoCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT + '38',
    backgroundColor: ACCENT + '0e',
    gap: 8,
  },
  todoKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: ACCENT },
  todoRange: { fontSize: 18, fontWeight: '800' },
  todoMeta: { fontSize: 13, opacity: 0.6 },
  doneHint: { fontSize: 13.5, lineHeight: 19, opacity: 0.75 },
  upNext: { marginTop: 4, padding: 10, borderRadius: 10, backgroundColor: 'rgba(127,127,127,0.08)' },
  upNextLabel: { fontSize: 10, fontWeight: '800', opacity: 0.5, letterSpacing: 0.6 },
  upNextRange: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  doneTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  primaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 4,
  },
  primaryRowText: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
  ghost: { alignItems: 'center', paddingVertical: 10 },
  ghostText: { color: ACCENT, fontSize: 14.5, fontWeight: '700' },
  manage: { gap: 0 },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.22)',
  },
  manageText: { flex: 1, fontSize: 15, fontWeight: '600' },
  repaceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 10 },
  repaceBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: ACCENT + '16',
  },
  repaceBtnText: { color: ACCENT, fontSize: 13.5, fontWeight: '700' },
  primary: { backgroundColor: ACCENT, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, marginTop: 6 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disclaimer: { fontSize: 11.5, opacity: 0.5, lineHeight: 17, textAlign: 'center', marginTop: 2 },
});
