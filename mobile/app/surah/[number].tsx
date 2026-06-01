import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurah, type Ayah } from '@/lib/quran';
import { setLastRead } from '@/lib/storage';

const BISMILLAH = getSurah(1)?.ayahs[0]?.ar ?? '';

export default function SurahReader() {
  const { number, ayah } = useLocalSearchParams<{ number: string; ayah?: string }>();
  const surahNo = Number(number);
  const surah = getSurah(surahNo);
  const targetAyah = ayah ? Number(ayah) : undefined;

  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<number, number>>({});
  const scrollY = useRef(0);
  const didScroll = useRef(false);
  const [highlight, setHighlight] = useState<number | undefined>(targetAyah);

  // Persist last-read: on open, and the topmost visible ayah on leave.
  useEffect(() => {
    if (!surah) return;
    setLastRead({ surah: surahNo, ayah: targetAyah ?? 1 });
    return () => {
      let top = 1;
      for (const a of surah.ayahs) {
        const y = positions.current[a.n];
        if (y === undefined) continue;
        if (y <= scrollY.current + 40) top = a.n;
        else break;
      }
      setLastRead({ surah: surahNo, ayah: top });
    };
  }, [surahNo, surah, targetAyah]);

  // Fade the highlight after a moment.
  useEffect(() => {
    if (highlight === undefined) return;
    const t = setTimeout(() => setHighlight(undefined), 3500);
    return () => clearTimeout(t);
  }, [highlight]);

  // When the target ayah reports its measured position, scroll straight to it.
  function onAyahLayout(ayahNum: number, y: number) {
    positions.current[ayahNum] = y;
    if (!didScroll.current && targetAyah && ayahNum === targetAyah) {
      didScroll.current = true;
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: false }));
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

  function onLongPressAyah(a: Ayah) {
    const text = `${a.ar}\n\n${a.en}\n\n— Qur'an ${surah!.number}:${a.n} (${surah!.englishName})`;
    Alert.alert(`Ayah ${surah!.number}:${a.n}`, undefined, [
      { text: 'Copy', onPress: () => Clipboard.setStringAsync(text) },
      { text: 'Share', onPress: () => Share.share({ message: text }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: surah.englishName, headerBackTitle: "Qur'an" }} />
      <ScrollView
        ref={scrollRef}
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

        {surah.ayahs.map((item) => (
          <Pressable
            key={item.n}
            onLayout={(e) => onAyahLayout(item.n, e.nativeEvent.layout.y)}
            onLongPress={() => onLongPressAyah(item)}
            delayLongPress={300}
            style={[styles.ayah, highlight === item.n && styles.ayahHighlight]}>
            <ThemedText style={styles.arabic}>{item.ar}</ThemedText>
            <View style={styles.transRow}>
              <View style={styles.numBadge}>
                <ThemedText style={styles.numText}>{item.n}</ThemedText>
              </View>
              <ThemedText style={styles.trans}>{item.en}</ThemedText>
            </View>
          </Pressable>
        ))}
      </ScrollView>
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
    paddingHorizontal: 8,
    marginHorizontal: -8,
    borderRadius: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
    gap: 12,
  },
  ayahHighlight: { backgroundColor: 'rgba(10,126,164,0.12)' },
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
