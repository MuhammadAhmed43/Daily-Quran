import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { haptic } from '@/lib/haptics';
import { estimateMinutes, surahName } from '@/lib/quran-plan';
import { useQuranPlan } from '@/lib/quran-plan-progress';

const ACCENT = '#0a7ea4';

// Home entry for the personalized Qur'an reading plan — the flagship of the /plan hub. Four states:
// no plan (start nudge), today's portion waiting, already read today, whole plan finished.
export function QuranPlanCard() {
  const router = useRouter();
  const v = useQuranPlan();

  if (!v.plan) {
    return (
      <Pressable
        style={styles.card}
        onPress={() => {
          haptic.light();
          router.push('/reading/new');
        }}>
        <View style={styles.well}>
          <Ionicons name="book-outline" size={24} color={ACCENT} />
        </View>
        <View style={styles.body}>
          <ThemedText style={styles.title}>Read through the Qur’an</ThemedText>
          <ThemedText style={styles.meta}>A personal plan, paced to fit you</ThemedText>
        </View>
        <ThemedText style={styles.arrow}>›</ThemedText>
      </Pressable>
    );
  }

  if (v.finished) {
    return (
      <Pressable
        style={styles.card}
        onPress={() => {
          haptic.light();
          router.push('/reading');
        }}>
        <View style={styles.well}>
          <ThemedText style={styles.emoji}>🌟</ThemedText>
        </View>
        <View style={styles.body}>
          <ThemedText style={styles.title}>Qur’an plan complete</ThemedText>
          <ThemedText style={[styles.meta, { color: ACCENT }]}>Read it again, or start a new one →</ThemedText>
        </View>
        <ThemedText style={styles.arrow}>›</ThemedText>
      </Pressable>
    );
  }

  if (v.doneToday) {
    return (
      <Pressable
        style={styles.card}
        onPress={() => {
          haptic.light();
          router.push('/reading');
        }}>
        <View style={styles.well}>
          <Ionicons name="checkmark-circle" size={26} color={ACCENT} />
        </View>
        <View style={styles.body}>
          <ThemedText style={styles.title}>Today’s reading is done 🌱</ThemedText>
          <ThemedText style={styles.meta}>{Math.round(v.percent * 100)}% through · next unlocks tomorrow</ThemedText>
        </View>
        <ThemedText style={styles.arrow}>›</ThemedText>
      </Pressable>
    );
  }

  const t = v.today!;
  return (
    <Pressable
      style={styles.card}
      onPress={() => {
        haptic.light();
        router.push('/reading/portion');
      }}>
      <View style={styles.well}>
        <Ionicons name="book" size={22} color={ACCENT} />
      </View>
      <View style={styles.body}>
        <ThemedText style={styles.kicker}>TODAY’S PORTION</ThemedText>
        <ThemedText style={styles.title} numberOfLines={1}>
          {surahName(t.from.surah)} {t.from.surah}:{t.from.ayah} → {t.to.surah}:{t.to.ayah}
        </ThemedText>
        <ThemedText style={styles.meta}>
          Portion {v.portionNumber} of {v.totalPortionsCount} · ~{estimateMinutes(t.count)} min
        </ThemedText>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.round(v.percent * 100)}%` }]} />
        </View>
      </View>
      <Ionicons name="play-circle" size={30} color={ACCENT} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: ACCENT + '14',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ACCENT + '38',
  },
  well: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT + '22',
  },
  emoji: { fontSize: 22 },
  body: { flex: 1, gap: 2 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, color: ACCENT },
  title: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13, opacity: 0.62 },
  barTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(127,127,127,0.2)',
    overflow: 'hidden',
    marginTop: 6,
  },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: ACCENT },
  arrow: { fontSize: 22, opacity: 0.4 },
});
