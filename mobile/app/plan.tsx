import { Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeIn } from '@/components/fade-in';
import { QuranPlanCard } from '@/components/home/quran-plan-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { haptic } from '@/lib/haptics';
import { PLANS } from '@/lib/plans';
import { usePlanProgress } from '@/lib/plan-progress';

// "Journeys" hub — the four guided tracks as cards, each with its own progress. Mirrors the watch
// hub list. Position-based: a started journey shows where you are; missing days never shows here.
export default function PlansScreen() {
  const router = useRouter();
  const progress = usePlanProgress();

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Plans', headerBackTitle: 'Home' }} />
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText style={styles.h1}>Plans</ThemedText>
            <ThemedText style={styles.sub}>
              Read through the Qur’an at your own pace, or follow a short guided journey.
            </ThemedText>
          </View>

          <ThemedText style={styles.sectionLabel}>Your Qur’an plan</ThemedText>
          <QuranPlanCard />
          <ThemedText style={[styles.sectionLabel, styles.sectionGap]}>Guided journeys</ThemedText>

          {PLANS.map((p, i) => {
            const s = progress.summary(p.id);
            const pill = s.finished
              ? 'Completed ✓'
              : s.started
                ? `Step ${Math.min(s.currentOrder, s.total)} of ${s.total}`
                : `${s.total} steps · not started`;
            return (
              <FadeIn key={p.id} delay={i * 50} duration={420}>
                <Pressable
                  style={[styles.card, { backgroundColor: p.accent + '12', borderColor: p.accent + '33' }]}
                  onPress={() => {
                    haptic.light();
                    router.push({ pathname: '/plan/[id]', params: { id: p.id } });
                  }}>
                  <View style={[styles.iconWell, { backgroundColor: p.accent + '22' }]}>
                    <ThemedText style={styles.emoji}>{p.emoji}</ThemedText>
                  </View>
                  <View style={styles.body}>
                    <View style={styles.titleRow}>
                      <ThemedText style={styles.title}>{p.title}</ThemedText>
                      {s.isActive && !s.finished ? (
                        <View style={[styles.tag, { backgroundColor: p.accent }]}>
                          <ThemedText style={styles.tagText}>FOCUS</ThemedText>
                        </View>
                      ) : null}
                    </View>
                    <ThemedText style={styles.blurb} numberOfLines={2}>
                      {p.blurb}
                    </ThemedText>
                    <ThemedText style={[styles.pill, { color: p.accent }]}>{pill}</ThemedText>
                  </View>
                  <ThemedText style={styles.arrow}>›</ThemedText>
                </Pressable>
              </FadeIn>
            );
          })}

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
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },
  header: { gap: 4, marginBottom: 2 },
  h1: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  sub: { fontSize: 14, opacity: 0.6, lineHeight: 20 },
  sectionLabel: { fontSize: 12.5, fontWeight: '800', opacity: 0.5, letterSpacing: 0.6, textTransform: 'uppercase' },
  sectionGap: { marginTop: 6 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWell: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 24 },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 17, fontWeight: '700' },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  tagText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  blurb: { fontSize: 13.5, opacity: 0.7, lineHeight: 19 },
  pill: { fontSize: 12.5, fontWeight: '700', marginTop: 1 },
  arrow: { fontSize: 22, opacity: 0.4 },
  disclaimer: { fontSize: 11, opacity: 0.45, lineHeight: 16, textAlign: 'center', marginTop: 4 },
});
