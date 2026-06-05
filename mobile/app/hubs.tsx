// FIND PEACE (onyx) — the topical-hub list (anxiety / grief / hope / …). Onyx reskin only: champagne
// icon badges (replacing emojis), serif titles, staggered cards. Hub data + routing preserved.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { haptic } from '@/lib/haptics';
import { hubIcon } from '@/lib/hub-visuals';
import { HUBS } from '@/lib/hubs';
import { c, radius, space } from '@/lib/theme';

export default function HubsScreen() {
  const router = useRouter();
  return (
    <Screen stars>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <IconButton name="chevron-back" onPress={() => router.back()} diameter={38} size={22} bg={c.surface2} color={c.textPrimary} />
        <Txt variant="cardTitle">Find peace</Txt>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Txt variant="body" color={c.textSecondary} style={styles.lead}>
          Wherever you are today, there’s a place to begin.
        </Txt>
        {HUBS.map((h, i) => (
          <Animated.View key={h.id} entering={FadeInDown.delay(i * 40).duration(300)}>
            <PressableScale
              style={styles.card}
              onPress={() => {
                haptic.light();
                router.push({ pathname: '/hub/[id]', params: { id: h.id } });
              }}>
              <View style={styles.iconWrap}>
                <Ionicons name={hubIcon(h.id)} size={20} color={c.accent} />
              </View>
              <View style={styles.cardText}>
                <Txt variant="cardTitle" numberOfLines={1}>
                  {h.title}
                </Txt>
                <Txt variant="caption" color={c.textMuted} numberOfLines={2}>
                  {h.blurb}
                </Txt>
              </View>
              <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.32)" />
            </PressableScale>
          </Animated.View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter, paddingBottom: space.sm },
  spacer: { width: 38 },
  scroll: { paddingHorizontal: space.gutter, paddingBottom: space.section, gap: 10 },
  lead: { lineHeight: 22, marginBottom: 6, paddingHorizontal: 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: space.card,
    borderRadius: radius.md,
    backgroundColor: c.surface1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(201,189,166,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 3 },
});
