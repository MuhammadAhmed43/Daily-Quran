import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { toggleBookmark, useBookmarks } from '@/lib/bookmarks';
import { haptic } from '@/lib/haptics';
import { getAyah, getSurah } from '@/lib/quran';

const ACCENT = '#0a7ea4';

export default function BookmarksScreen() {
  const router = useRouter();
  const bookmarks = useBookmarks();

  const open = (surah: number, ayah: number) => {
    haptic.light();
    router.push({ pathname: '/surah/[number]', params: { number: String(surah), ayah: String(ayah) } });
  };

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen options={{ title: 'Bookmarks', headerBackTitle: "Qur'an" }} />
      {bookmarks.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bookmark-outline" size={40} color="rgba(127,127,127,0.5)" />
          <ThemedText style={styles.emptyText}>No bookmarks yet</ThemedText>
          <ThemedText style={styles.emptyHint}>
            Long-press an ayah while reading, then tap Bookmark.
          </ThemedText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {bookmarks.map((b) => {
            const s = getSurah(b.surah);
            const a = getAyah(b.surah, b.ayah);
            return (
              <Pressable key={`${b.surah}:${b.ayah}`} style={styles.row} onPress={() => open(b.surah, b.ayah)}>
                <View style={styles.rowMid}>
                  <ThemedText style={styles.ref}>
                    {s?.englishName ?? `Surah ${b.surah}`} · {b.surah}:{b.ayah}
                  </ThemedText>
                  {a ? (
                    <ThemedText style={styles.snippet} numberOfLines={2}>
                      {a.en}
                    </ThemedText>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => {
                    haptic.light();
                    void toggleBookmark(b.surah, b.ayah);
                  }}
                  hitSlop={12}
                  style={styles.remove}>
                  <Ionicons name="bookmark" size={20} color={ACCENT} />
                </Pressable>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { padding: 16, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
  },
  rowMid: { flex: 1, gap: 4 },
  ref: { fontSize: 13, fontWeight: '700', color: ACCENT },
  snippet: { fontSize: 15, lineHeight: 21, opacity: 0.85 },
  remove: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emptyText: { fontSize: 17, fontWeight: '600' },
  emptyHint: { fontSize: 14, opacity: 0.6, textAlign: 'center', lineHeight: 20 },
});
