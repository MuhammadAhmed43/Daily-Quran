// TODAY — home tab, matched to Bible Chat's home (frames 3-5): top bar (avatar + title + gold date + flame
// streak + calendar), a 7-day week row, a "Progress today" bar, and three color-coded ACCORDION "journey"
// cards (Your Verse / Reflection / My Prayer) that tap-EXPAND to a serif body + Listen/Read.
//   IMAGERY: procedural, depiction-safe "illumination" per card (category gradient + corner light bloom +
//   a faint 8-point seal motif in SVG) instead of stock photos — $0, crisp, palette-aware, on-brand.
//   MOTION: native LayoutAnimation drives the slow, smooth expand/collapse as ONE Core Animation pass (no
//   per-frame JS = no jank); the chevron rotates on the native driver. Press-scale on every tap.
// Palette-agnostic chrome (theme tokens); the 3 cards keep fixed category tints (spec §1.3). Logic preserved
// verbatim: resolveToday/getVerse/verseText, useStreak/useWeekStreak, usePrayerLog, recitation, bookmarks,
// recordActivity. Re-skin + re-layout + motion only — no data/logic rewrite.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { Easing, LinearTransition, useAnimatedStyle, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Polygon } from 'react-native-svg';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Txt } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { useAuth } from '@/lib/auth';
import { toggleBookmark, useBookmarks } from '@/lib/bookmarks';
import { refreshDailyVerse } from '@/lib/daily-verse';
import { haptic } from '@/lib/haptics';
import { FARD, LABELS } from '@/lib/prayer';
import { usePrayerLog } from '@/lib/prayer-log';
import { usePrayerGate } from '@/lib/prayer-times';
import { useRecitation } from '@/lib/recitation-context';
import { reflectionFor, useReflectedToday, useTodayReflection } from '@/lib/reflections';
import { recordActivity, useStreak, useWeekStreak, type WeekDay } from '@/lib/streak';
import { c, font, glow, grad, radius, space, type as ty } from '@/lib/theme';
import { getVerse, resolveToday, type Verse } from '@/lib/today';
import { useTranslation, verseText } from '@/lib/translations';

// Canonical Reanimated layout-animation accordion (New-Architecture native; same mechanism as the
// @animatereactnative/accordion library). Two DECOUPLED animations: (1) the card's height eases via `layout`
// (LinearTransition) on an overflow:hidden container; (2) the body reveals as ONE BLOCK via entering/exiting
// opacity. Decoupling them is what removes the line-by-line "streaming" — the height no longer gates the text.
const DURATION = 600; // expand/collapse pace (ms); open and close are the SAME timing reversed (a true mirror)
const EASING = Easing.out(Easing.cubic);

type CardKey = 'verse' | 'reflection' | 'prayer';

// Fixed category identity (spec §1.3) — cards stay color-coded regardless of PALETTE (like Bible Chat).
// Color-theory set tuned for the achromatic ONYX base (these tints are the ONLY chroma on screen).
// SPLIT-COMPLEMENTARY: a cool contemplative pair (verse=petrol teal + reflection=indigo) answered by one
// warm devotional accent (prayer=burnt amber, kin to the champagne metal). One desaturated museum band;
// all clear WCAG-AAA for ivory text + the champagne accent.
const CARD: Record<CardKey, { tint: string; bloom: string; line: string }> = {
  verse: { tint: 'rgba(38,86,92,0.55)', bloom: 'rgba(64,132,138,0.38)', line: '#8FB7BC' }, // deep petrol teal
  reflection: { tint: 'rgba(58,64,112,0.58)', bloom: 'rgba(96,104,168,0.38)', line: '#9AA0C8' }, // deep indigo
  prayer: { tint: 'rgba(120,74,46,0.55)', bloom: 'rgba(168,110,72,0.40)', line: '#C79B7E' }, // burnt amber
};

// One 8-point seal (rub-el-hizb) polygon, computed once — the faint illumination motif behind each card.
function sealPoints(center: number, outer: number, inner: number): string {
  const pts: string[] = [];
  const step = Math.PI / 8;
  let a = -Math.PI / 2;
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? outer : inner;
    pts.push(`${(center + Math.cos(a) * r).toFixed(1)},${(center + Math.sin(a) * r).toFixed(1)}`);
    a += step;
  }
  return pts.join(' ');
}
const SEAL = sealPoints(95, 80, 53);

export default function TodayScreen() {
  useTranslation(); // re-render the verse when the translation changes
  const info = useMemo(() => resolveToday(), []);
  const verse = useMemo<Verse | null>(() => {
    for (const r of info.refs) {
      const v = getVerse(r.surah, r.ayah);
      if (v) return v;
    }
    return null;
  }, [info]);
  const streak = useStreak();
  const week = useWeekStreak();
  const prayer = usePrayerLog();

  const [open, setOpen] = useState<CardKey | null>('verse'); // verse expanded by default
  const reflected = useReflectedToday(); // true once a reflection is saved for today
  const [verseEngaged, setVerseEngaged] = useState(false);

  useEffect(() => {
    recordActivity('daily_verse'); // opening Today counts toward the streak
    void refreshDailyVerse();
  }, []);

  const prayersDone = prayer.todayCount === FARD.length;
  const done = (verseEngaged ? 1 : 0) + (reflected ? 1 : 0) + (prayersDone ? 1 : 0);
  const progress = Math.round((done / 3) * 100);

  const toggle = (k: CardKey) => {
    haptic.light();
    setOpen((cur) => (cur === k ? null : k)); // the card's LinearTransition animates the height change
  };

  return (
    <Screen stars>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TopBar hijri={info.hijri.label} streak={streak.current} />
        <WeekRow week={week} />
        <Progress pct={progress} />

        {verse ? (
          <JourneyCard variant="verse" icon="book-outline" eyebrow="Your Verse" status={verseEngaged ? 'Read' : undefined} statusDone={verseEngaged} open={open === 'verse'} onToggle={() => toggle('verse')}>
            <VerseBody verse={verse} onEngage={() => setVerseEngaged(true)} />
          </JourneyCard>
        ) : null}

        <JourneyCard variant="reflection" icon="sparkles-outline" eyebrow="Reflection" status={reflected ? 'Reflected' : undefined} statusDone={reflected} open={open === 'reflection'} onToggle={() => toggle('reflection')}>
          <ReflectionBody seed={info.gregorian.getDate()} />
        </JourneyCard>

        <JourneyCard variant="prayer" icon="moon-outline" eyebrow="My Prayer" status={`${prayer.todayCount}/${FARD.length}`} statusDone={prayer.todayCount === FARD.length} open={open === 'prayer'} onToggle={() => toggle('prayer')}>
          <PrayerBody prayer={prayer} />
        </JourneyCard>
      </ScrollView>
    </Screen>
  );
}

// ---- top bar ----
function TopBar({ hijri, streak }: { hijri: string; streak: number }) {
  const router = useRouter();
  const { user } = useAuth();
  const initial = user && !user.isAnonymous && user.name ? user.name.charAt(0).toUpperCase() : null;
  return (
    <View style={styles.topBar}>
      <PressableScale onPress={() => router.push('/profile')}>
        <LinearGradient colors={c.goldGrad} start={grad.diagStart} end={grad.diagEnd} style={styles.avatar}>
          {initial ? <Txt style={styles.avatarInitial}>{initial}</Txt> : <Ionicons name="person" size={18} color={c.bg} />}
        </LinearGradient>
      </PressableScale>
      <View style={styles.titleCol}>
        <Txt variant="h2" numberOfLines={1}>
          Today
        </Txt>
        <Txt variant="subtitle" color={c.accent} numberOfLines={1}>
          {hijri}
        </Txt>
      </View>
      <View style={styles.streakPill}>
        <Ionicons name="flame" size={14} color={c.streakFlame} />
        <Txt variant="caption" color={c.textPrimary} style={styles.streakNum}>
          {streak}
        </Txt>
      </View>
      <PressableScale onPress={() => router.push('/calendar')} style={styles.calBtn}>
        <Ionicons name="calendar-outline" size={18} color={c.textSecondary} />
      </PressableScale>
    </View>
  );
}

// ---- week row ----
function WeekRow({ week }: { week: WeekDay[] }) {
  return (
    <View style={styles.weekRow}>
      {week.map((d, i) => (
        <View key={i} style={styles.weekDay}>
          <Txt variant="caption" color={d.isToday ? c.accent : c.textMuted}>
            {d.letter}
          </Txt>
          <View
            style={[
              styles.dayCircle,
              d.done && { backgroundColor: c.surface2, borderColor: c.accent },
              d.isToday && { borderColor: c.accent, borderWidth: 2 },
              d.isFuture && { opacity: 0.4 },
            ]}>
            {d.done ? (
              <Ionicons name="flame" size={14} color={c.streakFlame} />
            ) : (
              <Txt variant="caption" color={d.isToday ? c.accent : c.textSecondary}>
                {d.dayNum}
              </Txt>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

// ---- "Progress today" (the fill glides up smoothly as completion increases) ----
function Progress({ pct }: { pct: number }) {
  const w = useSharedValue(pct);
  useEffect(() => {
    w.value = withTiming(pct, { duration: DURATION, easing: EASING });
  }, [pct, w]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${Math.max(2, w.value)}%` }));
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTop}>
        <Txt variant="caption" color={c.textSecondary} style={styles.progressLabel}>
          Progress today
        </Txt>
        <Txt variant="caption" color={c.accent} style={styles.progressPct}>
          {pct}%
        </Txt>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, fillStyle]} />
      </View>
    </View>
  );
}

// ---- procedural card illumination (gradient + corner bloom + faint seal) ----
function CardArt({ variant }: { variant: CardKey }) {
  const a = CARD[variant];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[a.bloom, 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0.4, y: 0.72 }} style={StyleSheet.absoluteFill} />
      <Svg width={190} height={190} style={styles.motif}>
        <G opacity={0.12} stroke={a.line} strokeWidth={1} fill="none">
          <Polygon points={SEAL} />
          <Circle cx={95} cy={95} r={90} />
        </G>
      </Svg>
    </View>
  );
}

// chevron rotates on the UI thread (transform only — never touches layout)
function Chevron({ open }: { open: boolean }) {
  const v = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    v.value = withTiming(open ? 1 : 0, { duration: DURATION, easing: EASING });
  }, [open, v]);
  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${v.value * 180}deg` }] }));
  return (
    <Animated.View style={st}>
      <Ionicons name="chevron-down" size={18} color={c.textSecondary} />
    </Animated.View>
  );
}

// ---- generic accordion journey card ----
function JourneyCard({
  variant,
  icon,
  eyebrow,
  status,
  statusDone,
  open,
  onToggle,
  children,
}: {
  variant: CardKey;
  icon: keyof typeof Ionicons.glyphMap;
  eyebrow: string;
  status?: string; // a meaningful per-card status (e.g. "Read", "Reflected", "3/5"); hidden if absent
  statusDone?: boolean; // true => show a gold check + accent color
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  // OFFICIAL Reanimated accordion (measured-height + useAnimatedStyle): OPEN and CLOSE are the SAME
  // withTiming(measured * open) in reverse — a true mirror. Driving height via useAnimatedStyle (NOT `layout`)
  // is what makes the clip AND its children interpolate correctly on Fabric (Reanimated #6280): the body
  // stays mounted (no detach/float/black, no two-beat lag) and the bg/art track the height (no lingering star).
  const measured = useSharedValue(0); // body's natural height, measured once
  const openSV = useSharedValue(open ? 1 : 0);
  const animate = useSharedValue(false); // first paint JUMPS to target (no mount-time ease); taps animate
  useEffect(() => {
    openSV.value = open ? 1 : 0;
  }, [open, openSV]);
  const bodyHeight = useDerivedValue(() => {
    const target = measured.value * openSV.value;
    return animate.value ? withTiming(target, { duration: DURATION, easing: EASING }) : target; // jump on first paint
  });
  const bodyStyle = useAnimatedStyle(() => {
    const full = measured.value || 1;
    const p = bodyHeight.value / full; // 0..1 open progress
    // fade the block WITH the height (faint while small) so it reveals/hides as ONE block, never line-by-line
    return { height: bodyHeight.value, opacity: Math.min(1, Math.max(0, (p - 0.08) * 1.6)) };
  });
  return (
    // OUTER: `layout` ONLY so sibling cards glide when one grows/shrinks; holds the glow (no clip => shadow shows).
    <Animated.View layout={LinearTransition.duration(DURATION).easing(EASING)} style={[styles.cardWrap, open ? glow(c.accent, 0.12, 18) : null]}>
      {/* STATIC card: bg gradient + art + header live HERE (not in the height animator), so they track the
          card's real height and never linger/flash on collapse; its overflow:hidden masks them to the radius. */}
      <View style={styles.card}>
        <LinearGradient colors={[CARD[variant].tint, c.surface1]} start={grad.diagStart} end={grad.diagEnd} style={StyleSheet.absoluteFill} />
        <CardArt variant={variant} />
        <PressableScale onPress={onToggle} style={styles.cardHeader}>
          <Ionicons name={icon} size={15} color={c.textPrimary} />
          <Txt variant="eyebrow" color={c.textPrimary}>
            {eyebrow}
          </Txt>
          {status ? (
            <View style={styles.statusGroup}>
              {statusDone ? <Ionicons name="checkmark-circle" size={13} color={c.accent} /> : <View style={styles.dot} />}
              <Txt variant="caption" color={statusDone ? c.accent : c.textSecondary} style={styles.cardStatus}>
                {status}
              </Txt>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <Chevron open={open} />
        </PressableScale>
        {/* HEIGHT ANIMATOR: overflow:hidden + animated height. The body is position:absolute inside so measuring
            it never drives this box's height (the animated value does). Open == close == same timing reversed. */}
        <Animated.View style={[styles.clip, bodyStyle]}>
          <View
            style={styles.measure}
            // Cache the body as a GPU texture so the height reveal composites a flat bitmap instead of
            // re-rendering heavy content (the Amiri Arabic in the verse card) every frame -> smooth on all cards.
            shouldRasterizeIOS
            renderToHardwareTextureAndroid
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h <= 0) return;
              const first = measured.value === 0;
              if (Math.abs(h - measured.value) > 0.5) measured.value = h; // gated: set once => no jitter
              // Enable animated open/close only AFTER the first measurement has applied (instantly), so a
              // default-open card shows fully on first paint instead of animating itself open on load.
              if (first) setTimeout(() => (animate.value = true), 60);
            }}>
            <View style={styles.cardBody}>{children}</View>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// ---- Your Verse body ----
function VerseBody({ verse, onEngage }: { verse: Verse; onEngage: () => void }) {
  const router = useRouter();
  const rec = useRecitation();
  const bookmarks = useBookmarks();
  const saved = bookmarks.some((b) => b.surah === verse.surah && b.ayah === verse.ayah);
  const isThis = rec.playing?.surah === verse.surah && rec.playing?.ayah === verse.ayah;
  const playing = isThis && !rec.paused && !rec.loading;

  const onShare = () =>
    Share.share({
      message: `${verseText(verse.surah, verse.ayah)}\n\n— Qur'an ${verse.surah}:${verse.ayah} (${verse.surahEnglish})\n\nvia Daily Qur'an`,
    });

  return (
    <>
      <Txt style={[ty.verseAr, styles.verseAr]}>{verse.ar}</Txt>
      <Txt style={ty.verseEn}>{verseText(verse.surah, verse.ayah)}</Txt>
      <Txt variant="caption" color={c.accent} style={styles.verseRef}>
        {verse.surahEnglish} · {verse.surah}:{verse.ayah}
      </Txt>
      <View style={styles.actionRow}>
        <ActionPill
          icon={playing ? 'pause' : 'headset-outline'}
          label="Listen"
          onPress={() => {
            haptic.light();
            onEngage();
            rec.toggleAyah(verse.surah, verse.ayah);
          }}
        />
        <ActionPill
          icon="book-outline"
          label="Read"
          onPress={() => {
            onEngage();
            router.push({ pathname: '/surah/[number]', params: { number: String(verse.surah), ayah: String(verse.ayah) } });
          }}
        />
      </View>
      <View style={styles.miniRow}>
        <MiniIcon name={saved ? 'bookmark' : 'bookmark-outline'} active={saved} onPress={() => toggleBookmark(verse.surah, verse.ayah)} />
        <MiniIcon name="share-outline" onPress={onShare} />
        <View style={{ flex: 1 }} />
        <MiniIcon name="sparkles" active onPress={() => router.push('/ask')} />
      </View>
    </>
  );
}

// ---- Reflection body (opens the slide-up reflection sheet; shows a preview once saved) ----
function ReflectionBody({ seed }: { seed: number }) {
  const router = useRouter();
  const saved = useTodayReflection();
  const { prompt } = reflectionFor(seed);
  const has = saved.trim().length > 0;
  return (
    <>
      <Txt variant="cardTitle" style={styles.reflectPrompt}>
        {prompt}
      </Txt>
      {has ? (
        <Txt variant="body" numberOfLines={2} style={styles.reflectPreview}>
          {saved}
        </Txt>
      ) : null}
      <View style={styles.actionRow}>
        <ActionPill
          icon={has ? 'checkmark-circle' : 'create-outline'}
          label={has ? 'Edit reflection' : 'Reflect'}
          onPress={() => router.push('/reflect')}
        />
      </View>
    </>
  );
}

// ---- My Prayer body (the 5-fard tracker; a prayer can't be marked before its time has come) ----
function PrayerBody({ prayer }: { prayer: ReturnType<typeof usePrayerLog> }) {
  const { today, todayCount, toggle } = prayer;
  const gate = usePrayerGate();
  const router = useRouter();
  return (
    <>
      <View style={styles.prayerRow}>
        {FARD.map((p) => {
          const isDone = today[p];
          const locked = !isDone && !gate.occurred[p]; // time not yet come; a done prayer stays togglable
          return (
            <PressableScale
              key={p}
              onPress={() => {
                if (!locked) toggle(p);
              }}
              style={[styles.prayerItem, locked && styles.prayerLocked]}>
              <View style={[styles.prayerDot, isDone ? { backgroundColor: c.primary, borderColor: 'transparent' } : { borderColor: c.hairline }]}>
                {isDone ? (
                  <Ionicons name="checkmark" size={14} color={c.bg} />
                ) : locked ? (
                  <Ionicons name="time-outline" size={14} color={c.textMuted} />
                ) : null}
              </View>
              <Txt variant="caption" color={isDone ? c.textPrimary : c.textMuted}>
                {LABELS[p]}
              </Txt>
            </PressableScale>
          );
        })}
      </View>
      <Txt variant="caption" color={c.textSecondary} style={styles.prayerCount}>
        {todayCount} of {FARD.length} prayers
      </Txt>
      <View style={styles.prayerLinks}>
        <PressableScale style={styles.prayerPill} onPress={() => router.push('/prayer')}>
          <Ionicons name="time-outline" size={15} color={c.accent} />
          <Txt variant="caption" color={c.accent} style={styles.prayerPillText}>
            Prayer times
          </Txt>
        </PressableScale>
        <PressableScale style={styles.prayerPill} onPress={() => router.push('/qibla')}>
          <Ionicons name="compass-outline" size={15} color={c.accent} />
          <Txt variant="caption" color={c.accent} style={styles.prayerPillText}>
            Qibla
          </Txt>
        </PressableScale>
      </View>
    </>
  );
}

// ---- small building blocks ----
function ActionPill({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={styles.pill}>
      <Ionicons name={icon} size={17} color={c.textPrimary} />
      <Txt variant="caption" color={c.textPrimary} style={styles.pillLabel}>
        {label}
      </Txt>
    </PressableScale>
  );
}

function MiniIcon({ name, active, onPress }: { name: keyof typeof Ionicons.glyphMap; active?: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={styles.miniBtn}>
      <Ionicons name={name} size={17} color={active ? c.accent : c.textSecondary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: space.gutter, paddingTop: space.sm, paddingBottom: 110, gap: space.gutter },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: space.xs },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: font.sansBold, fontSize: 17, color: c.bg },
  titleCol: { flex: 1, gap: 1 },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: c.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  streakNum: { fontFamily: font.sansBold },
  calBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: 7 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: c.hairline, alignItems: 'center', justifyContent: 'center' },

  progressWrap: { gap: 8 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontFamily: font.sansSemi, letterSpacing: 0.3 },
  progressPct: { fontFamily: font.sansBold },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: c.surface2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: c.accent },

  cardWrap: { borderRadius: radius.lg },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    backgroundColor: c.bg,
    overflow: 'hidden', // masks the bg gradient + the star seal to the rounded corner
  },
  clip: { overflow: 'hidden' }, // the height animator: its animated height clips the body
  measure: { position: 'absolute', top: 0, left: 0, right: 0 }, // body measured off-flow so it never drives the clip height
  motif: { position: 'absolute', top: -44, right: -38 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, minHeight: 58 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: c.textMuted },
  statusGroup: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardStatus: { fontFamily: font.sansSemi, letterSpacing: 0.3 },
  cardBody: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 2, gap: 12 },

  verseAr: { marginTop: 2 },
  verseRef: { letterSpacing: 0.5 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,0,0,0.30)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  pillLabel: { fontFamily: font.sansSemi, fontSize: 13 },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  miniBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.22)' },

  reflectPrompt: { lineHeight: 24 },
  reflectPreview: { marginTop: 2 },

  prayerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  prayerItem: { alignItems: 'center', gap: 8, flex: 1 },
  prayerLocked: { opacity: 0.4 },
  prayerDot: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  prayerCount: { marginTop: 4 },
  prayerLinks: { flexDirection: 'row', gap: 8, marginTop: 14 },
  prayerPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,189,166,0.3)',
    backgroundColor: 'rgba(201,189,166,0.06)',
  },
  prayerPillText: { fontFamily: font.sansSemi },
});
