import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { haptic } from '@/lib/haptics';
import { getChapter, getChapters, ytThumb } from '@/lib/watch';
import { useWatchProgress } from '@/lib/watch-progress';

// Home entry for the Watch feature. Smart "continue watching" when something's in progress
// (thumbnail + resume bar → jumps back into the player); otherwise a simple track-preview card.
export function WatchCard() {
  const router = useRouter();
  const progress = useWatchProgress();
  const cont = progress.continueChapter();
  const chapter = cont ? getChapter(cont.id) : undefined;

  if (cont && chapter) {
    const list = getChapters(chapter.track);
    const pos = list.findIndex((c) => c.id === chapter.id) + 1;
    return (
      <Pressable
        style={styles.card}
        onPress={() => {
          haptic.light();
          router.push('/watch');
        }}>
        <View style={styles.thumb}>
          <Image
            source={{ uri: ytThumb(chapter.videos[0].youtubeId) }}
            style={styles.thumbImg}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.playChip}>
            <Ionicons name="play" size={11} color="#fff" />
          </View>
          <View style={styles.resumeTrack}>
            <View style={[styles.resumeFill, { width: `${Math.round(cont.pct * 100)}%` }]} />
          </View>
        </View>
        <View style={styles.body}>
          <ThemedText style={styles.kicker}>CONTINUE WATCHING</ThemedText>
          <ThemedText style={styles.title} numberOfLines={1}>
            {chapter.title}
          </ThemedText>
          <ThemedText style={styles.meta}>
            {chapter.track === 'seerah' ? 'Seerah' : 'History'} · {pos} of {list.length}
          </ThemedText>
        </View>
        <ThemedText style={styles.arrow}>›</ThemedText>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={styles.card}
      onPress={() => {
        haptic.light();
        router.push('/watch');
      }}>
      <View style={styles.iconWell}>
        <Ionicons name="play-circle" size={24} color="#0a7ea4" />
      </View>
      <View style={styles.body}>
        <ThemedText style={styles.title}>Watch</ThemedText>
        <ThemedText style={styles.meta}>The Seerah & the eras of Islam, in order</ThemedText>
      </View>
      <ThemedText style={styles.arrow}>›</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(10,126,164,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(10,126,164,0.2)',
  },
  thumb: {
    width: 96,
    height: 54,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
  thumbImg: { width: '100%', height: '100%' },
  playChip: {
    position: 'absolute',
    top: 16,
    left: 37,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  resumeFill: { height: '100%', backgroundColor: '#0a7ea4' },
  iconWell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,126,164,0.12)',
  },
  body: { flex: 1, gap: 2 },
  kicker: { fontSize: 11, fontWeight: '700', color: '#0a7ea4', letterSpacing: 0.5 },
  title: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13, opacity: 0.6 },
  arrow: { fontSize: 22, opacity: 0.4 },
});
