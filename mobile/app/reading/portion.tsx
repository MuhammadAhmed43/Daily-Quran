import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExplainSheet, type ExplainTarget } from '@/components/explain-sheet';
import { FadeIn } from '@/components/fade-in';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { haptic } from '@/lib/haptics';
import { getAyah } from '@/lib/quran';
import { corpusAyahs, corpusLength, estimateMinutes, surahName } from '@/lib/quran-plan';
import { useQuranPlan } from '@/lib/quran-plan-progress';
import { useRecitation } from '@/lib/recitation-context';
import { getSurahIntro } from '@/lib/surah-intro';
import { recordActivity } from '@/lib/streak';

const ACCENT = '#0a7ea4';

export default function PortionScreen() {
  const router = useRouter();
  const rec = useRecitation();
  const { plan, today, finished, portionNumber, totalPortionsCount, completePortion } = useQuranPlan();
  const [explainTarget, setExplainTarget] = useState<ExplainTarget | null>(null);
  const [completed, setCompleted] = useState<null | { wasLast: boolean; percentAfter: number }>(null);
  const ownsAudioRef = useRef(false);
  ownsAudioRef.current = rec.queued; // the portion screen's only audio is its "narrate portion" playlist

  // Fade narration out smoothly if we leave while it's still playing.
  useEffect(() => {
    return () => {
      if (ownsAudioRef.current) rec.fadeStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fadeIfMine = () => {
    if (ownsAudioRef.current) rec.fadeStop();
  };

  if (!plan) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <Stack.Screen options={{ title: 'Reading' }} />
        <ThemedText style={styles.muted}>You don’t have an active plan.</ThemedText>
        <Pressable onPress={() => router.replace('/reading/new')} hitSlop={10}>
          <ThemedText style={styles.link}>Start one ›</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  // Completion screen (shown right after marking complete, before swapping to the next portion).
  if (completed) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <Stack.Screen options={{ title: 'Done', headerBackTitle: 'Plan' }} />
        <FadeIn duration={550}>
          <View style={styles.doneWrap}>
            <ThemedText style={styles.doneEmoji}>{completed.wasLast ? '🌟' : '🌱'}</ThemedText>
            <ThemedText style={styles.doneTitle}>
              {completed.wasLast ? 'You’ve completed your plan' : 'Portion complete'}
            </ThemedText>
            <ThemedText style={styles.doneText}>
              {completed.wasLast
                ? 'You read it through to the end, at your own pace. May it stay with you.'
                : `${Math.round(completed.percentAfter * 100)}% of the way through. See you tomorrow — or keep going.`}
            </ThemedText>
            {completed.wasLast ? (
              <Pressable
                style={styles.primary}
                onPress={() => {
                  haptic.light();
                  router.replace('/reading');
                }}>
                <ThemedText style={styles.primaryText}>View my plan</ThemedText>
              </Pressable>
            ) : (
              <>
                <Pressable
                  style={styles.primary}
                  onPress={() => {
                    haptic.light();
                    fadeIfMine();
                    setCompleted(null); // reveal the next portion in place
                  }}>
                  <ThemedText style={styles.primaryText}>Continue reading</ThemedText>
                </Pressable>
                <Pressable
                  style={styles.secondary}
                  onPress={() => {
                    haptic.light();
                    fadeIfMine();
                    router.back();
                  }}>
                  <ThemedText style={styles.secondaryText}>Done for today</ThemedText>
                </Pressable>
              </>
            )}
          </View>
        </FadeIn>
      </ThemedView>
    );
  }

  if (finished || !today) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <Stack.Screen options={{ title: 'Reading', headerBackTitle: 'Plan' }} />
        <ThemedText style={styles.doneEmoji}>🌟</ThemedText>
        <ThemedText style={styles.muted}>You’ve finished this plan.</ThemedText>
        <Pressable onPress={() => router.replace('/reading')} hitSlop={10}>
          <ThemedText style={styles.link}>View my plan ›</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const refs = corpusAyahs(plan.corpus).slice(today.startIdx, today.endIdx);
  const rows: { surah: number; ayah: number; header: boolean }[] = [];
  let prev = -1;
  for (const r of refs) {
    rows.push({ surah: r.surah, ayah: r.ayah, header: r.surah !== prev });
    prev = r.surah;
  }

  const complete = () => {
    haptic.success();
    const wasLast = today.endIdx >= corpusLength(plan.corpus);
    completePortion();
    recordActivity('study_step');
    setCompleted({ wasLast, percentAfter: today.endIdx / corpusLength(plan.corpus) });
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: `Portion ${portionNumber}`, headerBackTitle: 'Plan' }} />
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <FadeIn duration={450}>
            <ThemedText style={styles.kicker}>
              PORTION {portionNumber} OF {totalPortionsCount}
            </ThemedText>
            <ThemedText style={styles.range}>
              {surahName(today.from.surah)} {today.from.surah}:{today.from.ayah} → {today.to.surah}:
              {today.to.ayah}
            </ThemedText>
            <ThemedText style={styles.meta}>
              {today.count} ayahs · about {estimateMinutes(today.count)} min
            </ThemedText>
          </FadeIn>

          <Pressable
            style={({ pressed }) => [styles.narrate, pressed && styles.pressed]}
            onPress={() => {
              haptic.light();
              if (rec.queued) rec.stop();
              else rec.playList(refs);
            }}>
            <Ionicons name={rec.queued ? 'stop' : 'play'} size={16} color={ACCENT} />
            <ThemedText style={styles.narrateText}>
              {rec.queued ? 'Stop recitation' : 'Recite this portion'}
            </ThemedText>
          </Pressable>

          {rows.map((row, i) => {
            const a = getAyah(row.surah, row.ayah);
            if (!a) return null;
            const intro = row.header ? getSurahIntro(row.surah) : undefined;
            return (
              <View key={`${row.surah}:${row.ayah}`}>
                {row.header ? (
                  <View style={styles.surahHead}>
                    <ThemedText style={styles.surahHeadName}>{surahName(row.surah)}</ThemedText>
                    {intro ? <ThemedText style={styles.surahHeadIntro}>{intro.summary}</ThemedText> : null}
                  </View>
                ) : null}
                <Pressable
                  style={({ pressed }) => [styles.ayah, pressed && { backgroundColor: ACCENT + '10' }]}
                  onPress={() =>
                    setExplainTarget({ surah: row.surah, ayah: row.ayah, name: surahName(row.surah), ar: a.ar, en: a.en })
                  }>
                  <View style={styles.ayahHead}>
                    <ThemedText style={styles.ayahRef}>
                      {row.surah}:{row.ayah}
                    </ThemedText>
                    {i === 0 ? <ThemedText style={styles.tapHint}>tap any ayah to explain</ThemedText> : null}
                  </View>
                  <ThemedText style={styles.ar}>{a.ar}</ThemedText>
                  <ThemedText style={styles.en}>{a.en}</ThemedText>
                </Pressable>
              </View>
            );
          })}

          <Pressable style={styles.completeBtn} onPress={complete}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <ThemedText style={styles.completeText}>Mark portion complete</ThemedText>
          </Pressable>

          <ThemedText style={styles.disclaimer}>
            Read with your heart, not the clock — understanding on tap, never a test.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>

      <ExplainSheet target={explainTarget} onClose={() => setExplainTarget(null)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  muted: { opacity: 0.65, fontSize: 16, textAlign: 'center' },
  link: { color: ACCENT, fontSize: 15, fontWeight: '700' },
  scroll: { padding: 16, paddingBottom: 40, gap: 12 },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: ACCENT },
  range: { fontSize: 21, fontWeight: '800', lineHeight: 27, marginTop: 6 },
  meta: { fontSize: 13.5, opacity: 0.6, marginTop: 3 },
  narrate: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: ACCENT + '1e',
  },
  pressed: { opacity: 0.6 },
  narrateText: { color: ACCENT, fontSize: 14, fontWeight: '700' },
  surahHead: { marginTop: 10, marginBottom: 6, gap: 4, paddingHorizontal: 2 },
  surahHeadName: { fontSize: 17, fontWeight: '800', color: ACCENT },
  surahHeadIntro: { fontSize: 13, lineHeight: 19, opacity: 0.7 },
  ayah: { paddingVertical: 12, gap: 8, borderRadius: 12, paddingHorizontal: 6 },
  ayahHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ayahRef: { fontSize: 12.5, fontWeight: '700', color: ACCENT, opacity: 0.9 },
  tapHint: { fontSize: 11.5, opacity: 0.5, fontStyle: 'italic' },
  ar: { fontFamily: 'AmiriQuran', fontSize: 23, lineHeight: 48, textAlign: 'right', writingDirection: 'rtl' },
  en: { fontSize: 15, lineHeight: 23, opacity: 0.85 },
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 8,
  },
  completeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disclaimer: { fontSize: 11.5, opacity: 0.5, lineHeight: 17, textAlign: 'center', marginTop: 2 },
  doneWrap: { alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  doneEmoji: { fontSize: 40 },
  doneTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  doneText: { fontSize: 15, lineHeight: 23, opacity: 0.82, textAlign: 'center' },
  primary: {
    backgroundColor: ACCENT,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginTop: 8,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondary: { paddingVertical: 12, paddingHorizontal: 20 },
  secondaryText: { color: ACCENT, fontSize: 15, fontWeight: '700' },
});
