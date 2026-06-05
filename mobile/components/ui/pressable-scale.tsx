// The press-feedback primitive used on every tappable: scales down + light haptic on press.
// Reanimated v4 spring. See UI-REDESIGN-SPEC.md §4.11.
import { Pressable, PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { motion } from '@/lib/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  scaleTo?: number;
  haptics?: boolean;
};

export function PressableScale({ scaleTo = motion.pressScale, haptics = true, onPress, onPressIn, onPressOut, disabled, style, children, ...rest }: Props) {
  const s = useSharedValue(1);
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
