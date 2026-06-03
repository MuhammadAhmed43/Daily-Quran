import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { haptic } from '@/lib/haptics';
import { useRecitation } from '@/lib/recitation-context';

const ACCENT = '#0a7ea4';

/** A speaker button that recites a single ayah (Arabic, from the same reciter the reader uses).
 *  Routed through the global recitation engine, so tapping it stops anything else that's playing
 *  and the mini-player reflects it — no overlapping audio. Plays just this verse, then stops. */
export function VerseSpeaker({
  surah,
  ayah,
  size = 20,
  color = ACCENT,
}: {
  surah: number;
  ayah: number;
  size?: number;
  color?: string;
}) {
  const rec = useRecitation();
  const isThis = rec.playing?.surah === surah && rec.playing?.ayah === ayah;
  const loading = isThis && rec.loading;
  const playing = isThis && !rec.paused && !rec.loading;
  const paused = isThis && rec.paused;
  const icon = playing ? 'pause-circle' : paused ? 'play-circle' : 'volume-high';

  return (
    <Pressable
      hitSlop={10}
      onPress={() => {
        haptic.light();
        rec.toggleAyah(surah, ayah);
      }}
      style={styles.btn}
      accessibilityRole="button"
      accessibilityLabel={playing ? 'Pause recitation' : 'Play recitation'}>
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name={icon} size={size} color={color} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
