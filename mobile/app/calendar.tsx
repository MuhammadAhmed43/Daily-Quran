// Holy Calendar (onyx, Bible Chat frames 25-27) — a scrollable HIJRI month grid of the Islamic holy days.
// Each cell is a day-circle; sacred / historic days are filled champagne, recurring sunnah days carry a
// dot, today is ringed. Tapping a day slides up its significance (badge + title + meaning + the verse to
// read). The whole thing is driven by the existing date engine (lib/today: resolveToday works for ANY
// date) + hijri-converter (Hijri <-> Gregorian), so there is no new content to vet.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { toGregorian, toHijri } from 'hijri-converter';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { haptic } from '@/lib/haptics';
import { c, font, radius, space } from '@/lib/theme';
import { HIJRI_MONTHS, resolveToday, type DayKind, type TodayInfo } from '@/lib/today';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const GMONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type DayCell = { d: number; greg: Date; info: TodayInfo; isToday: boolean };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const isMajor = (k: DayKind) => k === 'sacred' || k === 'history';

export default function HolyCalendar() {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const todayH = useMemo(() => toHijri(now.getFullYear(), now.getMonth() + 1, now.getDate()), [now]);
  const [cur, setCur] = useState({ hy: todayH.hy, hm: todayH.hm });
  const [sel, setSel] = useState<DayCell | null>(null);

  // Build the Hijri month: the weekday its 1st falls on, its length (29/30), and every day resolved.
  const month = useMemo(() => {
    const { hy, hm } = cur;
    const g1 = toGregorian(hy, hm, 1);
    const first = new Date(g1.gy, g1.gm - 1, g1.gd);
    const next = hm === 12 ? toGregorian(hy + 1, 1, 1) : toGregorian(hy, hm + 1, 1);
    const firstNext = new Date(next.gy, next.gm - 1, next.gd);
    const len = Math.round((firstNext.getTime() - first.getTime()) / 86_400_000);
    const days: DayCell[] = [];
    for (let d = 1; d <= len; d++) {
      const g = toGregorian(hy, hm, d);
      const greg = new Date(g.gy, g.gm - 1, g.gd);
      days.push({ d, greg, info: resolveToday(greg), isToday: sameDay(greg, now) });
    }
    return { offset: first.getDay(), days, first, last: days[days.length - 1].greg };
  }, [cur, now]);

  const cells: (DayCell | null)[] = [...Array(month.offset).fill(null), ...month.days];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (DayCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const monthLabel = `${HIJRI_MONTHS[cur.hm - 1]} ${cur.hy} AH`;
  const gregLabel =
    month.first.getMonth() === month.last.getMonth()
      ? `${GMONTHS[month.first.getMonth()]} ${month.first.getFullYear()}`
      : `${GMONTHS[month.first.getMonth()]} – ${GMONTHS[month.last.getMonth()]} ${month.last.getFullYear()}`;

  const go = (dir: -1 | 1) => {
    haptic.light();
    setSel(null);
    setCur((p) => {
      let hm = p.hm + dir;
      let hy = p.hy;
      if (hm < 1) { hm = 12; hy -= 1; }
      if (hm > 12) { hm = 1; hy += 1; }
      return { hy, hm };
    });
  };

  const pick = (day: DayCell) => {
    haptic.light();
    setSel((s) => (s && sameDay(s.greg, day.greg) ? null : day));
  };

  return (
    <Screen stars>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <IconButton name="chevron-back" onPress={() => router.back()} diameter={38} size={22} color={c.textPrimary} />
        <Txt variant="cardTitle">Holy Calendar</Txt>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Month switcher */}
        <View style={styles.monthBar}>
          <IconButton name="chevron-back" onPress={() => go(-1)} diameter={34} size={18} color={c.textSecondary} />
          <View style={styles.monthLabels}>
            <Txt variant="h2" style={styles.center}>
              {monthLabel}
            </Txt>
            <Txt variant="caption" color={c.accent} style={styles.center}>
              {gregLabel}
            </Txt>
          </View>
          <IconButton name="chevron-forward" onPress={() => go(1)} diameter={34} size={18} color={c.textSecondary} />
        </View>

        {/* Weekday header */}
        <View style={styles.weekRow}>
          {WEEKDAYS.map((w) => (
            <Txt key={w} variant="eyebrow" color={c.textMuted} style={styles.weekHead}>
              {w}
            </Txt>
          ))}
        </View>

        {/* Grid */}
        <Animated.View key={monthLabel} entering={FadeIn.duration(260)} style={styles.grid}>
          {rows.map((row, ri) => (
            <Animated.View key={ri} entering={FadeInDown.delay(ri * 35).duration(240)} style={styles.dayRow}>
              {row.map((day, ci) =>
                day ? (
                  <PressableScale key={ci} style={styles.cell} onPress={() => pick(day)}>
                    <View
                      style={[
                        styles.circle,
                        isMajor(day.info.kind) && styles.circleMajor,
                        sel && sameDay(sel.greg, day.greg) && styles.circleSel,
                        day.isToday && styles.circleToday,
                      ]}>
                      <Txt style={[styles.dayNum, isMajor(day.info.kind) && styles.dayNumMajor]}>{day.d}</Txt>
                    </View>
                    {day.info.kind === 'weekly' ? <View style={styles.dot} /> : null}
                  </PressableScale>
                ) : (
                  <View key={ci} style={styles.cell} />
                ),
              )}
            </Animated.View>
          ))}
        </Animated.View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: c.accent }]} />
            <Txt variant="caption" color={c.textMuted}>
              Sacred / historic
            </Txt>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendSmall} />
            <Txt variant="caption" color={c.textMuted}>
              Sunnah fast / Jumuʿah
            </Txt>
          </View>
        </View>

        {/* Selected day detail */}
        {sel ? (
          <Animated.View key={sel.greg.toISOString()} entering={FadeInDown.duration(280)}>
            <PressableScale
              style={styles.detail}
              onPress={() => {
                const r = sel.info.refs[0];
                if (!r) return;
                haptic.light();
                router.push({ pathname: '/surah/[number]', params: { number: String(r.surah), ayah: String(r.ayah) } });
              }}>
              <View style={styles.detailHead}>
                <Txt variant="eyebrow" color={c.accent}>
                  {sel.info.badge}
                </Txt>
                <Txt variant="caption" color={c.textMuted}>
                  {sel.d} {HIJRI_MONTHS[cur.hm - 1]} · {GMONTHS[sel.greg.getMonth()]} {sel.greg.getDate()}
                </Txt>
              </View>
              <Txt variant="h2" style={styles.detailTitle}>
                {sel.info.title}
              </Txt>
              <Txt variant="body" color={c.textSecondary} style={styles.detailBody}>
                {sel.info.significance}
              </Txt>
              {sel.info.caveat ? (
                <Txt variant="caption" color={c.textMuted} style={styles.caveat}>
                  {sel.info.caveat}
                </Txt>
              ) : null}
              {sel.info.refs[0] ? (
                <View style={styles.readRow}>
                  <Txt variant="caption" color={c.accent} style={styles.readText}>
                    Read the verse
                  </Txt>
                  <Ionicons name="arrow-forward" size={15} color={c.accent} />
                </View>
              ) : null}
            </PressableScale>
          </Animated.View>
        ) : (
          <Txt variant="caption" color={c.textMuted} style={styles.hint}>
            Tap any day to see its place in the Islamic year.
          </Txt>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: space.sm },
  spacer: { width: 38 },
  scroll: { paddingHorizontal: space.gutter, paddingBottom: space.section, gap: 14 },
  center: { textAlign: 'center' },

  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthLabels: { flex: 1, alignItems: 'center', gap: 2 },

  weekRow: { flexDirection: 'row' },
  weekHead: { flex: 1, textAlign: 'center', letterSpacing: 0.6 },

  grid: { gap: 6 },
  dayRow: { flexDirection: 'row' },
  cell: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    backgroundColor: c.surface1,
  },
  circleMajor: { backgroundColor: c.accent, borderColor: c.accent },
  circleSel: { borderColor: c.accentBright, borderWidth: 1.5 },
  circleToday: { borderColor: c.primary, borderWidth: 2 },
  dayNum: { fontFamily: font.sansSemi, fontSize: 13.5, color: c.textSecondary },
  dayNumMajor: { color: c.bg, fontFamily: font.sansBold },
  dot: { position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: c.accent },

  legend: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendSmall: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.accent },

  detail: { padding: space.card, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(201,189,166,0.28)', backgroundColor: 'rgba(201,189,166,0.07)', gap: 8 },
  detailHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailTitle: { lineHeight: 26 },
  detailBody: { lineHeight: 23 },
  caveat: { fontStyle: 'italic', lineHeight: 16 },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  readText: { fontFamily: font.sansBold },

  hint: { textAlign: 'center', marginTop: 4 },
});
