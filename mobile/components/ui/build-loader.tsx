// Reusable "building / configuring" loader — the staged relay used at the end of the reading-plan
// wizard (app/reading/new.tsx), extracted so onboarding + Personalize settings can share the exact
// same animation: a gold orb, a title, and N stacked progress rows that fill one after another over
// `duration`, then `onDone` fires. Pure presentation.
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Txt } from '@/components/ui/primitives';
import { c, font, grad, radius, space } from '@/lib/theme';

export function BuildLoader({
  title,
  stages,
  duration = 2700,
  onDone,
}: {
  title: string;
  stages: string[];
  duration?: number;
  onDone: () => void;
}) {
  const prog = useSharedValue(0);
  useEffect(() => {
    prog.value = 0;
    prog.value = withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }, (fin) => {
      if (fin) runOnJS(onDone)();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View entering={FadeIn.duration(320)} style={styles.wrap}>
      <View style={styles.orb}>
        <LinearGradient colors={c.goldGrad} start={grad.diagStart} end={grad.diagEnd} style={StyleSheet.absoluteFill} />
      </View>
      <Txt variant="h2" style={styles.center}>
        {title}
      </Txt>
      <View style={styles.stages}>
        {stages.map((label, i) => (
          <StageBar key={label} prog={prog} index={i} total={stages.length} label={label} />
        ))}
      </View>
    </Animated.View>
  );
}

// One relay row: stays dim until its slice of `prog` arrives, then brightens as its bar fills.
function StageBar({ prog, index, total, label }: { prog: SharedValue<number>; index: number; total: number; label: string }) {
  const fillA = useAnimatedStyle(() => {
    const f = Math.min(1, Math.max(0, (prog.value - index / total) * total));
    return { width: `${f * 100}%` };
  });
  const rowA = useAnimatedStyle(() => {
    const f = Math.min(1, Math.max(0, (prog.value - index / total) * total));
    return { opacity: 0.4 + 0.6 * Math.min(1, f * 6) };
  });
  return (
    <Animated.View style={[styles.stageRow, rowA]}>
      <Txt variant="caption" color={c.textPrimary} style={styles.stageLabel}>
        {label}
      </Txt>
      <View style={styles.stageTrack}>
        <Animated.View style={[styles.stageFill, fillA]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.section, gap: 22 },
  center: { textAlign: 'center' },
  orb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: c.accent,
    shadowOpacity: 0.55,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
  },
  stages: { alignSelf: 'stretch', gap: 12, marginTop: 6 },
  stageRow: { padding: 14, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, backgroundColor: c.surface1, gap: 10 },
  stageLabel: { fontFamily: font.sansSemi },
  stageTrack: { height: 4, borderRadius: 2, backgroundColor: c.surface3, overflow: 'hidden' },
  stageFill: { height: 4, borderRadius: 2, backgroundColor: c.accent },
});
