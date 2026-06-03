import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExplainSheet, type ExplainTarget } from '@/components/explain-sheet';
import { FadeIn } from '@/components/fade-in';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VerseSpeaker } from '@/components/verse-speaker';
import { haptic } from '@/lib/haptics';
import { getPlan, getStep } from '@/lib/plans';
import { usePlanProgress } from '@/lib/plan-progress';
import { getAyah, getSurah } from '@/lib/quran';
import { useRecitation } from '@/lib/recitation-context';
import { recordActivity } from '@/lib/streak';

// A single day/step of a journey: framing → the verse(s), each tappable for the grounded explanation
// (the same ExplainSheet used app-wide) → a reflection prompt → mark complete. Completing it feeds
// the streak via 'study_step'. The care step (Through Hardship) leads with help + a helpline instead
// of a verse. Recitation is NOT stopped on mount — verse narration here IS the recitation engine.
export default function StepPlayer() {
  const { id, order } = useLocalSearchParams<{ id: string; order: string }>();
  const router = useRouter();
  const rec = useRecitation();
  const progress = usePlanProgress();
  const [explainTarget, setExplainTarget] = useState<ExplainTarget | null>(null);
  const [justDone, setJustDone] = useState(false);
  const ownsAudioRef = useRef(false); // is the recitation playing right now one this step started?

  // Reset the local "just completed" flash whenever we move to a different step (router.replace keeps
  // this screen mounted across Up-next, so without this the next step would inherit a stale done).
  useEffect(() => {
    setJustDone(false);
  }, [order]);

  // Leaving this step via a real unmount (header back / Home / swipe) gently fades out the step's
  // recitation. The explicit nav buttons below handle the in-place param swap (Up next), which this
  // cleanup can't see. Only fades audio THIS step started (see ownsAudioRef).
  useEffect(() => {
    return () => {
      if (ownsAudioRef.current) rec.fadeStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  const plan = id ? getPlan(String(id)) : undefined;
  const step = plan ? getStep(plan.id, Number(order)) : undefined;

  if (!plan || !step) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <Stack.Screen options={{ title: 'Step' }} />
        <ThemedText style={styles.muted}>This step isn’t available.</ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ThemedText style={styles.backLink}>Go back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const accent = plan.accent;
  const total = plan.steps.length;
  const done = progress.isStepDone(plan.id, step.order) || justDone;
  const next = getStep(plan.id, step.order + 1);

  // Is the audio playing right now something THIS step started? — the "narrate this step" playlist,
  // or a tapped speaker on one of this step's own verses. (Recitation started elsewhere, e.g. the
  // reader, is left alone.) Computed each render so the value is always fresh for the handlers below.
  const playingNow = rec.playing;
  ownsAudioRef.current =
    rec.queued ||
    (playingNow ? step.verses.some((v) => v.surah === playingNow.surah && v.ayah === playingNow.ayah) : false);
  const fadeIfMine = () => {
    if (ownsAudioRef.current) rec.fadeStop();
  };

  const complete = () => {
    if (done) return;
    haptic.success();
    progress.completeStep(plan.id, step.order);
    recordActivity('study_step');
    setJustDone(true);
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: `Step ${step.order}`, headerBackTitle: plan.title }} />
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <FadeIn duration={500}>
            <ThemedText style={[styles.kicker, { color: accent }]}>
              STEP {step.order} OF {total}
            </ThemedText>
            <ThemedText style={styles.title}>{step.title}</ThemedText>
            <ThemedText style={styles.framing}>{step.framing}</ThemedText>
          </FadeIn>

          {step.care ? (
            <FadeIn delay={120}>
              <View style={styles.crisis}>
                <ThemedText style={styles.crisisTitle}>Please reach out — you matter</ThemedText>
                <ThemedText style={styles.crisisText}>
                  If you’re in crisis or thinking about harming yourself, you don’t have to face it
                  alone. Contact your local emergency services or a crisis helpline right now, and talk
                  to someone you trust. Reaching out is strength, and help is real.
                </ThemedText>
              </View>
            </FadeIn>
          ) : (
            step.verses.map((v, i) => {
              const a = getAyah(v.surah, v.ayah);
              const sr = getSurah(v.surah);
              if (!a || !sr) return null;
              return (
                <FadeIn key={`${v.surah}:${v.ayah}`} delay={120 + i * 70}>
                  <Pressable
                    style={({ pressed }) => [styles.verse, pressed && { backgroundColor: accent + '12' }]}
                    onPress={() =>
                      setExplainTarget({ surah: v.surah, ayah: v.ayah, name: sr.englishName, ar: a.ar, en: a.en })
                    }>
                    <View style={styles.verseHead}>
                      <ThemedText style={[styles.ref, { color: accent }]}>
                        {sr.englishName} · {v.surah}:{v.ayah}
                      </ThemedText>
                      <VerseSpeaker surah={v.surah} ayah={v.ayah} size={18} />
                    </View>
                    <ThemedText style={styles.ar}>{a.ar}</ThemedText>
                    <ThemedText style={styles.en}>{a.en}</ThemedText>
                    <ThemedText style={[styles.explainHint, { color: accent }]}>Tap to explain ›</ThemedText>
                  </Pressable>
                </FadeIn>
              );
            })
          )}

          {step.verses.length >= 2 ? (
            <Pressable
              style={({ pressed }) => [styles.narrateBtn, { backgroundColor: accent + '1e' }, pressed && styles.pressed]}
              onPress={() => {
                haptic.light();
                if (rec.queued) rec.stop();
                else rec.playList(step.verses);
              }}>
              <Ionicons name={rec.queued ? 'stop' : 'play'} size={16} color={accent} />
              <ThemedText style={[styles.narrateText, { color: accent }]}>
                {rec.queued ? 'Stop narration' : 'Narrate this step'}
              </ThemedText>
            </Pressable>
          ) : null}

          <FadeIn delay={200}>
            <View style={[styles.reflect, { backgroundColor: accent + '0c', borderColor: accent + '33' }]}>
              <ThemedText style={[styles.reflectLabel, { color: accent }]}>REFLECT</ThemedText>
              <ThemedText style={styles.reflectText}>{step.reflection}</ThemedText>
            </View>
          </FadeIn>

          {step.note ? <ThemedText style={styles.note}>{step.note}</ThemedText> : null}

          <Pressable
            onPress={complete}
            disabled={done}
            style={[styles.markBtn, done ? styles.markDone : { backgroundColor: accent }]}>
            <Ionicons
              name={done ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={done ? accent : '#fff'}
            />
            <ThemedText style={[styles.markText, done && { color: accent }]}>
              {done ? 'Step complete' : 'Mark complete'}
            </ThemedText>
          </Pressable>

          {done ? (
            <FadeIn duration={550}>
              {next ? (
                <Pressable
                  style={styles.nextBtn}
                  onPress={() => {
                    haptic.light();
                    fadeIfMine(); // fade this step's recitation out before moving on
                    router.replace({ pathname: '/plan/[id]/[order]', params: { id: plan.id, order: String(next.order) } });
                  }}>
                  <View style={styles.nextBody}>
                    <ThemedText style={[styles.nextLabel, { color: accent }]}>UP NEXT</ThemedText>
                    <ThemedText style={styles.nextTitle} numberOfLines={1}>
                      {next.title}
                    </ThemedText>
                  </View>
                  <Ionicons name="arrow-forward-circle" size={28} color={accent} />
                </Pressable>
              ) : (
                <View style={[styles.finishCard, { borderColor: accent + '38', backgroundColor: accent + '12' }]}>
                  <ThemedText style={styles.finishEmoji}>🌟</ThemedText>
                  <ThemedText style={styles.finishTitle}>You’ve completed {plan.title}</ThemedText>
                  <ThemedText style={styles.finishText}>
                    May what you’ve read stay with you through the day. When you’re ready, another
                    journey is waiting.
                  </ThemedText>
                  <Pressable
                    style={[styles.cta, { backgroundColor: accent }]}
                    onPress={() => {
                      haptic.light();
                      fadeIfMine();
                      router.replace('/plan');
                    }}>
                    <ThemedText style={styles.ctaText}>Explore journeys</ThemedText>
                  </Pressable>
                </View>
              )}
            </FadeIn>
          ) : null}

          <ThemedText style={styles.disclaimer}>
            An AI study aid for reflection — not a fatwa or a substitute for a qualified scholar.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>

      <ExplainSheet target={explainTarget} onClose={() => setExplainTarget(null)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  muted: { opacity: 0.6 },
  backLink: { color: '#0a7ea4', fontSize: 14, fontWeight: '600' },
  scroll: { padding: 16, paddingBottom: 40, gap: 16 },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 24, fontWeight: '800', lineHeight: 30, marginTop: 6 },
  framing: { fontSize: 16, lineHeight: 25, opacity: 0.9, marginTop: 10 },
  crisis: {
    backgroundColor: 'rgba(214,84,84,0.10)',
    borderColor: 'rgba(214,84,84,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  crisisTitle: { fontSize: 15, fontWeight: '800', color: '#c1554f' },
  crisisText: { fontSize: 14, lineHeight: 21, opacity: 0.85 },
  verse: { backgroundColor: 'rgba(127,127,127,0.07)', borderRadius: 16, padding: 16, gap: 8 },
  verseHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ref: { fontSize: 13, fontWeight: '700' },
  ar: { fontFamily: 'AmiriQuran', fontSize: 22, lineHeight: 46, textAlign: 'right', writingDirection: 'rtl' },
  en: { fontSize: 15, lineHeight: 23, opacity: 0.85 },
  explainHint: { fontSize: 12, opacity: 0.8, fontWeight: '600' },
  narrateBtn: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  pressed: { opacity: 0.6 },
  narrateText: { fontSize: 14, fontWeight: '700' },
  reflect: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 6 },
  reflectLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  reflectText: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
  note: { fontSize: 13.5, lineHeight: 20, opacity: 0.6, fontStyle: 'italic' },
  markBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  markDone: {
    backgroundColor: 'rgba(127,127,127,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
  },
  markText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.22)',
  },
  nextBody: { flex: 1, gap: 2 },
  nextLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  nextTitle: { fontSize: 15, fontWeight: '600' },
  finishCard: {
    alignItems: 'center',
    gap: 8,
    padding: 20,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  finishEmoji: { fontSize: 34 },
  finishTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  finishText: { fontSize: 14.5, lineHeight: 22, opacity: 0.82, textAlign: 'center' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 22,
    borderRadius: 12,
    marginTop: 6,
  },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  disclaimer: { fontSize: 11, opacity: 0.45, lineHeight: 16, textAlign: 'center', marginTop: 4 },
});
