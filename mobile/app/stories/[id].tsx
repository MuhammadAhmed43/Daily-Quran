// Story player (onyx, immersive). A horizontal paging storyboard: each panel = a cinematic visual with a
// slow per-scene Ken Burns drift + the story content (serif scene title, app-voice narration, the verse from
// the verified bundle) below; auto-narration glides scene to scene. Re-skin only — the FlatList paging,
// expo-audio narration + auto-advance chain, recitation hand-off, Ken Burns motion, and verse resolution
// are all unchanged. Prophets are never depicted (aniconic art).
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRecitation } from '@/lib/recitation-context';
import { getStory, panelAudio, panelImage, panelVerse, type Panel } from '@/lib/stories';
import { c, font, radius } from '@/lib/theme';

const BASE = c.bg; // immersive near-black onyx base for the whole player

// Named "camera moves" for the Ken Burns drift — each scene gets one that fits its moment. Each value is a
// [start, end] pair the panel slowly ping-pongs between; base scale > 1 overscans so a pan never reveals an edge.
const MOTIONS: Record<string, { scale: [number, number]; tx: [number, number]; ty: [number, number] }> = {
  zoomIn: { scale: [1.04, 1.15], tx: [0, 0], ty: [0, 0] },
  zoomOut: { scale: [1.15, 1.04], tx: [0, 0], ty: [0, 0] },
  panLeft: { scale: [1.11, 1.11], tx: [10, -10], ty: [0, 0] },
  panRight: { scale: [1.11, 1.11], tx: [-10, 10], ty: [0, 0] },
  rise: { scale: [1.11, 1.11], tx: [0, 0], ty: [10, -10] },
  sink: { scale: [1.11, 1.11], tx: [0, 0], ty: [-10, 10] },
};

export default function StoryPlayer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const story = getStory(id);
  const [index, setIndex] = useState(0);
  const recitation = useRecitation();

  // Stable refs for FlatList viewability (RN requires these not to change between renders).
  const viewConfig = useRef({ itemVisiblePercentThreshold: 60 });
  const onViewRef = useRef((info: { viewableItems: ViewToken[] }) => {
    const first = info.viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  });

  // Narration playback. One player, re-pointed to the active scene's clip. Auto-narration is on by default:
  // it starts on scene 1, and when a clip ends it gracefully advances + keeps narrating — until you pause.
  const listRef = useRef<FlatList<Panel>>(null);
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const autoNarrate = useRef(true);

  useEffect(() => {
    recitation.stop();
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!story) return;
    const src = panelAudio(story.id, story.panels[index].n);
    if (src == null) return;
    player.replace(src);
    player.seekTo(0);
    if (autoNarrate.current) player.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    if (autoNarrate.current && status.isLoaded && !status.playing && !status.didJustFinish && status.currentTime < 0.25) {
      player.play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.isLoaded]);

  useEffect(() => {
    if (!story || !status.didJustFinish || !autoNarrate.current) return;
    if (index >= story.panels.length - 1) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.didJustFinish]);

  if (!story) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: BASE }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.muted}>Story not found.</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backFallback}>
          <Text style={styles.backFallbackText}>‹ Back</Text>
        </Pressable>
      </View>
    );
  }

  const total = story.panels.length;
  const toggleNarration = () => {
    if (status.playing) {
      autoNarrate.current = false;
      player.pause();
    } else {
      autoNarrate.current = true;
      player.seekTo(0);
      player.play();
    }
  };

  return (
    <View style={[styles.fill, { backgroundColor: BASE }]}>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />

      <FlatList
        ref={listRef}
        data={story.panels}
        keyExtractor={(p) => String(p.n)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={viewConfig.current}
        renderItem={({ item }) => <PanelView panel={item} storyId={story.id} width={width} visualHeight={Math.round(height * 0.46)} />}
      />

      {/* Top overlay: back + progress */}
      <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} hitSlop={14} style={styles.glassDisc}>
          <BlurView intensity={30} tint="systemThinMaterialDark" style={StyleSheet.absoluteFill} />
          <View style={styles.glassRim} pointerEvents="none" />
          <Ionicons name="chevron-back" size={21} color={c.textPrimary} />
        </Pressable>
        <View style={styles.crumb}>
          <BlurView intensity={30} tint="systemThinMaterialDark" style={StyleSheet.absoluteFill} />
          <View style={styles.glassRimPill} pointerEvents="none" />
          <Text style={styles.crumbText}>
            {story.title} · {index + 1} / {total}
          </Text>
        </View>
        <View style={styles.glassDisc} />
      </SafeAreaView>

      {/* Bottom: Listen control + progress */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBar} pointerEvents="box-none">
        <Pressable onPress={toggleNarration} hitSlop={8} style={styles.narrateBtn}>
          <BlurView intensity={32} tint="systemThinMaterialDark" style={StyleSheet.absoluteFill} />
          <View style={styles.glassRimPill} pointerEvents="none" />
          <Ionicons name={status.playing ? 'pause' : 'headset'} size={15} color={c.accentBright} style={styles.narrateIcon} />
          <Text style={styles.narrateText}>{status.playing ? 'Narrating…' : 'Listen'}</Text>
        </Pressable>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((index + 1) / total) * 100}%` }]} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function PanelView({ panel, storyId, width, visualHeight }: { panel: Panel; storyId: string; width: number; visualHeight: number }) {
  const verse = panelVerse(panel);
  const localImg = panelImage(storyId, panel.n);

  // Subtle, slow Ken Burns drift — a gentle ping-pong eased in and out, per-scene direction (MOTIONS).
  // Native-driver transforms only. Duration nudged by the scene number so adjacent panels don't pulse in sync.
  const motion = MOTIONS[panel.motion ?? ''] ?? MOTIONS.zoomIn;
  const duration = 8500 + ((panel.n * 1300) % 4000);
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const leg = (toValue: number) => Animated.timing(drift, { toValue, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true });
    const loop = Animated.loop(Animated.sequence([leg(1), leg(0)]));
    loop.start();
    return () => loop.stop();
  }, [drift, duration]);
  const driftStyle = {
    transform: [
      { scale: drift.interpolate({ inputRange: [0, 1], outputRange: motion.scale }) },
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: motion.tx }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: motion.ty }) },
    ],
  };

  return (
    <View style={[styles.page, { width }]}>
      <View style={[styles.visual, { height: visualHeight, backgroundColor: panel.color }]}>
        <Animated.View style={[StyleSheet.absoluteFill, driftStyle]}>
          {localImg ? (
            <Image source={localImg} style={StyleSheet.absoluteFill} contentFit="cover" transition={350} />
          ) : panel.image ? (
            <Image source={{ uri: panel.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={350} />
          ) : (
            <Placeholder panel={panel} />
          )}
        </Animated.View>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>SCENE {panel.n}</Text>
        <Text style={styles.title}>{panel.title}</Text>
        <Text style={styles.narration}>{panel.narration}</Text>

        {verse && (
          <View style={styles.verseCard}>
            <Text style={styles.arabic}>{verse.ar}</Text>
            <Text style={styles.english}>{verse.en}</Text>
            <Text style={styles.ref}>
              Surah {verse.surahEnglish} · {verse.ref}
            </Text>
          </View>
        )}

        <Text style={styles.disclaimer}>
          {"The verse is the Qur'an's own words; the scene and retelling are an interpretation for reflection."}
        </Text>
      </ScrollView>
    </View>
  );
}

function Placeholder({ panel }: { panel: Panel }) {
  return (
    <View style={[styles.fill, styles.center]}>
      <View style={styles.glow} />
      <Text style={styles.mark}>✦</Text>
      <Text style={styles.visualText}>{panel.visual}</Text>
      <Text style={styles.inProgress}>ANICONIC ILLUSTRATION · IN PROGRESS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  muted: { color: c.textSecondary, fontSize: 15, fontFamily: font.sans },

  page: { flex: 1, backgroundColor: BASE },

  visual: { width: '100%', overflow: 'hidden', justifyContent: 'center' },
  glow: { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: 'rgba(201,189,166,0.06)', top: -40 },
  mark: { fontSize: 30, color: c.accent, marginBottom: 14 },
  visualText: { color: c.textSecondary, fontSize: 15, lineHeight: 23, fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 30, fontFamily: font.serifReg },
  inProgress: { position: 'absolute', bottom: 14, color: c.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1, fontFamily: font.sansBold },

  contentScroll: { flex: 1 },
  content: { padding: 22, paddingTop: 18, paddingBottom: 48, gap: 10 },
  kicker: { color: c.accent, fontSize: 12, letterSpacing: 1.5, fontFamily: font.sansBold },
  title: { color: c.scriptureInk, fontSize: 25, lineHeight: 31, fontFamily: font.serif },
  narration: { color: c.textSecondary, fontSize: 16, lineHeight: 25, marginTop: 2, fontFamily: font.serifReg },

  verseCard: {
    marginTop: 8,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: 'rgba(201,189,166,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,189,166,0.22)',
    gap: 10,
  },
  arabic: { fontFamily: 'AmiriQuran', fontSize: 24, lineHeight: 54, color: c.scriptureInk, textAlign: 'right', writingDirection: 'rtl' },
  english: { color: c.textSecondary, fontSize: 15, lineHeight: 23, fontFamily: font.serifReg },
  ref: { color: c.accent, fontSize: 13, fontFamily: font.sansSemi },

  disclaimer: { color: c.textMuted, fontSize: 11, lineHeight: 16, marginTop: 8, fontStyle: 'italic', fontFamily: font.sans },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  glassDisc: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, overflow: 'hidden' },
  glassRim: { ...StyleSheet.absoluteFillObject, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },
  glassRimPill: { ...StyleSheet.absoluteFillObject, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },
  backFallback: { marginTop: 16 },
  backFallbackText: { color: c.textPrimary, fontSize: 16, fontFamily: font.sansSemi },
  crumb: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, overflow: 'hidden' },
  crumbText: { color: c.textPrimary, fontSize: 13, fontFamily: font.sansSemi },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16 },
  narrateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-end',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  narrateIcon: { marginLeft: -1 },
  narrateText: { color: c.accentBright, fontSize: 14, fontFamily: font.sansBold },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 6, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: c.accent },
});
