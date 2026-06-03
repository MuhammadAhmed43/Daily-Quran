import { type ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

// A tiny circular progress donut (react-native-svg ships in Expo Go). Used by the timeline node
// (in-progress state) and the per-track summary card. Children render centered inside the ring.
export function ProgressRing({
  size = 28,
  stroke = 2.5,
  pct,
  color,
  trackColor = 'rgba(127,127,127,0.22)',
  children,
}: {
  size?: number;
  stroke?: number;
  pct: number;
  color: string;
  trackColor?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, pct || 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - clamped)}
          strokeLinecap="round"
        />
      </Svg>
      {children}
    </View>
  );
}
