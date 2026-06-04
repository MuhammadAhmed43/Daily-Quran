// Daily quiz player. Two modes via the `mode` route param:
//   • daily (default) — the deterministic 10 for today; records a result + credits the streak, once.
//   • practice — a fresh random 10 every time; never recorded, never credits the streak.
// Flow: one question at a time, tap to answer -> instant right/wrong + the explanation (+ "Read in
// context" when the question has a verse ref) -> a score screen at the end. Scripture shown in the
// verse questions is rendered from the verified bundle by the bank, never generated here.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { haptic } from '@/lib/haptics';
import { getQuizStats, recordDailyResult } from '@/lib/quiz';
import { getDailyQuestions, getPracticeQuestions, type QuizTopic } from '@/lib/quiz-bank';
import { dayKey } from '@/lib/streak';

const ACCENT = '#0a7ea4';
const GREEN = '#2e9e6b';
const RED = '#cf5b54';

const TOPIC_LABEL: Record<QuizTopic, string> = {
  quran: "Qur'an",
  basics: 'Islam basics',
  seerah: 'Seerah',
  vocab: 'Vocabulary',
};

function outcomeFor(pct: number): { title: string; sub: string } {
  if (pct >= 0.9) return { title: 'Excellent!', sub: 'Ma sha Allah — a strong score.' };
  if (pct >= 0.7) return { title: 'Well done', sub: 'A good result — keep it up.' };
  if (pct >= 0.4) return { title: 'Good effort', sub: 'A little more each day adds up.' };
  return { title: 'Keep going', sub: 'Every attempt teaches you something new.' };
}

export default function QuizScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: 'daily' | 'practice' = params.mode === 'practice' ? 'practice' : 'daily';
  const title = mode === 'practice' ? 'Practice' : 'Daily Quiz';

  // The question set is fixed for the life of a round. Daily is deterministic by date; practice is a
  // fresh random set, reshuffled when `round` bumps (Play again).
  const [round, setRound] = useState(0);
  const questions = useMemo(() => {
    void round; // bumping `round` (Play again) reshuffles a fresh practice set; daily stays fixed
    return mode === 'practice' ? getPracticeQuestions() : getDailyQuestions(dayKey(new Date()));
  }, [mode, round]);

  // Daily only: find out if today's quiz is already done (so we show the recap instead of replaying it).
  const [ready, setReady] = useState(mode === 'practice');
  const [doneToday, setDoneToday] = useState<{ score: number; total: number } | null>(null);
  useEffect(() => {
    if (mode !== 'daily') return;
    let active = true;
    getQuizStats().then((s) => {
      if (!active) return;
      if (s.todayDone && s.todayScore != null && s.todayTotal != null) {
        setDoneToday({ score: s.todayScore, total: s.todayTotal });
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [mode]);

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);

  const q = questions[idx];
  const score = picked.reduce((s, p, i) => s + (p === questions[i]?.answer ? 1 : 0), 0);

  // Gentle fade + lift as each question appears.
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [idx, anim]);

  const onPick = (optionIdx: number) => {
    if (revealed || finished || !q) return;
    if (optionIdx === q.answer) haptic.success();
    else haptic.medium();
    setPicked((prev) => {
      const next = prev.slice();
      next[idx] = optionIdx;
      return next;
    });
    setRevealed(true);
  };

  const onNext = () => {
    haptic.light();
    if (idx + 1 >= questions.length) {
      setFinished(true);
      if (mode === 'daily') void recordDailyResult(score, questions.length, picked);
    } else {
      setIdx(idx + 1);
      setRevealed(false);
    }
  };

  const restart = () => {
    haptic.light();
    setIdx(0);
    setPicked([]);
    setRevealed(false);
    setFinished(false);
    setRound((r) => r + 1);
  };

  const readInContext = () => {
    if (!q?.ref) return;
    haptic.light();
    router.push({
      pathname: '/surah/[number]',
      params: { number: String(q.ref.surah), ...(q.ref.ayah ? { ayah: String(q.ref.ayah) } : {}) },
    });
  };

  // ---- loading (daily recap check) ----
  if (!ready) {
    return (
      <ThemedView style={styles.fill}>
        <Stack.Screen options={{ title, headerBackTitle: 'Profile' }} />
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      </ThemedView>
    );
  }

  // ---- daily already done today: a calm recap, with practice as the way to keep going ----
  if (mode === 'daily' && doneToday) {
    return (
      <ThemedView style={styles.fill}>
        <Stack.Screen options={{ title, headerBackTitle: 'Profile' }} />
        <SafeAreaView edges={['bottom']} style={styles.fill}>
          <View style={styles.resultWrap}>
            <View style={[styles.scoreRing, { borderColor: GREEN }]}>
              <ThemedText style={styles.scoreBig}>
                {doneToday.score}
                <ThemedText style={styles.scoreOf}>/{doneToday.total}</ThemedText>
              </ThemedText>
            </View>
            <Ionicons name="checkmark-circle" size={22} color={GREEN} />
            <ThemedText style={styles.resultTitle}>Today&apos;s quiz is done</ThemedText>
            <ThemedText style={styles.resultSub}>Come back tomorrow for a fresh set of ten.</ThemedText>
            <View style={styles.resultBtns}>
              <Pressable style={styles.primaryBtn} onPress={() => router.replace({ pathname: '/quiz', params: { mode: 'practice' } })}>
                <Ionicons name="repeat" size={18} color="#fff" />
                <ThemedText style={styles.primaryBtnText}>Practice more</ThemedText>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
                <ThemedText style={styles.secondaryBtnText}>Done</ThemedText>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ---- finished: score screen ----
  if (finished) {
    const total = questions.length;
    const pct = total ? score / total : 0;
    const o = outcomeFor(pct);
    const ringColor = pct >= 0.7 ? GREEN : pct >= 0.4 ? ACCENT : RED;
    return (
      <ThemedView style={styles.fill}>
        <Stack.Screen options={{ title, headerBackTitle: 'Profile' }} />
        <SafeAreaView edges={['bottom']} style={styles.fill}>
          <View style={styles.resultWrap}>
            <View style={[styles.scoreRing, { borderColor: ringColor }]}>
              <ThemedText style={styles.scoreBig}>
                {score}
                <ThemedText style={styles.scoreOf}>/{total}</ThemedText>
              </ThemedText>
            </View>
            <ThemedText style={styles.resultTitle}>{o.title}</ThemedText>
            <ThemedText style={styles.resultSub}>{o.sub}</ThemedText>
            {mode === 'daily' ? (
              <View style={styles.streakNote}>
                <Ionicons name="flame" size={16} color="#e8833a" />
                <ThemedText style={styles.streakNoteText}>This counts toward your streak</ThemedText>
              </View>
            ) : null}
            <View style={styles.resultBtns}>
              {mode === 'practice' ? (
                <>
                  <Pressable style={styles.primaryBtn} onPress={restart}>
                    <Ionicons name="repeat" size={18} color="#fff" />
                    <ThemedText style={styles.primaryBtnText}>Play again</ThemedText>
                  </Pressable>
                  <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
                    <ThemedText style={styles.secondaryBtnText}>Done</ThemedText>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable style={styles.primaryBtn} onPress={() => router.replace({ pathname: '/quiz', params: { mode: 'practice' } })}>
                    <Ionicons name="repeat" size={18} color="#fff" />
                    <ThemedText style={styles.primaryBtnText}>Practice more</ThemedText>
                  </Pressable>
                  <Pressable style={styles.secondaryBtn} onPress={() => router.back()}>
                    <ThemedText style={styles.secondaryBtnText}>Done</ThemedText>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  // ---- active question ----
  if (!q) {
    return (
      <ThemedView style={styles.fill}>
        <Stack.Screen options={{ title, headerBackTitle: 'Profile' }} />
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      </ThemedView>
    );
  }

  const answeredPct = ((revealed ? idx + 1 : idx) / questions.length) * 100;
  const chosen = picked[idx];

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen options={{ title, headerBackTitle: 'Profile' }} />
      <SafeAreaView edges={['bottom']} style={styles.fill}>
        {/* progress */}
        <View style={styles.progressHead}>
          <ThemedText style={styles.progressLabel}>
            Question {idx + 1} of {questions.length}
          </ThemedText>
          <View style={styles.topicChip}>
            <ThemedText style={styles.topicChipText}>{TOPIC_LABEL[q.topic]}</ThemedText>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${answeredPct}%` }]} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View
            style={{
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            }}>
            <ThemedText style={styles.question}>{q.q}</ThemedText>

            <View style={styles.options}>
              {q.options.map((opt, i) => {
                const isCorrect = i === q.answer;
                const isChosen = i === chosen;
                let border = 'rgba(127,127,127,0.28)';
                let bg = 'transparent';
                let icon: keyof typeof Ionicons.glyphMap | null = null;
                let iconColor = ACCENT;
                if (revealed) {
                  if (isCorrect) {
                    border = GREEN;
                    bg = 'rgba(46,158,107,0.12)';
                    icon = 'checkmark-circle';
                    iconColor = GREEN;
                  } else if (isChosen) {
                    border = RED;
                    bg = 'rgba(207,91,84,0.12)';
                    icon = 'close-circle';
                    iconColor = RED;
                  }
                }
                return (
                  <Pressable
                    key={i}
                    style={[styles.option, { borderColor: border, backgroundColor: bg }, revealed && !isCorrect && !isChosen ? styles.optionDim : null]}
                    onPress={() => onPick(i)}
                    disabled={revealed}>
                    <ThemedText style={styles.optionText}>{opt}</ThemedText>
                    {icon ? <Ionicons name={icon} size={20} color={iconColor} /> : null}
                  </Pressable>
                );
              })}
            </View>

            {revealed ? (
              <View style={styles.explainCard}>
                <ThemedText style={styles.explainText}>{q.explain}</ThemedText>
                {q.ref ? (
                  <Pressable style={styles.readLink} onPress={readInContext}>
                    <Ionicons name="book-outline" size={16} color={ACCENT} />
                    <ThemedText style={styles.readLinkText}>Read in context</ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>

        {revealed ? (
          <View style={styles.footer}>
            <Pressable style={styles.primaryBtn} onPress={onNext}>
              <ThemedText style={styles.primaryBtnText}>{idx + 1 >= questions.length ? 'See results' : 'Next'}</ThemedText>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // progress
  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8 },
  progressLabel: { fontSize: 13, fontWeight: '700', opacity: 0.55 },
  topicChip: { backgroundColor: 'rgba(10,126,164,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  topicChipText: { fontSize: 12, fontWeight: '700', color: ACCENT },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: 'rgba(127,127,127,0.18)', marginHorizontal: 18, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: ACCENT },

  // question
  scroll: { padding: 18, paddingBottom: 24, gap: 18 },
  question: { fontSize: 20, fontWeight: '700', lineHeight: 28, marginTop: 6, marginBottom: 4 },
  options: { gap: 11 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  optionDim: { opacity: 0.45 },
  optionText: { fontSize: 16, fontWeight: '600', flex: 1, lineHeight: 22 },

  explainCard: { backgroundColor: 'rgba(127,127,127,0.08)', borderRadius: 14, padding: 14, gap: 10 },
  explainText: { fontSize: 15, lineHeight: 22, opacity: 0.9 },
  readLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  readLinkText: { fontSize: 14.5, fontWeight: '700', color: ACCENT },

  // footer button
  footer: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 8 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 15,
    borderRadius: 14,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14 },
  secondaryBtnText: { color: ACCENT, fontSize: 15.5, fontWeight: '700' },

  // result
  resultWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  scoreRing: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  scoreBig: { fontSize: 44, fontWeight: '800', lineHeight: 50 },
  scoreOf: { fontSize: 22, fontWeight: '700', opacity: 0.5 },
  resultTitle: { fontSize: 24, fontWeight: '800' },
  resultSub: { fontSize: 15.5, opacity: 0.65, textAlign: 'center', lineHeight: 22 },
  streakNote: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6, backgroundColor: 'rgba(232,131,58,0.12)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  streakNoteText: { fontSize: 14, fontWeight: '700', color: '#e8833a' },
  resultBtns: { alignSelf: 'stretch', gap: 8, marginTop: 22 },
});
