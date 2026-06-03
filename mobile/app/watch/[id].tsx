import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type YoutubeIframeRef } from 'react-native-youtube-iframe';

import { FadeIn } from '@/components/fade-in';
import { ThemedText } from '@/components/themed-text';
import { YouTube } from '@/components/watch/youtube-player';
import { haptic } from '@/lib/haptics';
import { useRecitation } from '@/lib/recitation-context';
import { recordActivity } from '@/lib/streak';
import { getChapter, getChapters, neighbors, trackAccent } from '@/lib/watch';
import { markWatched as saveWatched, setPct as saveProgress, useWatchProgress } from '@/lib/watch-progress';

const GOLD = '#c8a24a';

export default function WatchPlayer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const recitation = useRecitation();
  const progress = useWatchProgress();
  const playerRef = useRef<YoutubeIframeRef>(null);
  const latest = useRef(0);
  const [pct, setLocalPct] = useState(0);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);

  const chapter = id ? getChapter(id) : undefined;

  // Opening a video counts toward the streak; and YouTube grabs the audio session, so stop any
  // recitation that's playing (same coordination Stories/voice already use). Reset per-video state.
  useEffect(() => {
    if (!chapter) return;
    setEnded(false);
    setLocalPct(0);
    setFailed(false);
    recitation.stop();
    recordActivity('watched');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Poll playback position for the watched-progress bar; persist every ~5s + on leave (throttled).
  useEffect(() => {
    if (!chapter) return;
    latest.current = 0;
    let tick = 0;
    const cid = chapter.id;
    const timer = setInterval(async () => {
      try {
        const cur = await playerRef.current?.getCurrentTime();
        const dur = await playerRef.current?.getDuration();
        if (cur != null && dur && dur > 0) {
          const p = Math.min(1, cur / dur);
          latest.current = p;
          setLocalPct(p);
          if (++tick % 5 === 0) saveProgress(cid, p);
        }
      } catch {}
    }, 1000);
    return () => {
      clearInterval(timer);
      if (latest.current > 0) saveProgress(cid, latest.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!chapter) {
    return (
      <View style={[styles.root, styles.center]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ThemedText style={styles.notFound}>Chapter not found.</ThemedText>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ThemedText style={styles.backLink}>Go back</ThemedText>
        </Pressable>
      </View>
    );
  }

  const list = getChapters(chapter.track);
  const pos = list.findIndex((c) => c.id === chapter.id) + 1;
  const { prev, next } = neighbors(chapter.id);
  const accent = trackAccent(chapter.track);
  const watched = progress.isWatched(chapter.id) || ended;
  const video = chapter.videos[0];

  const go = (cid: string) => {
    haptic.light();
    setEnded(false);
    setLocalPct(0);
    router.replace({ pathname: '/watch/[id]', params: { id: cid } });
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
      <SafeAreaView edges={['top']}>
        <View style={styles.topbar}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </Pressable>
          <View style={styles.crumb}>
            <ThemedText style={styles.crumbText}>
              {chapter.track === 'seerah' ? 'Seerah' : 'History'} · {pos} / {list.length}
            </ThemedText>
          </View>
          <View style={styles.iconBtn} />
        </View>
      </SafeAreaView>

      {failed ? (
        <View style={styles.failBox}>
          <Ionicons name="alert-circle-outline" size={28} color="rgba(255,255,255,0.6)" />
          <ThemedText style={styles.failText}>This video can’t play here.</ThemedText>
          <Pressable
            onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${video.youtubeId}`)}
            style={styles.failBtn}>
            <ThemedText style={styles.failBtnText}>Open in YouTube ↗</ThemedText>
          </Pressable>
        </View>
      ) : (
        <>
          <YouTube
            ref={playerRef}
            videoId={video.youtubeId}
            onError={() => setFailed(true)}
            onEnded={() => {
              setEnded(true);
              saveWatched(chapter.id);
              haptic.success();
            }}
          />
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, pct * 100)}%` }]} />
          </View>
        </>
      )}

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <FadeIn delay={120}>
          <ThemedText style={styles.kicker}>CHAPTER {chapter.order}</ThemedText>
          <ThemedText style={styles.title}>{chapter.title}</ThemedText>
          <ThemedText style={[styles.era, { color: accent }]}>{chapter.era}</ThemedText>
          <ThemedText style={styles.blurb}>{chapter.blurb}</ThemedText>
          <ThemedText style={styles.source}>Source: {video.source}</ThemedText>
        </FadeIn>

        <FadeIn delay={200}>
          <Pressable
            onPress={() => {
              haptic.light();
              progress.toggleWatched(chapter.id);
              setEnded(false);
            }}
            style={[styles.markBtn, watched ? styles.markDone : styles.markTodo]}>
            <Ionicons
              name={watched ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={watched ? GOLD : '#fff'}
            />
            <ThemedText style={[styles.markText, watched && { color: GOLD }]}>
              {watched ? 'Watched' : 'Mark as watched'}
            </ThemedText>
          </Pressable>
        </FadeIn>

        <FadeIn delay={280}>
          <View style={styles.nav}>
            <Pressable
              disabled={!prev}
              onPress={() => prev && go(prev.id)}
              style={[styles.navSide, !prev && styles.navDisabled]}>
              <ThemedText style={styles.navLabel}>PREVIOUS</ThemedText>
              <ThemedText style={styles.navTitle} numberOfLines={1}>
                {prev ? prev.title : '—'}
              </ThemedText>
            </Pressable>
            <View style={styles.navDivider} />
            <Pressable
              disabled={!next}
              onPress={() => next && go(next.id)}
              style={[styles.navSide, styles.navRight, !next && styles.navDisabled]}>
              <ThemedText style={[styles.navLabel, styles.navLabelRight]}>UP NEXT</ThemedText>
              <ThemedText style={[styles.navTitle, styles.navTitleRight]} numberOfLines={1}>
                {next ? next.title : '—'}
              </ThemedText>
            </Pressable>
          </View>
        </FadeIn>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0d12' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFound: { color: '#fff', fontSize: 16 },
  backLink: { color: GOLD, fontSize: 14, fontWeight: '600' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  crumb: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  crumbText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  progressFill: { height: '100%', backgroundColor: GOLD },
  failBox: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  failText: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  failBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  failBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  body: { padding: 20, paddingBottom: 48, gap: 18 },
  kicker: { color: GOLD, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', lineHeight: 30, marginTop: 6 },
  era: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  blurb: { color: 'rgba(255,255,255,0.86)', fontSize: 16, lineHeight: 25, marginTop: 10 },
  source: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 10 },
  markBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  markTodo: { backgroundColor: '#0a7ea4' },
  markDone: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  markText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  nav: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: 14,
  },
  navSide: { flex: 1, gap: 3 },
  navRight: { alignItems: 'flex-end' },
  navDisabled: { opacity: 0.3 },
  navDivider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },
  navLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  navLabelRight: { textAlign: 'right' },
  navTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  navTitleRight: { textAlign: 'right' },
});
