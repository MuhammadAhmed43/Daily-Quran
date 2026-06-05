// PROFILE DRAWER (onyx, Bible Chat frames 19/24) — a LEFT SLIDE-OVER hub opened from the top-left
// avatar on Today. Presented as a transparentModal so the real Today screen dims + peeks on the right;
// the panel slides in (and out) on a single shared value, with a scrim tap + swipe-left to close.
// Contents: gradient avatar + name + email/guest · 2-up streak StatCards · Your Verses (bookmarks) ·
// a color-coded menu (Daily Quiz / Holy Calendar / Ameen wall) · a share/encouragement card · footer
// (About / Account). It is a NAV HUB — every destination already exists; this only restyles + routes.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, FadeInDown, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SkyBand } from '@/components/sky-band';
import { PressableScale } from '@/components/ui/pressable-scale';
import { IconButton, Txt } from '@/components/ui/primitives';
import { SettingsCard, SettingsRow, StatCard } from '@/components/ui/settings';
import { useAuth } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { useStreak } from '@/lib/streak';
import { c, font, glow, grad, radius, space } from '@/lib/theme';

export default function ProfileDrawer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const streak = useStreak();
  const { width } = useWindowDimensions();
  const PANEL_W = Math.min(width * 0.87, 372);

  const guest = !user || user.isAnonymous;
  const name = guest ? 'Guest' : user?.name || 'Friend';
  const initial = !guest && user?.name ? user.name.charAt(0).toUpperCase() : null;
  const subline = guest ? 'Browsing on this device' : user?.email || 'Signed in';

  // One shared value drives open (1) and close (0): scrim opacity + panel translateX both read it,
  // so opening and closing are a true mirror (entering/exiting are dead on the New Arch — see spec §9).
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
  }, [p]);

  const dismiss = useCallback(() => {
    p.value = withTiming(0, { duration: 230, easing: Easing.in(Easing.cubic) }, (fin) => {
      if (fin) runOnJS(router.back)();
    });
  }, [p, router]);

  const close = useCallback(() => {
    haptic.light();
    dismiss();
  }, [dismiss]);

  // Picking an item CLOSES the drawer and opens the destination. We REPLACE the transparent modal with
  // the destination instead of stacking a card on top of it: a screen pushed over a transparentModal can
  // render beneath the still-mounted drawer (so it "doesn't open"). Replacing also matches the drawer UX
  // — the drawer dismisses, the destination opens, and back from it returns to Today.
  const finishNav = useCallback((path: string) => router.replace(path as Href), [router]);
  const go = useCallback(
    (path: string) => {
      haptic.light();
      p.value = withTiming(0, { duration: 190, easing: Easing.in(Easing.cubic) }, (fin) => {
        if (fin) runOnJS(finishNav)(path);
      });
    },
    [p, finishNav],
  );

  const onShare = useCallback(() => {
    haptic.light();
    Share.share({
      message: 'I have been reading and reflecting on the Qur’an with Daily Qur’an — come read with me.',
    }).catch(() => {});
  }, []);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: p.value * 0.58 }));
  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(p.value, [0, 1], [-PANEL_W - 24, 0]) }] }));

  const pan = Gesture.Pan()
    .activeOffsetX(-18)
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      const dx = Math.min(0, e.translationX);
      p.value = 1 + dx / PANEL_W;
    })
    .onEnd((e) => {
      const shouldClose = e.translationX < -PANEL_W * 0.33 || e.velocityX < -650;
      if (shouldClose) {
        p.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) }, (fin) => {
          if (fin) runOnJS(router.back)();
        });
      } else {
        p.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      }
    });

  const totalDays = streak.totalDays;
  const encourageTitle = totalDays > 0 ? `${totalDays} ${totalDays === 1 ? 'day' : 'days'} with the Qur’an` : 'Begin your journey today';

  return (
    <View style={styles.root}>
      {/* tap the dimmed Today (peeking on the right) to close */}
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} />

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.panel, { width: PANEL_W, paddingTop: insets.top }, panelStyle]}>
          <SkyBand height={insets.top + 28} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + space.section }]}>
            {/* Header: avatar (-> edit) + name + email + quick settings gear */}
            <Animated.View entering={FadeInDown.delay(70).duration(320)} style={styles.headerRow}>
              <Pressable onPress={() => go('/profile/edit')} hitSlop={6}>
                <LinearGradient colors={c.goldGrad} start={grad.diagStart} end={grad.diagEnd} style={styles.avatar}>
                  {initial ? <Txt style={styles.avatarInitial}>{initial}</Txt> : <Ionicons name="person" size={24} color={c.bg} />}
                </LinearGradient>
                <View style={styles.pencil}>
                  <Ionicons name="pencil" size={10} color={c.bg} />
                </View>
              </Pressable>
              <View style={styles.nameCol}>
                <Txt variant="h2" numberOfLines={1}>
                  {name}
                </Txt>
                <Txt variant="caption" color={c.textMuted} numberOfLines={1}>
                  {subline}
                </Txt>
              </View>
              <IconButton name="settings-outline" onPress={() => go('/profile/account')} diameter={38} size={19} bg={c.surface2} color={c.textSecondary} />
            </Animated.View>

            {/* 2-up streak stats */}
            <Animated.View entering={FadeInDown.delay(120).duration(320)} style={styles.statRow}>
              <StatCard icon="flame" value={streak.current} label="Current streak" />
              <StatCard icon="trophy" value={streak.longest} label="Longest streak" tint={c.accent} />
            </Animated.View>

            {/* Your Verses */}
            <Animated.View entering={FadeInDown.delay(165).duration(320)}>
              <SettingsCard>
                <SettingsRow icon="bookmark" badge={c.accent} title="Your Verses" subtitle="Saved ayat and bookmarks" onPress={() => go('/bookmarks')} />
              </SettingsCard>
            </Animated.View>

            {/* Color-coded menu */}
            <Animated.View entering={FadeInDown.delay(205).duration(320)}>
              <SettingsCard>
                <SettingsRow icon="school" badge="#7E72A6" title="Daily Quiz" subtitle="Test your knowledge" onPress={() => go('/quiz')} />
                <SettingsRow icon="calendar" badge="#C99A5E" title="Holy Calendar" subtitle="Sacred days through the year" onPress={() => go('/calendar')} />
                <SettingsRow icon="people" badge="#B5807A" title="Ameen Wall" subtitle="Pray with the community" onPress={() => go('/ameen')} />
              </SettingsCard>
            </Animated.View>

            {/* Share / encouragement */}
            <Animated.View entering={FadeInDown.delay(245).duration(320)}>
              <PressableScale onPress={onShare} style={styles.encourage}>
                <View style={styles.encourageIcon}>
                  <Ionicons name="gift-outline" size={19} color={c.accent} />
                </View>
                <View style={styles.encourageText}>
                  <Txt variant="cardTitle" numberOfLines={1}>
                    {encourageTitle}
                  </Txt>
                  <Txt variant="caption" color={c.textSecondary} numberOfLines={2}>
                    Pass on the gift — share Daily Qur’an with someone you love.
                  </Txt>
                </View>
                <Ionicons name="share-outline" size={18} color={c.textMuted} />
              </PressableScale>
            </Animated.View>

            {/* Footer */}
            <Animated.View entering={FadeInDown.delay(285).duration(320)}>
              <SettingsCard>
                <SettingsRow icon="information-circle-outline" title="About" onPress={() => go('/profile/about')} />
                <SettingsRow icon="settings-outline" title="Account" onPress={() => go('/profile/account')} />
              </SettingsCard>
            </Animated.View>
          </ScrollView>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { backgroundColor: '#000' },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: c.bg,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: c.hairline,
    shadowColor: '#000',
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 16,
  },
  scroll: { paddingHorizontal: space.gutter, paddingTop: space.sm, gap: 14 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingTop: space.sm, paddingBottom: space.xs },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: font.sansBold, fontSize: 22, color: c.bg },
  pencil: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: c.accentBright,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.bg,
  },
  nameCol: { flex: 1, gap: 2 },

  statRow: { flexDirection: 'row', gap: 10 },

  encourage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 15,
    borderRadius: radius.lg,
    backgroundColor: c.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,189,166,0.28)',
    ...glow(c.accent, 0.12, 14),
  },
  encourageIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(201,189,166,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  encourageText: { flex: 1, gap: 2 },
});
