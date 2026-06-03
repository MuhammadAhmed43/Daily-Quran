import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { haptic } from '@/lib/haptics';
import { getPlan, getStep, planLength, suggestedPlan } from '@/lib/plans';
import { usePlanProgress } from '@/lib/plan-progress';
import { useProfile } from '@/lib/profile';

// Home entry for "Journeys" — the day's single guided step, and the loudest call-to-action on Home.
// Position-based and never "behind": four calm states (no plan → a tasteful nudge; today's step
// waiting; already done today; whole journey finished). Surfaces only the ONE active journey.
export function TodayStepCard() {
  const router = useRouter();
  const { profile } = useProfile();
  const progress = usePlanProgress();
  const t = progress.today;

  // No active journey → a gentle "start a journey" nudge, name-dropping the track that fits this
  // person's onboarding answers (defaults to "New to the Qur'an").
  if (t.kind === 'none') {
    const suggested = getPlan(suggestedPlan(profile));
    return (
      <Pressable
        style={[styles.card, tint('#0a7ea4')]}
        onPress={() => {
          haptic.light();
          router.push('/plan');
        }}>
        <View style={[styles.iconWell, { backgroundColor: 'rgba(10,126,164,0.12)' }]}>
          <Ionicons name="compass-outline" size={24} color="#0a7ea4" />
        </View>
        <View style={styles.body}>
          <ThemedText style={styles.title}>Begin a guided journey</ThemedText>
          <ThemedText style={styles.meta} numberOfLines={1}>
            {suggested ? `Start with ${suggested.title} — short daily steps` : 'Short daily steps through the Qur’an'}
          </ThemedText>
        </View>
        <ThemedText style={styles.arrow}>›</ThemedText>
      </Pressable>
    );
  }

  const plan = getPlan(t.id);
  if (!plan) return null;
  const accent = plan.accent;
  const total = planLength(t.id);

  // Whole journey finished → quiet celebration + a door to the next one.
  if (t.kind === 'finished') {
    return (
      <Pressable
        style={[styles.card, tint(accent)]}
        onPress={() => {
          haptic.light();
          router.push('/plan');
        }}>
        <View style={[styles.iconWell, { backgroundColor: accent + '22' }]}>
          <ThemedText style={styles.emoji}>🌟</ThemedText>
        </View>
        <View style={styles.body}>
          <ThemedText style={styles.title} numberOfLines={1}>
            You completed {plan.title}
          </ThemedText>
          <ThemedText style={[styles.meta, { color: accent }]}>Start another journey →</ThemedText>
        </View>
        <ThemedText style={styles.arrow}>›</ThemedText>
      </Pressable>
    );
  }

  // Already took today's step → a warm done state, no pressure to do more.
  if (t.kind === 'done-today') {
    return (
      <Pressable
        style={[styles.card, tint(accent)]}
        onPress={() => {
          haptic.light();
          router.push({ pathname: '/plan/[id]', params: { id: t.id } });
        }}>
        <View style={[styles.iconWell, { backgroundColor: accent + '22' }]}>
          <Ionicons name="checkmark-circle" size={26} color={accent} />
        </View>
        <View style={styles.body}>
          <ThemedText style={styles.title}>You’ve taken today’s step 🌱</ThemedText>
          <ThemedText style={styles.meta}>Next step unlocks tomorrow · {plan.title}</ThemedText>
        </View>
        <ThemedText style={styles.arrow}>›</ThemedText>
      </Pressable>
    );
  }

  // Today's step is waiting.
  const step = getStep(t.id, t.order);
  if (!step) return null;
  const done = Math.max(0, t.order - 1);
  return (
    <Pressable
      style={[styles.card, tint(accent)]}
      onPress={() => {
        haptic.light();
        router.push({ pathname: '/plan/[id]/[order]', params: { id: t.id, order: String(t.order) } });
      }}>
      <View style={[styles.iconWell, { backgroundColor: accent + '22' }]}>
        <ThemedText style={styles.emoji}>{plan.emoji}</ThemedText>
      </View>
      <View style={styles.body}>
        <ThemedText style={[styles.kicker, { color: accent }]}>TODAY’S STEP</ThemedText>
        <ThemedText style={styles.title} numberOfLines={1}>
          {step.title}
        </ThemedText>
        <ThemedText style={styles.meta} numberOfLines={1}>
          {plan.title} · Step {t.order} of {total}
        </ThemedText>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${total ? (done / total) * 100 : 0}%`, backgroundColor: accent }]} />
        </View>
      </View>
      <Ionicons name="play-circle" size={30} color={accent} />
    </Pressable>
  );
}

const tint = (accent: string) => ({ backgroundColor: accent + '14', borderColor: accent + '38' });

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWell: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  body: { flex: 1, gap: 2 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13, opacity: 0.62 },
  barTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(127,127,127,0.2)',
    overflow: 'hidden',
    marginTop: 6,
  },
  barFill: { height: '100%', borderRadius: 3 },
  arrow: { fontSize: 22, opacity: 0.4 },
});
