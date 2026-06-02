import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getStories } from '@/lib/stories';

export default function StoriesScreen() {
  const stories = getStories();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.h1}>
              Stories
            </ThemedText>
            <ThemedText style={styles.sub}>
              The Qur'an's narratives, illustrated — fully aniconic, with every verse shown from
              the verified text.
            </ThemedText>
          </View>

          {stories.map((s) => (
            <Link
              key={s.id}
              href={{ pathname: '/stories/[id]', params: { id: s.id } }}
              asChild>
              <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
                <ThemedText style={styles.cardArabic}>{s.arabicName}</ThemedText>
                <ThemedText style={styles.cardTitle}>{s.title}</ThemedText>
                <ThemedText style={styles.cardSubtitle}>{s.subtitle}</ThemedText>
                <ThemedText style={styles.cardBlurb}>{s.blurb}</ThemedText>
                <View style={styles.cardFooter}>
                  <ThemedText style={styles.cardMeta}>{s.panels.length} scenes</ThemedText>
                  <ThemedText style={styles.cardCta}>Begin →</ThemedText>
                </View>
              </Pressable>
            </Link>
          ))}

          <ThemedText style={styles.note}>
            Reverence by design: prophets are never depicted. Scenes are told through objects,
            light, and calligraphy — a study aid, not a ruling.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40, gap: 16 },
  header: { gap: 6, paddingTop: 8 },
  h1: { fontSize: 30 },
  sub: { fontSize: 14, lineHeight: 20, opacity: 0.6 },
  card: {
    backgroundColor: '#161334',
    borderRadius: 20,
    padding: 22,
    gap: 6,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.9 },
  cardArabic: {
    fontFamily: 'AmiriQuran',
    fontSize: 32,
    lineHeight: 64,
    color: '#f4e2b8',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  cardTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  cardSubtitle: { fontSize: 15, fontWeight: '600', color: '#c8b4f0' },
  cardBlurb: { fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.72)', marginTop: 6 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.55)',
  },
  cardCta: { fontSize: 15, fontWeight: '700', color: '#f4e2b8' },
  note: { fontSize: 11, lineHeight: 16, opacity: 0.45, textAlign: 'center', paddingHorizontal: 8 },
});
