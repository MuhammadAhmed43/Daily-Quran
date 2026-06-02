import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { haptic } from '@/lib/haptics';
import { getSurah } from '@/lib/quran';
import { useRecitation } from '@/lib/recitation-context';

const ACCENT = '#0a7ea4';

// A slim "now reciting" bar that sits just above the tab bar whenever something is playing, so
// you can pause/stop or tap back into the surah from anywhere in the app.
export function MiniPlayer() {
  const ctx = useRecitation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (!ctx.playing) return null;
  const { surah, ayah } = ctx.playing;
  const name = getSurah(surah)?.englishName ?? `Surah ${surah}`;

  const open = () => {
    haptic.light();
    router.push({ pathname: '/surah/[number]', params: { number: String(surah), ayah: String(ayah) } });
  };
  const togglePlay = () => {
    haptic.light();
    if (ctx.paused) ctx.resume();
    else ctx.pause();
  };
  const stop = () => {
    haptic.light();
    ctx.stop();
  };

  return (
    <ThemedView style={[styles.bar, { bottom: insets.bottom + 50 }]}>
      <Pressable style={styles.info} onPress={open} hitSlop={6}>
        <Ionicons name="musical-notes" size={18} color={ACCENT} />
        <ThemedText style={styles.text} numberOfLines={1}>
          {ctx.loading ? 'Loading…' : `Reciting ${surah}:${ayah}`}
          <ThemedText style={styles.sub}>{`  ·  ${name}`}</ThemedText>
        </ThemedText>
      </Pressable>
      <Pressable onPress={togglePlay} hitSlop={10} style={styles.btn}>
        <Ionicons name={ctx.paused ? 'play' : 'pause'} size={22} color={ACCENT} />
      </Pressable>
      <Pressable onPress={stop} hitSlop={10} style={styles.btn}>
        <Ionicons name="close" size={20} color={ACCENT} />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  info: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { flex: 1, fontSize: 14, fontWeight: '600' },
  sub: { fontSize: 12, fontWeight: '400', opacity: 0.6 },
  btn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
});
