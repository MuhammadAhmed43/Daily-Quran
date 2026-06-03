import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ProgressRing } from '@/components/watch/progress-ring';
import { fmtDuration, ytThumb, type Chapter } from '@/lib/watch';

// One row on the vertical timeline: a numbered node (hollow / progress-ring / filled ✓) sitting on
// a connector spine, then the video thumbnail, title, era, and duration. The connector is drawn as
// two per-row halves so it survives any row height; the half above a watched node tints to the
// track accent for a Duolingo-style "filled path."
export function ChapterRow({
  chapter,
  isFirst,
  isLast,
  watched,
  pct,
  accent,
  onPress,
}: {
  chapter: Chapter;
  isFirst: boolean;
  isLast: boolean;
  watched: boolean;
  pct: number;
  accent: string;
  onPress: () => void;
}) {
  const inProgress = !watched && pct > 0.01;
  const video = chapter.videos[0];

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.gutter}>
        {!isFirst ? (
          <View style={[styles.connTop, watched && { backgroundColor: accent + '66' }]} />
        ) : null}
        {!isLast ? <View style={styles.connBottom} /> : null}
        <View style={styles.node}>
          {watched ? (
            <View style={[styles.nodeFill, { backgroundColor: accent }]}>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </View>
          ) : inProgress ? (
            <ProgressRing size={28} pct={pct} color={accent}>
              <ThemedText style={styles.nodeNum}>{chapter.order}</ThemedText>
            </ProgressRing>
          ) : (
            <View style={styles.nodeHollow}>
              <ThemedText style={styles.nodeNum}>{chapter.order}</ThemedText>
            </View>
          )}
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.thumb}>
          <Image
            source={{ uri: ytThumb(video.youtubeId) }}
            style={styles.thumbImg}
            contentFit="cover"
            transition={250}
          />
          <View style={styles.playChip}>
            <Ionicons name="play" size={11} color="#fff" />
          </View>
        </View>

        <View style={styles.text}>
          <ThemedText style={[styles.title, watched && styles.recede]} numberOfLines={2}>
            {chapter.title}
          </ThemedText>
          <ThemedText style={[styles.era, { color: accent }, watched && styles.recedeEra]} numberOfLines={1}>
            {chapter.era}
          </ThemedText>
          <View style={styles.meta}>
            <ThemedText style={styles.metaText}>{fmtDuration(video.durationSec)}</ThemedText>
            {inProgress ? (
              <ThemedText style={[styles.pct, { color: accent }]}>{Math.round(pct * 100)}%</ThemedText>
            ) : null}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color="rgba(127,127,127,0.4)" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  rowPressed: { backgroundColor: 'rgba(127,127,127,0.10)', borderRadius: 14 },
  gutter: { width: 44, position: 'relative' },
  connTop: {
    position: 'absolute',
    left: 21,
    top: 0,
    height: '50%',
    width: 2,
    backgroundColor: 'rgba(127,127,127,0.25)',
  },
  connBottom: {
    position: 'absolute',
    left: 21,
    top: '50%',
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(127,127,127,0.25)',
  },
  node: { position: 'absolute', left: 8, top: '50%', marginTop: -14, width: 28, height: 28 },
  nodeFill: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  nodeHollow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(127,127,127,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeNum: { fontSize: 13, fontWeight: '700' },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingRight: 12,
  },
  thumb: {
    width: 112,
    height: 63,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
  thumbImg: { width: '100%', height: '100%' },
  playChip: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 3 },
  title: { fontSize: 15.5, fontWeight: '700', lineHeight: 20 },
  recede: { opacity: 0.6 },
  era: { fontSize: 12, fontWeight: '600' },
  recedeEra: { opacity: 0.7 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 1 },
  metaText: { fontSize: 12, opacity: 0.55 },
  pct: { fontSize: 12, fontWeight: '600' },
});
