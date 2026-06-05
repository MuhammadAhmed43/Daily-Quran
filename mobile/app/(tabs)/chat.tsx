// ASK (tab) — the browse / entry state (Bible Chat frame 15). A warm rotating welcome verse + an
// Explore-Topics grid of color-coded category cards, with the signature glass "Ask" pill. Tapping the pill
// opens the full-screen conversation at /ask (no tab bar). Tapping a CATEGORY opens a fresh chat curated to
// it (a streaming opening message + starter questions). This screen holds no chat state.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CosmicCardBg } from '@/components/cosmic-field';
import { GlassSurface } from '@/components/ui/glass-surface';
import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { SuggestedSheet } from '@/components/suggested-sheet';
import { VerseSpeaker } from '@/components/verse-speaker';
import { useAuth } from '@/lib/auth';
import { setCategorySeed, setChatSeed } from '@/lib/chat-seed';
import { haptic } from '@/lib/haptics';
import { bumpHub, useForYou } from '@/lib/hub-affinity';
import { HUBS, type Hub } from '@/lib/hubs';
import { useProfile } from '@/lib/profile';
import { questionsFor } from '@/lib/suggested-questions';
import { c, font, grad, radius, space, type as ty } from '@/lib/theme';
import { getVerse, type Verse } from '@/lib/today';
import { useTranslation, verseText } from '@/lib/translations';
import { freshWelcome } from '@/lib/welcome';

function HubCard({ hub, hueIndex, featured, onPress }: { hub: Hub; hueIndex: number; featured?: boolean; onPress: () => void }) {
  return (
    <PressableScale style={[styles.hubCard, featured && styles.hubCardForYou]} onPress={onPress}>
      <CosmicCardBg hueIndex={hueIndex} id={hub.id} />
      <Txt variant="cardTitle" numberOfLines={2} style={styles.hubTitle}>
        {hub.title}
      </Txt>
      <Txt variant="caption" numberOfLines={2} style={styles.hubBlurb}>
        {hub.blurb}
      </Txt>
      <Ionicons name="arrow-forward" size={16} color={c.accent} style={styles.hubArrow} />
    </PressableScale>
  );
}

export default function AskBrowseScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const [welcome, setWelcome] = useState(() => freshWelcome());
  const [sheetHub, setSheetHub] = useState<Hub | null>(null);
  useTranslation();

  // A fresh welcome verse each time you arrive (changes every conversation start).
  useFocusEffect(
    useCallback(() => {
      setWelcome(freshWelcome());
    }, []),
  );

  const welcomeVerse = useMemo<Verse | null>(() => getVerse(welcome.surah, welcome.ayah), [welcome]);
  const forYou = useForYou(profile.focuses);
  const forYouIds = new Set(forYou.map((h) => h.id));
  const rest = HUBS.filter((h) => !forYouIds.has(h.id));

  const openVerse = (surah: number, ayah: number) =>
    router.push({ pathname: '/surah/[number]', params: { number: String(surah), ayah: String(ayah) } });

  // Tap a category -> the recommended-questions sheet (frame 21).
  const openCategory = (hub: Hub) => {
    haptic.light();
    bumpHub(hub.id, 1);
    setSheetHub(hub);
  };

  // From the sheet: a PICKED question goes straight to it (no curated opener); "Ask your own" opens the
  // chat with the curated streaming opener first.
  const enterCategory = (question?: string) => {
    if (!sheetHub) return;
    if (question) setChatSeed(question, sheetHub.id);
    else setCategorySeed(sheetHub.id);
    setSheetHub(null);
    router.push('/ask');
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <PressableScale onPress={() => router.push('/profile')}>
          <LinearGradient colors={c.goldGrad} start={grad.diagStart} end={grad.diagEnd} style={styles.avatar}>
            <AvatarInitial />
          </LinearGradient>
        </PressableScale>
        <Txt variant="h2" style={styles.topTitle}>
          Ask
        </Txt>
        <View style={styles.fill} />
        <IconButton name="time-outline" onPress={() => router.push('/chat-history')} diameter={38} size={20} color={c.textSecondary} />
      </View>

      <ScrollView contentContainerStyle={styles.browse} showsVerticalScrollIndicator={false}>
        {/* Warm rotating welcome — a comforting verse to begin (changes each visit). */}
        {welcomeVerse ? (
          <PressableScale style={styles.welcomeCard} onPress={() => openVerse(welcomeVerse.surah, welcomeVerse.ayah)}>
            <LinearGradient colors={['rgba(201,189,166,0.14)', 'rgba(201,189,166,0.02)']} start={grad.diagStart} end={grad.diagEnd} style={StyleSheet.absoluteFill} />
            <Txt variant="h2" style={styles.greeting}>
              {welcome.greeting}
            </Txt>
            <View style={styles.rule} />
            <Txt style={[ty.verseAr, styles.welcomeAr]}>{welcomeVerse.ar}</Txt>
            <Txt style={styles.welcomeTrans}>{verseText(welcomeVerse.surah, welcomeVerse.ayah)}</Txt>
            <View style={styles.welcomeFoot}>
              <Txt variant="caption" color={c.accent} style={styles.welcomeRef}>
                {welcomeVerse.surahEnglish} · {welcomeVerse.surah}:{welcomeVerse.ayah}
              </Txt>
              <VerseSpeaker surah={welcomeVerse.surah} ayah={welcomeVerse.ayah} size={18} />
            </View>
          </PressableScale>
        ) : null}

        <Txt variant="h2">Explore topics</Txt>

        {forYou.length > 0 ? (
          <View style={styles.section}>
            <Txt variant="eyebrow">For you</Txt>
            <View style={styles.grid}>
              {forYou.map((h, i) => (
                <HubCard key={h.id} hub={h} hueIndex={i} featured onPress={() => openCategory(h)} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          {forYou.length > 0 ? <Txt variant="eyebrow">More</Txt> : null}
          <View style={styles.grid}>
            {rest.map((h, i) => (
              <HubCard key={h.id} hub={h} hueIndex={i + forYou.length} onPress={() => openCategory(h)} />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* The signature glass Ask pill — a tappable entry into the full-screen conversation. */}
      <View style={styles.composerWrap}>
        <GlassSurface interactive={false} radius={radius.xl}>
          <View style={styles.pillRow}>
            <Pressable style={styles.pillTap} onPress={() => router.push('/ask')}>
              <Ionicons name="sparkles" size={17} color={c.accent} />
              <Txt style={styles.pillPlaceholder} numberOfLines={1}>
                Ask about the Qur&apos;an…
              </Txt>
            </Pressable>
            <Pressable style={styles.pillBtn} onPress={() => router.push('/voice')} accessibilityLabel="Voice conversation">
              <Ionicons name="mic" size={20} color={c.textSecondary} />
            </Pressable>
          </View>
        </GlassSurface>
      </View>

      <SuggestedSheet
        visible={!!sheetHub}
        questions={sheetHub ? questionsFor(sheetHub.id) : []}
        onPick={(q) => enterCategory(q)}
        onAskOwn={() => enterCategory()}
        onClose={() => setSheetHub(null)}
      />
    </Screen>
  );
}

function AvatarInitial() {
  const { user } = useAuth();
  const initial = user && !user.isAnonymous && user.name ? user.name.charAt(0).toUpperCase() : null;
  return initial ? <Txt style={styles.avatarInitial}>{initial}</Txt> : <Ionicons name="person" size={18} color={c.bg} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.gutter, paddingTop: space.xs, paddingBottom: space.sm },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: font.sansBold, fontSize: 16, color: c.bg },
  topTitle: { marginLeft: 2 },

  browse: { paddingHorizontal: space.gutter, paddingTop: space.xs, paddingBottom: space.section, gap: space.section },
  welcomeCard: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, backgroundColor: c.surface1, overflow: 'hidden', padding: space.card, gap: 10 },
  greeting: { lineHeight: 28 },
  rule: { width: 40, height: StyleSheet.hairlineWidth, backgroundColor: c.accent, opacity: 0.45 },
  welcomeAr: { color: c.scriptureInk, textAlign: 'right' },
  welcomeTrans: { fontFamily: font.serifReg, fontSize: 15.5, lineHeight: 24, color: c.scriptureInk },
  welcomeFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  welcomeRef: { letterSpacing: 0.5 },

  section: { gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  hubCard: { width: '48.5%', minHeight: 132, padding: 16, paddingBottom: 38, borderRadius: radius.md, gap: 6, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
  hubCardForYou: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(201,189,166,0.5)' },
  hubTitle: { lineHeight: 21 },
  hubBlurb: { lineHeight: 16 },
  hubArrow: { position: 'absolute', left: 16, bottom: 14, transform: [{ rotate: '-45deg' }] },

  composerWrap: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 14, paddingRight: 6, minHeight: 52 },
  pillTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  pillPlaceholder: { flex: 1, fontFamily: font.sans, fontSize: 16, color: c.textMuted },
  pillBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
