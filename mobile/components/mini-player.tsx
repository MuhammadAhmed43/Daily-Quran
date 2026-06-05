import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReciterSheet } from '@/components/reciter-sheet';
import { SkyBand } from '@/components/sky-band';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Txt } from '@/components/ui/primitives';
import { haptic } from '@/lib/haptics';
import { getSurah } from '@/lib/quran';
import { useRecitation } from '@/lib/recitation-context';
import { c, font, radius } from '@/lib/theme';

// A slim "now reciting" bar that floats above the tab bar whenever something is playing: tap back into the
// surah, switch the reciter, or pause/stop. Pitch-black with a small drifting constellation (same starlight
// as the notch band). Recitation logic preserved — `chooseReciter` restarts the current ayah in the new voice.
export function MiniPlayer() {
  const ctx = useRecitation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [reciterOpen, setReciterOpen] = useState(false);

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
    <View style={[styles.shadow, { bottom: insets.bottom + 50 }]}>
      <View style={styles.bar}>
        <SkyBand height={54} count={14} seed={0x9a2e} />
        <PressableScale style={styles.info} onPress={open} hitSlop={6}>
          <Ionicons name="musical-notes" size={18} color={c.accent} />
          <Txt style={styles.text} numberOfLines={1}>
            {ctx.loading ? 'Loading…' : `Reciting ${surah}:${ayah}`}
            <Txt style={styles.sub}>{`  ·  ${name}`}</Txt>
          </Txt>
        </PressableScale>
        <PressableScale
          onPress={() => {
            haptic.light();
            setReciterOpen(true);
          }}
          hitSlop={10}
          style={styles.btn}>
          <Ionicons name="person-circle-outline" size={22} color={c.textSecondary} />
        </PressableScale>
        <PressableScale onPress={togglePlay} hitSlop={10} style={styles.btn}>
          <Ionicons name={ctx.paused ? 'play' : 'pause'} size={22} color={c.textPrimary} />
        </PressableScale>
        <PressableScale onPress={stop} hitSlop={10} style={styles.btn}>
          <Ionicons name="close" size={20} color={c.textMuted} />
        </PressableScale>
      </View>

      <ReciterSheet visible={reciterOpen} currentId={ctx.reciter.id} onClose={() => setReciterOpen(false)} onSelect={ctx.chooseReciter} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Outer holds the float shadow (no overflow, so the shadow isn't clipped); inner clips the starfield.
  shadow: {
    position: 'absolute',
    left: 8,
    right: 8,
    borderRadius: radius.md,
    backgroundColor: c.bg,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: c.bg, // pitch black
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassLip,
  },
  info: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { flex: 1, fontFamily: font.sansSemi, fontSize: 14, color: c.textPrimary },
  sub: { fontFamily: font.sans, fontSize: 12, color: c.textMuted },
  btn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
