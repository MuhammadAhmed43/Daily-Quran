import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ProgressRing } from '@/components/watch/progress-ring';
import { haptic } from '@/lib/haptics';
import { FARD, LABELS, type FardName, type PrayerName } from '@/lib/prayer';
import { usePrayerLog } from '@/lib/prayer-log';

const ACCENT = '#0a7ea4';
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const dowInitial = (key: string) => DOW[new Date(`${key}T00:00:00`).getDay()];

// Private, non-gamified prayer tracker on the Prayer tab: tap to mark each fard prayer prayed today
// (a prayer whose time hasn't arrived stays dimmed + untappable), plus a quiet last-7-days ring strip.
// Marking logs `prayer_logged`, which never feeds the streak — worship is recorded, never scored.
export function PrayerTracker({ times, now }: { times: Record<PrayerName, Date>; now: Date }) {
  const log = usePrayerLog();
  const isFriday = now.getDay() === 5;
  const labelFor = (p: FardName) => (p === 'dhuhr' && isFriday ? 'Jumuʿah' : LABELS[p]);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <ThemedText style={styles.title}>Today’s prayers</ThemedText>
        <ThemedText style={styles.count}>{log.todayCount} of 5</ThemedText>
      </View>

      <View style={styles.row}>
        {FARD.map((p) => {
          const marked = log.today[p];
          const due = now.getTime() >= times[p].getTime();
          const tappable = due || marked;
          return (
            <Pressable
              key={p}
              disabled={!tappable}
              onPress={() => {
                haptic.light();
                log.toggle(p);
              }}
              style={styles.cell}>
              <View
                style={[styles.dot, marked ? styles.dotOn : due ? styles.dotDue : styles.dotUpcoming]}>
                {marked ? <Ionicons name="checkmark" size={20} color="#fff" /> : null}
              </View>
              <ThemedText
                style={[styles.cellLabel, !tappable && styles.cellLabelDim]}
                numberOfLines={1}>
                {labelFor(p)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {log.todayCount === 5 ? (
        <ThemedText style={styles.complete}>All five today — alhamdulillah 🤲</ThemedText>
      ) : null}

      <View style={styles.strip}>
        {log.last7.map((d, i) => {
          const isToday = i === log.last7.length - 1;
          return (
            <View key={d.key} style={styles.stripDay}>
              <ProgressRing
                size={32}
                stroke={3}
                pct={d.count / 5}
                color={isToday ? ACCENT : 'rgba(10,126,164,0.45)'}>
                <ThemedText style={[styles.stripNum, isToday && styles.stripNumToday]}>
                  {d.count || ''}
                </ThemedText>
              </ProgressRing>
              <ThemedText style={[styles.stripDow, isToday && styles.stripDowToday]}>
                {dowInitial(d.key)}
              </ThemedText>
            </View>
          );
        })}
      </View>

      <ThemedText style={styles.note}>Private to you — a gentle record, never a score.</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, backgroundColor: 'rgba(127,127,127,0.06)', padding: 16, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '700' },
  count: { fontSize: 13, opacity: 0.6, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { alignItems: 'center', gap: 6, flex: 1 },
  dot: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: ACCENT },
  dotDue: { borderWidth: 2, borderColor: 'rgba(10,126,164,0.6)' },
  dotUpcoming: { borderWidth: 2, borderColor: 'rgba(127,127,127,0.25)' },
  cellLabel: { fontSize: 11.5, fontWeight: '600' },
  cellLabelDim: { opacity: 0.4 },
  complete: { fontSize: 13.5, color: ACCENT, fontWeight: '600', textAlign: 'center' },
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127,127,127,0.18)',
  },
  stripDay: { alignItems: 'center', gap: 4 },
  stripNum: { fontSize: 11, fontWeight: '700', opacity: 0.6 },
  stripNumToday: { opacity: 1, color: ACCENT },
  stripDow: { fontSize: 10, opacity: 0.45 },
  stripDowToday: { opacity: 0.9, fontWeight: '700' },
  note: { fontSize: 11.5, opacity: 0.5, textAlign: 'center', lineHeight: 16 },
});
