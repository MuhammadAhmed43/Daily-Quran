// Small dark-premium UI primitives: Txt (type scale), Card, IconButton (circular), Divider.
// See UI-REDESIGN-SPEC.md §1.4 / §3.
import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import { StyleSheet, Text, TextProps, View, ViewStyle } from 'react-native';

import { c, radius, shadow, space, type as typeScale } from '@/lib/theme';
import { PressableScale } from './pressable-scale';

type Variant = keyof typeof typeScale;

// The standalone Arabic honorific ligatures — ﷺ (sall-Allahu alayhi wa sallam) and ﷻ (jalla jalaluhu) —
// render far larger than the surrounding text and break out of the line box. Render just those glyphs at
// HALF size, inline, wherever Txt shows them (the honorifics live in the content data, which flows through
// Txt). Only kicks in when a honorific is actually present, so normal text is untouched.
const hasHon = (s: string) => s.includes('ﷺ') || s.includes('ﷻ');
const childHasHon = (node: ReactNode): boolean =>
  typeof node === 'string' ? hasHon(node) : Array.isArray(node) ? node.some(childHasHon) : false;
function shrinkHonorifics(node: ReactNode, half: number): ReactNode {
  const one = (s: string, kb: string): ReactNode =>
    hasHon(s)
      ? s.split(/([ﷺﷻ])/).map((p, i) =>
          p === 'ﷺ' || p === 'ﷻ' ? (
            <Text key={`${kb}${i}`} style={{ fontSize: half }}>
              {p}
            </Text>
          ) : (
            p
          ),
        )
      : s;
  if (typeof node === 'string') return one(node, 'h');
  if (Array.isArray(node)) return node.map((ch, i) => (typeof ch === 'string' ? one(ch, `h${i}_`) : ch));
  return node;
}

export function Txt({ variant = 'body', color, style, children, ...rest }: TextProps & { variant?: Variant; color?: string }) {
  let kids: ReactNode = children;
  if (childHasHon(children)) {
    const base = (StyleSheet.flatten([typeScale[variant], style]) as { fontSize?: number }).fontSize ?? 16;
    kids = shrinkHonorifics(children, base * 0.5);
  }
  return (
    <Text {...rest} style={[typeScale[variant], color ? { color } : null, style]}>
      {kids}
    </Text>
  );
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
