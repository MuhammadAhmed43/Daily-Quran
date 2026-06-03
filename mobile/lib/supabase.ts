// Supabase client for the community ("Ameen wall") - the ONE place the mobile app talks to Supabase
// directly (everything else goes through the Vercel API). Uses the PUBLIC anon key (RLS-protected) +
// anonymous auth, with the session persisted in AsyncStorage. No-ops gracefully if env isn't set, so
// the rest of the app is unaffected when the community isn't configured.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const communityReady = !!(url && anon);

export const supabase = communityReady
  ? createClient(url as string, anon as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Ensure a session exists - sign in anonymously on first use. Returns the session, or null if the
// community isn't configured / sign-in failed (the caller shows a graceful "unavailable" state).
export async function ensureAnonSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: signedIn, error } = await supabase.auth.signInAnonymously();
  if (error) return null;
  return signedIn.session;
}
