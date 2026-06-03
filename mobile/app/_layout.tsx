import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useProfile } from '@/lib/profile';
import { RecitationProvider } from '@/lib/recitation-context';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, error] = useFonts({
    AmiriQuran: require('@/assets/fonts/AmiriQuran-Regular.ttf'),
  });

  if (!loaded && !error) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <RecitationProvider>
        <RootGate />
      </RecitationProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

// First-run gate: show onboarding until the profile says setup is done, then the app. The splash
// is held until the profile has loaded, so there's no flash of the wrong screen on launch.
function RootGate() {
  const { profile, loaded } = useProfile();

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;
  if (!profile.onboarded) return <OnboardingFlow />;

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
    </Stack>
  );
}
