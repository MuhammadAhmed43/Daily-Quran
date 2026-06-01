import { Link } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import surahs from '@/assets/quran/surahs.json';

type SurahMeta = {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  numberOfAyahs: number;
};

export default function SurahListScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.container}>
        <FlatList
          data={surahs as SurahMeta[]}
          keyExtractor={(s) => String(s.number)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.headerWrap}>
              <ThemedText type="title">Qur&apos;an</ThemedText>
              <ThemedText style={styles.headerSub}>Uthmani · Pickthall translation</ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <Link
              href={{ pathname: '/surah/[number]', params: { number: String(item.number) } }}
              asChild>
              <Pressable style={styles.row}>
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
            </Link>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  headerWrap: { paddingTop: 12, paddingBottom: 16, gap: 4 },
  headerSub: { opacity: 0.6, fontSize: 13 },
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
});
