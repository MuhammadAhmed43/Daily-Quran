import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExplainSheet, type ExplainTarget } from '@/components/explain-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VerseSpeaker } from '@/components/verse-speaker';
import { setChatSeed } from '@/lib/chat-seed';
import { haptic } from '@/lib/haptics';
import { bumpHub, HUB_OPEN_WEIGHT } from '@/lib/hub-affinity';
import { getHub } from '@/lib/hubs';
import { getAyah, getSurah } from '@/lib/quran';
import { useRecitation } from '@/lib/recitation-context';
import { recordActivity } from '@/lib/streak';
import { useTranslation, verseText } from '@/lib/translations';

const ACCENT = '#0a7ea4';

export default function HubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const hub = getHub(String(id));
  const rec = useRecitation();
  const [explainTarget, setExplainTarget] = useState<ExplainTarget | null>(null);
  useTranslation(); // re-render the verses when the translation changes

  useEffect(() => {
    if (hub) {
      recordActivity('hub_opened');
      bumpHub(hub.id, HUB_OPEN_WEIGHT); // feeds adaptive "For you"
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub?.id]);

  if (!hub) {
    return (
      <ThemedView style={[styles.fill, styles.center]}>
        <Stack.Screen options={{ title: 'Find peace' }} />
        <ThemedText style={styles.muted}>This topic isn’t available.</ThemedText>
      </ThemedView>
    );
  }

  const talk = () => {
    haptic.light();
    setChatSeed(hub.starter, hub.id);
    router.push('/ask');
  };

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen options={{ title: hub.title, headerBackTitle: 'Back' }} />
      <SafeAreaView edges={['bottom']} style={styles.fill}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.emoji}>{hub.emoji}</ThemedText>
          <ThemedText style={styles.intro}>{hub.intro}</ThemedText>

          {hub.crisis ? (
            <View style={styles.crisis}>
              <ThemedText style={styles.crisisTitle}>You matter — please reach out</ThemedText>
              <ThemedText style={styles.crisisText}>
                If you’re in crisis or thinking about harming yourself, you don’t have to face it
                alone. Please contact your local emergency services or a crisis helpline now, and
                talk to someone you trust. Reaching out is strength, and help is real.
              </ThemedText>
            </View>
          ) : null}

          {hub.verses.length > 0 ? (
            <Pressable
              style={({ pressed }) => [styles.narrateBtn, pressed && styles.narratePressed]}
              onPress={() => {
                haptic.light();
                if (rec.queued) rec.stop();
                else rec.playList(hub.verses.map((v) => ({ surah: v.surah, ayah: v.ayah })));
              }}>
              <Ionicons name={rec.queued ? 'stop' : 'play'} size={16} color={ACCENT} />
              <ThemedText style={styles.narrateText}>
                {rec.queued ? 'Stop narration' : 'Narrate all verses'}
              </ThemedText>
            </Pressable>
          ) : null}

          {hub.verses.map((v) => {
            const a = getAyah(v.surah, v.ayah);
            const s = getSurah(v.surah);
            if (!a || !s) return null;
            return (
              <Pressable
                key={`${v.surah}:${v.ayah}`}
                style={({ pressed }) => [styles.verse, pressed && styles.versePressed]}
                onPress={() =>
                  setExplainTarget({
                    surah: v.surah,
                    ayah: v.ayah,
                    name: s.englishName,
                    ar: a.ar,
                    en: verseText(v.surah, v.ayah),
                  })
                }>
                <View style={styles.verseHead}>
                  <ThemedText style={styles.ref}>
                    {s.englishName} · {v.surah}:{v.ayah}
                  </ThemedText>
                  <VerseSpeaker surah={v.surah} ayah={v.ayah} size={18} />
                </View>
                <ThemedText style={styles.ar} numberOfLines={4}>
                  {a.ar}
                </ThemedText>
                <ThemedText style={styles.en}>{verseText(v.surah, v.ayah)}</ThemedText>
                <ThemedText style={styles.explainHint}>Tap to explain ›</ThemedText>
              </Pressable>
            );
          })}

        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.talkBtn} onPress={talk}>
            <Ionicons name="chatbubbles-outline" size={18} color="#fff" />
            <ThemedText style={styles.talkText}>Talk it through</ThemedText>
          </Pressable>
          <ThemedText style={styles.disclaimer}>
            A place for reflection and comfort — not a fatwa, and not a substitute for a qualified
            scholar or professional.
          </ThemedText>
        </View>
      </SafeAreaView>

      <ExplainSheet target={explainTarget} onClose={() => setExplainTarget(null)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  muted: { opacity: 0.6 },
  scroll: { padding: 16, paddingBottom: 16, gap: 14 },
  emoji: { fontSize: 40, textAlign: 'center', marginTop: 4 },
  intro: { fontSize: 16, lineHeight: 24, textAlign: 'center', opacity: 0.9, paddingHorizontal: 6 },
  crisis: {
    backgroundColor: 'rgba(214,84,84,0.10)',
    borderColor: 'rgba(214,84,84,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  crisisTitle: { fontSize: 15, fontWeight: '800', color: '#c1554f' },
  crisisText: { fontSize: 14, lineHeight: 21, opacity: 0.85 },
  verse: {
    backgroundColor: 'rgba(127,127,127,0.07)',
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  versePressed: { backgroundColor: 'rgba(10,126,164,0.10)' },
  verseHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ref: { color: ACCENT, fontSize: 13, fontWeight: '700' },
  ar: {
    fontFamily: 'AmiriQuran',
    fontSize: 22,
    lineHeight: 46,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  en: { fontSize: 15, lineHeight: 23, opacity: 0.85 },
  explainHint: { fontSize: 12, color: ACCENT, opacity: 0.8, fontWeight: '600' },
  narrateBtn: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(10,126,164,0.12)',
  },
  narratePressed: { opacity: 0.6 },
  narrateText: { color: ACCENT, fontSize: 14, fontWeight: '700' },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127,127,127,0.2)',
  },
  talkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 15,
    borderRadius: 14,
  },
  talkText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disclaimer: { fontSize: 11, opacity: 0.45, textAlign: 'center', lineHeight: 16 },
});
