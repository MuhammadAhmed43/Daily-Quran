// Streak history (onyx) — the full picture behind the Home flame: the current run, the best-ever run,
// total active days, and a month-by-month heatmap of every day a qualifying activity was logged. Pushed
// from the Home streak card. Read-only; derives entirely from the activity ledger (lib/streak).
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { IconButton, Txt } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { dayKey, useActiveDays, useStreak } from '@/lib/streak';
import { c, font, radius, space } from '@/lib/theme';

const FLAME = '#f59e0b';
const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function lastMonths(n: number): { year: number; month: number }[] {
  const now = new Date();
  const out: { year: number; month: number }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  return out; // newest first
}

export default function StreakScreen() {
  const router = useRouter();
  const s = useStreak();
  const active = useActiveDays();
  const todayKey = dayKey(new Date());

  return (
    <Screen edges={['top']} stars>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <IconButton name="chevron-back" onPress={() => router.back()} diameter={38} size={22} color={c.textPrimary} />
        <Txt variant="cardTitle">Your streak</Txt>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Ionicons name="flame" size={40} color={s.current > 0 ? FLAME : 'rgba(127,127,127,0.5)'} />
          <Txt style={styles.heroNum}>{s.current}</Txt>
          <Txt style={styles.heroLabel}>day{s.current === 1 ? '' : 's'} in a row</Txt>
          <Txt variant="caption" color={c.textMuted} style={styles.heroHint}>
            {s.todayDone ? 'Counted for today ✓' : s.current > 0 ? 'Show up today to keep it going' : 'Begin your streak today'}
          </Txt>
        </View>

        <View style={styles.statRow}>
          <Stat value={`${s.longest}`} unit={s.longest === 1 ? 'day' : 'days'} label="Longest" />
          <Stat value={`${s.totalDays}`} unit="days" label="Total active" />
          <Stat value={`${s.nextMilestone}`} unit="days" label="Next goal" />
        </View>

        <View style={styles.histHead}>
          <Txt variant="h2">History</Txt>
          <Txt variant="caption" color={c.textMuted}>
            Each gold day is one you engaged with the Qur&apos;an.
          </Txt>
        </View>

        {lastMonths(6).map((m, mi) => (
          <Animated.View key={`${m.year}-${m.month}`} entering={FadeInDown.delay(mi * 40).duration(300)} style={styles.month}>
            <Txt variant="cardTitle" style={styles.monthLabel}>
              {MONTHS[m.month]} {m.year}
            </Txt>
            <View style={styles.weekRow}>
              {WEEK.map((w, i) => (
                <Txt key={i} style={styles.weekLetter}>
                  {w}
                </Txt>
              ))}
            </View>
            <MonthGrid year={m.year} month={m.month} active={active} todayKey={todayKey} />
          </Animated.View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function Stat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statTop}>
        <Txt style={styles.statValue}>{value}</Txt>
        <Txt style={styles.statUnit}>{unit}</Txt>
      </View>
      <Txt variant="caption" color={c.textMuted} numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

function MonthGrid({ year, month, active, todayKey }: { year: number; month: number; active: Set<string>; todayKey: string }) {
  const startPad = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={styles.grid}>
      {cells.map((d, i) => {
        if (d == null) return <View key={i} style={styles.cell} />;
        const key = dayKey(new Date(year, month, d));
        const isActive = active.has(key);
        const isToday = key === todayKey;
        const isFuture = key > todayKey;
        return (
          <View key={i} style={styles.cell}>
            <View style={[styles.day, isActive && styles.dayActive, isToday && !isActive && styles.dayToday, isFuture && styles.dayFuture]}>
              <Txt style={[styles.dayNum, isActive && styles.dayNumActive, isFuture && styles.dayNumFuture]}>{d}</Txt>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.gutter, paddingBottom: 6, gap: 8 },
  spacer: { flex: 1 },
  scroll: { paddingHorizontal: space.gutter, paddingTop: space.xs, paddingBottom: space.section, gap: 18 },

  hero: { alignItems: 'center', gap: 2, paddingVertical: 14 },
  heroNum: { fontFamily: font.serif, fontSize: 56, lineHeight: 62, color: c.scriptureInk },
  heroLabel: { fontFamily: font.sansSemi, fontSize: 15, color: c.textSecondary },
  heroHint: { marginTop: 4 },

  statRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    backgroundColor: c.surface1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 3,
  },
  statTop: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statValue: { fontFamily: font.sansBold, fontSize: 22, color: c.accent },
  statUnit: { fontFamily: font.sans, fontSize: 12, color: c.textMuted },

  histHead: { gap: 2 },

  month: { gap: 6 },
  monthLabel: { color: c.scriptureInk },
  weekRow: { flexDirection: 'row' },
  weekLetter: { width: '14.2857%', textAlign: 'center', fontFamily: font.sansSemi, fontSize: 11, color: c.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', aspectRatio: 1, padding: 3 },
  day: { flex: 1, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2 },
  dayActive: { backgroundColor: c.accent },
  dayToday: { borderWidth: 1.5, borderColor: c.accentBright },
  dayFuture: { backgroundColor: 'transparent' },
  dayNum: { fontFamily: font.sans, fontSize: 11, color: c.textMuted },
  dayNumActive: { fontFamily: font.sansBold, color: c.bg },
  dayNumFuture: { color: 'rgba(255,255,255,0.12)' },
});
