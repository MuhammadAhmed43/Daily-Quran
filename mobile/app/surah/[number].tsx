import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AyahActions } from '@/components/ayah-actions';
import { JumpSheet } from '@/components/jump-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useBookmarks } from '@/lib/bookmarks';
import { haptic } from '@/lib/haptics';
import { getSurah, type Ayah } from '@/lib/quran';
import { useRecitation } from '@/lib/recitation-context';
import { setLastRead } from '@/lib/storage';

const BISMILLAH = getSurah(1)?.ayahs[0]?.ar ?? '';
const ACCENT = '#0a7ea4';
const JUMP_OFFSET = 90; // land a jumped-to ayah below the top edge, with a little context above

export default function SurahReader() {
  const params = useLocalSearchParams<{
    number: string;
    ayah?: string;
    autoplay?: string;
    continuous?: string;
  }>();
  const routeSurahNo = Number(params.number);
  const targetAyah = params.ayah ? Number(params.ayah) : undefined;

  // The recitation player lives at the app root; this screen is just a view of it.
  const ctx = useRecitation();
  // The surah on screen. It follows the player when continuous play crosses surahs, or when a
  // cross-surah jump happens — so the page tracks what's being recited.
  const [displayedSurah, setDisplayedSurah] = useState(routeSurahNo);
  const surah = getSurah(displayedSurah);

  const [jumpOpen, setJumpOpen] = useState(false);
  const [activeAyah, setActiveAyah] = useState<Ayah | null>(null);
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

  // Is the player on the surah we're showing, and if so which ayah?
  const playingHere = ctx.playing?.surah === displayedSurah;
  const playingAyah = playingHere ? ctx.playing!.ayah : null;

  // Auto-start when arriving from a "Listen to the whole Qur'an" / autoplay link.
  useEffect(() => {
    if (didAutostartRef.current) return;
    didAutostartRef.current = true;
    if (params.continuous === '1') ctx.setContinuous(true);
    if (params.autoplay === '1') {
      const t = setTimeout(() => ctx.playFrom(routeSurahNo, targetAyah ?? 1), 80);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist last-read: on open, and the topmost visible ayah on leave.
  useEffect(() => {
    if (!surah) return;
    const openAyah = displayedSurah === routeSurahNo ? (targetAyah ?? 1) : 1;
    setLastRead({ surah: displayedSurah, ayah: openAyah });
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
    if (!didScroll.current && targetAyah && ayahNum === targetAyah) {
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

  if (!surah) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Surah not found.</ThemedText>
      </ThemedView>
    );
  }

  const showBismillah = surah.number !== 1 && surah.number !== 9;
  const reciting = playingHere;

  function onLongPressAyah(a: Ayah) {
    haptic.medium();
    setActiveAyah(a);
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          title: surah.englishName,
          headerBackTitle: "Qur'an",
          headerRight: () => (
            <View style={styles.headerBtns}>
              <Pressable
                onPress={() => {
                  haptic.light();
                  setJumpOpen(true);
                }}
                hitSlop={10}>
                <Ionicons name="grid" size={22} color={ACCENT} />
              </Pressable>
              <Pressable
                onPress={() => {
                  haptic.light();
                  if (reciting) ctx.stop();
                  else ctx.playFrom(displayedSurah, 1);
                }}
                hitSlop={10}>
                <Ionicons name={reciting ? 'stop-circle' : 'play-circle'} size={28} color={ACCENT} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView
        ref={scrollRef}
        style={styles.fill}
        contentContainerStyle={styles.list}
        scrollEventThrottle={100}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
        }}>
        <View style={styles.head}>
          <ThemedText style={styles.surahName}>{surah.name}</ThemedText>
          <ThemedText style={styles.surahSub}>
            {surah.englishNameTranslation} · {surah.numberOfAyahs} ayat · {surah.revelationType}
          </ThemedText>
          {showBismillah ? <ThemedText style={styles.bismillah}>{BISMILLAH}</ThemedText> : null}
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
              <ThemedText style={styles.arabic}>{item.ar}</ThemedText>
              <View style={styles.transRow}>
                <View style={styles.numBadge}>
                  <ThemedText style={styles.numText}>{item.n}</ThemedText>
                </View>
                {bookmarked ? (
                  <Ionicons name="bookmark" size={14} color={ACCENT} style={styles.bookmarkMark} />
                ) : null}
                <ThemedText style={styles.trans}>{item.en}</ThemedText>
                <Pressable
                  onPress={() => {
                    haptic.light();
                    ctx.toggle(displayedSurah, item.n);
                  }}
                  hitSlop={8}
                  style={styles.ayBtn}>
                  {isThis && ctx.loading ? (
                    <ActivityIndicator size="small" color={ACCENT} />
                  ) : (
                    <Ionicons
                      name={isThis ? (ctx.paused ? 'play' : 'pause') : 'play-circle-outline'}
                      size={24}
                      color={isThis ? ACCENT : 'rgba(127,127,127,0.55)'}
                    />
                  )}
                </Pressable>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {reciting ? (
        <ThemedView style={styles.playbar}>
          <Pressable
            onPress={() => {
              haptic.light();
              ctx.setContinuous(!ctx.continuous);
            }}
            hitSlop={10}
            style={[styles.contBtn, ctx.continuous && styles.contBtnOn]}>
            <Ionicons name="infinite" size={18} color={ctx.continuous ? '#fff' : ACCENT} />
          </Pressable>
          <ThemedText style={styles.playbarText} numberOfLines={1}>
            {ctx.loading ? 'Loading…' : `Reciting ${surah.number}:${playingAyah}`}
            <ThemedText style={styles.playbarReciter}>
              {`  ·  ${ctx.continuous ? 'Whole Qur’an' : ctx.reciter.name}`}
            </ThemedText>
          </ThemedText>
          <Pressable
            onPress={() => {
              haptic.light();
              if (ctx.paused) ctx.resume();
              else ctx.pause();
            }}
            hitSlop={10}
            style={styles.barBtn}>
            <Ionicons name={ctx.paused ? 'play' : 'pause'} size={24} color={ACCENT} />
          </Pressable>
          <Pressable
            onPress={() => {
              haptic.light();
              ctx.stop();
            }}
            hitSlop={10}
            style={styles.barBtn}>
            <Ionicons name="stop" size={22} color={ACCENT} />
          </Pressable>
        </ThemedView>
      ) : null}

      <JumpSheet
        visible={jumpOpen}
        onClose={() => setJumpOpen(false)}
        currentSurahNo={displayedSurah}
        onJump={jumpTo}
      />

      <AyahActions
        ayah={activeAyah}
        surah={surah}
        onClose={() => setActiveAyah(null)}
        onPlay={(n) => ctx.playFrom(displayedSurah, n)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 80 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  head: { alignItems: 'center', gap: 6, paddingVertical: 16 },
  surahName: { fontFamily: 'AmiriQuran', fontSize: 30, lineHeight: 50, writingDirection: 'rtl' },
  surahSub: { opacity: 0.6, fontSize: 13 },
  bismillah: {
    fontFamily: 'AmiriQuran',
    fontSize: 26,
    writingDirection: 'rtl',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 58,
  },
  ayah: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
    gap: 12,
  },
  ayahHighlight: { backgroundColor: 'rgba(10,126,164,0.12)' },
  ayahPlaying: { backgroundColor: 'rgba(10,126,164,0.18)' },
  ayahPressed: { backgroundColor: 'rgba(10,126,164,0.16)' },
  arabic: {
    fontFamily: 'AmiriQuran',
    fontSize: 26,
    lineHeight: 62,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  transRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  numBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,127,127,0.15)',
  },
  numText: { fontSize: 12, fontWeight: '600' },
  bookmarkMark: { marginTop: 5, marginLeft: -4 },
  trans: { flex: 1, fontSize: 15, lineHeight: 22, opacity: 0.85 },
  ayBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginTop: -2 },

  playbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127,127,127,0.25)',
  },
  contBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,126,164,0.14)',
  },
  contBtnOn: { backgroundColor: ACCENT },
  playbarText: { flex: 1, fontSize: 14, fontWeight: '600' },
  playbarReciter: { fontSize: 12, fontWeight: '400', opacity: 0.6 },
  barBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
