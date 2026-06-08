// The press-feedback primitive used on every tappable: scales down + light haptic on press.
// Reanimated v4 spring. See UI-REDESIGN-SPEC.md §4.11.
import { useRef } from 'react';
import { Pressable, PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { motion } from '@/lib/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  scaleTo?: number;
  haptics?: boolean;
  // Drop a repeat press within this many ms (default 500) so an accidental double-tap can't fire onPress
  // twice — which otherwise stacks a navigated screen twice. Pass 0 to allow rapid repeated presses.
  guardMs?: number;
};

export function PressableScale({ scaleTo = motion.pressScale, haptics = true, guardMs = 500, onPress, onPressIn, onPressOut, disabled, style, children, ...rest }: Props) {
  const s = useSharedValue(1);
  const lastPress = useRef(0);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={(e) => {
        s.value = withSpring(scaleTo, motion.springPress);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withSpring(1, motion.springPress);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        // Swallow an accidental double-tap so a navigation (router.push) can't fire twice and open the
        // destination twice. The scale animation + haptic still play; only the repeat ACTION is dropped.
        if (guardMs > 0) {
          const now = Date.now();
          if (now - lastPress.current < guardMs) return;
          lastPress.current = now;
        }
        if (haptics) haptic.light();
        onPress?.(e);
      }}
      // style can be a plain style or array; we append the animated transform
      style={[style as object, aStyle]}
      {...rest}>
      {children as React.ReactNode}
    </AnimatedPressable>
  );
}
