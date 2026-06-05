// QUR'AN — the surah index + search (browse). Dark-premium onyx re-skin (UI-REDESIGN-SPEC.md §5.C / frame 36's
// sibling — Bible Chat opens straight into a reader; we keep an index for 114 surahs and make it premium):
// a serif masthead, a glass search pill (jump-to-ref / fuzzy / voice), "Listen to the whole Qur'an" + "Continue
// reading" cards, then the surahs as premium rows. ALL resolver / voice / search logic is preserved verbatim
// from the old screen — this is a re-skin only.
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { useVoiceSearch } from '@/hooks/use-voice-search';
import { useBookmarks } from '@/lib/bookmarks';
import { SURAHS, getSurah, rankSurahs, resolveReference, searchVerses, type Surah } from '@/lib/quran';
import { getLastRead, type LastRead } from '@/lib/storage';
import { c, font, grad, radius, space } from '@/lib/theme';

export default function QuranScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [last, setLast] = useState<LastRead | null>(null);
  const bookmarks = useBookmarks();
  const inputRef = useRef<TextInput>(null);
  const sv = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getLastRead().then((lr) => active && setLast(lr));
      return () => {
        active = false;
      };
    }, []),
  );

  const q = query.trim();
  const searching = q.length >= 1;

  const ref = useMemo(() => (searching ? resolveReference(q) : null), [q, searching]);
  const ranked = useMemo(() => (searching ? rankSurahs(q, 8) : []), [q, searching]);
  const verseHits = useMemo(() => (searching ? searchVerses(q) : []), [q, searching]);

  // Promote a strong, non-exact top match into a "Did you mean …?" suggestion.
  const guess = !ref && ranked.length > 0 && ranked[0].score >= 0.62 ? ranked[0].surah : null;
  const surahHits = (guess ? ranked.slice(1) : ranked).map((r) => r.surah);

  const open = (surah: number, ayah?: number) =>
    router.push({
      pathname: '/surah/[number]',
      params: ayah ? { number: String(surah), ayah: String(ayah) } : { number: String(surah) },
    });

  // Start a hands-free, continuous recitation of the whole Qur'an from Al-Fatiha.
  const listenWholeQuran = () =>
    router.push({
      pathname: '/surah/[number]',
      params: { number: '1', autoplay: '1', continuous: '1' },
    });

  // Voice search: speak a surah name / number / alias → fill the box and, if it
  // resolves to an exact reference, jump straight there.
  const onVoiceResult = useCallback(
    (text: string) => {
      const base = text
        .replace(/[.,!?]+$/g, '')
        .trim()
        .replace(/^(surah|surat|sura|chapter)\s+/i, '') // drop a spoken "Surah …" prefix
        .trim();
      // Whisper sometimes mishears the leading word (e.g. "Surah" → "Ture"), so also
      // try the phrase without its first word.
      const words = base.split(/\s+/).filter(Boolean);
      const candidates = words.length > 1 ? [base, words.slice(1).join(' ')] : [base];

      const go = (surah: number, ayah?: number, qy?: string) => {
        if (qy !== undefined) setQuery(qy);
        router.push({
          pathname: '/surah/[number]',
          params: ayah ? { number: String(surah), ayah: String(ayah) } : { number: String(surah) },
        });
      };

      // 1) Exact reference (number, or alias like "Ayat al-Kursi").
      for (const cand of candidates) {
        const r = resolveReference(cand);
        if (r) return go(r.surah, r.ayah, cand);
      }
      // 2) Best fuzzy surah match across candidates — tolerant of wrong letters anywhere.
      let best: { surah: Surah; score: number } | null = null;
      let bestText = base;
      for (const cand of candidates) {
        const top = rankSurahs(cand, 1)[0];
        if (top && (!best || top.score > best.score)) {
          best = top;
          bestText = cand;
        }
      }
      // Confident → jump straight to it; otherwise drop the closest text into the box
      // so the on-screen "Did you mean …?" suggestion can take over.
      if (best && best.score >= 0.78) return go(best.surah.number, undefined, best.surah.englishName);
      setQuery(bestText);
    },
    [router],
  );
  const voice = useVoiceSearch(onVoiceResult);

  const openSearch = () => setSearchOpen(true);
  const closeSearch = () => {
    if (voice.listening) voice.toggle();
    setQuery('');
    setSearchOpen(false);
    Keyboard.dismiss();
  };

  // Cross-fade the masthead <-> search field (both animate, open AND close — no broken exiting anims).
  useEffect(() => {
    sv.value = withTiming(searchOpen ? 1 : 0, { duration: 300, easing: Easing.bezier(0.22, 1, 0.36, 1) });
    if (searchOpen) inputRef.current?.focus();
    else inputRef.current?.blur();
  }, [searchOpen, sv]);
  const mastheadAnim = useAnimatedStyle(() => ({ opacity: 1 - sv.value, transform: [{ translateY: sv.value * -6 }] }));
  const fieldAnim = useAnimatedStyle(() => ({
    opacity: sv.value,
    transform: [{ translateX: (1 - sv.value) * 32 }, { scale: 0.97 + 0.03 * sv.value }],
  }));

  const lastSurah = last ? getSurah(last.surah) : undefined;

  const renderSurahRow = (item: Surah) => (
    <PressableScale key={item.number} style={styles.row} onPress={() => open(item.number)}>
      <View style={styles.badge}>
        <Txt style={styles.badgeNum}>{item.number}</Txt>
      </View>
      <View style={styles.rowMid}>
        <Txt variant="cardTitle" numberOfLines={1}>
          {item.englishName}
        </Txt>
        <Txt variant="caption" numberOfLines={1}>
          {item.englishNameTranslation} · {item.numberOfAyahs} ayat · {item.revelationType}
        </Txt>
      </View>
      <Txt style={styles.arabicName}>{item.name}</Txt>
    </PressableScale>
  );

  return (
    <Screen stars>
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <Animated.View style={[styles.titleRow, mastheadAnim]} pointerEvents={searchOpen ? 'none' : 'auto'}>
            <View style={styles.titleCol}>
              <Txt variant="h1">Qur&apos;an</Txt>
              <Txt variant="subtitle">114 surahs</Txt>
            </View>
            <IconButton name="search" color={c.textPrimary} onPress={openSearch} diameter={42} size={20} />
            <IconButton
              name={bookmarks.length > 0 ? 'bookmark' : 'bookmark-outline'}
              color={c.accent}
              onPress={() => router.push('/bookmarks')}
              diameter={42}
              size={19}
            />
          </Animated.View>

          <Animated.View style={[styles.searchRow, fieldAnim]} pointerEvents={searchOpen ? 'auto' : 'none'}>
            <View style={styles.searchField}>
              <Ionicons name="search" size={18} color={c.textMuted} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                placeholder="Surah, 2:255, or Ayat al-Kursi"
                placeholderTextColor={c.textMuted}
                style={styles.searchInput}
                autoCorrect={false}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
              {voice.enabled ? (
                <PressableScale
                  onPress={voice.toggle}
                  accessibilityRole="button"
                  accessibilityLabel={voice.listening ? 'Stop listening' : 'Search by voice'}
                  style={[styles.mic, voice.listening && styles.micActive]}>
                  {voice.busy ? (
                    <ActivityIndicator color={voice.listening ? c.bg : c.accent} size="small" />
                  ) : (
                    <Ionicons name={voice.listening ? 'stop' : 'mic'} size={17} color={voice.listening ? c.bg : c.accent} />
                  )}
                </PressableScale>
              ) : null}
            </View>
            <PressableScale onPress={closeSearch} hitSlop={8} style={styles.cancelBtn}>
              <Txt style={styles.cancelText}>Cancel</Txt>
            </PressableScale>
          </Animated.View>
        </View>
        {searchOpen && voice.listening ? (
          <Txt variant="caption" color={c.accent} style={styles.listening}>
            Listening… tap to stop
          </Txt>
        ) : null}
      </View>

      {searchOpen && !searching ? (
        <Pressable style={styles.searchHint} onPress={closeSearch}>
          <Ionicons name="search" size={26} color={c.textMuted} style={styles.searchHintIcon} />
          <Txt variant="caption" color={c.textMuted} style={styles.searchHintText}>
            Jump to a surah, an ayah like 2:255, or search by name.
          </Txt>
        </Pressable>
      ) : searching ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.results}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={closeSearch}
          showsVerticalScrollIndicator={false}>
          {ref ? (
            <PressableScale style={styles.goTo} onPress={() => open(ref.surah, ref.ayah)}>
              <Ionicons name="arrow-forward-circle" size={19} color={c.accent} />
              <Txt variant="body" color={c.accent} style={styles.goToText} numberOfLines={1}>
                Go to {ref.label ? `${ref.label} · ` : ''}
                {getSurah(ref.surah)?.englishName ?? `Surah ${ref.surah}`}
                {ref.ayah ? ` ${ref.surah}:${ref.ayah}` : ''}
              </Txt>
            </PressableScale>
          ) : null}

          {guess ? (
            <PressableScale style={styles.goTo} onPress={() => open(guess.number)}>
              <Ionicons name="help-circle" size={19} color={c.accent} />
              <Txt variant="body" color={c.accent} style={styles.goToText} numberOfLines={1}>
                Did you mean {guess.englishName}? · Surah {guess.number}
              </Txt>
            </PressableScale>
          ) : null}

          {surahHits.length > 0 ? (
            <Txt variant="eyebrow" style={styles.section}>
              Surahs
            </Txt>
          ) : null}
          {surahHits.map(renderSurahRow)}

          {verseHits.length > 0 ? (
            <Txt variant="eyebrow" style={styles.section}>
              Verses
            </Txt>
          ) : null}
          {verseHits.map((v) => (
            <PressableScale key={`${v.surah}:${v.ayah}`} style={styles.verseHit} onPress={() => open(v.surah, v.ayah)}>
              <Txt variant="caption" color={c.accent} style={styles.verseRef}>
                {v.surahEnglish} · {v.surah}:{v.ayah}
              </Txt>
              <Txt style={styles.verseText} numberOfLines={2}>
                {v.en}
              </Txt>
            </PressableScale>
          ))}

          {!ref && surahHits.length === 0 && verseHits.length === 0 ? (
            <Txt variant="body" color={c.textMuted} style={styles.empty}>
              No matches for “{q}”.
            </Txt>
          ) : null}
        </ScrollView>
      ) : (
        <FlatList
          style={styles.fill}
          data={SURAHS}
          keyExtractor={(s) => String(s.number)}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <PressableScale style={styles.bigCard} onPress={listenWholeQuran}>
                <LinearGradient colors={c.goldGrad} start={grad.diagStart} end={grad.diagEnd} style={styles.playCircle}>
                  <Ionicons name="headset" size={16} color={c.bg} />
                </LinearGradient>
                <View style={styles.bigCardMid}>
                  <Txt variant="cardTitle">Listen to the whole Qur&apos;an</Txt>
                  <Txt variant="caption">Continuous recitation from Al-Fatiha</Txt>
                </View>
                <Ionicons name="infinite" size={20} color={c.accent} />
              </PressableScale>

              {lastSurah && last ? (
                <PressableScale style={styles.continueCard} onPress={() => open(last.surah, last.ayah)}>
                  <View style={styles.continueMid}>
                    <Txt variant="eyebrow">Continue reading</Txt>
                    <Txt variant="cardTitle" style={styles.continueTitle}>
                      {lastSurah.englishName} · Ayah {last.ayah}
                    </Txt>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
                </PressableScale>
              ) : null}
            </View>
          }
          renderItem={({ item }) => renderSurahRow(item)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },

  header: { paddingHorizontal: space.gutter, paddingTop: space.xs, paddingBottom: space.md, gap: space.sm },
  headerInner: { position: 'relative', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  titleCol: { flex: 1, gap: 2 },

  searchRow: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 16,
    backgroundColor: '#000000',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, fontFamily: font.sans, fontSize: 16, color: c.textPrimary, padding: 0 },
  cancelBtn: { paddingHorizontal: 2 },
  cancelText: { fontFamily: font.sansSemi, fontSize: 15, color: c.accent },
  searchHint: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 14 },
  searchHintIcon: { opacity: 0.45 },
  searchHintText: { textAlign: 'center', lineHeight: 20 },
  mic: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201,189,166,0.14)',
  },
  micActive: { backgroundColor: c.accent },
  listening: { marginTop: 2, marginLeft: 4 },

  results: { paddingHorizontal: space.gutter, paddingBottom: 120 },
  list: { paddingHorizontal: space.gutter, paddingBottom: 120 },

  listHeader: { gap: space.md, paddingTop: space.xs, paddingBottom: space.sm },
  bigCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: c.surface1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  playCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bigCardMid: { flex: 1, gap: 2 },
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: radius.lg,
    backgroundColor: c.surface1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  continueMid: { flex: 1, gap: 3 },
  continueTitle: { marginTop: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairlineSoft,
  },
  badge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  badgeNum: { fontFamily: font.serifMed, fontSize: 14, lineHeight: 18, color: c.accent },
  rowMid: { flex: 1, gap: 2 },
  arabicName: { fontFamily: font.arabic, fontSize: 21, lineHeight: 36, color: c.scriptureInk, writingDirection: 'rtl' },

  goTo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(201,189,166,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,189,166,0.22)',
    marginTop: 10,
  },
  goToText: { flex: 1, fontFamily: font.sansSemi },
  section: { marginTop: 18, marginBottom: 4 },
  verseHit: {
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairlineSoft,
    gap: 4,
  },
  verseRef: { fontFamily: font.sansSemi, letterSpacing: 0.4 },
  verseText: { fontFamily: font.serifReg, fontSize: 14.5, lineHeight: 21, color: c.textSecondary },
  empty: { textAlign: 'center', marginTop: 48 },
});
