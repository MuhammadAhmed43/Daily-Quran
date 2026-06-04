// GLASS SURFACE — one adaptive premium container that upgrades itself to real glass where the OS supports it.
//   ★ DEV BUILD on iOS 26+: renders Apple's REAL Liquid Glass via expo-glass-effect's <GlassView> — the OS
//     itself draws the material AND its touch interaction (isInteractive). This only lights up in a
//     development build; Expo Go's binary isn't compiled against the iOS 26 glass API, so
//     isGlassEffectAPIAvailable() is false there and we fall back.
//   ◦ EXPO GO / iOS < 26 / Android: a clean MINIMAL capsule (onyx "luxury by subtraction") — solid dark
//     surface, hairline rim, a whisper of top light, soft float shadow. No blur (which looks murky on a
//     near-black canvas); reads as intentional and high-end.
// Same children contract either way — callers (the reader pill now, the Ask pill next) get authentic glass
// for free wherever the OS allows it, and a tasteful minimal surface everywhere else.
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { c, radius as rad } from '@/lib/theme';

// Decided once at load: is Apple's Liquid Glass actually available? (true only in a dev build on iOS 26+)
const LIQUID_GLASS = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

type Props = {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  radius?: number;
  interactive?: boolean;
};

export function GlassSurface(props: Props) {
  return LIQUID_GLASS ? <LiquidGlass {...props} /> : <MinimalSurface {...props} />;
}

// ---- Dev build, iOS 26+: authentic system Liquid Glass (the OS renders + handles touch) ----
function LiquidGlass({ children, style, radius = rad.full, interactive = true }: Props) {
  return (
    // NB: never put opacity < 1 on a GlassView or any ancestor — it makes the glass not render.
    <View style={[styles.shadow, { borderRadius: radius }, style as ViewStyle]}>
      <GlassView
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        glassEffectStyle="regular"
        isInteractive={interactive}
        colorScheme="dark"
      />
      {children}
    </View>
  );
}

// ---- Everywhere else (incl. Expo Go): clean minimal capsule ----
function MinimalSurface({ children, style, radius = rad.full }: Props) {
  return (
    <View style={[styles.shadow, styles.minimal, { borderRadius: radius }, style as ViewStyle]}>
      <View style={styles.topHighlight} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  minimal: {
    backgroundColor: c.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  // a whisper of "lit from above" along the top edge — premium without going glassy
  topHighlight: { position: 'absolute', top: 0, left: 16, right: 16, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.07)' },
});
