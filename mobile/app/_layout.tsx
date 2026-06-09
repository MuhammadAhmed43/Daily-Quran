import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Fraunces_400Regular, Fraunces_400Regular_Italic, Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { Component, type ReactNode, useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthFlow } from '@/components/auth/auth-flow';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { phaseFromClock } from '@/components/splash/common';
import { SkySplash } from '@/components/splash/sky-splash';
import { getAuthDecided, subscribeAuthChange } from '@/lib/auth';
import { useProfile } from '@/lib/profile';
import { RecitationProvider } from '@/lib/recitation-context';
import { startSync, syncNow } from '@/lib/sync';
import { c } from '@/lib/theme';
import { hydrateTranslation } from '@/lib/translations';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    AmiriQuran: require('@/assets/fonts/AmiriQuran-Regular.ttf'),
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Fail-open: never block the whole app on font loading. If fonts haven't resolved (or errored) within 4s
  // -- a release/standalone build can stall expo-font in a way Expo Go never does -- proceed anyway. The
  // theme has system-font fallbacks, so the worst case is a brief glyph swap, not a permanent blank splash.
  const [fontTimedOut, setFontTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, []);

  if (!loaded && !error && !fontTimedOut) return null;

  // Dark-only premium: force a dark navigation theme with our canvas, regardless of device setting.
  const navTheme = {
    ...DarkTheme,
    colors: { ...DarkTheme.colors, background: c.bg, card: c.navBar, border: c.hairline },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Seed safe-area insets synchronously on the first frame so screens don't mount with 0 top padding
          and then snap down a frame later (the first-load up/down jitter on each page). */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ThemeProvider value={navTheme}>
          <BootErrorBoundary>
            <RecitationProvider>
              <RootGate />
            </RecitationProvider>
          </BootErrorBoundary>
          <StatusBar style="light" />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Launch gate. Every cold launch plays the animated splash, then reveals the right screen:
//   - signed in + onboarded  -> Today (the tabs)
//   - signed in, not onboarded (fresh sign-up) -> the welcome questions -> Today
//   - not signed in -> the login / sign-up landing -> (sign up: questions -> Today | log in: Today)
// The splash is mounted OVER whatever screen is correct, so it melts straight into it.
function RootGate() {
  const { profile, loaded } = useProfile();
  const [trReady, setTrReady] = useState(false);
  const [authDecided, setAuthDecided] = useState<boolean | null>(null);
  const [splashGone, setSplashGone] = useState(false);

  // Load the saved translation before the first frame so scripture never flashes the wrong one.
  useEffect(() => {
    hydrateTranslation().finally(() => setTrReady(true));
  }, []);

  // Decide where to route. For a PERMANENT account, pull cloud state (incl. `onboarded`) BEFORE flipping
  // `authDecided`, so a returning user who logs in lands on Today and never flashes the welcome questions.
  // Guests / signed-out resolve instantly (syncNow is a quick no-op without a permanent session).
  const evaluate = useCallback(async () => {
    const decided = await getAuthDecided();
    if (decided) await syncNow();
    setAuthDecided(decided);
  }, []);
  useEffect(() => {
    evaluate();
    // Re-evaluate on sign in / out (sign out drops back to the landing; sign in advances past it).
    return subscribeAuthChange(evaluate);
  }, [evaluate]);

  // Kick off cloud sync: a no-op for guests, runs on sign-in + app foreground/background.
  useEffect(() => {
    startSync();
  }, []);

  const ready = loaded && trReady && authDecided !== null;

  // Fail-open safety net: if the gate hasn't resolved within 6s (a stalled async step, a network hang,
  // a swallowed error), force past it so the native splash can NEVER trap the app. Whatever didn't finish
  // settles behind the scenes or surfaces via BootErrorBoundary -- far better than an invisible hang.
  const [forceReady, setForceReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setForceReady(true), 6000);
    return () => clearTimeout(t);
  }, []);
  const show = ready || forceReady;

  useEffect(() => {
    if (show) SplashScreen.hideAsync().catch(() => {});
  }, [show]);

  if (!show) return null;

  const stage: 'auth' | 'onboard' | 'app' = !authDecided ? 'auth' : !profile.onboarded ? 'onboard' : 'app';

  return (
    <View style={styles.root}>
      {stage === 'auth' ? (
        <AuthFlow onDone={evaluate} />
      ) : stage === 'onboard' ? (
        <OnboardingFlow />
      ) : (
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="reflect" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="ask" options={{ headerShown: false }} />
          <Stack.Screen name="chat-history" options={{ headerShown: false }} />
          {/* Profile is a LEFT slide-over drawer: transparent so Today dims + peeks behind it. */}
          <Stack.Screen name="profile" options={{ headerShown: false, presentation: 'transparentModal', animation: 'none' }} />
        </Stack>
      )}

      {/* The animated launch splash — shown once per cold launch, then it fades away to reveal the app. */}
      {!splashGone ? <LaunchSplash onDone={() => setSplashGone(true)} /> : null}
    </View>
  );
}

// Full-screen overlay that plays the Sky splash (lit for the local time of day), then fades itself out so
// the screen beneath (Today, or the login landing) is revealed — the splash "melts" into the app.
function LaunchSplash({ onDone }: { onDone: () => void }) {
  const fade = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const finish = () => {
    fade.value = withTiming(0, { duration: 540, easing: Easing.out(Easing.cubic) }, (done) => {
      if (done) runOnJS(onDone)();
    });
  };
  return (
    <Animated.View style={[StyleSheet.absoluteFill, aStyle]}>
      <SkySplash phase={phaseFromClock()} onDone={finish} />
    </Animated.View>
  );
}

// A real React error boundary around the launch tree. If anything throws during boot RENDER (a release-only
// circular-import/bad-element-type fault, a provider crash, a worklets/native-module init throw), we MUST hide
// the native splash and show the ACTUAL error -- otherwise the app is stranded on the splash with no clue.
// Detail is shown on purpose (even in release) while we stabilize the standalone/sideload build.
class BootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch() {
    SplashScreen.hideAsync().catch(() => {});
  }
  render() {
    const e = this.state.error;
    if (!e) return this.props.children;
    return (
      <View style={styles.errRoot}>
        <Text style={styles.errTitle}>Startup error</Text>
        <Text style={styles.errBody}>The app hit an error while starting. Details below.</Text>
        <ScrollView style={styles.errScroll} contentContainerStyle={{ paddingVertical: 8 }}>
          <Text style={styles.errDetail}>{String(e.message ?? e)}</Text>
          {e.stack ? <Text style={styles.errStack}>{e.stack}</Text> : null}
        </ScrollView>
      </View>
    );
  }
}

// expo-router renders this automatically if any screen throws during render. Without it, a single
// uncaught error white-screens the whole app with no recovery. Uses system fonts + only theme colors so
// it renders even if a font/theme load was the thing that failed.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={styles.errRoot}>
      <Text style={styles.errTitle}>Something went wrong</Text>
      <Text style={styles.errBody}>The app ran into an unexpected problem. Please try again.</Text>
      <Text style={styles.errDetail}>{String(error?.message ?? error)}</Text>
      <Pressable style={styles.errBtn} onPress={() => retry()} accessibilityRole="button" accessibilityLabel="Try again">
        <Text style={styles.errBtnText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  errRoot: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  errTitle: { color: c.textPrimary, fontSize: 22, fontWeight: '600', textAlign: 'center' },
  errBody: { color: c.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  errDetail: { color: c.textMuted, fontSize: 12, textAlign: 'center' },
  errScroll: { maxHeight: 340, alignSelf: 'stretch', marginTop: 8 },
  errStack: { color: c.textMuted, fontSize: 11, marginTop: 10, opacity: 0.75 },
  errBtn: { marginTop: 12, backgroundColor: c.accent, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 999 },
  errBtnText: { color: c.bg, fontSize: 16, fontWeight: '600' },
});
