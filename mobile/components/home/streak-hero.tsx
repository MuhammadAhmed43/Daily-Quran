import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useStreak } from '@/lib/streak';

const FLAME = '#f59e0b';

/** The streak hero — the emotional anchor of Home. Flame + day count + the next milestone to aim
 *  for. Reads the activity ledger, so it fills the instant any qualifying action is logged. */
export function StreakHero() {
  const s = useStreak();
  const toGo = Math.max(0, s.nextMilestone - s.current);
  const lit = s.current > 0;
  return (
    <View style={styles.card}>
      <View style={styles.flameWrap}>
        <Ionicons name="flame" size={28} color={lit ? FLAME : 'rgba(127,127,127,0.5)'} />
      </View>
      <View style={styles.mid}>
        <ThemedText style={styles.count}>
          {s.current}{' '}
          <ThemedText style={styles.countLabel}>day{s.current === 1 ? '' : 's'}</ThemedText>
        </ThemedText>
        <ThemedText style={styles.sub}>
          {s.todayDone
            ? 'You’ve shown up today ✓'
            : lit
              ? 'Reflect today to keep your streak'
              : 'Begin your streak today'}
        </ThemedText>
      </View>
      {lit && toGo > 0 ? (
        <View style={styles.milestone}>
          <ThemedText style={styles.mlNum}>{toGo}</ThemedText>
          <ThemedText style={styles.mlLabel}>to {s.nextMilestone}</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  flameWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,158,11,0.12)',
  },
  mid: { flex: 1, gap: 2 },
  count: { fontSize: 26, fontWeight: '800', lineHeight: 30 },
  countLabel: { fontSize: 15, fontWeight: '600', opacity: 0.6 },
  sub: { fontSize: 13, opacity: 0.7 },
  milestone: { alignItems: 'center', minWidth: 40 },
  mlNum: { fontSize: 18, fontWeight: '800', color: FLAME, lineHeight: 22 },
  mlLabel: { fontSize: 11, opacity: 0.6 },
});
