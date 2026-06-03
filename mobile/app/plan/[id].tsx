import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { haptic } from '@/lib/haptics';
import { getPlan } from '@/lib/plans';
import { usePlanProgress } from '@/lib/plan-progress';

// Journey overview — intro, progress, the full ordered step list, and the primary Start/Continue
// (or Begin again, once finished). Done steps can be revisited; the current step is highlighted;
// future steps wait their turn (you reach them by completing the one before). Mirrors the watch hub.
export default function PlanOverview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const progress = usePlanProgress();
  const plan = id ? getPlan(String(id)) : undefined;

  if (!plan) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <Stack.Screen options={{ title: 'Journey' }} />
        <ThemedText style={styles.muted}>This journey isn’t available.</ThemedText>
      </ThemedView>
    );
  }

  const s = progress.summary(plan.id);
  const accent = plan.accent;
  const cur = Math.min(s.currentOrder, plan.steps.length);

  const open = (order: number) => {
    haptic.light();
    progress.startPlan(plan.id); // enroll + make this the active focus
    router.push({ pathname: '/plan/[id]/[order]', params: { id: plan.id, order: String(order) } });
  };
  const restart = () => {
    haptic.medium();
    progress.restartPlan(plan.id);
    router.push({ pathname: '/plan/[id]/[order]', params: { id: plan.id, order: '1' } });
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: plan.title, headerBackTitle: 'Journeys' }} />
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={[styles.iconWell, { backgroundColor: accent + '22' }]}>
              <ThemedText style={styles.emoji}>{plan.emoji}</ThemedText>
            </View>
            <ThemedText style={styles.h1}>{plan.title}</ThemedText>
            <ThemedText style={styles.intro}>{plan.intro}</ThemedText>
          </View>

          <View style={[styles.summary, { backgroundColor: accent + '14', borderColor: accent + '38' }]}>
            <ThemedText style={styles.summaryLabel}>
              {s.finished
                ? 'Completed'
                : s.started
                  ? `Step ${cur} of ${plan.steps.length}`
                  : `${plan.steps.length} steps · a few minutes a day`}
            </ThemedText>
            <View style={styles.barTrack}>
              <View
                style={[styles.barFill, { width: `${(s.done / plan.steps.length) * 100}%`, backgroundColor: accent }]}
              />
            </View>
          </View>

          {s.finished ? (
            <Pressable style={[styles.cta, { backgroundColor: accent }]} onPress={restart}>
              <Ionicons name="refresh" size={18} color="#fff" />
              <ThemedText style={styles.ctaText}>Begin again</ThemedText>
            </Pressable>
          ) : (
            <Pressable style={[styles.cta, { backgroundColor: accent }]} onPress={() => open(s.started ? cur : 1)}>
              <Ionicons name="play" size={18} color="#fff" />
              <ThemedText style={styles.ctaText}>{s.started ? `Continue · Step ${cur}` : 'Start journey'}</ThemedText>
            </Pressable>
          )}

          {s.started && !s.isActive && !s.finished ? (
            <Pressable
              style={styles.focusBtn}
              onPress={() => {
                haptic.light();
                progress.setActive(plan.id);
              }}>
              <Ionicons name="bookmark-outline" size={15} color={accent} />
              <ThemedText style={[styles.focusText, { color: accent }]}>Make this today’s focus</ThemedText>
            </Pressable>
          ) : null}

          <View style={styles.steps}>
            {plan.steps.map((st) => {
              const isDone = st.order < s.currentOrder;
              const isCurrent = st.order === s.currentOrder && !s.finished;
              const locked = st.order > s.currentOrder;
              return (
                <Pressable
                  key={st.order}
                  disabled={locked}
                  onPress={() => open(st.order)}
                  style={[
                    styles.stepRow,
                    isCurrent && { borderColor: accent + '66', backgroundColor: accent + '0e' },
                    locked && styles.stepLocked,
                  ]}>
                  <View
                    style={[
                      styles.stepNum,
                      isDone
                        ? { backgroundColor: accent }
                        : isCurrent
                          ? { borderColor: accent, borderWidth: 2 }
                          : styles.stepNumIdle,
                    ]}>
                    {isDone ? (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    ) : (
                      <ThemedText style={[styles.stepNumText, isCurrent && { color: accent }]}>{st.order}</ThemedText>
                    )}
                  </View>
                  <View style={styles.stepBody}>
                    <ThemedText style={styles.stepTitle} numberOfLines={1}>
                      {st.title}
                    </ThemedText>
                    {isCurrent ? (
                      <ThemedText style={[styles.stepHint, { color: accent }]}>Today’s step</ThemedText>
                    ) : null}
                  </View>
                  {locked ? (
                    <Ionicons name="lock-closed" size={13} color="rgba(127,127,127,0.5)" />
                  ) : (
                    <ThemedText style={styles.stepArrow}>›</ThemedText>
                  )}
                </Pressable>
              );
            })}
          </View>

          <ThemedText style={styles.disclaimer}>
            A study aid for reflection — not a fatwa or a substitute for a qualified scholar.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  muted: { opacity: 0.6 },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },
  header: { alignItems: 'center', gap: 8, paddingHorizontal: 8, marginBottom: 2 },
  iconWell: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 30 },
  h1: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  intro: { fontSize: 15, lineHeight: 23, opacity: 0.82, textAlign: 'center' },
  summary: { padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  summaryLabel: { fontSize: 15, fontWeight: '700' },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(127,127,127,0.2)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  focusBtn: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 6, paddingVertical: 4 },
  focusText: { fontSize: 14, fontWeight: '700' },
  steps: { gap: 8, marginTop: 2 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.2)',
  },
  stepLocked: { opacity: 0.45 },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepNumIdle: { backgroundColor: 'rgba(127,127,127,0.14)' },
  stepNumText: { fontSize: 13, fontWeight: '800', opacity: 0.7 },
  stepBody: { flex: 1, gap: 1 },
  stepTitle: { fontSize: 15, fontWeight: '600' },
  stepHint: { fontSize: 11.5, fontWeight: '700' },
  stepArrow: { fontSize: 20, opacity: 0.35 },
  disclaimer: { fontSize: 11, opacity: 0.45, lineHeight: 16, textAlign: 'center', marginTop: 4 },
});
