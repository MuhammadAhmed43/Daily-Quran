// SURAH READER — the flagship reading surface (UI-REDESIGN-SPEC.md §5.C, frame 36). Dark-premium onyx re-skin:
// a custom header (back · surah ▾ · translation · play), a centered serif masthead (Amiri name · italic-serif
// meta · bismillah · About-this-surah), warm serif verses (Amiri Arabic + champagne verse numbers + Fraunces
// translation), and a persistent BOTTOM REFERENCE BAR that pages prev/next surah when idle and morphs into the
// recitation controls while reciting. ALL reader logic is preserved verbatim from the old screen — the app-level
// recitation player, jump/reciter/translation/explain sheets, last-read, read-credit, continuous-surah follow,
// pending jump/scroll, autoplay, bookmarks. This is presentation only.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AboutSurah } from '@/components/about-surah';
import { AyahActions } from '@/components/ayah-actions';
import { ExplainSheet, type ExplainTarget } from '@/components/explain-sheet';
import { JumpSheet } from '@/components/jump-sheet';
import { ReciterSheet } from '@/components/reciter-sheet';
import { TranslationSheet } from '@/components/translation-sheet';
import { GlassSurface } from '@/components/ui/glass-surface';
import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { useBookmarks } from '@/lib/bookmarks';
import { haptic } from '@/lib/haptics';
import { getSurah, type Ayah } from '@/lib/quran';
import { useRecitation } from '@/lib/recitation-context';
import { setLastRead } from '@/lib/storage';
import { recordActivity } from '@/lib/streak';
import { c, font, radius, space } from '@/lib/theme';
import { translationMeta, useTranslation, verseText } from '@/lib/translations';

const BISMILLAH = getSurah(1)?.ayahs[0]?.ar ?? '';
const JUMP_OFFSET = 90; // land a jumped-to ayah below the top edge, with a little context above
const SURAH_COUNT = 114;

export default function SurahReader() {
  const params = useLocalSearchParams<{
    number: string;
    ayah?: string;
    autoplay?: string;
    continuous?: string;
    whole?: string; // arrived from "Listen to the whole Qur'an" — track the listen point, not the read point
  }>();
  const routeSurahNo = Number(params.number);
  const targetAyah = params.ayah ? Number(params.ayah) : undefined;

  const router = useRouter();
  const insets = useSafeAreaInsets();

  // The recitation player lives at the app root; this screen is just a view of it.
  const ctx = useRecitation();
  // The surah on screen. It follows the player when continuous play crosses surahs, or when a
  // cross-surah jump happens — so the page tracks what's being recited.
  const [displayedSurah, setDisplayedSurah] = useState(routeSurahNo);
  const surah = getSurah(displayedSurah);

  const [jumpOpen, setJumpOpen] = useState(false);
  const [reciterOpen, setReciterOpen] = useState(false);
  const [activeAyah, setActiveAyah] = useState<Ayah | null>(null);
  const [explainTarget, setExplainTarget] = useState<ExplainTarget | null>(null);
  const [translationOpen, setTranslationOpen] = useState(false);
  const { id: trId, setId: setTr } = useTranslation();
  const bookmarks = useBookmarks();

  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<number, number>>({});
  const scrollY = useRef(0);
  const didScroll = useRef(false);
  const [highlight, setHighlight] = useState<number | undefined>(targetAyah);

  const pendingJumpRef = useRef<{ ayah: number; play: boolean } | null>(null);
  const pendingScrollRef = useRef<number | null>(null);
  const didAutostartRef = useRef(false);
  const initialRenderRef = useRef(true);
  const prevPlayingSurahRef = useRef<number | null>(ctx.playing?.surah ?? null);

  // Count reading toward the streak once the reader is actually engaged (a dwell OR any real scroll)
  // — so a quick bounce never counts. read_ayahs was previously credited only by the Explain sheet.
  const readCredited = useRef(false);
  const creditRead = () => {
    if (readCredited.current || !surah) return;
    readCredited.current = true;
    recordActivity('read_ayahs');
  };
  useEffect(() => {
    const t = setTimeout(creditRead, 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Is the player on the surah we're showing, and if so which ayah?
  const playingHere = ctx.playing?.surah === displayedSurah;
  const playingAyah = playingHere ? ctx.playing!.ayah : null;

  // Auto-start when arriving from a "Listen to the whole Qur'an" / autoplay link.
  useEffect(() => {
    if (didAutostartRef.current) return;
    didAutostartRef.current = true;
    if (params.continuous === '1') ctx.setContinuous(true);
    if (params.autoplay === '1') {
      const t = setTimeout(() => {
        if (params.whole === '1') ctx.playWhole(routeSurahNo, targetAyah ?? 1);
        else ctx.playFrom(routeSurahNo, targetAyah ?? 1);
      }, 80);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist last-read: on open, and the topmost visible ayah on leave.
  useEffect(() => {
    if (!surah) return;
    const openAyah = displayedSurah === routeSurahNo ? (targetAyah ?? 1) : 1;
    // Opening via "Listen to the whole Qur'an" must NOT move the reading position (Continue reading).
    if (params.whole !== '1') setLastRead({ surah: displayedSurah, ayah: openAyah });
    return () => {
      let top = 1;
      for (const a of surah.ayahs) {
        const y = positions.current[a.n];
        if (y === undefined) continue;
        if (y <= scrollY.current + 40) top = a.n;
        else break;
      }
      setLastRead({ surah: displayedSurah, ayah: top });
    };
  }, [displayedSurah, surah, targetAyah, routeSurahNo]);

  // Follow continuous recitation as it crosses into the next surah (only if we were the surah
  // that was playing — so we don't yank the page if you're reading something else).
  useEffect(() => {
    const ps = ctx.playing?.surah ?? null;
    const prev = prevPlayingSurahRef.current;
    prevPlayingSurahRef.current = ps;
    if (ps != null && ps !== displayedSurah && prev === displayedSurah) setDisplayedSurah(ps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.playing?.surah]);

  // When the page rolls to a new surah, reset scroll/measurements and apply any pending jump.
  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }
    positions.current = {};
    didScroll.current = true;
    setHighlight(undefined);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    const pj = pendingJumpRef.current;
    if (pj) {
      pendingJumpRef.current = null;
      setHighlight(pj.ayah);
      if (pj.play) ctx.playFrom(displayedSurah, pj.ayah);
      else pendingScrollRef.current = pj.ayah;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedSurah]);

  // Fade the navigation highlight after a moment (recitation has its own highlight).
  useEffect(() => {
    if (highlight === undefined) return;
    const t = setTimeout(() => setHighlight(undefined), 3500);
    return () => clearTimeout(t);
  }, [highlight]);

  // Keep the ayah being recited comfortably in view; defer if it isn't measured yet.
  useEffect(() => {
    if (playingAyah == null) return;
    const y = positions.current[playingAyah];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 100), animated: true });
    else pendingScrollRef.current = playingAyah;
  }, [playingAyah]);

  function onAyahLayout(ayahNum: number, y: number) {
    positions.current[ayahNum] = y;
    if (pendingScrollRef.current === ayahNum) {
      pendingScrollRef.current = null;
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - JUMP_OFFSET), animated: false }));
      return;
    }
    // Open at the route's target ayah — UNLESS this surah is being recited, in which case the follow
    // effect below lands us on the actually-playing ayah (so returning always points to what's narrated).
    if (!didScroll.current && targetAyah && ayahNum === targetAyah && !playingHere) {
      didScroll.current = true;
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: false }));
    }
  }

  // Jump to any surah:ayah. If this surah is reciting, continue from there; else just read there.
  function jumpTo(s: number, a: number) {
    const shouldPlay = playingHere;
    if (s === displayedSurah) {
      if (shouldPlay) {
        ctx.playFrom(s, a);
      } else {
        setHighlight(a);
        const y = positions.current[a];
        if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - JUMP_OFFSET), animated: true });
        else pendingScrollRef.current = a;
      }
    } else {
      pendingJumpRef.current = { ayah: a, play: shouldPlay };
      setDisplayedSurah(s);
    }
  }

  // Page to the previous/next surah (frame 36's chapter pager) — reuses the surah-roll reset machinery.
  function goSurah(n: number) {
    if (n < 1 || n > SURAH_COUNT || n === displayedSurah) return;
    haptic.light();
    setDisplayedSurah(n);
  }

  if (!surah) {
    return (
      <Screen>
        <View style={styles.center}>
          <Txt variant="body">Surah not found.</Txt>
        </View>
      </Screen>
    );
  }

  const showBismillah = surah.number !== 1 && surah.number !== 9;
  const reciting = playingHere;
  const trShort = translationMeta(trId).short;

  function onLongPressAyah(a: Ayah) {
    haptic.medium();
    setActiveAyah(a);
  }

  return (
    <Screen edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom header — back · surah name (▾ → jump) · translation · play (frame 36's top bar). */}
      <View style={styles.header}>
        <IconButton name="chevron-back" onPress={() => router.back()} diameter={38} size={22} color={c.textPrimary} />
        <PressableScale onPress={() => setJumpOpen(true)} style={styles.headerTitle}>
          <Txt variant="cardTitle" numberOfLines={1}>
            {surah.englishName}
          </Txt>
          <Ionicons name="chevron-down" size={14} color={c.textMuted} />
        </PressableScale>
        <IconButton name="language" onPress={() => setTranslationOpen(true)} color={c.accent} diameter={38} size={19} />
        <IconButton
          name={reciting ? 'stop' : 'headset-outline'}
          onPress={() => {
            if (reciting) ctx.stop();
            else ctx.playFrom(displayedSurah, 1);
          }}
          color={c.accent}
          diameter={38}
          size={18}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 104 }]}
        scrollEventThrottle={100}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
          if (scrollY.current > 240) creditRead();
        }}>
        <View style={styles.head}>
          <Txt style={styles.surahNameAr}>{surah.name}</Txt>
          <Txt variant="subtitle" color={c.textSecondary} style={styles.pericope}>
            {surah.englishNameTranslation} · {surah.numberOfAyahs} ayat · {surah.revelationType}
          </Txt>
          <View style={styles.rule} />
          {showBismillah ? <Txt style={styles.bismillah}>{BISMILLAH}</Txt> : null}
          <AboutSurah key={surah.number} surah={surah} />
        </View>

        {surah.ayahs.map((item) => {
          const isThis = playingAyah === item.n;
          const bookmarked = bookmarks.some((b) => b.surah === displayedSurah && b.ayah === item.n);
          return (
            <Pressable
              key={item.n}
              onLayout={(e) => onAyahLayout(item.n, e.nativeEvent.layout.y)}
              onLongPress={() => onLongPressAyah(item)}
              delayLongPress={300}
              style={({ pressed }) => [
                styles.ayah,
                highlight === item.n && styles.ayahHighlight,
                isThis && styles.ayahPlaying,
                pressed && styles.ayahPressed,
              ]}>
              <Txt style={styles.arabic}>{item.ar}</Txt>
              <View style={styles.transRow}>
                <Txt style={styles.vnum}>{item.n}</Txt>
                {bookmarked ? <Ionicons name="bookmark" size={13} color={c.accent} style={styles.bookmarkMark} /> : null}
                <Txt style={styles.trans}>{verseText(surah.number, item.n)}</Txt>
                <PressableScale
                  onPress={() => ctx.playWhole(displayedSurah, item.n)}
                  hitSlop={6}
                  style={styles.ayBtn}
                  accessibilityLabel="Recite the whole Qur'an from this ayah">
                  <Ionicons name="infinite" size={19} color={c.textMuted} />
                </PressableScale>
                <PressableScale
                  onPress={() => {
                    if (!isThis) setLastRead({ surah: displayedSurah, ayah: item.n }); // a newly tapped ayah is a manual read
                    ctx.toggle(displayedSurah, item.n);
                  }}
                  hitSlop={8}
                  style={styles.ayBtn}>
                  {isThis && ctx.loading ? (
                    <ActivityIndicator size="small" color={c.accent} />
                  ) : (
                    <Ionicons
                      name={isThis ? (ctx.paused ? 'play' : 'pause') : 'headset-outline'}
                      size={22}
                      color={isThis ? c.accent : c.textMuted}
                    />
                  )}
                </PressableScale>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Floating reference pill — adaptive: real Apple Liquid Glass in a dev build on iOS 26, a clean minimal
          capsule in Expo Go (see GlassSurface). Pages prev/next surah when idle; morphs to recitation controls. */}
      <GlassSurface style={[styles.barWrap, { bottom: insets.bottom + 12 }]} radius={radius.full}>
        <View style={styles.barContent}>
          {reciting ? (
            <>
              <PressableScale onPress={() => ctx.setContinuous(!ctx.continuous)} style={styles.barIcon}>
                <Ionicons name="infinite" size={19} color={ctx.continuous ? c.accent : c.textMuted} />
              </PressableScale>
              <PressableScale style={styles.barCenter} onPress={() => setReciterOpen(true)}>
                <Txt variant="caption" color={c.textSecondary} numberOfLines={1} style={styles.barText}>
                  {ctx.loading ? 'Loading…' : `Reciting ${surah.number}:${playingAyah}`}
                  <Txt variant="caption" color={c.textMuted}>{`  ·  ${ctx.reciter.name}`}</Txt>
                </Txt>
                <Ionicons name="chevron-up" size={13} color={c.textMuted} />
              </PressableScale>
              <PressableScale onPress={() => (ctx.paused ? ctx.resume() : ctx.pause())} style={styles.barIcon}>
                <Ionicons name={ctx.paused ? 'play' : 'pause'} size={21} color={c.accent} />
              </PressableScale>
              <PressableScale onPress={() => ctx.stop()} style={styles.barIcon}>
                <Ionicons name="stop" size={19} color={c.accent} />
              </PressableScale>
            </>
          ) : (
            <>
              <PressableScale
                onPress={() => goSurah(displayedSurah - 1)}
                disabled={displayedSurah <= 1}
                style={[styles.barIcon, displayedSurah <= 1 && styles.barIconDim]}>
                <Ionicons name="chevron-back" size={21} color={c.textSecondary} />
              </PressableScale>
              <PressableScale style={styles.barCenter} onPress={() => setJumpOpen(true)}>
                <Txt variant="caption" color={c.textSecondary} numberOfLines={1} style={styles.barText}>
                  Surah {surah.number} · {surah.englishName}
                  <Txt variant="caption" color={c.textMuted}>{`  ·  ${trShort}`}</Txt>
                </Txt>
                <Ionicons name="grid-outline" size={13} color={c.textMuted} />
              </PressableScale>
              <PressableScale
                onPress={() => goSurah(displayedSurah + 1)}
                disabled={displayedSurah >= SURAH_COUNT}
                style={[styles.barIcon, displayedSurah >= SURAH_COUNT && styles.barIconDim]}>
                <Ionicons name="chevron-forward" size={21} color={c.textSecondary} />
              </PressableScale>
            </>
          )}
        </View>
      </GlassSurface>

      <JumpSheet visible={jumpOpen} onClose={() => setJumpOpen(false)} currentSurahNo={displayedSurah} onJump={jumpTo} />

      <AyahActions
        ayah={activeAyah}
        surah={surah}
        onClose={() => setActiveAyah(null)}
        onPlay={(n) => {
          setLastRead({ surah: displayedSurah, ayah: n }); // a tapped ayah is a manual read → Continue reading
          ctx.playFrom(displayedSurah, n);
        }}
        onExplain={(a) =>
          setExplainTarget({
            surah: surah.number,
            ayah: a.n,
            name: surah.englishName,
            ar: a.ar,
            en: verseText(surah.number, a.n),
          })
        }
      />

      <ExplainSheet target={explainTarget} onClose={() => setExplainTarget(null)} />

      <ReciterSheet
        visible={reciterOpen}
        currentId={ctx.reciter.id}
        onClose={() => setReciterOpen(false)}
        onSelect={(id) => ctx.chooseReciter(id)}
      />

      <TranslationSheet
        visible={translationOpen}
        currentId={trId}
        onClose={() => setTranslationOpen(false)}
        onSelect={setTr}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: space.gutter,
    paddingBottom: space.sm,
  },
  headerTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },

  list: { paddingHorizontal: space.gutter, paddingTop: space.xs },

  head: { alignItems: 'center', gap: 8, paddingTop: space.xs, paddingBottom: space.md },
  surahNameAr: { fontFamily: font.arabic, fontSize: 30, lineHeight: 52, color: c.scriptureInk, textAlign: 'center', writingDirection: 'rtl' },
  pericope: { fontFamily: font.serifItalic, textAlign: 'center' },
  rule: { width: 44, height: StyleSheet.hairlineWidth, backgroundColor: c.accent, opacity: 0.45, marginVertical: 2 },
  bismillah: {
    fontFamily: font.arabic,
    fontSize: 24,
    lineHeight: 54,
    color: c.scriptureInk,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginTop: 6,
  },

  ayah: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent', // becomes a champagne accent bar on the reciting ayah (no layout shift)
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairlineSoft,
  },
  ayahHighlight: { backgroundColor: 'rgba(201,189,166,0.10)' },
  ayahPlaying: { backgroundColor: 'rgba(201,189,166,0.13)', borderLeftColor: c.accent },
  ayahPressed: { backgroundColor: 'rgba(201,189,166,0.12)' },
  arabic: {
    fontFamily: font.arabic,
    fontSize: 26,
    lineHeight: 62,
    textAlign: 'right',
    writingDirection: 'rtl',
    color: c.scriptureInk,
  },
  transRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  vnum: { fontFamily: font.sansBold, fontSize: 11.5, lineHeight: 20, color: c.accent, minWidth: 16, marginTop: 3 },
  bookmarkMark: { marginTop: 4, marginLeft: -4 },
  trans: { flex: 1, fontFamily: font.serifReg, fontSize: 16, lineHeight: 26, color: c.scriptureInk },
  ayBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginTop: -2 },

  barWrap: { position: 'absolute', left: space.gutter, right: space.gutter },
  barContent: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 54, paddingHorizontal: 8 },
  barIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  barIconDim: { opacity: 0.3 },
  barCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4, minHeight: 44 },
  barText: { flexShrink: 1, textAlign: 'center', fontFamily: font.sansSemi },
});
