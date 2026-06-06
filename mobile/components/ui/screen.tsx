// Dark-premium screen wrapper: near-black canvas + the warm "lit-from-above" radial glow at the top,
// + safe area. Put a ScrollView/View inside. See UI-REDESIGN-SPEC.md §1.9.
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { type Edge, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SkyBand } from '@/components/sky-band';
import { c } from '@/lib/theme';

export function Screen({
  children,
  edges = ['top'],
  glow = true,
  stars = false,
}: {
  children: ReactNode;
  edges?: readonly Edge[];
  glow?: boolean;
  stars?: boolean;
}) {
  const insets = useSafeAreaInsets();
  // Apply the safe area as MANUAL padding rather than via <SafeAreaView> — that component renders its
  // children first and applies the insets a frame later, so each screen mounts at 0 top padding and then
  // snaps down (the first-load "up/down" jitter). With the root SafeAreaProvider seeded by
  // initialWindowMetrics, these insets are correct on the very first frame, so there's no snap.
  const pad = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
  };
  return (
    <View style={styles.root}>
      {glow ? (
        <LinearGradient
          colors={c.glowTop}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.glow}
          pointerEvents="none"
        />
      ) : null}
      {/* Optional magical constellation in the status-bar / notch band (best on genuinely dark headers). */}
      {stars ? <SkyBand height={insets.top + 40} /> : null}
      <View style={[styles.fill, pad]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  fill: { flex: 1 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
});
