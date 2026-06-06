import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Fraunces_400Regular, Fraunces_400Regular_Italic, Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

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

SplashScreen.preventAutoHideAsync();

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

  if (!loaded && !error) return null;

  // Dark-only premium: force a dark navigation theme with our canvas, regardless of device setting.
  const navTheme = {
    ...DarkTheme,
    colors: { ...DarkTheme.colors, background: c.bg, card: c.navBar, border: c.hairline },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navTheme}>
        <RecitationProvider>
          <RootGate />
        </RecitationProvider>
        <StatusBar style="light" />
      </ThemeProvider>
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
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const stage: 'auth' | 'onboard' | 'app' = !authDecided ? 'auth' : !profile.onboarded ? 'onboard' : 'app';

  return (
    <View style={styles.root}>
      {/* The destination screen, cross-fading whenever the stage changes (log in -> Today, finish the
          questions -> Today). On cold launch it mounts UNDER the splash, so the splash melts into it. */}
      <Animated.View key={stage} style={styles.fill} entering={FadeIn.duration(420)}>
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
      </Animated.View>

      {/* The animated launch splash — shown once per cold launch, then it fades away to reveal the stage. */}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  fill: { flex: 1 },
});
