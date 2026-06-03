import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeIn } from '@/components/fade-in';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ChapterRow } from '@/components/watch/chapter-row';
import { ProgressRing } from '@/components/watch/progress-ring';
import { TrackSwitcher } from '@/components/watch/track-switcher';
import { haptic } from '@/lib/haptics';
import { getChapter, getChapters, TRACKS, trackAccent, ytThumb, type Track } from '@/lib/watch';
import { useWatchProgress } from '@/lib/watch-progress';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function WatchScreen() {
  const router = useRouter();
  const [track, setTrack] = useState<Track>('seerah');
  const progress = useWatchProgress();

  const chapters = getChapters(track);
  const accent = trackAccent(track);
  const meta = TRACKS.find((t) => t.key === track)!;
  const { done, total } = progress.perTrack(track);
  const cont = progress.continueChapter();
  const contCh = cont ? getChapter(cont.id) : undefined;

  const switchTrack = (t: Track) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTrack(t);
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Watch', headerBackTitle: 'Home' }} />
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText style={styles.h1}>Watch</ThemedText>
            <ThemedText style={styles.sub}>
              Follow the story in order — the Seerah, then the eras that grew from it.
            </ThemedText>
          </View>

          {contCh && cont ? (
            <Pressable
              style={styles.hero}
              onPress={() => {
                haptic.light();
                router.push({ pathname: '/watch/[id]', params: { id: contCh.id } });
              }}>
              <View style={styles.heroThumb}>
                <Image
                  source={{ uri: ytThumb(contCh.videos[0].youtubeId) }}
                  style={styles.heroThumbImg}
                  contentFit="cover"
                  transition={200}
                />
                <View style={styles.heroPlay}>
                  <Ionicons name="play" size={15} color="#fff" />
                </View>
                <View style={styles.heroResume}>
                  <View style={[styles.heroResumeFill, { width: `${Math.round(cont.pct * 100)}%` }]} />
                </View>
              </View>
              <View style={styles.heroBody}>
                <ThemedText style={styles.heroKicker}>CONTINUE WATCHING</ThemedText>
                <ThemedText style={styles.heroTitle} numberOfLines={2}>
                  {contCh.title}
                </ThemedText>
                <ThemedText style={styles.heroMeta}>
                  {contCh.track === 'seerah' ? 'Seerah' : 'History'} ·{' '}
                  {getChapters(contCh.track).findIndex((c) => c.id === contCh.id) + 1} of{' '}
                  {getChapters(contCh.track).length}
                </ThemedText>
              </View>
              <Ionicons name="play-circle" size={30} color="#0a7ea4" />
            </Pressable>
          ) : null}

          <TrackSwitcher value={track} onChange={switchTrack} />
          <ThemedText style={styles.trackSub}>{meta.subtitle}</ThemedText>

          <View style={[styles.summary, { backgroundColor: accent + '14', borderColor: accent + '38' }]}>
            <ProgressRing size={38} stroke={3.5} pct={total ? done / total : 0} color={accent}>
              <ThemedText style={styles.summaryCount}>{done}</ThemedText>
            </ProgressRing>
            <View style={styles.summaryBody}>
              <ThemedText style={styles.summaryLabel}>
                {done === 0 ? 'Start the timeline' : `${done} of ${total} watched`}
              </ThemedText>
              <View style={styles.barTrack}>
                <View
                  style={[styles.barFill, { width: `${total ? (done / total) * 100 : 0}%`, backgroundColor: accent }]}
                />
              </View>
            </View>
          </View>

          <View style={styles.timeline}>
            {chapters.map((ch, i) => (
              <FadeIn key={`${track}-${ch.id}`} delay={i * 40} duration={420}>
                <ChapterRow
                  chapter={ch}
                  isFirst={i === 0}
                  isLast={i === chapters.length - 1}
                  watched={progress.isWatched(ch.id)}
                  pct={progress.pctOf(ch.id)}
                  accent={accent}
                  onPress={() => {
                    haptic.light();
                    router.push({ pathname: '/watch/[id]', params: { id: ch.id } });
                  }}
                />
              </FadeIn>
            ))}
          </View>

          <ThemedText style={styles.disclaimer}>
            Videos are from third-party Sunni-mainstream creators, embedded from YouTube — a study
            aid, not an endorsement of every view expressed.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40, gap: 16 },
  header: { gap: 4 },
  h1: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  sub: { fontSize: 14, opacity: 0.6, lineHeight: 20 },
  trackSub: { fontSize: 13, opacity: 0.6, marginTop: -8 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryCount: { fontSize: 14, fontWeight: '800' },
  summaryBody: { flex: 1, gap: 8 },
  summaryLabel: { fontSize: 15, fontWeight: '700' },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(127,127,127,0.2)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  timeline: { marginTop: 2 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(10,126,164,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(10,126,164,0.2)',
  },
  heroThumb: {
    width: 104,
    height: 59,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
  heroThumbImg: { width: '100%', height: '100%' },
  heroPlay: {
    position: 'absolute',
    top: 18,
    left: 40,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroResume: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  heroResumeFill: { height: '100%', backgroundColor: '#0a7ea4' },
  heroBody: { flex: 1, gap: 2 },
  heroKicker: { fontSize: 11, fontWeight: '700', color: '#0a7ea4', letterSpacing: 0.5 },
  heroTitle: { fontSize: 15.5, fontWeight: '700', lineHeight: 20 },
  heroMeta: { fontSize: 12.5, opacity: 0.6 },
  disclaimer: { fontSize: 11, opacity: 0.45, lineHeight: 16, marginTop: 4 },
});
