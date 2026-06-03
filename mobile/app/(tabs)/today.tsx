import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MoodCheckIn } from '@/components/home/mood-check-in';
import { StreakHero } from '@/components/home/streak-hero';
import { WatchCard } from '@/components/home/watch-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VerseSpeaker } from '@/components/verse-speaker';
import { recordActivity } from '@/lib/streak';
import { getVerse, resolveToday, type Verse } from '@/lib/today';

export default function TodayScreen() {
  const router = useRouter();
  const info = useMemo(() => resolveToday(), []);
  const verses = useMemo(
    () =>
      info.refs
        .map((r) => getVerse(r.surah, r.ayah))
        .filter((v): v is Verse => v !== null),
    [info],
  );

  // opening today's reflection counts toward the streak
  useEffect(() => {
    recordActivity('daily_verse');
  }, []);

  const gregorian = info.gregorian.toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  async function onShare() {
    const v = verses[0];
    if (!v) return;
    await Share.share({
      message: `${v.en}\n\n— Qur'an ${v.surah}:${v.ayah} (${v.surahEnglish})\n\nvia Daily Qur'an`,
    });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <ThemedText style={styles.hijri}>{info.hijri.label}</ThemedText>
            <ThemedText style={styles.greg}>{gregorian}</ThemedText>
          </View>

          <StreakHero />
          <MoodCheckIn />
          <WatchCard />

          <Pressable style={styles.findPeace} onPress={() => router.push('/hubs')}>
            <ThemedText style={styles.findPeaceEmoji}>🌿</ThemedText>
            <View style={styles.findPeaceText}>
              <ThemedText style={styles.findPeaceTitle}>Find peace</ThemedText>
              <ThemedText style={styles.findPeaceBlurb}>
                Verses for whatever you’re carrying
              </ThemedText>
            </View>
            <ThemedText style={styles.findPeaceArrow}>›</ThemedText>
          </Pressable>

          <View style={styles.card}>
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText}>{info.badge.toUpperCase()}</ThemedText>
            </View>
            <ThemedText type="subtitle" style={styles.title}>
              {info.title}
            </ThemedText>
            <ThemedText style={styles.significance}>{info.significance}</ThemedText>
            {info.caveat ? <ThemedText style={styles.caveat}>{info.caveat}</ThemedText> : null}
          </View>

          {verses.map((v) => (
            <View key={`${v.surah}:${v.ayah}`} style={styles.verse}>
              <ThemedText style={styles.arabic}>{v.ar}</ThemedText>
              <ThemedText style={styles.trans}>{v.en}</ThemedText>
              <View style={styles.verseFooter}>
                <ThemedText style={styles.ref}>
                  {v.surahEnglish} · {v.surah}:{v.ayah}
                </ThemedText>
                <View style={styles.footerRight}>
                  <VerseSpeaker surah={v.surah} ayah={v.ayah} />
                  <Link
                    href={{ pathname: '/surah/[number]', params: { number: String(v.surah) } }}
                    asChild>
                    <Pressable hitSlop={8}>
                      <ThemedText style={styles.link}>Read in context →</ThemedText>
                    </Pressable>
                  </Link>
                </View>
              </View>
            </View>
          ))}

          <Pressable style={styles.shareBtn} onPress={onShare}>
            <ThemedText style={styles.shareText}>Share</ThemedText>
          </Pressable>

          <ThemedText style={styles.disclaimer}>
            Significance notes are a curated summary for reflection, not a religious ruling.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40, gap: 16 },
  header: { gap: 2, paddingTop: 8 },
  hijri: { fontSize: 22, fontWeight: '700' },
  greg: { fontSize: 13, opacity: 0.6 },
  card: {
    gap: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(127,127,127,0.08)',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(10,126,164,0.15)',
  },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: '#0a7ea4' },
  title: { marginTop: 2 },
  significance: { fontSize: 15, lineHeight: 22, opacity: 0.9 },
  caveat: { fontSize: 12, lineHeight: 17, opacity: 0.55, fontStyle: 'italic', marginTop: 4 },
  verse: {
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
  },
  arabic: {
    fontFamily: 'AmiriQuran',
    fontSize: 26,
    lineHeight: 60,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  trans: { fontSize: 15, lineHeight: 22, opacity: 0.85 },
  verseFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  findPeace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(10,126,164,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(10,126,164,0.2)',
  },
  findPeaceEmoji: { fontSize: 24 },
  findPeaceText: { flex: 1 },
  findPeaceTitle: { fontSize: 16, fontWeight: '700' },
  findPeaceBlurb: { fontSize: 13, opacity: 0.6 },
  findPeaceArrow: { fontSize: 22, opacity: 0.4 },
  ref: { fontSize: 13, opacity: 0.6 },
  link: { fontSize: 13, fontWeight: '600', color: '#0a7ea4' },
  shareBtn: {
    backgroundColor: '#0a7ea4',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  shareText: { color: '#fff', fontWeight: '600' },
  disclaimer: { fontSize: 11, opacity: 0.45, textAlign: 'center', lineHeight: 16 },
});
