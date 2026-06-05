// HUB DETAIL (onyx) — a topical comfort page: a champagne icon, a serif intro, an optional crisis-care
// card (helpline before scripture), comforting verses (tap -> ExplainSheet, per-verse Listen, narrate
// all), and a Talk-it-through footer that seeds the assistant. Onyx reskin only — all logic preserved
// (recordActivity / bumpHub / playList / setChatSeed / ExplainSheet).
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ExplainSheet, type ExplainTarget } from '@/components/explain-sheet';
import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { VerseSpeaker } from '@/components/verse-speaker';
import { setChatSeed } from '@/lib/chat-seed';
import { haptic } from '@/lib/haptics';
import { bumpHub, HUB_OPEN_WEIGHT } from '@/lib/hub-affinity';
import { hubIcon } from '@/lib/hub-visuals';
import { getHub } from '@/lib/hubs';
import { getAyah, getSurah } from '@/lib/quran';
import { useRecitation } from '@/lib/recitation-context';
import { recordActivity } from '@/lib/streak';
import { c, font, glow, radius, space } from '@/lib/theme';
import { useTranslation, verseText } from '@/lib/translations';

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
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <IconButton name="chevron-back" onPress={() => router.back()} diameter={38} size={22} bg={c.surface2} color={c.textPrimary} />
          <Txt variant="cardTitle" style={styles.headerTitle}>
            Find peace
          </Txt>
          <View style={styles.spacer} />
        </View>
        <View style={styles.center}>
          <Txt variant="body" color={c.textMuted}>
            This topic isn’t available.
          </Txt>
        </View>
      </Screen>
    );
  }

  const talk = () => {
    haptic.light();
    setChatSeed(hub.starter, hub.id);
    router.push('/ask');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <IconButton name="chevron-back" onPress={() => router.back()} diameter={38} size={22} bg={c.surface2} color={c.textPrimary} />
        <Txt variant="cardTitle" numberOfLines={1} style={styles.headerTitle}>
          {hub.title}
        </Txt>
        <View style={styles.spacer} />
      </View>

      <ScrollView style={styles.fill} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Ionicons name={hubIcon(hub.id)} size={30} color={c.accent} />
        </View>
        <Txt style={styles.intro}>{hub.intro}</Txt>

        {hub.crisis ? (
          <View style={styles.crisis}>
            <Txt style={styles.crisisTitle}>You matter — please reach out</Txt>
            <Txt variant="body" color={c.textSecondary} style={styles.crisisText}>
              If you’re in crisis or thinking about harming yourself, you don’t have to face it alone. Please contact your local
              emergency services or a crisis helpline now, and talk to someone you trust. Reaching out is strength, and help is real.
            </Txt>
          </View>
        ) : null}

        {hub.verses.length > 0 ? (
          <PressableScale
            style={styles.narrateBtn}
            onPress={() => {
              haptic.light();
              if (rec.queued) rec.stop();
              else rec.playList(hub.verses.map((v) => ({ surah: v.surah, ayah: v.ayah })));
            }}>
            <Ionicons name={rec.queued ? 'stop' : 'headset'} size={16} color={c.accent} />
            <Txt style={styles.narrateText}>{rec.queued ? 'Stop narration' : 'Narrate all verses'}</Txt>
          </PressableScale>
        ) : null}

        {hub.verses.map((v) => {
          const a = getAyah(v.surah, v.ayah);
          const s = getSurah(v.surah);
          if (!a || !s) return null;
          return (
            <PressableScale
              key={`${v.surah}:${v.ayah}`}
              style={styles.verse}
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
                <Txt variant="eyebrow" color={c.accent}>
                  {s.englishName} · {v.surah}:{v.ayah}
                </Txt>
                <VerseSpeaker surah={v.surah} ayah={v.ayah} size={18} />
              </View>
              <Txt variant="verseAr" numberOfLines={4} style={styles.ar}>
                {a.ar}
              </Txt>
              <Txt variant="verseEn">{verseText(v.surah, v.ayah)}</Txt>
              <Txt variant="caption" color={c.accent} style={styles.explainHint}>
                Tap to explain ›
              </Txt>
            </PressableScale>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <PressableScale style={styles.talkBtn} onPress={talk}>
          <Ionicons name="chatbubbles-outline" size={18} color={c.bg} />
          <Txt style={styles.talkText}>Talk it through</Txt>
        </PressableScale>
        <Txt variant="caption" color={c.textMuted} style={styles.disclaimer}>
          A place for reflection and comfort — not a fatwa, and not a substitute for a qualified scholar or professional.
        </Txt>
      </View>

      <ExplainSheet target={explainTarget} onClose={() => setExplainTarget(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.gutter, paddingBottom: space.sm },
  headerTitle: { flex: 1, textAlign: 'center' },
  spacer: { width: 38 },
  scroll: { paddingHorizontal: space.gutter, paddingBottom: space.card, gap: 14 },
  hero: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...glow(c.accent, 0.1, 16),
  },
  intro: { fontFamily: font.serifReg, fontSize: 17, lineHeight: 26, color: c.scriptureInk, textAlign: 'center', paddingHorizontal: 6 },
  crisis: {
    backgroundColor: 'rgba(217,89,76,0.10)',
    borderColor: 'rgba(217,89,76,0.34)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: 16,
    gap: 8,
  },
  crisisTitle: { fontFamily: font.sansBold, fontSize: 15, color: c.danger },
  crisisText: { lineHeight: 21 },
  narrateBtn: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: radius.full,
    backgroundColor: 'rgba(201,189,166,0.12)',
  },
  narrateText: { fontFamily: font.sansSemi, fontSize: 13.5, color: c.accent },
  verse: {
    backgroundColor: c.surface1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    padding: 16,
    gap: 8,
  },
  verseHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ar: { marginTop: 2 },
  explainHint: { fontFamily: font.sansSemi },
  footer: {
    paddingHorizontal: space.gutter,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.hairline,
  },
  talkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.primary,
    paddingVertical: 15,
    borderRadius: radius.full,
  },
  talkText: { color: c.bg, fontFamily: font.sansSemi, fontSize: 16 },
  disclaimer: { textAlign: 'center', lineHeight: 16 },
});
