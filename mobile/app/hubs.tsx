import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { haptic } from '@/lib/haptics';
import { HUBS } from '@/lib/hubs';

export default function HubsScreen() {
  const router = useRouter();
  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen options={{ title: 'Find peace' }} />
      <SafeAreaView edges={['bottom']} style={styles.fill}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ThemedText style={styles.lead}>
            Wherever you are today, there’s a place to begin.
          </ThemedText>
          {HUBS.map((h) => (
            <Pressable
              key={h.id}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => {
                haptic.light();
                router.push({ pathname: '/hub/[id]', params: { id: h.id } });
              }}>
              <ThemedText style={styles.emoji}>{h.emoji}</ThemedText>
              <View style={styles.cardText}>
                <ThemedText style={styles.title}>{h.title}</ThemedText>
                <ThemedText style={styles.blurb}>{h.blurb}</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(127,127,127,0.5)" />
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40, gap: 10 },
  lead: { fontSize: 15, lineHeight: 22, opacity: 0.7, marginBottom: 6 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(127,127,127,0.08)',
  },
  cardPressed: { backgroundColor: 'rgba(127,127,127,0.16)' },
  emoji: { fontSize: 26 },
  cardText: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700' },
  blurb: { fontSize: 13, opacity: 0.6 },
});
