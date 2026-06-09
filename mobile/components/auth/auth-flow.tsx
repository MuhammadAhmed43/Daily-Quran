// Auth landing (onyx) — the first screen for a new user: sign up / log in / Google / continue as guest.
// Onyx reskin only; all auth logic (email/google/guest + the Google redirect helper) is preserved.
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { SealMedallion } from '@/components/atlas-tile';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Txt } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { continueAsGuest, signInEmail, signInGoogle, signUpEmail } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { updateProfile } from '@/lib/profile';
import { c, font, radius } from '@/lib/theme';

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
      setBusy(null); // clear the spinner now; routing (onDone) drives the unmount, but never depend on it
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
    Alert.alert('Redirect URL copied', `${uri}\n\nAdd this exact URL in Supabase -> Authentication -> URL Configuration -> Redirect URLs, then try Google again.`);
  };

  const submitEmail = () =>
    run('email', async () => {
      const r = mode === 'signup' ? await signUpEmail(email, password, name) : await signInEmail(email, password);
      // A brand-new account has no profile yet -> send them through the welcome questions next.
      if (r.ok && mode === 'signup') await updateProfile({ onboarded: false });
      return r;
    });

  return (
    <Screen edges={['top', 'bottom']} stars>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <SealMedallion name="star-crescent" frame={78} ring={56} glyph={32} glowStrength={0.34} />
            <Txt variant="display" style={styles.title}>
              Daily Qur’an
            </Txt>
            <Txt variant="body" color={c.textMuted} style={styles.tagline}>
              Read, reflect, and pray — a little every day.
            </Txt>
          </View>

          <View style={styles.segment}>
            {(['signup', 'login'] as Mode[]).map((m) => (
              <PressableScale
                key={m}
                style={[styles.segBtn, mode === m && styles.segBtnOn]}
                onPress={() => {
                  haptic.light();
                  setMode(m);
                  setError(null);
                }}>
                <Txt style={[styles.segText, mode === m && styles.segTextOn]}>{m === 'signup' ? 'Sign up' : 'Log in'}</Txt>
              </PressableScale>
            ))}
          </View>

          {mode === 'signup' ? (
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={c.textMuted}
              style={styles.input}
              autoCapitalize="words"
              editable={!busy}
            />
          ) : null}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={c.textMuted}
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
            placeholderTextColor={c.textMuted}
            style={styles.input}
            secureTextEntry
            editable={!busy}
          />

          {error ? (
            <Txt variant="caption" color={c.danger} style={styles.error}>
              {error}
            </Txt>
          ) : null}
          {showRedirectHelp ? (
            <PressableScale style={styles.redirectHelp} onPress={copyRedirect}>
              <Ionicons name="copy-outline" size={14} color={c.accent} />
              <Txt style={styles.redirectHelpText}>Setting up Google? Tap to copy this app’s redirect URL</Txt>
            </PressableScale>
          ) : null}

          <PressableScale style={[styles.primary, (!canSubmit || !!busy) && styles.primaryOff]} onPress={submitEmail} disabled={!canSubmit || !!busy}>
            {busy === 'email' ? (
              <ActivityIndicator color={c.bg} />
            ) : (
              <Txt style={styles.primaryText}>{mode === 'signup' ? 'Create account' : 'Log in'}</Txt>
            )}
          </PressableScale>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Txt variant="caption" color={c.textMuted}>
              or
            </Txt>
            <View style={styles.line} />
          </View>

          <PressableScale style={[styles.social, !!busy && styles.socialOff]} onPress={() => run('google', signInGoogle)} disabled={!!busy}>
            {busy === 'google' ? (
              <ActivityIndicator color={c.accent} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color="#E0A89B" />
                <Txt style={styles.socialText}>Continue with Google</Txt>
              </>
            )}
          </PressableScale>

          <View style={[styles.social, styles.socialDisabled]}>
            <Ionicons name="logo-apple" size={19} color={c.textMuted} />
            <Txt style={styles.socialTextOff}>Apple — coming soon</Txt>
          </View>

          <PressableScale style={styles.guest} onPress={() => run('guest', continueAsGuest)} disabled={!!busy}>
            {busy === 'guest' ? <ActivityIndicator color={c.accent} /> : <Txt style={styles.guestText}>Continue as guest</Txt>}
          </PressableScale>

          <Txt variant="caption" color={c.textMuted} style={styles.fine}>
            Your account powers the Ameen wall and syncs your streak and bookmarks across devices. As a guest, everything stays on this device.
          </Txt>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingVertical: 28, gap: 14, flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { textAlign: 'center' },
  tagline: { textAlign: 'center' },
  segment: { flexDirection: 'row', backgroundColor: c.surface2, borderRadius: radius.md, padding: 4, gap: 4 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segBtnOn: { backgroundColor: c.accent },
  segText: { fontFamily: font.sansSemi, fontSize: 15, color: c.textSecondary },
  segTextOn: { color: c.bg },
  input: {
    backgroundColor: c.surface1,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: font.sans,
    color: c.textPrimary,
  },
  error: { lineHeight: 19, paddingHorizontal: 4 },
  redirectHelp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  redirectHelpText: { fontFamily: font.sansMed, fontSize: 12.5, color: c.accent },
  primary: { backgroundColor: c.primary, paddingVertical: 15, borderRadius: radius.full, alignItems: 'center', marginTop: 2 },
  primaryOff: { opacity: 0.4 },
  primaryText: { color: c.bg, fontFamily: font.sansSemi, fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.hairline },
  social: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  socialOff: { opacity: 0.5 },
  socialDisabled: { opacity: 0.5, borderStyle: 'dashed' },
  socialText: { fontFamily: font.sansSemi, fontSize: 15, color: c.textPrimary },
  socialTextOff: { fontFamily: font.sansSemi, fontSize: 15, color: c.textMuted },
  guest: { alignItems: 'center', paddingVertical: 14, marginTop: 2 },
  guestText: { fontFamily: font.sansSemi, fontSize: 15.5, color: c.accent },
  fine: { lineHeight: 17, textAlign: 'center', paddingHorizontal: 8, marginTop: 2 },
});
