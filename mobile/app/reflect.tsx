// REFLECT — the daily reflection sheet. Opens as a slide-up modal from the Today "Reflection" card (the
// study-plan-style bottom-to-top open, not an Instagram-story expand). A guided READING (the day's verse +
// a reflective framing + a prompt) and a private JOURNAL the user writes and saves on-device; saving logs a
// 'checkin' toward the streak. Religiously safe: scripture is rendered from the verified DB; the reading is
// non-doctrinal reflective framing (no interpretation or rulings).
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { isChatConfigured } from '@/lib/chat';
import { streamExplain } from '@/lib/explain';
import { haptic } from '@/lib/haptics';
import { getCachedReading, reflectionFor, saveCachedReading, saveReflection, useTodayReflection } from '@/lib/reflections';
import { dayKey, recordActivity } from '@/lib/streak';
import { c, font, radius, space, type as ty } from '@/lib/theme';
import { getVerse, resolveToday, type Verse } from '@/lib/today';
import { useTranslation, verseText } from '@/lib/translations';

export default function ReflectScreen() {
  useTranslation(); // re-render if the translation changes
  const router = useRouter();
  const info = useMemo(() => resolveToday(), []);
  const verse = useMemo<Verse | null>(() => {
    for (const r of info.refs) {
      const v = getVerse(r.surah, r.ayah);
      if (v) return v;
    }
    return null;
  }, [info]);
  const { prompt, reading: fallbackReading } = reflectionFor(info.gregorian.getDate());

  // The READING is AI-generated per verse (grounded /api/explain), streamed in and cached once per day.
  // Falls back to the curated framing if the API is off or the call fails — so it always shows something.
  const [reading, setReading] = useState('');
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!verse) {
        if (active) setReading(fallbackReading);
        return;
      }
      const day = dayKey(new Date());
      const cached = await getCachedReading(day);
      if (cached) {
        if (active) setReading(cached);
        return;
      }
      if (!isChatConfigured()) {
        if (active) setReading(fallbackReading);
        return;
      }
      try {
        const result = await streamExplain(verse.surah, verse.ayah, { name: verse.surahEnglish }, (t) => {
          if (active) setReading(t);
        });
        if (active) setReading(result.explanation);
        saveCachedReading(day, result.explanation);
      } catch {
        if (active) setReading(fallbackReading);
      }
    })();
    return () => {
      active = false;
    };
  }, [verse, fallbackReading]);

  const saved = useTodayReflection();
  const [text, setText] = useState(saved);
  useEffect(() => {
    setText(saved); // sync once the stored value loads
  }, [saved]);

  const onSave = () => {
    haptic.light();
    saveReflection(dayKey(new Date()), text);
    if (text.trim()) recordActivity('checkin'); // a written reflection counts toward the streak
    router.back();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <IconButton name="chevron-down" onPress={() => router.back()} bg={c.surface2} color={c.textPrimary} diameter={38} size={20} />
        <Txt variant="cardTitle">Reflection</Txt>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex} keyboardVerticalOffset={4}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {verse ? (
            <View style={styles.verseBlock}>
              <Txt variant="eyebrow" style={styles.center}>
                Verse of the Day
              </Txt>
              <Txt style={[ty.verseAr, styles.verseAr]}>{verse.ar}</Txt>
              <Txt style={[ty.verseEn, styles.center]}>{verseText(verse.surah, verse.ayah)}</Txt>
              <Txt variant="caption" color={c.accent} style={[styles.center, styles.verseRef]}>
                {verse.surahEnglish} · {verse.surah}:{verse.ayah}
              </Txt>
            </View>
          ) : null}

          <View style={styles.rule}>
            <View style={styles.ruleLine} />
            <View style={styles.ruleDot} />
            <View style={styles.ruleLine} />
          </View>

          <View style={styles.reflectBlock}>
            <Txt variant="eyebrow" style={styles.center}>
              A reflection on this verse
            </Txt>
            {reading ? (
              <Txt style={styles.reading}>{reading}</Txt>
            ) : (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={c.accent} />
                <Txt variant="body" color={c.textMuted}>
                  Reflecting on this verse...
                </Txt>
              </View>
            )}
            <Txt style={styles.prompt}>{prompt}</Txt>
          </View>

          <View style={styles.journalBlock}>
            <Txt variant="eyebrow" style={styles.center}>
              Your reflection
            </Txt>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Write whatever comes. This is only for you."
              placeholderTextColor={c.textMuted}
              multiline
              textAlignVertical="top"
              scrollEnabled={false}
            />
            <Txt variant="caption" color={c.textMuted} style={[styles.center, styles.privacy]}>
              Saved privately on your device.
            </Txt>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <PressableScale onPress={() => router.push('/(tabs)/chat')} style={styles.secondaryBtn}>
            <Ionicons name="sparkles" size={16} color={c.accent} />
            <Txt variant="caption" color={c.accent} style={styles.btnLabel}>
              Ask about this verse
            </Txt>
          </PressableScale>
          <PressableScale onPress={onSave} style={styles.primaryBtn}>
            <Txt variant="caption" color={c.bg} style={styles.btnLabel}>
              Save reflection
            </Txt>
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingBottom: space.sm,
  },
  headerSpacer: { width: 38 },

  scroll: { paddingHorizontal: space.section, paddingTop: space.md, paddingBottom: space.section, gap: space.hero },

  center: { textAlign: 'center' },

  verseBlock: { alignItems: 'center', gap: 10 },
  verseAr: { textAlign: 'center', marginTop: 4, color: c.scriptureInk },
  verseRef: { letterSpacing: 1 },

  rule: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  ruleLine: { width: 44, height: StyleSheet.hairlineWidth, backgroundColor: c.accent, opacity: 0.4 },
  ruleDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.accent, opacity: 0.7 },

  reflectBlock: { alignItems: 'center', gap: 16 },
  reading: { fontFamily: font.serifReg, fontSize: 16.5, lineHeight: 27, color: c.scriptureInk, textAlign: 'center' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  prompt: { fontFamily: font.serifItalic, fontSize: 19, lineHeight: 28, color: c.accent, textAlign: 'center', marginTop: 2 },

  journalBlock: { gap: 10 },

  input: {
    minHeight: 150,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    padding: 16,
    fontFamily: font.sans,
    fontSize: 15.5,
    lineHeight: 23,
    color: c.textPrimary,
  },
  privacy: { marginTop: 2 },

  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: space.gutter,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.hairline,
  },
  btnLabel: { fontFamily: font.sansSemi, fontSize: 13.5 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  primaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.full,
    backgroundColor: c.accent,
  },
});
