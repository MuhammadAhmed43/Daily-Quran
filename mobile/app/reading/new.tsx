import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { haptic } from '@/lib/haptics';
import { SURAHS } from '@/lib/quran';
import {
  avgPerDay,
  corpusLabel,
  estimateMinutes,
  JUZ_AMMA,
  PACES,
  surahName,
  WHOLE,
  type Corpus,
} from '@/lib/quran-plan';
import { createPlan, useQuranPlan } from '@/lib/quran-plan-progress';
import { useProfile } from '@/lib/profile';

const ACCENT = '#0a7ea4';
type GoalKind = 'whole' | 'juz-amma' | 'custom';

export default function NewQuranPlan() {
  const router = useRouter();
  const { profile } = useProfile();
  const existing = useQuranPlan().plan;
  const [goal, setGoal] = useState<GoalKind>('whole');
  const [fromS, setFromS] = useState(1);
  const [toS, setToS] = useState(114);
  const [days, setDays] = useState(120); // default: 4 months
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);

  const corpus: Corpus =
    goal === 'whole'
      ? WHOLE
      : goal === 'juz-amma'
        ? JUZ_AMMA
        : { fromSurah: Math.min(fromS, toS), toSurah: Math.max(fromS, toS) };

  const perDay = avgPerDay(corpus, days);
  const mins = estimateMinutes(perDay);
  const overBudget = mins > profile.dailyMinutes * 1.6;

  const start = () => {
    haptic.success();
    createPlan(corpus, days);
    router.replace('/reading');
  };

  const GOALS: { id: GoalKind; title: string; sub: string }[] = [
    { id: 'whole', title: 'The whole Qur’an', sub: 'All 114 surahs, beginning to end' },
    { id: 'juz-amma', title: 'Juz ʿAmma', sub: 'The 30th juz — An-Naba to An-Nas' },
    { id: 'custom', title: 'A custom range', sub: 'Pick the surahs to read' },
  ];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'New plan', headerBackTitle: 'Back' }} />
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {existing ? (
            <View style={styles.replaceNote}>
              <Ionicons name="information-circle-outline" size={16} color={ACCENT} />
              <ThemedText style={styles.replaceText}>
                Starting a new plan replaces your current one ({corpusLabel(existing.corpus)}).
              </ThemedText>
            </View>
          ) : null}

          <ThemedText style={styles.section}>What would you like to read?</ThemedText>
          {GOALS.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => {
                haptic.light();
                setGoal(g.id);
              }}
              style={[styles.card, goal === g.id && styles.cardOn]}>
              <View style={styles.radio}>{goal === g.id ? <View style={styles.radioDot} /> : null}</View>
              <View style={styles.cardBody}>
                <ThemedText style={styles.cardTitle}>{g.title}</ThemedText>
                <ThemedText style={styles.cardSub}>{g.sub}</ThemedText>
              </View>
            </Pressable>
          ))}

          {goal === 'custom' ? (
            <View style={styles.rangeRow}>
              <Pressable style={styles.rangePick} onPress={() => setPicking('from')}>
                <ThemedText style={styles.rangeLabel}>FROM</ThemedText>
                <ThemedText style={styles.rangeVal} numberOfLines={1}>
                  {surahName(fromS)}
                </ThemedText>
              </Pressable>
              <Ionicons name="arrow-forward" size={16} color="rgba(127,127,127,0.6)" />
              <Pressable style={styles.rangePick} onPress={() => setPicking('to')}>
                <ThemedText style={styles.rangeLabel}>TO</ThemedText>
                <ThemedText style={styles.rangeVal} numberOfLines={1}>
                  {surahName(toS)}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          <ThemedText style={[styles.section, styles.sectionGap]}>Your pace</ThemedText>
          {PACES.map((p) => {
            const pd = avgPerDay(corpus, p.days);
            const on = days === p.days;
            return (
              <Pressable
                key={p.id}
                onPress={() => {
                  haptic.light();
                  setDays(p.days);
                }}
                style={[styles.card, on && styles.cardOn]}>
                <View style={styles.radio}>{on ? <View style={styles.radioDot} /> : null}</View>
                <View style={styles.cardBody}>
                  <ThemedText style={styles.cardTitle}>{p.label}</ThemedText>
                  <ThemedText style={styles.cardSub}>
                    ~{pd} ayahs/day · about {estimateMinutes(pd)} min
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}

          {overBudget ? (
            <ThemedText style={styles.budgetNote}>
              That’s more than your usual {profile.dailyMinutes} min/day — a slower pace might be easier
              to keep. Totally your call.
            </ThemedText>
          ) : null}

          <View style={styles.summary}>
            <ThemedText style={styles.summaryText}>
              {corpusLabel(corpus)} · ~{perDay} ayahs a day · about {mins} min
            </ThemedText>
          </View>

          <Pressable style={styles.startBtn} onPress={start}>
            <Ionicons name="book-outline" size={18} color="#fff" />
            <ThemedText style={styles.startText}>Start reading plan</ThemedText>
          </Pressable>

          <ThemedText style={styles.disclaimer}>
            Read at your own pace — miss a day and the plan simply waits. You can change the pace
            anytime.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={picking !== null} animationType="slide" transparent onRequestClose={() => setPicking(null)}>
        <Pressable style={styles.modalScrim} onPress={() => setPicking(null)}>
          <ThemedView style={styles.modalSheet}>
            <View style={styles.modalHead}>
              <ThemedText style={styles.modalTitle}>{picking === 'from' ? 'Start from' : 'End at'}</ThemedText>
              <Pressable onPress={() => setPicking(null)} hitSlop={10}>
                <Ionicons name="close" size={22} color={ACCENT} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {SURAHS.map((s) => (
                <Pressable
                  key={s.number}
                  style={styles.surahRow}
                  onPress={() => {
                    haptic.light();
                    if (picking === 'from') setFromS(s.number);
                    else setToS(s.number);
                    setPicking(null);
                  }}>
                  <ThemedText style={styles.surahNum}>{s.number}</ThemedText>
                  <View style={styles.surahBody}>
                    <ThemedText style={styles.surahName}>{s.englishName}</ThemedText>
                    <ThemedText style={styles.surahMeta}>
                      {s.englishNameTranslation} · {s.numberOfAyahs} ayahs
                    </ThemedText>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </ThemedView>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40, gap: 10 },
  replaceNote: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(10,126,164,0.08)',
  },
  replaceText: { flex: 1, fontSize: 13, opacity: 0.8, lineHeight: 18 },
  section: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
  sectionGap: { marginTop: 14 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
  },
  cardOn: { borderColor: ACCENT, backgroundColor: 'rgba(10,126,164,0.08)' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: ACCENT },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSub: { fontSize: 13, opacity: 0.62 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  rangePick: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT + '55',
    backgroundColor: 'rgba(10,126,164,0.06)',
    gap: 2,
  },
  rangeLabel: { fontSize: 10, fontWeight: '800', color: ACCENT, letterSpacing: 0.5 },
  rangeVal: { fontSize: 15, fontWeight: '700' },
  budgetNote: { fontSize: 13, lineHeight: 19, opacity: 0.7, fontStyle: 'italic', paddingHorizontal: 2 },
  summary: {
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(10,126,164,0.10)',
    alignItems: 'center',
  },
  summaryText: { fontSize: 14.5, fontWeight: '700', color: ACCENT, textAlign: 'center' },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 4,
  },
  startText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disclaimer: { fontSize: 11.5, opacity: 0.5, lineHeight: 17, textAlign: 'center', marginTop: 2 },
  modalScrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { maxHeight: '76%', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  modalTitle: { fontSize: 17, fontWeight: '800' },
  surahRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.15)',
  },
  surahNum: { width: 28, fontSize: 14, fontWeight: '700', color: ACCENT, textAlign: 'center' },
  surahBody: { flex: 1 },
  surahName: { fontSize: 15, fontWeight: '600' },
  surahMeta: { fontSize: 12.5, opacity: 0.55 },
});
