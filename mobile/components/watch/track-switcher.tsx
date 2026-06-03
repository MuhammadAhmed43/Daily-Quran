import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { haptic } from '@/lib/haptics';
import { TRACKS, type Track } from '@/lib/watch';

// A hand-rolled iOS-style segmented control (the native package won't load in Expo Go). A sliding
// thumb springs between the two tracks; labels cross-fade their emphasis.
export function TrackSwitcher({
  value,
  onChange,
}: {
  value: Track;
  onChange: (t: Track) => void;
}) {
  const dark = useColorScheme() === 'dark';
  const [w, setW] = useState(0);
  const idx = Math.max(0, TRACKS.findIndex((t) => t.key === value));
  const anim = useRef(new Animated.Value(idx)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: idx, useNativeDriver: true, friction: 9, tension: 80 }).start();
  }, [idx, anim]);

  const segW = w > 0 ? (w - 6) / 2 : 0;
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, segW] });

  return (
    <View style={styles.track} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {segW > 0 ? (
        <Animated.View
          style={[
            styles.thumb,
            { width: segW, transform: [{ translateX }] },
            dark ? styles.thumbDark : styles.thumbLight,
          ]}
        />
      ) : null}
      {TRACKS.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            style={styles.segment}
            onPress={() => {
              if (active) return;
              haptic.light();
              onChange(t.key);
            }}>
            <ThemedText style={[styles.label, !active && styles.labelInactive]}>
              {t.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: 38,
    borderRadius: 12,
    padding: 3,
    backgroundColor: 'rgba(127,127,127,0.12)',
  },
  thumb: { position: 'absolute', top: 3, left: 3, bottom: 3, borderRadius: 9 },
  thumbLight: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  thumbDark: { backgroundColor: 'rgba(255,255,255,0.16)' },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  label: { fontSize: 14, fontWeight: '600' },
  labelInactive: { opacity: 0.55 },
});
