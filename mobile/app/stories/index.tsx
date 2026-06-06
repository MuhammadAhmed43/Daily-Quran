// Stories library (onyx) — the Qur'an's narratives as illustrated, narrated storyboards. A cover-art card
// per story that opens the immersive player. Pushed from the Explore "Stories" tile as an app-level stack
// screen WITH a back button (matching Journeys / Watch / Reading). Re-skin + compose only; story data
// (lib/stories) is unchanged. Prophets are never depicted (aniconic art).
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { haptic } from '@/lib/haptics';
import { getStories, panelImage } from '@/lib/stories';
import { c, font, radius, space } from '@/lib/theme';

export default function StoriesLibrary() {
  const router = useRouter();
  const stories = getStories();

  return (
    <Screen edges={['top']} stars>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <IconButton name="chevron-back" onPress={() => router.back()} diameter={38} size={22} color={c.textPrimary} />
        <Txt variant="cardTitle">Stories</Txt>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Txt variant="subtitle" style={styles.intro}>
          The Qur&apos;an&apos;s narratives, illustrated — fully aniconic, every verse shown from the verified text.
        </Txt>

        {stories.map((s, i) => {
          const cover = panelImage(s.id, 1);
          return (
            <Animated.View key={s.id} entering={FadeInDown.delay(i * 50).duration(320)}>
              <PressableScale
                style={styles.card}
                onPress={() => {
                  haptic.light();
                  router.push({ pathname: '/stories/[id]', params: { id: s.id } });
                }}>
                <View style={styles.cover}>
                  {cover ? <Image source={cover} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} /> : null}
                  <LinearGradient colors={['transparent', 'rgba(5,5,5,0.55)', 'rgba(5,5,5,0.9)']} locations={[0.25, 0.7, 1]} style={StyleSheet.absoluteFill} />
                  <Txt style={styles.coverArabic}>{s.arabicName}</Txt>
                  <View style={styles.coverText}>
                    <Txt variant="h2" numberOfLines={1} style={styles.coverTitle}>
                      {s.title}
                    </Txt>
                    <Txt variant="caption" color={c.accent} numberOfLines={1}>
                      {s.subtitle}
                    </Txt>
                  </View>
                </View>
                <View style={styles.cardBody}>
                  <Txt variant="body" color={c.textSecondary} numberOfLines={3} style={styles.blurb}>
                    {s.blurb}
                  </Txt>
                  <View style={styles.footer}>
                    <Txt variant="eyebrow" color={c.textMuted}>
                      {s.panels.length} SCENES
                    </Txt>
                    <View style={styles.begin}>
                      <Txt variant="caption" color={c.accent} style={styles.beginText}>
                        Begin
                      </Txt>
                      <Ionicons name="arrow-forward" size={15} color={c.accent} />
                    </View>
                  </View>
                </View>
              </PressableScale>
            </Animated.View>
          );
        })}

        <Txt variant="caption" color={c.textMuted} style={styles.note}>
          Reverence by design: prophets are never depicted. Scenes are told through objects, light, and calligraphy — a study aid, not a ruling.
        </Txt>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.gutter, paddingBottom: 6, gap: 8 },
  spacer: { flex: 1 },
  scroll: { paddingHorizontal: space.gutter, paddingTop: space.xs, paddingBottom: space.section, gap: 16 },
  intro: { paddingBottom: 2 },

  card: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, backgroundColor: c.surface1 },
  cover: { aspectRatio: 16 / 10, backgroundColor: c.surface2, justifyContent: 'flex-end' },
  coverArabic: { position: 'absolute', top: 12, right: 14, fontFamily: 'AmiriQuran', fontSize: 28, lineHeight: 52, color: c.accent, writingDirection: 'rtl' },
  coverText: { padding: space.card, paddingBottom: 14, gap: 3 },
  coverTitle: { color: c.scriptureInk },

  cardBody: { padding: space.card, gap: 12 },
  blurb: { lineHeight: 22 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  begin: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  beginText: { fontFamily: font.sansBold },

  note: { textAlign: 'center', lineHeight: 16, paddingHorizontal: 8, marginTop: 2 },
});
