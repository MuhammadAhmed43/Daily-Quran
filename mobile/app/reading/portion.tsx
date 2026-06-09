// Today's-portion reader (onyx, frame-28 style). Serif reading: a portion header, a Listen pill that
// recites the whole portion, champagne verse cards (Uthmani Arabic + translation, tap any to explain) that
// follow + highlight + auto-scroll with the recitation, an ivory Mark-complete, and a completion reveal.
// Re-skin only: the scroll-follow refs, narrate playlist, completePortion, streak credit, audio hand-off
// (fadeStop), and ExplainSheet are all unchanged.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { SealMedallion } from '@/components/atlas-tile';
import { ExplainSheet, type ExplainTarget } from '@/components/explain-sheet';
import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { haptic } from '@/lib/haptics';
import { getAyah } from '@/lib/quran';
import { corpusAyahs, corpusLength, estimateMinutes, surahName, type Corpus } from '@/lib/quran-plan';
import { useQuranPlan } from '@/lib/quran-plan-progress';
import { useRecitation } from '@/lib/recitation-context';
import { getSurahIntro } from '@/lib/surah-intro';
import { recordActivity } from '@/lib/streak';
import { c, font, radius, space } from '@/lib/theme';
import { useTranslation, verseText } from '@/lib/translations';

export default function PortionScreen() {
  const router = useRouter();
  const rec = useRecitation();
  const { plan, today, finished, portionNumber, totalPortionsCount, completePortion } = useQuranPlan();
  const [explainTarget, setExplainTarget] = useState<ExplainTarget | null>(null);
  const [completed, setCompleted] = useState<null | { wasLast: boolean; percentAfter: number }>(null);
  const ownsAudioRef = useRef(false);
  ownsAudioRef.current = rec.queued; // the portion screen's only audio is its "narrate portion" playlist
  const onExplain = useCallback((t: ExplainTarget) => setExplainTarget(t), []);

  // Follow the recitation like the surah reader: highlight the recited ayah and keep it on screen.
  // Positions keyed by surah*1000+ayah because a portion can span surahs.
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<number, number>>({});
  const pendingScrollRef = useRef<number | null>(null);
  const playingKey = rec.playing ? rec.playing.surah * 1000 + rec.playing.ayah : null;

  const onAyahLayout = useCallback((key: number, y: number) => {
    positions.current[key] = y;
    if (pendingScrollRef.current === key) {
      pendingScrollRef.current = null;
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 100), animated: true }));
    }
  }, []);

  useEffect(() => {
    if (playingKey == null) return;
    const y = positions.current[playingKey];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 100), animated: true });
    else pendingScrollRef.current = playingKey;
  }, [playingKey]);

  // Fade narration out smoothly if we leave while it's still playing.
  useEffect(() => {
    return () => {
      if (ownsAudioRef.current) rec.fadeStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fadeIfMine = () => {
    if (ownsAudioRef.current) rec.fadeStop();
  };

  // Pop back to the plan dashboard we came from instead of pushing a duplicate /reading the user then has
  // to back through. Falls back to a replace only if there is nothing to pop to.
  const backToPlan = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/reading');
  };

  const header = (
    <View style={styles.header}>
      <IconButton name="chevron-back" onPress={() => router.back()} diameter={38} size={22} color={c.textPrimary} />
      <Txt variant="cardTitle">{plan && !finished && today ? `Portion ${portionNumber}` : 'Reading'}</Txt>
      <View style={styles.spacer} />
    </View>
  );

  if (!plan) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View style={styles.center}>
          <Txt variant="body" color={c.textMuted}>
            You don&apos;t have an active plan.
          </Txt>
          <PressableScale onPress={() => router.replace('/reading/new')} hitSlop={10}>
            <Txt variant="body" color={c.accent} style={styles.link}>
              Start one ›
            </Txt>
          </PressableScale>
        </View>
      </Screen>
    );
  }

  // Completion reveal (shown right after marking complete, before swapping to the next portion).
  if (completed) {
    return (
      <Screen stars>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <Animated.View entering={FadeInDown.duration(520)} style={styles.doneWrap}>
            <SealMedallion name={completed.wasLast ? 'star-four-points' : 'sprout-outline'} frame={76} ring={54} glyph={32} glowStrength={0.3} />
            <Txt variant="h1" style={styles.centerText}>
              {completed.wasLast ? 'You read it through' : 'Portion complete'}
            </Txt>
            <Txt variant="body" color={c.textSecondary} style={styles.doneText}>
              {completed.wasLast
                ? 'You read it through to the end, at your own pace. May it stay with you.'
                : `${Math.round(completed.percentAfter * 100)}% of the way through. See you tomorrow — or keep going.`}
            </Txt>
            {completed.wasLast ? (
              <PressableScale
                style={styles.cta}
                onPress={() => {
                  haptic.light();
                  backToPlan();
                }}>
                <Txt style={styles.ctaText}>View my plan</Txt>
              </PressableScale>
            ) : (
              <>
                <PressableScale
                  style={styles.cta}
                  onPress={() => {
                    haptic.light();
                    fadeIfMine();
                    setCompleted(null); // reveal the next portion in place
                  }}>
                  <Txt style={styles.ctaText}>Continue reading</Txt>
                </PressableScale>
                <PressableScale
                  style={styles.ghost}
                  onPress={() => {
                    haptic.light();
                    fadeIfMine();
                    router.back();
                  }}>
                  <Txt variant="body" color={c.accent} style={styles.ghostText}>
                    Done for today
                  </Txt>
                </PressableScale>
              </>
            )}
          </Animated.View>
        </View>
      </Screen>
    );
  }

  if (finished || !today) {
    return (
      <Screen stars>
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View style={styles.center}>
          <SealMedallion name="star-four-points" frame={70} ring={50} glyph={30} glowStrength={0.26} />
          <Txt variant="body" color={c.textSecondary} style={styles.centerText}>
            You&apos;ve finished this plan.
          </Txt>
          <PressableScale onPress={backToPlan} hitSlop={10}>
            <Txt variant="body" color={c.accent} style={styles.link}>
              View my plan ›
            </Txt>
          </PressableScale>
        </View>
      </Screen>
    );
  }

  const refs = corpusAyahs(plan.corpus).slice(today.startIdx, today.endIdx);

  const complete = () => {
    haptic.success();
    const wasLast = today.endIdx >= corpusLength(plan.corpus);
    completePortion();
    recordActivity('study_step');
    setCompleted({ wasLast, percentAfter: today.endIdx / corpusLength(plan.corpus) });
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      {header}
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(420)}>
          <Txt variant="eyebrow" color={c.accent}>
            PORTION {portionNumber} OF {totalPortionsCount}
          </Txt>
          <Txt variant="h1" style={styles.range}>
            {surahName(today.from.surah)} {today.from.surah}:{today.from.ayah} → {today.to.surah}:{today.to.ayah}
          </Txt>
          <Txt variant="caption" color={c.textSecondary} style={styles.meta}>
            {today.count} ayahs · about {estimateMinutes(today.count)} min
          </Txt>
        </Animated.View>

        <PressableScale
          style={styles.listen}
          onPress={() => {
            haptic.light();
            if (rec.queued) rec.stop();
            else rec.playList(refs);
          }}>
          <Ionicons name={rec.queued ? 'stop' : 'headset-outline'} size={16} color={c.accent} />
          <Txt variant="caption" color={c.accent} style={styles.listenText}>
            {rec.queued ? 'Stop recitation' : 'Recite this portion'}
          </Txt>
        </PressableScale>

        <PortionAyahs
          corpus={plan.corpus}
          startIdx={today.startIdx}
          endIdx={today.endIdx}
          playingKey={playingKey}
          onExplain={onExplain}
          onLayout={onAyahLayout}
        />

        <PressableScale style={styles.cta} onPress={complete}>
          <Ionicons name="checkmark-circle" size={19} color={c.bg} />
          <Txt style={styles.ctaText}>Mark portion complete</Txt>
        </PressableScale>

        <Txt variant="caption" color={c.textMuted} style={styles.disclaimer}>
          Read with your heart, not the clock — understanding on tap, never a test.
        </Txt>
      </ScrollView>

      <ExplainSheet target={explainTarget} onClose={() => setExplainTarget(null)} />
    </Screen>
  );
}

// The portion's ayah rows, isolated + memoized: opening/closing the ExplainSheet or marking complete
// re-renders the parent but never re-reconciles these (up to ~200 AmiriQuran rows on a Ramadan pace).
// They DO re-render as recitation advances (playingKey changes) so the recited ayah highlights + scrolls.
const PortionAyahs = memo(function PortionAyahs({
  corpus,
  startIdx,
  endIdx,
  playingKey,
  onExplain,
  onLayout,
}: {
  corpus: Corpus;
  startIdx: number;
  endIdx: number;
  playingKey: number | null;
  onExplain: (t: ExplainTarget) => void;
  onLayout: (key: number, y: number) => void;
}) {
  useTranslation(); // re-render this memoized block when the translation changes
  const refs = corpusAyahs(corpus).slice(startIdx, endIdx);
  const rows: { surah: number; ayah: number; header: boolean }[] = [];
  let prev = -1;
  for (const r of refs) {
    rows.push({ surah: r.surah, ayah: r.ayah, header: r.surah !== prev });
    prev = r.surah;
  }
  return (
    <View style={styles.ayahList}>
      {rows.map((row, i) => {
        const a = getAyah(row.surah, row.ayah);
        if (!a) return null;
        const intro = row.header ? getSurahIntro(row.surah) : undefined;
        const key = row.surah * 1000 + row.ayah;
        const isPlaying = playingKey === key;
        return (
          <View key={`${row.surah}:${row.ayah}`} onLayout={(e) => onLayout(key, e.nativeEvent.layout.y)}>
            {row.header ? (
              <View style={styles.surahHead}>
                <Txt variant="h2" color={c.accent} style={styles.surahHeadName}>
                  {surahName(row.surah)}
                </Txt>
                {intro ? (
                  <Txt variant="caption" color={c.textSecondary} style={styles.surahHeadIntro}>
                    {intro.summary}
                  </Txt>
                ) : null}
              </View>
            ) : null}
            <PressableScale
              style={[styles.ayah, isPlaying && styles.ayahPlaying]}
              onPress={() => onExplain({ surah: row.surah, ayah: row.ayah, name: surahName(row.surah), ar: a.ar, en: verseText(row.surah, row.ayah) })}>
              <View style={styles.ayahHead}>
                <Txt variant="caption" color={c.accent} style={styles.ayahRef}>
                  {row.surah}:{row.ayah}
                </Txt>
                {i === 0 ? (
                  <Txt variant="caption" color={c.textMuted} style={styles.tapHint}>
                    tap any ayah to explain
                  </Txt>
                ) : null}
              </View>
              <Txt style={styles.ar}>{a.ar}</Txt>
              <Txt style={styles.en}>{verseText(row.surah, row.ayah)}</Txt>
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: space.sm },
  spacer: { width: 38 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: space.section },
  centerText: { textAlign: 'center' },
  link: { fontFamily: font.sansSemi },

  scroll: { paddingHorizontal: space.gutter, paddingBottom: 44, gap: 12 },
  range: { lineHeight: 30, marginTop: 6 },
  meta: { marginTop: 3 },

  listen: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    backgroundColor: 'rgba(201,189,166,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,189,166,0.3)',
  },
  listenText: { fontFamily: font.sansSemi },

  ayahList: { gap: 10 },
  surahHead: { marginTop: 12, marginBottom: 2, gap: 4, paddingHorizontal: 2 },
  surahHeadName: {},
  surahHeadIntro: { lineHeight: 19 },
  ayah: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 9,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    backgroundColor: c.surface1,
  },
  ayahPlaying: { borderColor: 'rgba(201,189,166,0.5)', backgroundColor: 'rgba(201,189,166,0.1)' },
  ayahHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ayahRef: { fontFamily: font.sansSemi },
  tapHint: { fontStyle: 'italic' },
  ar: { fontFamily: 'AmiriQuran', fontSize: 23, lineHeight: 48, textAlign: 'right', writingDirection: 'rtl', color: c.scriptureInk },
  en: { fontFamily: font.serifReg, fontSize: 15.5, lineHeight: 24, color: c.textSecondary },

  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.primary, paddingVertical: 15, borderRadius: radius.full, marginTop: 8 },
  ctaText: { fontFamily: font.sansBold, fontSize: 15.5, color: c.bg },
  ghost: { alignItems: 'center', paddingVertical: 10 },
  ghostText: { fontFamily: font.sansSemi },

  disclaimer: { textAlign: 'center', lineHeight: 16, marginTop: 4 },

  doneWrap: { alignItems: 'center', gap: 14, paddingHorizontal: 8 },
  doneText: { textAlign: 'center', lineHeight: 23 },
});
