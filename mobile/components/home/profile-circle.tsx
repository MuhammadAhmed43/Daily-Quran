import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth';
import { haptic } from '@/lib/haptics';

const ACCENT = '#0a7ea4';

// The top-right avatar on Home. Shows the signed-in user's initial, or a person icon for a guest.
// Tapping opens the profile + settings screen.
export function ProfileCircle() {
  const router = useRouter();
  const { user } = useAuth();
  const initial = user && !user.isAnonymous && user.name ? user.name.charAt(0).toUpperCase() : null;
  return (
    <Pressable
      hitSlop={8}
      style={styles.circle}
      onPress={() => {
        haptic.light();
        router.push('/profile');
      }}>
      {initial ? (
        <ThemedText style={styles.initial}>{initial}</ThemedText>
      ) : (
        <Ionicons name="person" size={18} color="#fff" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
