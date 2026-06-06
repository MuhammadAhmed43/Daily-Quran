// DEV PREVIEW — compare the three launch-splash concepts across the four times of day, on device.
// Pick a concept (Sky / Manuscript / Niche) and a sky (Dawn / Day / Dusk / Night); changing either replays
// the full animation, and Replay re-runs the current combo. Reachable from About → "Preview launch splash".
// This screen is a scaffold for choosing the winner; once chosen, that concept wires into the real launch
// (app/_layout.tsx) and this screen + the About entry can be removed.
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LottieSplash } from '@/components/splash/lottie-splash';
import { ManuscriptSplash } from '@/components/splash/manuscript-splash';
import { MinimalSplash } from '@/components/splash/minimal-splash';
import { NicheSplash } from '@/components/splash/niche-splash';
import { PhotographicSplash } from '@/components/splash/photographic-splash';
import { phaseFromClock, PHASES, type Phase } from '@/components/splash/common';
import { SkySplash } from '@/components/splash/sky-splash';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Txt } from '@/components/ui/primitives';
import { haptic } from '@/lib/haptics';
import { c, font, radius, space } from '@/lib/theme';

const CONCEPTS = ['Sky', 'Lottie', 'Photo', 'Minimal', 'Manuscript', 'Niche'] as const;
const SPLASHES = [SkySplash, LottieSplash, PhotographicSplash, MinimalSplash, ManuscriptSplash, NicheSplash];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export default function SplashPreview() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [concept, setConcept] = useState(0);
  const [phase, setPhase] = useState<Phase>(phaseFromClock());
  const [playKey, setPlayKey] = useState(0);

  const Splash = SPLASHES[concept];
  const replay = () => {
    haptic.light();
    setPlayKey((k) => k + 1);
  };
  const pick = (fn: () => void) => {
    haptic.light();
    fn();
    setPlayKey((k) => k + 1);
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />

      {/* the splash under test — remounts (and replays) whenever the combo or playKey changes */}
      <View style={StyleSheet.absoluteFill}>
        <Splash key={`${concept}-${phase}-${playKey}`} phase={phase} />
      </View>

      <PressableScale style={[styles.close, { top: insets.top + 8 }]} onPress={() => router.back()}>
        <Ionicons name="close" size={20} color={c.textPrimary} />
      </PressableScale>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 14 }]}>
        <Txt style={styles.heading}>LAUNCH SPLASH · PREVIEW</Txt>
        <View style={styles.row}>
          {CONCEPTS.map((name, i) => (
            <Chip key={name} label={name} active={i === concept} onPress={() => pick(() => setConcept(i))} />
          ))}
        </View>
        <View style={styles.row}>
          {PHASES.map((p) => (
            <Chip key={p} label={cap(p)} active={p === phase} onPress={() => pick(() => setPhase(p))} />
          ))}
        </View>
        <PressableScale style={styles.replay} onPress={replay}>
          <Ionicons name="refresh" size={16} color={c.bg} />
          <Txt style={styles.replayText}>Replay</Txt>
        </PressableScale>
      </View>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} style={[styles.chip, active ? styles.chipOn : styles.chipOff]}>
      <Txt style={[styles.chipText, { color: active ? c.bg : c.textSecondary }]}>{label}</Txt>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  close: {
    position: 'absolute',
    right: space.gutter,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(20,20,20,0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 14,
    paddingHorizontal: space.gutter,
    gap: 10,
    backgroundColor: 'rgba(10,10,10,0.86)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.glassLip,
  },
  heading: { fontFamily: font.sansBold, fontSize: 10.5, letterSpacing: 1.8, color: c.textMuted, alignSelf: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.full },
  chipOn: { backgroundColor: c.primary },
  chipOff: { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
  chipText: { fontFamily: font.sansSemi, fontSize: 13 },
  replay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: radius.full,
    backgroundColor: c.accent,
    marginTop: 2,
  },
  replayText: { fontFamily: font.sansSemi, fontSize: 14, color: c.bg },
});
