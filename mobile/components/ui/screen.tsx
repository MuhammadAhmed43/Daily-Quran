// Dark-premium screen wrapper: near-black canvas + the warm "lit-from-above" radial glow at the top,
// + safe area. Put a ScrollView/View inside. See UI-REDESIGN-SPEC.md §1.9.
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { c } from '@/lib/theme';

export function Screen({
  children,
  edges = ['top'],
  glow = true,
}: {
  children: ReactNode;
  edges?: readonly Edge[];
  glow?: boolean;
}) {
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
      <SafeAreaView edges={edges} style={styles.fill}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  fill: { flex: 1 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
});
