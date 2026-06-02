import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  SURAHS,
  getSurah,
  rankSurahs,
  resolveReference,
  searchVerses,
  type Surah,
} from '@/lib/quran';
import { useBookmarks } from '@/lib/bookmarks';
import { haptic } from '@/lib/haptics';
import { getLastRead, type LastRead } from '@/lib/storage';
import { useVoiceSearch } from '@/hooks/use-voice-search';

export default function QuranScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [last, setLast] = useState<LastRead | null>(null);
  const bookmarks = useBookmarks();

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

      const go = (surah: number, ayah?: number, q?: string) => {
        if (q !== undefined) setQuery(q);
        router.push({
          pathname: '/surah/[number]',
          params: ayah
            ? { number: String(surah), ayah: String(ayah) }
            : { number: String(surah) },
        });
      };

      // 1) Exact reference (number, or alias like "Ayat al-Kursi").
      for (const c of candidates) {
        const r = resolveReference(c);
        if (r) return go(r.surah, r.ayah, c);
      }
      // 2) Best fuzzy surah match across candidates — tolerant of wrong letters anywhere.
      let best: { surah: Surah; score: number } | null = null;
      let bestText = base;
      for (const c of candidates) {
        const top = rankSurahs(c, 1)[0];
        if (top && (!best || top.score > best.score)) {
          best = top;
          bestText = c;
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

  const renderSurahRow = (item: Surah) => (
    <Pressable key={item.number} style={styles.row} onPress={() => open(item.number)}>
      <View style={styles.badge}>
        <ThemedText style={styles.badgeText}>{item.number}</ThemedText>
      </View>
      <View style={styles.rowMid}>
        <ThemedText type="defaultSemiBold">{item.englishName}</ThemedText>
        <ThemedText style={styles.sub}>
          {item.englishNameTranslation} · {item.numberOfAyahs} ayat · {item.revelationType}
        </ThemedText>
      </View>
      <ThemedText style={styles.arabicName}>{item.name}</ThemedText>
    </Pressable>
  );

  const lastSurah = last ? getSurah(last.surah) : undefined;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.searchWrap}>
          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search, or jump to 2:255 / Ayat al-Kursi"
              placeholderTextColor="rgba(127,127,127,0.7)"
              style={[styles.search, styles.searchInput]}
              autoCorrect={false}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
            <Pressable
              onPress={() => {
                haptic.light();
                router.push('/bookmarks');
              }}
              accessibilityRole="button"
              accessibilityLabel="Bookmarks"
              style={styles.bookmarkBtn}>
              <Ionicons
                name={bookmarks.length > 0 ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color="#c8a24a"
              />
            </Pressable>
            {voice.enabled ? (
              <Pressable
                onPress={voice.toggle}
                accessibilityRole="button"
                accessibilityLabel={voice.listening ? 'Stop listening' : 'Search by voice'}
                style={[styles.mic, voice.listening && styles.micActive]}>
                {voice.busy ? (
                  <ActivityIndicator color={voice.listening ? '#fff' : '#0a7ea4'} />
                ) : (
                  <Ionicons
                    name={voice.listening ? 'stop' : 'mic'}
                    size={20}
                    color={voice.listening ? '#fff' : '#0a7ea4'}
                  />
                )}
              </Pressable>
            ) : null}
          </View>
          {voice.listening ? (
            <ThemedText style={styles.listening}>Listening… tap to stop</ThemedText>
          ) : null}
        </View>

        {searching ? (
          <ScrollView contentContainerStyle={styles.results} keyboardShouldPersistTaps="handled">
            {ref ? (
              <Pressable style={styles.goTo} onPress={() => open(ref.surah, ref.ayah)}>
                <ThemedText style={styles.goToText}>
                  Go to {ref.label ? `${ref.label} · ` : ''}
                  {getSurah(ref.surah)?.englishName ?? `Surah ${ref.surah}`}
                  {ref.ayah ? ` ${ref.surah}:${ref.ayah}` : ''}
                </ThemedText>
              </Pressable>
            ) : null}

            {guess ? (
              <Pressable style={styles.goTo} onPress={() => open(guess.number)}>
                <ThemedText style={styles.goToText}>
                  Did you mean {guess.englishName}? · Surah {guess.number}
                </ThemedText>
              </Pressable>
            ) : null}

            {surahHits.length > 0 ? <ThemedText style={styles.section}>Surahs</ThemedText> : null}
            {surahHits.map(renderSurahRow)}

            {verseHits.length > 0 ? <ThemedText style={styles.section}>Verses</ThemedText> : null}
            {verseHits.map((v) => (
              <Pressable
                key={`${v.surah}:${v.ayah}`}
                style={styles.verseHit}
                onPress={() => open(v.surah, v.ayah)}>
                <ThemedText style={styles.verseRef}>
                  {v.surahEnglish} · {v.surah}:{v.ayah}
                </ThemedText>
                <ThemedText style={styles.verseText} numberOfLines={2}>
                  {v.en}
                </ThemedText>
              </Pressable>
            ))}

            {!ref && surahHits.length === 0 && verseHits.length === 0 ? (
              <ThemedText style={styles.empty}>No matches for “{q}”.</ThemedText>
            ) : null}
          </ScrollView>
        ) : (
          <FlatList
            data={SURAHS}
            keyExtractor={(s) => String(s.number)}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <>
                <Pressable style={styles.listenAll} onPress={listenWholeQuran}>
                  <View style={styles.listenIcon}>
                    <Ionicons name="play" size={18} color="#fff" />
                  </View>
                  <View style={styles.listenMid}>
                    <ThemedText type="defaultSemiBold">Listen to the whole Qur’an</ThemedText>
                    <ThemedText style={styles.sub}>Continuous recitation from Al-Fatiha</ThemedText>
                  </View>
                  <Ionicons name="infinite" size={20} color="#0a7ea4" />
                </Pressable>
                {lastSurah && last ? (
                  <Pressable style={styles.continue} onPress={() => open(last.surah, last.ayah)}>
                    <ThemedText style={styles.continueLabel}>CONTINUE READING</ThemedText>
                    <ThemedText type="defaultSemiBold">
                      {lastSurah.englishName} · Ayah {last.ayah}
                    </ThemedText>
                  </Pressable>
                ) : null}
              </>
            }
            renderItem={({ item }) => renderSurahRow(item)}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1 },
  search: {
    backgroundColor: 'rgba(127,127,127,0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    color: 'rgba(127,127,127,1)',
  },
  mic: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,126,164,0.12)',
  },
  bookmarkBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,162,74,0.14)',
  },
  micActive: { backgroundColor: '#e0245e' },
  listening: { marginTop: 8, fontSize: 13, color: '#e0245e', fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  results: { paddingHorizontal: 16, paddingBottom: 32, gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.25)',
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,127,127,0.15)',
  },
  badgeText: { fontSize: 13, fontWeight: '600' },
  rowMid: { flex: 1, gap: 2 },
  sub: { opacity: 0.6, fontSize: 12 },
  arabicName: { fontFamily: 'AmiriQuran', fontSize: 22, lineHeight: 36, writingDirection: 'rtl' },
  listenAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(10,126,164,0.12)',
  },
  listenIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a7ea4',
  },
  listenMid: { flex: 1, gap: 2 },
  continue: {
    marginVertical: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(10,126,164,0.12)',
    gap: 4,
  },
  continueLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: '#0a7ea4' },
  goTo: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(10,126,164,0.15)',
    marginBottom: 8,
  },
  goToText: { fontWeight: '700', color: '#0a7ea4' },
  section: { fontSize: 12, fontWeight: '700', opacity: 0.5, marginTop: 14, marginBottom: 4, letterSpacing: 0.5 },
  verseHit: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
    gap: 3,
  },
  verseRef: { fontSize: 12, fontWeight: '600', color: '#0a7ea4' },
  verseText: { fontSize: 14, lineHeight: 20, opacity: 0.85 },
  empty: { opacity: 0.5, textAlign: 'center', marginTop: 40 },
});
