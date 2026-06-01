import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  SURAHS,
  getSurah,
  resolveReference,
  searchSurahs,
  searchVerses,
  type Surah,
} from '@/lib/quran';
import { getLastRead, type LastRead } from '@/lib/storage';

export default function QuranScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [last, setLast] = useState<LastRead | null>(null);

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
  const surahHits = useMemo(() => (searching ? searchSurahs(q) : []), [q, searching]);
  const verseHits = useMemo(() => (searching ? searchVerses(q) : []), [q, searching]);

  const open = (surah: number, ayah?: number) =>
    router.push({
      pathname: '/surah/[number]',
      params: ayah ? { number: String(surah), ayah: String(ayah) } : { number: String(surah) },
    });

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
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search, or jump to 2:255 / Ayat al-Kursi"
            placeholderTextColor="rgba(127,127,127,0.7)"
            style={styles.search}
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
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
              lastSurah && last ? (
                <Pressable style={styles.continue} onPress={() => open(last.surah, last.ayah)}>
                  <ThemedText style={styles.continueLabel}>CONTINUE READING</ThemedText>
                  <ThemedText type="defaultSemiBold">
                    {lastSurah.englishName} · Ayah {last.ayah}
                  </ThemedText>
                </Pressable>
              ) : null
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
  search: {
    backgroundColor: 'rgba(127,127,127,0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    color: 'rgba(127,127,127,1)',
  },
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
