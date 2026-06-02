import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getStory, panelVerse, type Panel } from '@/lib/stories';

const BASE = '#0b0d12'; // immersive near-black base for the whole player

// Named "camera moves" for the Ken Burns drift — each scene gets one that fits its
// moment, so the storyboard feels hand-directed rather than uniform. Each value is a
// [start, end] pair the panel slowly ping-pongs between; base scale > 1 overscans the
// frame so a pan never reveals an edge.
const MOTIONS: Record<
  string,
  { scale: [number, number]; tx: [number, number]; ty: [number, number] }
> = {
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

  // Stable refs for FlatList viewability (RN requires these not to change between renders).
  const viewConfig = useRef({ itemVisiblePercentThreshold: 60 });
  const onViewRef = useRef((info: { viewableItems: ViewToken[] }) => {
    const first = info.viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  });

  if (!story) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: BASE }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.muted}>Story not found.</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backFallback}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
      </View>
    );
  }

  const total = story.panels.length;

  return (
    <View style={[styles.fill, { backgroundColor: BASE }]}>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />

      <FlatList
        data={story.panels}
        keyExtractor={(p) => String(p.n)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onViewableItemsChanged={onViewRef.current}
        viewabilityConfig={viewConfig.current}
        renderItem={({ item }) => (
          <PanelView panel={item} width={width} visualHeight={Math.round(height * 0.46)} />
        )}
      />

      {/* Top overlay: back + progress, with safe-area inset */}
      <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
        <Pressable onPress={() => router.back()} hitSlop={14} style={styles.iconBtn}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.crumb}>
          {story.title} · {index + 1} / {total}
        </Text>
        <View style={styles.iconBtn} />
      </SafeAreaView>

      {/* Bottom progress bar */}
      <SafeAreaView edges={['bottom']} style={styles.progressWrap} pointerEvents="none">
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((index + 1) / total) * 100}%` }]} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function PanelView({
  panel,
  width,
  visualHeight,
}: {
  panel: Panel;
  width: number;
  visualHeight: number;
}) {
  const verse = panelVerse(panel);

  // Subtle, slow "Ken Burns" drift so each still scene feels alive — a gentle
  // ping-pong eased in and out, in a direction chosen per scene (MOTIONS). Native-driver
  // transforms only, so it stays smooth off the JS thread. The duration is nudged by the
  // scene number so adjacent panels don't pulse in lockstep.
  const motion = MOTIONS[panel.motion ?? ''] ?? MOTIONS.zoomIn;
  const duration = 8500 + ((panel.n * 1300) % 4000);
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const leg = (toValue: number) =>
      Animated.timing(drift, {
        toValue,
        duration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      });
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
      {/* Visual area — real illustration once present, otherwise an art-direction placeholder.
          The inner layer drifts slowly to give the still scene a living, cinematic feel. */}
      <View style={[styles.visual, { height: visualHeight, backgroundColor: panel.color }]}>
        <Animated.View style={[StyleSheet.absoluteFill, driftStyle]}>
          {panel.image ? (
            <Image
              source={{ uri: panel.image }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={350}
            />
          ) : (
            <Placeholder panel={panel} />
          )}
        </Animated.View>
      </View>

      {/* Story content */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
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

        {/* Narration audio — wired once the Kokoro MP3s are generated */}
        <View style={styles.audioChip}>
          <Text style={styles.audioText}>
            {panel.audio ? '▶  Play narration' : '🔊  Narration coming soon'}
          </Text>
        </View>

        <Text style={styles.disclaimer}>
          The verse is the Qur'an's own words; the scene and retelling are an interpretation for
          reflection.
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
  muted: { color: 'rgba(255,255,255,0.6)', fontSize: 15 },

  page: { flex: 1, backgroundColor: BASE },

  visual: { width: '100%', overflow: 'hidden', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -40,
  },
  mark: { fontSize: 30, color: 'rgba(255,255,255,0.5)', marginBottom: 14 },
  visualText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 15,
    lineHeight: 23,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  inProgress: {
    position: 'absolute',
    bottom: 14,
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },

  contentScroll: { flex: 1 },
  content: { padding: 22, paddingTop: 18, paddingBottom: 48, gap: 10 },
  kicker: { color: '#c8a24a', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', lineHeight: 30 },
  narration: { color: 'rgba(255,255,255,0.86)', fontSize: 16, lineHeight: 25, marginTop: 2 },

  verseCard: {
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    gap: 10,
  },
  arabic: {
    fontFamily: 'AmiriQuran',
    fontSize: 24,
    lineHeight: 54,
    color: '#f6efe0',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  english: { color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 23 },
  ref: { color: '#c8a24a', fontSize: 13, fontWeight: '600' },

  audioChip: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  audioText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },

  disclaimer: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
    fontStyle: 'italic',
  },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  backText: { color: '#fff', fontSize: 28, fontWeight: '400', lineHeight: 30, marginTop: -2 },
  backFallback: { marginTop: 16 },
  crumb: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },

  progressWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16 },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: '#c8a24a' },
});
