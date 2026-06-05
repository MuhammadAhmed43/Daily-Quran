// Watch player (onyx). Topbar + embedded YouTube + a watched-progress bar, then chapter title/era/blurb,
// a Mark-watched button, and prev/next nav. Re-skin only: the player ref, progress polling + persistence,
// recitation hand-off, streak credit, and prev/next logic are unchanged.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type YoutubeIframeRef } from 'react-native-youtube-iframe';

import { FadeIn } from '@/components/fade-in';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Txt } from '@/components/ui/primitives';
import { YouTube } from '@/components/watch/youtube-player';
import { haptic } from '@/lib/haptics';
import { useRecitation } from '@/lib/recitation-context';
import { recordActivity } from '@/lib/streak';
import { c, font, radius, space } from '@/lib/theme';
import { getChapter, getChapters, neighbors } from '@/lib/watch';
import { markWatched as saveWatched, setPct as saveProgress, useWatchProgress } from '@/lib/watch-progress';

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

  useEffect(() => {
    if (!chapter) return;
    setEnded(false);
    setLocalPct(0);
    setFailed(false);
    recitation.stop();
    recordActivity('watched');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
        <Txt variant="body" color={c.textMuted}>
          Chapter not found.
        </Txt>
        <PressableScale onPress={() => router.back()}>
          <Txt variant="caption" color={c.accent}>
            Go back
          </Txt>
        </PressableScale>
      </View>
    );
  }

  const list = getChapters(chapter.track);
  const pos = list.findIndex((ch) => ch.id === chapter.id) + 1;
  const { prev, next } = neighbors(chapter.id);
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
          <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={24} color={c.textPrimary} />
          </PressableScale>
          <View style={styles.crumb}>
            <Txt variant="caption" style={styles.crumbText}>
              {chapter.track === 'seerah' ? 'Seerah' : 'History'} · {pos} / {list.length}
            </Txt>
          </View>
          <View style={styles.iconBtn} />
        </View>
      </SafeAreaView>

      {failed ? (
        <View style={styles.failBox}>
          <Ionicons name="alert-circle-outline" size={28} color={c.textMuted} />
          <Txt variant="body" color={c.textSecondary}>
            This video can&apos;t play here.
          </Txt>
          <PressableScale onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${video.youtubeId}`)} style={styles.failBtn}>
            <Txt variant="caption" color={c.textPrimary} style={styles.failBtnText}>
              Open in YouTube ↗
            </Txt>
          </PressableScale>
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
          <Txt variant="eyebrow">Chapter {chapter.order}</Txt>
          <Txt variant="h1" style={styles.title}>
            {chapter.title}
          </Txt>
          <Txt variant="caption" color={c.accent} style={styles.era}>
            {chapter.era}
          </Txt>
          <Txt style={styles.blurb}>{chapter.blurb}</Txt>
          <Txt variant="caption" color={c.textMuted} style={styles.source}>
            Source: {video.source}
          </Txt>
        </FadeIn>

        <FadeIn delay={200}>
          <PressableScale
            onPress={() => {
              haptic.light();
              progress.toggleWatched(chapter.id);
              setEnded(false);
            }}
            style={[styles.markBtn, watched ? styles.markDone : styles.markTodo]}>
            <Ionicons name={watched ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={watched ? c.accent : c.bg} />
            <Txt style={[styles.markText, watched && styles.markTextDone]}>{watched ? 'Watched' : 'Mark as watched'}</Txt>
          </PressableScale>
        </FadeIn>

        <FadeIn delay={280}>
          <View style={styles.nav}>
            <PressableScale disabled={!prev} onPress={() => prev && go(prev.id)} style={[styles.navSide, !prev && styles.navDisabled]}>
              <Txt variant="caption" color={c.textMuted} style={styles.navLabel}>
                PREVIOUS
              </Txt>
              <Txt variant="caption" numberOfLines={1} style={styles.navTitle}>
                {prev ? prev.title : '—'}
              </Txt>
            </PressableScale>
            <View style={styles.navDivider} />
            <PressableScale disabled={!next} onPress={() => next && go(next.id)} style={[styles.navSide, styles.navRight, !next && styles.navDisabled]}>
              <Txt variant="caption" color={c.textMuted} style={[styles.navLabel, styles.navLabelRight]}>
                UP NEXT
              </Txt>
              <Txt variant="caption" numberOfLines={1} style={[styles.navTitle, styles.navTitleRight]}>
                {next ? next.title : '—'}
              </Txt>
            </PressableScale>
          </View>
        </FadeIn>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2 },
  crumb: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, backgroundColor: c.surface2 },
  crumbText: { fontFamily: font.sansSemi, color: c.textSecondary },
  progressTrack: { height: 2, backgroundColor: c.surface3 },
  progressFill: { height: '100%', backgroundColor: c.accent },
  failBox: { width: '100%', aspectRatio: 16 / 9, backgroundColor: c.surface1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  failBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.full, backgroundColor: c.surface2 },
  failBtnText: { fontFamily: font.sansSemi },

  body: { padding: space.card, paddingBottom: 48, gap: 18 },
  title: { marginTop: 8, lineHeight: 33 },
  era: { fontFamily: font.sansSemi, marginTop: 4 },
  blurb: { fontFamily: font.serifReg, fontSize: 16.5, lineHeight: 26, color: c.scriptureInk, marginTop: 10 },
  source: { marginTop: 10 },

  markBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: radius.full },
  markTodo: { backgroundColor: c.primary },
  markDone: { backgroundColor: c.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
  markText: { fontFamily: font.sansBold, fontSize: 15, color: c.bg },
  markTextDone: { color: c.accent },

  nav: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairline, paddingTop: 14 },
  navSide: { flex: 1, gap: 3 },
  navRight: { alignItems: 'flex-end' },
  navDisabled: { opacity: 0.3 },
  navDivider: { width: StyleSheet.hairlineWidth, backgroundColor: c.hairline },
  navLabel: { fontFamily: font.sansBold, letterSpacing: 0.5 },
  navLabelRight: { textAlign: 'right' },
  navTitle: { fontFamily: font.sansSemi, color: c.textPrimary },
  navTitleRight: { textAlign: 'right' },
});
