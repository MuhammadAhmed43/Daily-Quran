import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import quran from '@/assets/quran/quran.json';

type Ayah = { n: number; ar: string; en: string };
type Surah = {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  numberOfAyahs: number;
  ayahs: Ayah[];
};

const SURAHS = quran.surahs as Surah[];
// Bismillah pulled from the verified text itself (al-Fatiha 1:1), never typed by hand.
const BISMILLAH = SURAHS[0].ayahs[0].ar;

export default function SurahReader() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const surah = SURAHS.find((s) => s.number === Number(number));

  if (!surah) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Surah not found.</ThemedText>
      </ThemedView>
    );
  }

  const showBismillah = surah.number !== 1 && surah.number !== 9;

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: surah.englishName, headerBackTitle: 'Surahs' }} />
      <FlatList
        data={surah.ayahs}
        keyExtractor={(a) => String(a.n)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.head}>
            <ThemedText style={styles.surahName}>{surah.name}</ThemedText>
            <ThemedText style={styles.surahSub}>
              {surah.englishNameTranslation} · {surah.numberOfAyahs} ayat · {surah.revelationType}
            </ThemedText>
            {showBismillah ? <ThemedText style={styles.bismillah}>{BISMILLAH}</ThemedText> : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.ayah}>
            <ThemedText style={styles.arabic}>{item.ar}</ThemedText>
            <View style={styles.transRow}>
              <View style={styles.numBadge}>
                <ThemedText style={styles.numText}>{item.n}</ThemedText>
              </View>
              <ThemedText style={styles.trans}>{item.en}</ThemedText>
            </View>
          </View>
        )}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 48 },
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
    gap: 12,
  },
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
  trans: { flex: 1, fontSize: 15, lineHeight: 22, opacity: 0.85 },
});
