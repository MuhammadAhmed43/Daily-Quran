import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Share, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui/primitives';
import { toggleBookmark, useBookmarks } from '@/lib/bookmarks';
import { haptic } from '@/lib/haptics';
import type { Ayah, Surah } from '@/lib/quran';
import { c, font, radius } from '@/lib/theme';
import { verseText } from '@/lib/translations';

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
  const text = `${shown.ar}\n\n${verseText(surah.number, shown.n)}\n\n— Qur'an ${surah.number}:${shown.n} (${surah.englishName})`;
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
        <View style={styles.sheet}>
          <View style={styles.card}>
            <Txt variant="caption" color={c.accent} style={styles.ref}>
              {refLabel}
            </Txt>
            <Txt style={styles.ar} numberOfLines={3}>
              {shown.ar}
            </Txt>
            <Txt style={styles.en} numberOfLines={3}>
              {verseText(surah.number, shown.n)}
            </Txt>
          </View>

          <Row icon="sparkles-outline" label="Explain this verse" onPress={() => act(() => onExplain(shown))} />
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
        </View>
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
      <Ionicons name={icon} size={22} color={c.accent} />
      <Txt variant="body" color={active ? c.accent : c.textPrimary} style={active ? styles.rowLabelActive : undefined}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  sheetWrap: { paddingHorizontal: 12 },
  sheet: {
    backgroundColor: c.surface2,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    padding: 8,
    paddingBottom: 12,
    marginBottom: 28,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: 'rgba(201,189,166,0.08)',
    borderRadius: radius.md,
    padding: 14,
    gap: 8,
    marginBottom: 6,
  },
  ref: { fontFamily: font.sansBold, letterSpacing: 0.3 },
  ar: { fontFamily: font.arabic, fontSize: 22, lineHeight: 46, color: c.scriptureInk, textAlign: 'right', writingDirection: 'rtl' },
  en: { fontFamily: font.serifReg, fontSize: 15, lineHeight: 22, color: c.scriptureInk },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  rowPressed: { backgroundColor: c.surface3 },
  rowLabelActive: { fontFamily: font.sansSemi },
});
