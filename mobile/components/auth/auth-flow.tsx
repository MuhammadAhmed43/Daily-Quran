import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { continueAsGuest, signInEmail, signInGoogle, signUpEmail } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { updateProfile } from '@/lib/profile';

const ACCENT = '#0a7ea4';

type Mode = 'login' | 'signup';

export function AuthFlow({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<null | 'email' | 'google' | 'guest'>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRedirectHelp, setShowRedirectHelp] = useState(false);

  const canSubmit = email.trim().length > 3 && password.length >= 6 && (mode === 'login' || name.trim().length > 0);

  const run = async (which: 'email' | 'google' | 'guest', fn: () => Promise<{ ok: boolean; message?: string }>) => {
    if (busy) return;
    haptic.light();
    setBusy(which);
    setError(null);
    const r = await fn();
    if (r.ok) {
      haptic.success();
      onDone();
    } else {
      setError(r.message ?? 'Something went wrong.');
      if (which === 'google') setShowRedirectHelp(true);
      setBusy(null);
    }
  };

  const copyRedirect = async () => {
    const uri = Linking.createURL('auth-callback');
    await Clipboard.setStringAsync(uri);
    Alert.alert(
      'Redirect URL copied',
      `${uri}\n\nAdd this exact URL in Supabase -> Authentication -> URL Configuration -> Redirect URLs, then try Google again.`,
    );
  };

  const submitEmail = () =>
    run('email', async () => {
      const r = mode === 'signup' ? await signUpEmail(email, password, name) : await signInEmail(email, password);
      // A brand-new account has no profile yet -> send them through the welcome questions next.
      if (r.ok && mode === 'signup') await updateProfile({ onboarded: false });
      return r;
    });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.brand}>
              <ThemedText style={styles.crescent}>🌙</ThemedText>
              <ThemedText style={styles.title}>Daily Qur&apos;an</ThemedText>
              <ThemedText style={styles.tagline}>Read, reflect, and pray — a little every day.</ThemedText>
            </View>

            <View style={styles.segment}>
              {(['signup', 'login'] as Mode[]).map((m) => (
                <Pressable
                  key={m}
                  style={[styles.segBtn, mode === m && styles.segBtnOn]}
                  onPress={() => {
                    haptic.light();
                    setMode(m);
                    setError(null);
                  }}>
                  <ThemedText style={[styles.segText, mode === m && styles.segTextOn]}>
                    {m === 'signup' ? 'Sign up' : 'Log in'}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {mode === 'signup' ? (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor="rgba(127,127,127,0.7)"
                style={styles.input}
                autoCapitalize="words"
                editable={!busy}
              />
            ) : null}
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor="rgba(127,127,127,0.7)"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!busy}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password (6+ characters)"
              placeholderTextColor="rgba(127,127,127,0.7)"
              style={styles.input}
              secureTextEntry
              editable={!busy}
            />

            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
            {showRedirectHelp ? (
              <Pressable style={styles.redirectHelp} onPress={copyRedirect}>
                <Ionicons name="copy-outline" size={14} color={ACCENT} />
                <ThemedText style={styles.redirectHelpText}>
                  Setting up Google? Tap to copy this app&apos;s redirect URL
                </ThemedText>
              </Pressable>
            ) : null}

            <Pressable
              style={[styles.primary, (!canSubmit || !!busy) && styles.primaryOff]}
              onPress={submitEmail}
              disabled={!canSubmit || !!busy}>
              {busy === 'email' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.primaryText}>{mode === 'signup' ? 'Create account' : 'Log in'}</ThemedText>
              )}
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.line} />
              <ThemedText style={styles.or}>or</ThemedText>
              <View style={styles.line} />
            </View>

            <Pressable
              style={[styles.social, !!busy && styles.socialOff]}
              onPress={() => run('google', signInGoogle)}
              disabled={!!busy}>
              {busy === 'google' ? (
                <ActivityIndicator color={ACCENT} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={18} color="#DB4437" />
                  <ThemedText style={styles.socialText}>Continue with Google</ThemedText>
                </>
              )}
            </Pressable>

            <View style={[styles.social, styles.socialDisabled]}>
              <Ionicons name="logo-apple" size={19} color="rgba(127,127,127,0.6)" />
              <ThemedText style={styles.socialTextOff}>Apple — coming soon</ThemedText>
            </View>

            <Pressable style={styles.guest} onPress={() => run('guest', continueAsGuest)} disabled={!!busy}>
              {busy === 'guest' ? (
                <ActivityIndicator color={ACCENT} />
              ) : (
                <ThemedText style={styles.guestText}>Continue as guest</ThemedText>
              )}
            </Pressable>

            <ThemedText style={styles.fine}>
              Your account powers the Ameen wall and (soon) syncs your streak and bookmarks across devices.
              As a guest, everything stays on this device.
            </ThemedText>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingTop: 36, gap: 14, flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', gap: 6, marginBottom: 10 },
  crescent: { fontSize: 48 },
  title: { fontSize: 28, fontWeight: '800' },
  tagline: { fontSize: 14.5, opacity: 0.65, textAlign: 'center' },
  segment: {
    flexDirection: 'row',
    backgroundColor: 'rgba(127,127,127,0.12)',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segBtnOn: { backgroundColor: ACCENT },
  segText: { fontSize: 15, fontWeight: '700', color: 'rgba(127,127,127,0.9)' },
  segTextOn: { color: '#fff' },
  input: {
    backgroundColor: 'rgba(127,127,127,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: 'rgba(127,127,127,1)',
  },
  error: { color: '#c1554f', fontSize: 13.5, lineHeight: 19, paddingHorizontal: 4 },
  redirectHelp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  redirectHelpText: { fontSize: 12.5, color: ACCENT, fontWeight: '600' },
  primary: { backgroundColor: ACCENT, paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 2 },
  primaryOff: { opacity: 0.4 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(127,127,127,0.4)' },
  or: { fontSize: 13, opacity: 0.5 },
  social: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.35)',
  },
  socialOff: { opacity: 0.5 },
  socialDisabled: { opacity: 0.5, borderStyle: 'dashed' },
  socialText: { fontSize: 15, fontWeight: '600' },
  socialTextOff: { fontSize: 15, fontWeight: '600', opacity: 0.7 },
  guest: { alignItems: 'center', paddingVertical: 14, marginTop: 2 },
  guestText: { color: ACCENT, fontSize: 15.5, fontWeight: '700' },
  fine: { fontSize: 11.5, opacity: 0.5, lineHeight: 17, textAlign: 'center', paddingHorizontal: 8, marginTop: 2 },
});
