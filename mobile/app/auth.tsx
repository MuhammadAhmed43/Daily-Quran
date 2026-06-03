import { Stack, useRouter } from 'expo-router';

import { AuthFlow } from '@/components/auth/auth-flow';

// Route version of the auth screen - used when a GUEST chooses to create an account / log in from the
// profile screen. (The first-launch gate renders AuthFlow directly from the root layout.)
export default function AuthRoute() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
      <AuthFlow onDone={() => router.back()} />
    </>
  );
}
