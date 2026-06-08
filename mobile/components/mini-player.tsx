import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReciterSheet } from '@/components/reciter-sheet';
import { SkyBand } from '@/components/sky-band';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Txt } from '@/components/ui/primitives';
import { haptic } from '@/lib/haptics';
import { getSurah } from '@/lib/quran';
import { useRecitation } from '@/lib/recitation-context';
import { c, font, radius } from '@/lib/theme';

const BAR_H = 50;
const COLLAPSED_W = 50; // the blob is a ~circle of this size

type Recitation = ReturnType<typeof useRecitation>;

// The reciting bar's contents (info + reciter + play/pause + stop), shared by the floating bar and the
// collapsible Ask-tab bar so they stay identical.
function MiniBar({ ctx, onOpen, onReciter }: { ctx: Recitation; onOpen: () => void; onReciter: () => void }) {
  const p = ctx.playing;
  if (!p) return null;
  const name = getSurah(p.surah)?.englishName ?? `Surah ${p.surah}`;
  return (
    <>
      <PressableScale style={styles.info} onPress={onOpen} hitSlop={6}>
        <Ionicons name="musical-notes" size={18} color={c.accent} />
        <Txt style={styles.text} numberOfLines={1}>
          {ctx.loading ? 'Loading…' : `Reciting ${p.surah}:${p.ayah}`}
          <Txt style={styles.sub}>{`  ·  ${name}`}</Txt>
        </Txt>
      </PressableScale>
      <PressableScale onPress={onReciter} hitSlop={10} style={styles.btn}>
        <Ionicons name="person-circle-outline" size={22} color={c.textSecondary} />
      </PressableScale>
      <PressableScale
        onPress={() => {
          haptic.light();
          if (ctx.paused) ctx.resume();
          else ctx.pause();
        }}
        hitSlop={10}
        style={styles.btn}>
        <Ionicons name={ctx.paused ? 'play' : 'pause'} size={22} color={c.textPrimary} />
      </PressableScale>
      <PressableScale
        onPress={() => {
          haptic.light();
          ctx.stop();
        }}
        hitSlop={10}
        style={styles.btn}>
        <Ionicons name="close" size={20} color={c.textMuted} />
      </PressableScale>
    </>
  );
}

// A slim "now reciting" bar that floats above the tab bar whenever something is playing: tap back into the
// surah, switch the reciter, or pause/stop. Pitch-black with a small drifting constellation (same starlight
// as the notch band). Recitation logic preserved — `chooseReciter` restarts the current ayah in the new voice.
//
// EXCEPTION: on the Ask tab (whose own bottom composer pill sits exactly here) it renders nothing — that
// screen shows its own CollapsibleMiniPlayer (below) above the pill so the two never overlap.
export function MiniPlayer() {
  const ctx = useRecitation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [reciterOpen, setReciterOpen] = useState(false);

  if (!ctx.playing) return null;
  if (pathname === '/chat') return null; // the Ask tab floats its own collapsible bar above its composer
  // The surah reader shows its OWN recitation bar (the GlassSurface pill), so suppress the floating one
  // there — otherwise both are briefly visible during the push and read as a "double" bar.
  if (pathname.startsWith('/surah')) return null;
  const { surah, ayah } = ctx.playing;

  const open = () => {
    haptic.light();
    router.push({ pathname: '/surah/[number]', params: { number: String(surah), ayah: String(ayah) } });
  };

  return (
    <View style={[styles.shadow, { bottom: insets.bottom + 50 }]}>
      <View style={styles.bar}>
        <SkyBand height={BAR_H} count={14} seed={0x9a2e} />
        <MiniBar
          ctx={ctx}
          onOpen={open}
          onReciter={() => {
            haptic.light();
            setReciterOpen(true);
          }}
        />
      </View>

      <ReciterSheet visible={reciterOpen} currentId={ctx.reciter.id} onClose={() => setReciterOpen(false)} onSelect={ctx.chooseReciter} />
    </View>
  );
}

// The Ask-tab variant: a small blob anchored to the lower-LEFT, just above the composer pill. Tapping it
// grows the bar open smoothly LEFT-TO-RIGHT into the full reciting bar; the host screen collapses it back
// into the blob on scroll / any outside touch. `expanded` is owned by the host so it can drive the collapse.
export function CollapsibleMiniPlayer({
  expanded,
  onExpandedChange,
  bottom,
}: {
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
  bottom: number;
}) {
  const ctx = useRecitation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [reciterOpen, setReciterOpen] = useState(false);
  const t = useSharedValue(0); // 0 = blob, 1 = full bar
  const fullW = width - 16; // left:8 + right:8

  useEffect(() => {
    t.value = withTiming(expanded ? 1 : 0, {
      duration: expanded ? 360 : 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [expanded, t]);

  // Outer (the shadowed shape) grows in width; inner clips the contents to the same rounding. Shadow and
  // overflow:hidden can't live on the same view on iOS (masksToBounds clips the shadow), so they're split.
  const outerStyle = useAnimatedStyle(() => ({
    width: COLLAPSED_W + (fullW - COLLAPSED_W) * t.value,
    borderRadius: COLLAPSED_W / 2 + (radius.md - COLLAPSED_W / 2) * t.value,
  }));
  const innerStyle = useAnimatedStyle(() => ({
    borderRadius: COLLAPSED_W / 2 + (radius.md - COLLAPSED_W / 2) * t.value,
  }));
  const barStyle = useAnimatedStyle(() => ({ opacity: interpolate(t.value, [0.2, 1], [0, 1], Extrapolation.CLAMP) }));
  const blobStyle = useAnimatedStyle(() => ({ opacity: interpolate(t.value, [0, 0.4], [1, 0], Extrapolation.CLAMP) }));

  if (!ctx.playing) return null;
  const { surah, ayah } = ctx.playing;
  const open = () => {
    haptic.light();
    router.push({ pathname: '/surah/[number]', params: { number: String(surah), ayah: String(ayah) } });
  };

  return (
    <>
      <Animated.View style={[styles.collapseOuter, { bottom }, outerStyle]}>
        <Animated.View style={[styles.collapseInner, innerStyle]}>
          <SkyBand height={BAR_H} count={14} seed={0x9a2e} />
          {/* full bar — fixed width so it doesn't reflow as the clip grows; fades in while expanding */}
          <Animated.View
            style={[styles.collapseBar, { width: fullW }, barStyle]}
            pointerEvents={expanded ? 'auto' : 'none'}>
            <MiniBar
              ctx={ctx}
              onOpen={open}
              onReciter={() => {
                haptic.light();
                setReciterOpen(true);
              }}
            />
          </Animated.View>
          {/* blob — the music glyph shown while collapsed; tap to open */}
          <Animated.View style={[styles.collapseBlob, blobStyle]} pointerEvents={expanded ? 'none' : 'auto'}>
            <PressableScale
              onPress={() => {
                haptic.light();
                onExpandedChange(true);
              }}
              hitSlop={12}
              style={styles.blobTap}
              accessibilityLabel="Show what is reciting">
              <Ionicons name="musical-notes" size={18} color={c.accent} />
            </PressableScale>
          </Animated.View>
        </Animated.View>
      </Animated.View>

      <ReciterSheet visible={reciterOpen} currentId={ctx.reciter.id} onClose={() => setReciterOpen(false)} onSelect={ctx.chooseReciter} />
    </>
  );
}

const styles = StyleSheet.create({
  // Outer holds the float shadow (no overflow, so the shadow isn't clipped); inner clips the starfield.
  shadow: {
    position: 'absolute',
    left: 8,
    right: 8,
    borderRadius: radius.md,
    backgroundColor: c.bg,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: c.bg, // pitch black
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassLip,
  },
  info: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { flex: 1, fontFamily: font.sansSemi, fontSize: 14, color: c.textPrimary },
  sub: { fontFamily: font.sans, fontSize: 12, color: c.textMuted },
  btn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  // ---- collapsible (Ask tab): a left blob that grows left-to-right into the full bar ----
  collapseOuter: {
    position: 'absolute',
    left: 8,
    height: BAR_H,
    backgroundColor: c.bg,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  collapseInner: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: c.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassLip,
  },
  collapseBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  collapseBlob: { position: 'absolute', left: 0, top: 0, bottom: 0, width: COLLAPSED_W, alignItems: 'center', justifyContent: 'center' },
  blobTap: { width: COLLAPSED_W, height: '100%', alignItems: 'center', justifyContent: 'center' },
});
