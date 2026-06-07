// Small dark-premium UI primitives: Txt (type scale), Card, IconButton (circular), Divider.
// See UI-REDESIGN-SPEC.md §1.4 / §3.
import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { StyleSheet, Text, TextProps, View, ViewStyle } from 'react-native';

import { c, radius, shadow, space, type as typeScale } from '@/lib/theme';
import { PressableScale } from './pressable-scale';

type Variant = keyof typeof typeScale;

export function Txt({ variant = 'body', color, style, ...rest }: TextProps & { variant?: Variant; color?: string }) {
  return <Text {...rest} style={[typeScale[variant], color ? { color } : null, style]} />;
}

export function Card({
  children,
  style,
  padded = true,
  elevated = false,
}: {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  padded?: boolean;
  elevated?: boolean;
}) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: elevated ? c.surface2 : c.surface1 },
        padded && { padding: space.card },
        shadow.card,
        style as ViewStyle,
      ]}>
      {children}
    </View>
  );
}

export function IconButton({
  name,
  onPress,
  size = 20,
  color = c.textPrimary,
  bg = c.surface2,
  diameter = 44,
  accessibilityLabel,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  size?: number;
  color?: string;
  bg?: string;
  diameter?: number;
  accessibilityLabel?: string;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: diameter,
        height: diameter,
        borderRadius: diameter / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={name} size={size} color={color} />
    </PressableScale>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.hairline },
});
