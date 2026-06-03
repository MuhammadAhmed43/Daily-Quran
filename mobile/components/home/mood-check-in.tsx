import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { haptic } from '@/lib/haptics';
import { getTodayTypes, recordActivity } from '@/lib/streak';

// One-tap daily mood check-in. A quick, low-friction action that counts toward the streak and is
// the future home of the feeling→hub→"a verse for you" flow (hubs not built yet, so for now it
// records the check-in and acknowledges warmly).
const MOODS = [
  { id: 'low', emoji: '😔', label: 'Low' },
  { id: 'anxious', emoji: '😟', label: 'Anxious' },
  { id: 'okay', emoji: '😐', label: 'Okay' },
  { id: 'grateful', emoji: '🤲', label: 'Grateful' },
  { id: 'good', emoji: '😊', label: 'Good' },
];

export function MoodCheckIn() {
  const [done, setDone] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    getTodayTypes().then((t) => setDone(t.includes('checkin')));
  }, []);

  const pick = (id: string) => {
    haptic.light();
    setPicked(id);
    setDone(true);
    recordActivity('checkin');
    // TODO (hubs): route low/anxious/etc. → matched hub + "a verse for how you're feeling".
  };

  return (
    <View style={styles.card}>
      <ThemedText style={styles.title}>How are you today?</ThemedText>
      {done ? (
        <ThemedText style={styles.doneText}>
          {picked
            ? 'Noted — may today bring you ease. 🤲'
            : 'You’ve checked in today. May it bring you ease.'}
        </ThemedText>
      ) : (
        <View style={styles.row}>
          {MOODS.map((m) => (
            <Pressable key={m.id} onPress={() => pick(m.id)} style={styles.mood} hitSlop={6}>
              <ThemedText style={styles.emoji}>{m.emoji}</ThemedText>
              <ThemedText style={styles.moodLabel}>{m.label}</ThemedText>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(127,127,127,0.08)',
    gap: 12,
  },
  title: { fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  mood: { alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 4, borderRadius: 10 },
  emoji: { fontSize: 28, lineHeight: 34 },
  moodLabel: { fontSize: 11, opacity: 0.7 },
  doneText: { fontSize: 14, opacity: 0.75, lineHeight: 20 },
});
