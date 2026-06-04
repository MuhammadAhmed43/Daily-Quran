import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, Txt } from '@/components/ui/primitives';
import { haptic } from '@/lib/haptics';
import type { Surah } from '@/lib/quran';
import { getSurahIntro } from '@/lib/surah-intro';
import { c, font, radius, space } from '@/lib/theme';

// A quiet "About this surah" pill in the reader head that opens a slide-up sheet — matched to the Today
// reflection sheet (centered, serif, airy): the surah's identity, a calm overview reading, its themes, and
// why it carries its name. Only renders when we have a vetted overview, so surahs without one show nothing.
export function AboutSurah({ surah }: { surah: Surah }) {
  const intro = getSurahIntro(surah.number);
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  if (!intro) return null;

  return (
    <>
      <Pressable
        style={styles.trigger}
        hitSlop={8}
        onPress={() => {
          haptic.light();
          setOpen(true);
        }}>
        <Ionicons name="information-circle-outline" size={15} color={c.accent} />
        <Txt variant="caption" color={c.accent} style={styles.triggerText}>
          About this surah
        </Txt>
        <Ionicons name="chevron-forward" size={13} color={c.accent} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.root}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.header}>
              <IconButton name="chevron-down" onPress={() => setOpen(false)} bg={c.surface3} diameter={38} size={20} />
              <Txt variant="cardTitle">About this surah</Txt>
              <View style={styles.headerSpacer} />
            </View>

            <ScrollView
              contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.section }]}
              showsVerticalScrollIndicator={false}>
              <View style={styles.identity}>
                <Txt style={styles.nameAr}>{surah.name}</Txt>
                <Txt variant="cardTitle" style={styles.center}>
                  {surah.englishName}
                </Txt>
                <Txt variant="caption" style={styles.center}>
                  {surah.englishNameTranslation} · {surah.numberOfAyahs} ayat · {surah.revelationType}
                </Txt>
              </View>

              <View style={styles.rule}>
                <View style={styles.ruleLine} />
                <View style={styles.ruleDot} />
                <View style={styles.ruleLine} />
              </View>

              <Txt style={styles.summary}>{intro.summary}</Txt>

              {intro.themes.length > 0 ? (
                <View style={styles.block}>
                  <Txt variant="eyebrow" style={styles.center}>
                    Themes
                  </Txt>
                  <View style={styles.themeRow}>
                    {intro.themes.map((t) => (
                      <View key={t} style={styles.chip}>
                        <Txt variant="caption" color={c.accent} style={styles.chipText}>
                          {t}
                        </Txt>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {intro.nameReason ? (
                <View style={styles.block}>
                  <Txt variant="eyebrow" style={styles.center}>
                    The name
                  </Txt>
                  <Txt style={styles.nameReason}>{intro.nameReason}</Txt>
                </View>
              ) : null}

              <Txt variant="caption" color={c.textMuted} style={[styles.center, styles.disclaimer]}>
                A brief study overview — not a substitute for tafsir or a scholar.
              </Txt>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: 'rgba(201,189,166,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,189,166,0.20)',
  },
  triggerText: { fontFamily: font.sansBold, letterSpacing: 0.2 },

  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    maxHeight: '85%',
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
  scroll: { paddingHorizontal: space.section, paddingTop: space.sm, gap: space.section },
  center: { textAlign: 'center' },
  identity: { alignItems: 'center', gap: 6 },
  nameAr: { fontFamily: font.arabic, fontSize: 28, lineHeight: 50, color: c.scriptureInk, textAlign: 'center', writingDirection: 'rtl' },
  rule: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ruleLine: { width: 44, height: StyleSheet.hairlineWidth, backgroundColor: c.accent, opacity: 0.4 },
  ruleDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.accent, opacity: 0.7 },
  summary: { fontFamily: font.serifReg, fontSize: 16, lineHeight: 26, color: c.scriptureInk, textAlign: 'center' },
  block: { alignItems: 'center', gap: 10 },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.badge, backgroundColor: 'rgba(201,189,166,0.12)' },
  chipText: { fontFamily: font.sansSemi },
  nameReason: { fontFamily: font.serifItalic, fontSize: 15, lineHeight: 24, color: c.accent, textAlign: 'center' },
  disclaimer: { lineHeight: 16 },
});
