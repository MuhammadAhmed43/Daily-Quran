import { memo, useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

// A calm "pop in": children fade + rise + ease up from a hair smaller. Used for content that
// appears after a transition settles (e.g. the verse card once a chat answer finishes streaming).
// Animates ONCE on mount — toggling inner state (e.g. expanding tafsir) won't restart it.
export const FadeIn = memo(function FadeIn({
  children,
  delay = 0,
  duration = 550,
  offset = 10,
  style,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  offset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.timing(a, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [a, delay, duration]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: a,
          transform: [
            { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) },
            { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
});
