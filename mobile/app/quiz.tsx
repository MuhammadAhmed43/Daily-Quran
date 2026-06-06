// Daily quiz player (onyx). Two modes via the `mode` route param:
//   • daily (default) — the deterministic 10 for today; records a result + credits the streak, once.
//   • practice — a fresh random 10 every time; never recorded, never credits the streak.
// Flow: one question at a time, tap to answer -> instant right/wrong + the explanation (+ "Read in
// context" when the question has a verse ref) -> a score screen at the end. Scripture shown in the
// verse questions is rendered from the verified bundle by the bank, never generated here.
// Onyx reskin only — all quiz/scoring/streak logic is preserved verbatim.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, StyleSheet, View } from 'react-native';

import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { haptic } from '@/lib/haptics';
import { getQuizStats, recordDailyResult } from '@/lib/quiz';
import { getDailyQuestions, getPracticeQuestions, type QuizTopic } from '@/lib/quiz-bank';
import { dayKey } from '@/lib/streak';
import { c, font, radius, space } from '@/lib/theme';

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

function QuizHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <IconButton name="close" onPress={onClose} diameter={38} size={20} bg={c.surface2} color={c.textSecondary} />
      <Txt variant="cardTitle">{title}</Txt>
      <View style={styles.spacer} />
    </View>
  );
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
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <QuizHeader title={title} onClose={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      </Screen>
    );
  }

  // ---- daily already done today: a calm recap, with practice as the way to keep going ----
  if (mode === 'daily' && doneToday) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <QuizHeader title={title} onClose={() => router.back()} />
        <View style={styles.resultWrap}>
          <ScoreRing score={doneToday.score} total={doneToday.total} color={c.success} />
          <Ionicons name="checkmark-circle" size={22} color={c.success} />
          <Txt variant="h1" style={styles.resultTitle}>
            Today’s quiz is done
          </Txt>
          <Txt variant="body" color={c.textMuted} style={styles.resultSub}>
            Come back tomorrow for a fresh set of ten.
          </Txt>
          <View style={styles.resultBtns}>
            <PressableScale style={styles.primaryBtn} onPress={() => router.replace({ pathname: '/quiz', params: { mode: 'practice' } })}>
              <Ionicons name="repeat" size={18} color={c.bg} />
              <Txt style={styles.primaryBtnText}>Practice more</Txt>
            </PressableScale>
            <PressableScale style={styles.secondaryBtn} onPress={() => router.back()}>
              <Txt style={styles.secondaryBtnText}>Done</Txt>
            </PressableScale>
          </View>
        </View>
      </Screen>
    );
  }

  // ---- finished: score screen ----
  if (finished) {
    const total = questions.length;
    const pct = total ? score / total : 0;
    const o = outcomeFor(pct);
    const ringColor = pct >= 0.7 ? c.success : pct >= 0.4 ? c.accent : c.danger;
    return (
      <Screen edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <QuizHeader title={title} onClose={() => router.back()} />
        <View style={styles.resultWrap}>
          <ScoreRing score={score} total={total} color={ringColor} />
          <Txt variant="h1" style={styles.resultTitle}>
            {o.title}
          </Txt>
          <Txt variant="body" color={c.textMuted} style={styles.resultSub}>
            {o.sub}
          </Txt>
          {mode === 'daily' ? (
            <View style={styles.streakNote}>
              <Ionicons name="flame" size={16} color={c.streakFlame} />
              <Txt style={styles.streakNoteText}>This counts toward your streak</Txt>
            </View>
          ) : null}
          <View style={styles.resultBtns}>
            {mode === 'practice' ? (
              <>
                <PressableScale style={styles.primaryBtn} onPress={restart}>
                  <Ionicons name="repeat" size={18} color={c.bg} />
                  <Txt style={styles.primaryBtnText}>Play again</Txt>
                </PressableScale>
                <PressableScale style={styles.secondaryBtn} onPress={() => router.back()}>
                  <Txt style={styles.secondaryBtnText}>Done</Txt>
                </PressableScale>
              </>
            ) : (
              <>
                <PressableScale style={styles.primaryBtn} onPress={() => router.replace({ pathname: '/quiz', params: { mode: 'practice' } })}>
                  <Ionicons name="repeat" size={18} color={c.bg} />
                  <Txt style={styles.primaryBtnText}>Practice more</Txt>
                </PressableScale>
                <PressableScale style={styles.secondaryBtn} onPress={() => router.back()}>
                  <Txt style={styles.secondaryBtnText}>Done</Txt>
                </PressableScale>
              </>
            )}
          </View>
        </View>
      </Screen>
    );
  }

  // ---- active question ----
  if (!q) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <QuizHeader title={title} onClose={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      </Screen>
    );
  }

  const answeredPct = ((revealed ? idx + 1 : idx) / questions.length) * 100;
  const chosen = picked[idx];

  return (
    <Screen edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <QuizHeader title={title} onClose={() => router.back()} />

      {/* progress */}
      <View style={styles.progressHead}>
        <Txt variant="caption" color={c.textMuted}>
          Question {idx + 1} of {questions.length}
        </Txt>
        <View style={styles.topicChip}>
          <Txt style={styles.topicChipText}>{TOPIC_LABEL[q.topic]}</Txt>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${answeredPct}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View
          style={{
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
          }}>
          <Txt style={styles.question}>{q.q}</Txt>

          <View style={styles.options}>
            {q.options.map((opt, i) => {
              const isCorrect = i === q.answer;
              const isChosen = i === chosen;
              let border = c.hairline;
              let bg = c.surface1;
              let icon: keyof typeof Ionicons.glyphMap | null = null;
              let iconColor = c.accent;
              if (revealed) {
                if (isCorrect) {
                  border = c.success;
                  bg = 'rgba(79,197,138,0.12)';
                  icon = 'checkmark-circle';
                  iconColor = c.success;
                } else if (isChosen) {
                  border = c.danger;
                  bg = 'rgba(217,89,76,0.12)';
                  icon = 'close-circle';
                  iconColor = c.danger;
                }
              }
              return (
                <PressableScale
                  key={i}
                  style={[styles.option, { borderColor: border, backgroundColor: bg }, revealed && !isCorrect && !isChosen ? styles.optionDim : null]}
                  onPress={() => onPick(i)}
                  disabled={revealed}>
                  <Txt style={styles.optionText}>{opt}</Txt>
                  {icon ? <Ionicons name={icon} size={20} color={iconColor} /> : null}
                </PressableScale>
              );
            })}
          </View>

          {revealed ? (
            <View style={styles.explainCard}>
              <Txt variant="body" color={c.textSecondary} style={styles.explainText}>
                {q.explain}
              </Txt>
              {q.ref ? (
                <PressableScale style={styles.readLink} onPress={readInContext}>
                  <Ionicons name="book-outline" size={16} color={c.accent} />
                  <Txt style={styles.readLinkText}>Read in context</Txt>
                </PressableScale>
              ) : null}
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      {revealed ? (
        <View style={styles.footer}>
          <PressableScale style={styles.primaryBtn} onPress={onNext}>
            <Txt style={styles.primaryBtnText}>{idx + 1 >= questions.length ? 'See results' : 'Next'}</Txt>
            <Ionicons name="arrow-forward" size={18} color={c.bg} />
          </PressableScale>
        </View>
      ) : null}
    </Screen>
  );
}

function ScoreRing({ score, total, color }: { score: number; total: number; color: string }) {
  return (
    <View style={[styles.scoreRing, { borderColor: color }]}>
      <Txt style={styles.scoreBig}>
        {score}
        <Txt style={styles.scoreOf}>/{total}</Txt>
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: space.sm },
  spacer: { width: 38 },

  // progress
  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: 8 },
  topicChip: { backgroundColor: 'rgba(201,189,166,0.12)', paddingHorizontal: 11, paddingVertical: 4, borderRadius: radius.full },
  topicChipText: { fontFamily: font.sansSemi, fontSize: 11.5, color: c.accent, letterSpacing: 0.2 },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: c.surface2, marginHorizontal: space.gutter, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: c.accent },

  // question
  scroll: { padding: space.gutter, paddingBottom: 24, gap: 18 },
  question: { fontFamily: font.serif, fontSize: 21, lineHeight: 32, color: c.textPrimary, marginTop: 8, marginBottom: 6 },
  options: { gap: 11 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    borderWidth: 1.5,
  },
  optionDim: { opacity: 0.4 },
  optionText: { fontFamily: font.sansMed, fontSize: 15.5, color: c.textPrimary, flex: 1, lineHeight: 25 },

  explainCard: { backgroundColor: c.surface1, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, padding: 15, gap: 10 },
  explainText: { lineHeight: 26 },
  readLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  readLinkText: { fontFamily: font.sansBold, fontSize: 14, color: c.accent },

  // footer button
  footer: { paddingHorizontal: space.gutter, paddingTop: 8, paddingBottom: 8 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.primary,
    paddingVertical: 15,
    borderRadius: radius.full,
  },
  primaryBtnText: { color: c.bg, fontFamily: font.sansSemi, fontSize: 16 },
  secondaryBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: radius.full },
  secondaryBtnText: { color: c.accent, fontFamily: font.sansSemi, fontSize: 15.5 },

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
  scoreBig: { fontFamily: font.serif, fontSize: 44, lineHeight: 50, color: c.textPrimary },
  scoreOf: { fontFamily: font.serif, fontSize: 22, color: c.textMuted },
  resultTitle: { marginTop: 2 },
  resultSub: { textAlign: 'center', lineHeight: 22 },
  streakNote: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6, backgroundColor: 'rgba(201,189,166,0.12)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full },
  streakNoteText: { fontFamily: font.sansSemi, fontSize: 13.5, color: c.accent },
  resultBtns: { alignSelf: 'stretch', gap: 8, marginTop: 22 },
});
