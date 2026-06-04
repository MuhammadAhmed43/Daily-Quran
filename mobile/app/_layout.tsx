import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Fraunces_400Regular, Fraunces_400Regular_Italic, Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { AuthFlow } from '@/components/auth/auth-flow';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { c } from '@/lib/theme';
import { getAuthDecided, subscribeAuthChange } from '@/lib/auth';
import { useProfile } from '@/lib/profile';
import { RecitationProvider } from '@/lib/recitation-context';
import { startSync } from '@/lib/sync';
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
    <ThemeProvider value={navTheme}>
      <RecitationProvider>
        <RootGate />
      </RecitationProvider>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

// First-run gate: show onboarding until the profile says setup is done, then the app. The splash
// is held until the profile has loaded, so there's no flash of the wrong screen on launch.
function RootGate() {
  const { profile, loaded } = useProfile();
  const [trReady, setTrReady] = useState(false);
  const [authDecided, setAuthDecided] = useState<boolean | null>(null);

  // Load the saved translation before the first frame so scripture never flashes the wrong one.
  useEffect(() => {
    hydrateTranslation().finally(() => setTrReady(true));
  }, []);
  // Has the user signed in or chosen guest? (A returning permanent session counts as decided.)
  useEffect(() => {
    getAuthDecided().then(setAuthDecided);
    // Re-evaluate on sign in / out so signing out drops back to the landing screen.
    return subscribeAuthChange(() => getAuthDecided().then(setAuthDecided));
  }, []);

  // Kick off cloud sync: a no-op for guests, runs on sign-in + app foreground/background.
  useEffect(() => {
    startSync();
  }, []);

  useEffect(() => {
    if (loaded && trReady && authDecided !== null) SplashScreen.hideAsync();
  }, [loaded, trReady, authDecided]);

  if (!loaded || !trReady || authDecided === null) return null;
  if (!authDecided) return <AuthFlow onDone={() => setAuthDecided(true)} />;
  if (!profile.onboarded) return <OnboardingFlow />;

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
