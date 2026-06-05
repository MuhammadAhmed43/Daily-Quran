import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Txt } from '@/components/ui/primitives';
import { ProgressRing } from '@/components/watch/progress-ring';
import { haptic } from '@/lib/haptics';
import { FARD, LABELS, type FardName, type PrayerName } from '@/lib/prayer';
import { usePrayerLog } from '@/lib/prayer-log';
import { c, font, radius } from '@/lib/theme';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const dowInitial = (key: string) => DOW[new Date(`${key}T00:00:00`).getDay()];

// Private, non-gamified prayer tracker on the Prayer tab: tap to mark each fard prayer prayed today
// (a prayer whose time hasn't arrived stays dimmed + untappable), plus a quiet last-7-days ring strip.
// Marking logs `prayer_logged`, which never feeds the streak — worship is recorded, never scored.
// Onyx reskin only; all logic preserved.
export function PrayerTracker({ times, now }: { times: Record<PrayerName, Date>; now: Date }) {
  const log = usePrayerLog();
  const isFriday = now.getDay() === 5;
  const labelFor = (p: FardName) => (p === 'dhuhr' && isFriday ? 'Jumuʿah' : LABELS[p]);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Txt variant="cardTitle">Today’s prayers</Txt>
        <Txt variant="caption" color={c.textMuted} style={styles.count}>
          {log.todayCount} of 5
        </Txt>
      </View>

      <View style={styles.row}>
        {FARD.map((p) => {
          const marked = log.today[p];
          const due = now.getTime() >= times[p].getTime();
          const tappable = due || marked;
          return (
            <PressableScale
              key={p}
              disabled={!tappable}
              onPress={() => {
                haptic.light();
                log.toggle(p);
              }}
              style={styles.cell}>
              <View style={[styles.dot, marked ? styles.dotOn : due ? styles.dotDue : styles.dotUpcoming]}>
                {marked ? <Ionicons name="checkmark" size={20} color={c.bg} /> : null}
              </View>
              <Txt variant="caption" color={c.textSecondary} style={[styles.cellLabel, !tappable && styles.cellLabelDim]} numberOfLines={1}>
                {labelFor(p)}
              </Txt>
            </PressableScale>
          );
        })}
      </View>

      {log.todayCount === 5 ? <Txt style={styles.complete}>All five today — alhamdulillah</Txt> : null}

      <View style={styles.strip}>
        {log.last7.map((d, i) => {
          const isToday = i === log.last7.length - 1;
          return (
            <View key={d.key} style={styles.stripDay}>
              <ProgressRing size={32} stroke={3} pct={d.count / 5} color={isToday ? c.accent : 'rgba(201,189,166,0.4)'}>
                <Txt style={[styles.stripNum, isToday && styles.stripNumToday]}>{d.count || ''}</Txt>
              </ProgressRing>
              <Txt style={[styles.stripDow, isToday && styles.stripDowToday]}>{dowInitial(d.key)}</Txt>
            </View>
          );
        })}
      </View>

      <Txt variant="caption" color={c.textMuted} style={styles.note}>
        Private to you — a gentle record, never a score.
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, backgroundColor: c.surface1, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, padding: 16, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  cell: { alignItems: 'center', gap: 6, flex: 1 },
  dot: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: c.accent },
  dotDue: { borderWidth: 2, borderColor: 'rgba(201,189,166,0.55)' },
  dotUpcoming: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.14)' },
  cellLabel: { fontSize: 11.5, fontFamily: font.sansSemi },
  cellLabelDim: { opacity: 0.4 },
  complete: { fontSize: 13.5, color: c.accent, fontFamily: font.sansSemi, textAlign: 'center' },
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.hairline,
  },
  stripDay: { alignItems: 'center', gap: 4 },
  stripNum: { fontSize: 11, fontFamily: font.sansBold, color: c.textMuted },
  stripNumToday: { color: c.accent },
  stripDow: { fontSize: 10, color: c.textMuted, fontFamily: font.sansMed },
  stripDowToday: { color: c.textSecondary, fontFamily: font.sansBold },
  note: { textAlign: 'center', lineHeight: 16 },
});
