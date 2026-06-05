// YOUR VERSES (onyx) — the saved-ayat list, reached from the profile drawer and the Qur'an tab. Onyx
// reskin only: champagne ref + serif snippet cards, a SealMedallion empty state, staggered entrance.
// All logic preserved (useBookmarks / toggleBookmark / verseText / open-in-reader).
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { SealMedallion } from '@/components/atlas-tile';
import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { toggleBookmark, useBookmarks } from '@/lib/bookmarks';
import { haptic } from '@/lib/haptics';
import { getAyah, getSurah } from '@/lib/quran';
import { c, radius, space } from '@/lib/theme';
import { useTranslation, verseText } from '@/lib/translations';

export default function BookmarksScreen() {
  const router = useRouter();
  const bookmarks = useBookmarks();
  useTranslation(); // re-render snippets when the translation changes

  const open = (surah: number, ayah: number) => {
    haptic.light();
    router.push({ pathname: '/surah/[number]', params: { number: String(surah), ayah: String(ayah) } });
  };

  return (
    <Screen stars>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <IconButton name="chevron-back" onPress={() => router.back()} diameter={38} size={22} bg={c.surface2} color={c.textPrimary} />
        <Txt variant="cardTitle">Your Verses</Txt>
        <View style={styles.spacer} />
      </View>

      {bookmarks.length === 0 ? (
        <View style={styles.empty}>
          <SealMedallion name="bookmark-outline" frame={66} ring={48} glyph={26} />
          <Txt variant="h2" style={styles.emptyTitle}>
            No saved verses yet
          </Txt>
          <Txt variant="body" color={c.textMuted} style={styles.emptyHint}>
            Long-press an ayah while reading, then tap Bookmark to keep it here.
          </Txt>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {bookmarks.map((b, i) => {
            const s = getSurah(b.surah);
            const a = getAyah(b.surah, b.ayah);
            return (
              <Animated.View key={`${b.surah}:${b.ayah}`} entering={FadeInDown.delay(i * 45).duration(300)}>
                <PressableScale style={styles.row} onPress={() => open(b.surah, b.ayah)}>
                  <View style={styles.rowMid}>
                    <Txt variant="eyebrow" color={c.accent}>
                      {s?.englishName ?? `Surah ${b.surah}`} · {b.surah}:{b.ayah}
                    </Txt>
                    {a ? (
                      <Txt variant="verseEn" numberOfLines={2} style={styles.snippet}>
                        {verseText(b.surah, b.ayah)}
                      </Txt>
                    ) : null}
                  </View>
                  <PressableScale
                    onPress={() => {
                      haptic.light();
                      void toggleBookmark(b.surah, b.ayah);
                    }}
                    hitSlop={12}
                    style={styles.remove}>
                    <Ionicons name="bookmark" size={19} color={c.accent} />
                  </PressableScale>
                </PressableScale>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: space.sm },
  spacer: { width: 38 },
  list: { paddingHorizontal: space.gutter, paddingBottom: space.section, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: space.card,
    borderRadius: radius.md,
    backgroundColor: c.surface1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  rowMid: { flex: 1, gap: 7 },
  snippet: { fontSize: 16, lineHeight: 23 },
  remove: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: space.section },
  emptyTitle: { marginTop: 4 },
  emptyHint: { textAlign: 'center', lineHeight: 22 },
});
