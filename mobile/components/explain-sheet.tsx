import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { FadeIn } from '@/components/fade-in';
import { SpeakButton } from '@/components/speak-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { explainAyah, type Explanation } from '@/lib/explain';
import { haptic } from '@/lib/haptics';
import { useProfile } from '@/lib/profile';
import { recordActivity } from '@/lib/streak';

const ACCENT = '#0a7ea4';

export type ExplainTarget = { surah: number; ayah: number; name: string; ar: string; en: string };

// A focused sheet that explains a single ayah, grounded in its Ibn Kathir tafsir (via /api/explain).
// Depth/voice adapt to the reader's profile. Opening one counts toward the streak.
export function ExplainSheet({
  target,
  onClose,
}: {
  target: ExplainTarget | null;
  onClose: () => void;
}) {
  const { profile } = useProfile();
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<ExplainTarget | null>(target);
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [data, setData] = useState<Explanation | null>(null);

  // animate in when a target arrives, out when it clears
  useEffect(() => {
    if (target) {
      setShown(target);
      Animated.timing(anim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else if (shown) {
      Animated.timing(anim, { toValue: 0, duration: 160, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) setShown(null);
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // fetch the explanation whenever a new ayah is opened — buffered, then revealed all at once with
  // a calm fade (token-by-token streaming is kept for chat only; it reads poorly in a sheet).
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

  if (!shown) return null;
  const sheetY = anim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });

  return (
    <Animated.View style={[styles.root, { opacity: anim }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>

      <Animated.View style={[styles.sheetWrap, { transform: [{ translateY: sheetY }] }]}>
        <ThemedView style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText style={styles.title}>Explain this verse</ThemedText>
              <ThemedText style={styles.ref}>
                {shown.name} · {shown.surah}:{shown.ayah}
              </ThemedText>
            </View>
            {target && status === 'done' && data ? <SpeakButton text={data.explanation} /> : null}
            <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
              <Ionicons name="close" size={20} color={ACCENT} />
            </Pressable>
          </View>

          <View style={styles.verse}>
            <ThemedText style={styles.ar} numberOfLines={3}>
              {shown.ar}
            </ThemedText>
            <ThemedText style={styles.en}>{shown.en}</ThemedText>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {status === 'loading' ? (
              <View style={styles.center}>
                <ActivityIndicator color={ACCENT} />
                <ThemedText style={styles.loadingText}>Reflecting on the commentary…</ThemedText>
              </View>
            ) : status === 'error' ? (
              <ThemedText style={styles.errorText}>
                Couldn’t load the explanation. Check your connection and try again.
              </ThemedText>
            ) : data ? (
              <FadeIn duration={650}>
                <ThemedText style={styles.explanation}>{data.explanation}</ThemedText>
                <ThemedText style={styles.source}>
                  {data.hasTafsir
                    ? 'Explained from Ibn Kathir’s tafsir.'
                    : 'Plain-meaning explanation — detailed commentary isn’t available for this verse.'}
                </ThemedText>
              </FadeIn>
            ) : null}
          </ScrollView>

          <ThemedText style={styles.disclaimer}>
            {data?.disclaimer ?? 'AI study aid — not a fatwa or a substitute for a qualified scholar.'}
          </ThemedText>
        </ThemedView>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  sheetWrap: { paddingHorizontal: 10 },
  sheet: {
    borderRadius: 22,
    padding: 16,
    paddingBottom: 22,
    marginBottom: 10,
    maxHeight: '82%',
    overflow: 'hidden',
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerText: { flex: 1 },
  title: { fontSize: 17, fontWeight: '800' },
  ref: { color: ACCENT, fontSize: 13, fontWeight: '700', marginTop: 2 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
  verse: { backgroundColor: 'rgba(10,126,164,0.08)', borderRadius: 14, padding: 14, gap: 8 },
  ar: {
    fontFamily: 'AmiriQuran',
    fontSize: 20,
    lineHeight: 42,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  en: { fontSize: 14, lineHeight: 21, opacity: 0.85 },
  body: { flexShrink: 1 },
  bodyContent: { paddingVertical: 4, gap: 12 },
  center: { alignItems: 'center', gap: 10, paddingVertical: 30 },
  loadingText: { fontSize: 14, opacity: 0.6 },
  errorText: { fontSize: 15, lineHeight: 22, opacity: 0.8, paddingVertical: 10 },
  explanation: { fontSize: 16, lineHeight: 25 },
  source: { fontSize: 12, opacity: 0.55, fontStyle: 'italic', marginTop: 4 },
  disclaimer: { fontSize: 11, opacity: 0.45, lineHeight: 16 },
});
