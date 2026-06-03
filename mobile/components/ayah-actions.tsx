import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { toggleBookmark, useBookmarks } from '@/lib/bookmarks';
import { haptic } from '@/lib/haptics';
import type { Ayah, Surah } from '@/lib/quran';

const ACCENT = '#0a7ea4';

type Props = {
  ayah: Ayah | null; // non-null = open; set to null to dismiss
  surah: Surah;
  onClose: () => void;
  onPlay: (n: number) => void;
  onExplain: (ayah: Ayah) => void;
};

// A focus overlay: long-press lifts the chosen ayah into a sharp card while everything behind
// it blurs out, with its actions right there — so you're clearly acting on *that* ayah.
export function AyahActions({ ayah, surah, onClose, onPlay, onExplain }: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<Ayah | null>(ayah);
  const bookmarks = useBookmarks();

  useEffect(() => {
    if (ayah) {
      setShown(ayah);
      Animated.timing(anim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else if (shown) {
      Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setShown(null);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ayah]);

  if (!shown) return null;

  const refLabel = `${surah.englishName} · ${surah.number}:${shown.n}`;
  const text = `${shown.ar}\n\n${shown.en}\n\n— Qur'an ${surah.number}:${shown.n} (${surah.englishName})`;
  const sheetY = anim.interpolate({ inputRange: [0, 1], outputRange: [60, 0] });
  const saved = bookmarks.some((b) => b.surah === surah.number && b.ayah === shown.n);

  const act = (fn: () => void) => {
    haptic.light();
    fn();
    onClose();
  };

  return (
    <Animated.View style={[styles.root, { opacity: anim }]} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>

      <Animated.View style={[styles.sheetWrap, { transform: [{ translateY: sheetY }] }]} pointerEvents="box-none">
        <ThemedView style={styles.sheet}>
          <View style={styles.card}>
            <ThemedText style={styles.ref}>{refLabel}</ThemedText>
            <ThemedText style={styles.ar} numberOfLines={3}>
              {shown.ar}
            </ThemedText>
            <ThemedText style={styles.en} numberOfLines={3}>
              {shown.en}
            </ThemedText>
          </View>

          <Row
            icon="sparkles-outline"
            label="Explain this verse"
            onPress={() => act(() => onExplain(shown))}
          />
          <Row
            icon={saved ? 'bookmark' : 'bookmark-outline'}
            label={saved ? 'Saved — tap to remove' : 'Bookmark'}
            active={saved}
            onPress={() => {
              haptic.light();
              void toggleBookmark(surah.number, shown.n);
            }}
          />
          <Row icon="play-circle" label="Play from here" onPress={() => act(() => onPlay(shown.n))} />
          <Row icon="copy-outline" label="Copy" onPress={() => act(() => void Clipboard.setStringAsync(text))} />
          <Row icon="share-outline" label="Share" onPress={() => act(() => void Share.share({ message: text }))} />
        </ThemedView>
      </Animated.View>
    </Animated.View>
  );
}

function Row({
  icon,
  label,
  onPress,
  active,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <Ionicons name={icon} size={22} color={ACCENT} />
      <ThemedText style={[styles.rowLabel, active && styles.rowLabelActive]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  sheetWrap: { paddingHorizontal: 12 },
  sheet: {
    borderRadius: 20,
    padding: 8,
    paddingBottom: 12,
    marginBottom: 28,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: 'rgba(10,126,164,0.10)',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginBottom: 6,
  },
  ref: { color: ACCENT, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  ar: {
    fontFamily: 'AmiriQuran',
    fontSize: 22,
    lineHeight: 46,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  en: { fontSize: 15, lineHeight: 22, opacity: 0.85 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  rowPressed: { backgroundColor: 'rgba(127,127,127,0.12)' },
  rowLabel: { fontSize: 16, fontWeight: '500' },
  rowLabelActive: { color: ACCENT, fontWeight: '600' },
});
