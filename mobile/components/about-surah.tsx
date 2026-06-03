import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { haptic } from '@/lib/haptics';
import type { Surah } from '@/lib/quran';
import { getSurahIntro } from '@/lib/surah-intro';

const ACCENT = '#0a7ea4';

// LayoutAnimation needs an opt-in on Android; iOS (the target) works out of the box.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// A quiet, collapsible "About this surah" card in the reader head — collapsed by default so the
// scripture stays front-and-centre. Only renders when we have a vetted overview for this surah,
// so surahs without one simply show no toggle (no thin/empty cards).
export function AboutSurah({ surah }: { surah: Surah }) {
  const [open, setOpen] = useState(false);
  const intro = getSurahIntro(surah.number);
  if (!intro) return null;

  const toggle = () => {
    haptic.light();
    LayoutAnimation.configureNext(
      LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
    );
    setOpen((o) => !o);
  };

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.toggle} onPress={toggle} hitSlop={8}>
        <Ionicons name="information-circle-outline" size={15} color={ACCENT} />
        <ThemedText style={styles.toggleText}>About this surah</ThemedText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={ACCENT} />
      </Pressable>

      {open ? (
        <View style={styles.card}>
          <ThemedText style={styles.summary}>{intro.summary}</ThemedText>

          {intro.themes.length > 0 ? (
            <View style={styles.themeRow}>
              {intro.themes.map((t) => (
                <View key={t} style={styles.chip}>
                  <ThemedText style={styles.chipText}>{t}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          {intro.nameReason ? <ThemedText style={styles.note}>{intro.nameReason}</ThemedText> : null}

          <ThemedText style={styles.disclaimer}>
            A brief study overview — not a substitute for tafsir or a scholar.
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', marginTop: 14, gap: 10 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(10,126,164,0.10)',
  },
  toggleText: { fontSize: 12.5, fontWeight: '700', color: ACCENT, letterSpacing: 0.2 },
  card: {
    width: '100%',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(127,127,127,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.18)',
  },
  summary: { fontSize: 14.5, lineHeight: 23, opacity: 0.9 },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(10,126,164,0.12)',
  },
  chipText: { fontSize: 12, fontWeight: '600', color: ACCENT },
  note: { fontSize: 12.5, lineHeight: 19, opacity: 0.6, fontStyle: 'italic' },
  disclaimer: { fontSize: 10.5, lineHeight: 15, opacity: 0.45 },
});
