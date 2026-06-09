// Authentication for Daily Qur'an. Builds on the Supabase client already used by the Ameen wall.
// Guests use an anonymous session; signing up UPGRADES that same anonymous user to a permanent account
// (so Ameen posts + the user id carry over). Email/password + Google OAuth. The "auth decided" flag
// gates the landing screen - it's true once you sign in OR choose guest, and for any returning
// (non-anonymous) session. Cloud sync (profile/streak/bookmarks) is layered on top of this elsewhere.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';

import { ensureAnonSession, supabase } from './supabase';
import { clearLocalUserData, suspendSync, syncNow } from './sync';

WebBrowser.maybeCompleteAuthSession();

const DECIDED_KEY = 'daily-quran:auth-decided';

// Bound a network promise so a stalled auth call can never hang the sign-in flow. On timeout it rejects, and
// the caller's try/catch surfaces a clear error instead of trapping the loading spinner forever.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms))]);
}

export type AuthUser = {
  id: string;
  email: string | null;
  name: string; // display name: metadata full_name, else email local-part, else a friendly fallback
  isAnonymous: boolean;
  avatarUrl: string | null;
};
export type AuthResult = { ok: true } | { ok: false; message: string };

function toUser(session: Session | null): AuthUser | null {
  const u = session?.user;
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string; picture?: string };
  const email = u.email ?? null;
  const isAnonymous = !!u.is_anonymous;
  const name = meta.full_name || meta.name || (email ? email.split('@')[0] : '') || (isAnonymous ? 'Guest' : 'Friend');
  return { id: u.id, email, name, isAnonymous, avatarUrl: meta.avatar_url || meta.picture || null };
}

function prettyAuthError(msg: string): string {
  const m = (msg || '').toLowerCase();
  if (m.includes('already') && m.includes('regist')) return 'That email already has an account - try logging in.';
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'Wrong email or password.';
  if (m.includes('at least') || (m.includes('password') && m.includes('6'))) return 'Password must be at least 6 characters.';
  if (m.includes('valid email') || m.includes('email address')) return 'Please enter a valid email.';
  return msg || 'Something went wrong - please try again.';
}

// Has the user made an auth choice (signed in, or explicitly chose guest)? A returning permanent
// session counts as decided even before they touch the flag.
export async function getAuthDecided(): Promise<boolean> {
  if (!supabase) return true; // community not configured -> never gate
  try {
    // Timeout-guarded: getSession is normally a fast local read, but can stall on the auth lock; never let
    // it block the launch/route decision indefinitely.
    const { data } = await withTimeout(supabase.auth.getSession(), 8000, 'getSession');
    if (data.session && !data.session.user.is_anonymous) return true;
  } catch {
    // fall through to the persisted decision flag
  }
  try {
    return (await AsyncStorage.getItem(DECIDED_KEY)) === 'yes';
  } catch {
    return false;
  }
}
async function markDecided(yes: boolean): Promise<void> {
  try {
    if (yes) await AsyncStorage.setItem(DECIDED_KEY, 'yes');
    else await AsyncStorage.removeItem(DECIDED_KEY);
  } catch {}
}

export async function continueAsGuest(): Promise<AuthResult> {
  const s = await withTimeout(ensureAnonSession(), 20000, 'guest');
  if (!s) return { ok: false, message: "Couldn't start a guest session - check your connection." };
  await markDecided(true);
  return { ok: true };
}

export async function signUpEmail(email: string, password: string, name: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, message: 'Accounts are unavailable right now.' };
  const clean = email.trim();
  const display = name.trim();
  // A plain sign-up is the reliable path: anonymous->permanent CONVERSION (updateUser) always requires
  // an email-verification click, which the no-deep-link Expo Go flow can't do. Drop the guest session
  // first so sign-up creates a clean permanent account + session.
  const { data: cur } = await withTimeout(supabase.auth.getSession(), 8000, 'session');
  if (cur.session?.user.is_anonymous) await withTimeout(supabase.auth.signOut(), 10000, 'sign-out');
  const { data, error } = await withTimeout(
    supabase.auth.signUp({ email: clean, password, options: { data: { full_name: display } } }),
    20000,
    'sign-up',
  );
  if (error) return { ok: false, message: prettyAuthError(error.message) };
  // With "Confirm email" OFF, sign-up returns a session immediately (you're signed in). If there's no
  // session, email confirmation is still ON in Supabase - say so plainly instead of failing silently.
  if (!data.session) {
    const { error: e2 } = await withTimeout(supabase.auth.signInWithPassword({ email: clean, password }), 20000, 'sign-in');
    if (e2) {
      return {
        ok: false,
        message: 'Account made, but email confirmation is still ON in Supabase. Turn it off (Auth -> Providers -> Email), then log in.',
      };
    }
  }
  await markDecided(true);
  return { ok: true };
}

export async function signInEmail(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, message: 'Accounts are unavailable right now.' };
  const { error } = await withTimeout(supabase.auth.signInWithPassword({ email: email.trim(), password }), 20000, 'sign-in');
  if (error) return { ok: false, message: prettyAuthError(error.message) };
  await markDecided(true);
  return { ok: true };
}

// Google OAuth via the system browser. Works in a dev/standalone build; in Expo Go the redirect URL is
// an exp:// link that must be allow-listed in Supabase + Google for it to complete.
export async function signInGoogle(): Promise<AuthResult> {
  if (!supabase) return { ok: false, message: 'Accounts are unavailable right now.' };
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await withTimeout(
    supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } }),
    20000,
    'Google start',
  );
  if (error || !data?.url) return { ok: false, message: 'Could not start Google sign-in.' };
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success' || !res.url) return { ok: false, message: 'Google sign-in was cancelled.' };
  try {
    const url = new URL(res.url);
    const code = url.searchParams.get('code');
    if (code) {
      const { error: exErr } = await withTimeout(supabase.auth.exchangeCodeForSession(code), 20000, 'Google exchange');
      if (exErr) return { ok: false, message: 'Google sign-in could not complete.' };
    } else {
      const frag = res.url.includes('#') ? res.url.split('#')[1] : '';
      const p = new URLSearchParams(frag);
      const access_token = p.get('access_token');
      const refresh_token = p.get('refresh_token');
      if (!access_token || !refresh_token) return { ok: false, message: 'Google sign-in did not return a session.' };
      const { error: sErr } = await withTimeout(supabase.auth.setSession({ access_token, refresh_token }), 20000, 'Google session');
      if (sErr) return { ok: false, message: 'Google sign-in could not complete.' };
    }
  } catch {
    return { ok: false, message: 'Google sign-in could not complete.' };
  }
  await markDecided(true);
  return { ok: true };
}

// Update the signed-in user's display name (full_name metadata). Guests have no permanent account to
// save to, so the Edit-profile screen gates the name field behind sign-in.
export async function updateDisplayName(name: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, message: 'Accounts are unavailable right now.' };
  const display = name.trim();
  if (!display) return { ok: false, message: 'Please enter a name.' };
  const { error } = await supabase.auth.updateUser({ data: { full_name: display } });
  if (error) return { ok: false, message: prettyAuthError(error.message) };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await syncNow(); // push any unsynced local changes to the OUTGOING user's cloud row first
  suspendSync(true); // then freeze sync so the SIGNED_OUT event / cache-reset debounce can't push emptied state
  try {
    await clearLocalUserData(); // wipe local so the next account can't inherit/re-upload this user's data
    await markDecided(false);
    if (supabase) await supabase.auth.signOut();
  } finally {
    suspendSync(false); // re-enable for the next sign-in
  }
}

// Subscribe to auth changes (sign in / out / token refresh). Used by the launch gate so signing out
// returns to the landing screen, and signing in advances past it. Returns an unsubscribe fn.
export function subscribeAuthChange(cb: () => void): () => void {
  if (!supabase) return () => {};
  // Defer the callback OUT of the onAuthStateChange handler. supabase-js holds an internal lock while it
  // emits the event, and calling an auth method (our evaluate -> getSession) synchronously from inside here
  // re-enters that lock and DEADLOCKS -- the app hangs after sign-in. setTimeout(0) runs it once the lock
  // is released.
  const { data } = supabase.auth.onAuthStateChange(() => setTimeout(cb, 0));
  return () => data.subscription.unsubscribe();
}

// Reactive auth state for the UI (the profile circle, settings screen, etc.).
export function useAuth(): { user: AuthUser | null; loading: boolean } {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(toUser(data.session));
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setUser(toUser(session)));
    return () => sub.subscription.unsubscribe();
  }, []);
  return { user, loading };
}
