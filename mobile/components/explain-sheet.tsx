import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FadeIn } from '@/components/fade-in';
import { SpeakButton } from '@/components/speak-button';
import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { explainAyah, type Explanation } from '@/lib/explain';
import { haptic } from '@/lib/haptics';
import { useProfile } from '@/lib/profile';
import { recordActivity } from '@/lib/streak';
import { c, font, radius, space, type as ty } from '@/lib/theme';

export type ExplainTarget = { surah: number; ayah: number; name: string; ar: string; en: string };

// A slide-up sheet (matched to the Today reflection sheet: centered, serif, airy) that explains a single
// ayah, grounded in its Ibn Kathir tafsir (via /api/explain). Depth/voice adapt to the reader's profile.
// Opening one counts toward the streak. Rendered via a Modal so it works from every screen that hosts it.
export function ExplainSheet({ target, onClose }: { target: ExplainTarget | null; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const [shown, setShown] = useState<ExplainTarget | null>(target);
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [data, setData] = useState<Explanation | null>(null);

  // keep the last target rendered while the sheet slides out
  useEffect(() => {
    if (target) setShown(target);
  }, [target]);

  // fetch the explanation whenever a new ayah is opened — buffered, then revealed all at once with a calm
  // fade (token-by-token streaming is kept for chat only; it reads poorly in a sheet).
  useEffect(() => {
    if (!target) return;
    let active = true;
    setStatus('loading');
    setData(null);
    const level = profile.knowledge === 'new' || profile.knowledge === 'some' ? 'simple' : 'standard';
    const tone = profile.journey === 'exploring' ? 'explore' : 'default';
    explainAyah(target.surah, target.ayah, { name: target.name, level, tone })
      .then((d) => {
        if (!active) return;
        setData(d);
        setStatus('done');
        recordActivity('read_ayahs');
        haptic.light();
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.surah, target?.ayah]);

  const askAboutVerse = () => {
    onClose();
    router.push('/(tabs)/chat');
  };

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          {shown ? (
            <>
              <View style={styles.header}>
                <IconButton name="chevron-down" onPress={onClose} bg={c.surface3} diameter={38} size={20} />
                <Txt variant="cardTitle">Explanation</Txt>
                <View style={styles.headerSpacer} />
              </View>

              <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.verseBlock}>
                  <Txt variant="eyebrow" style={styles.center}>
                    Verse
                  </Txt>
                  <Txt style={[ty.verseAr, styles.verseAr]}>{shown.ar}</Txt>
                  <Txt style={[ty.verseEn, styles.center]}>{shown.en}</Txt>
                  <Txt variant="caption" color={c.accent} style={[styles.center, styles.ref]}>
                    {shown.name} · {shown.surah}:{shown.ayah}
                  </Txt>
                </View>

                <View style={styles.rule}>
                  <View style={styles.ruleLine} />
                  <View style={styles.ruleDot} />
                  <View style={styles.ruleLine} />
                </View>

                <View style={styles.meaningBlock}>
                  <Txt variant="eyebrow" style={styles.center}>
                    The meaning
                  </Txt>
                  {status === 'loading' ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color={c.accent} />
                      <Txt variant="body" color={c.textMuted}>
                        Reflecting on the commentary…
                      </Txt>
                    </View>
                  ) : status === 'error' ? (
                    <Txt variant="body" color={c.textSecondary} style={styles.center}>
                      Couldn&apos;t load the explanation. Check your connection and try again.
                    </Txt>
                  ) : data ? (
                    <FadeIn duration={650}>
                      <Txt style={styles.explanation}>{data.explanation}</Txt>
                      <Txt variant="caption" color={c.textMuted} style={[styles.center, styles.source]}>
                        {data.hasTafsir
                          ? 'Explained from Ibn Kathir’s tafsir.'
                          : 'Plain-meaning explanation — detailed commentary isn’t available for this verse.'}
                      </Txt>
                    </FadeIn>
                  ) : null}
                </View>
              </ScrollView>

              <View style={[styles.actions, { paddingBottom: insets.bottom + space.sm }]}>
                <View style={styles.actionRow}>
                  {status === 'done' && data ? <SpeakButton text={data.explanation} /> : null}
                  <PressableScale onPress={askAboutVerse} style={styles.pill}>
                    <Ionicons name="sparkles" size={17} color={c.textPrimary} />
                    <Txt variant="caption" color={c.textPrimary} style={styles.pillLabel}>
                      Ask about this verse
                    </Txt>
                  </PressableScale>
                </View>
                <Txt variant="caption" color={c.textMuted} style={[styles.center, styles.disclaimer]}>
                  {data?.disclaimer ?? 'AI study aid — not a fatwa or a substitute for a qualified scholar.'}
                </Txt>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    height: '90%',
    backgroundColor: c.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  headerSpacer: { width: 38 },
  scroll: { paddingHorizontal: space.section, paddingTop: space.md, paddingBottom: space.section, gap: space.hero },
  center: { textAlign: 'center' },
  verseBlock: { alignItems: 'center', gap: 10 },
  verseAr: { textAlign: 'center', marginTop: 4, color: c.scriptureInk },
  ref: { letterSpacing: 1 },
  rule: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ruleLine: { width: 44, height: StyleSheet.hairlineWidth, backgroundColor: c.accent, opacity: 0.4 },
  ruleDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.accent, opacity: 0.7 },
  meaningBlock: { alignItems: 'center', gap: 16 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  explanation: { fontFamily: font.serifReg, fontSize: 16.5, lineHeight: 27, color: c.scriptureInk, textAlign: 'center' },
  source: { marginTop: 10 },
  actions: {
    paddingHorizontal: space.gutter,
    paddingTop: space.sm,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.hairline,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: radius.sm,
    backgroundColor: c.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  pillLabel: { fontFamily: font.sansSemi, fontSize: 13 },
  disclaimer: { lineHeight: 16 },
});
