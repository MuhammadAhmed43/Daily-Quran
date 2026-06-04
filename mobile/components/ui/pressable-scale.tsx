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

export function PressableScale({ scaleTo = motion.pressScale, haptics = true, onPress, disabled, style, children, ...rest }: Props) {
  const s = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={() => {
        s.value = withSpring(scaleTo, motion.springPress);
      }}
      onPressOut={() => {
        s.value = withSpring(1, motion.springPress);
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
