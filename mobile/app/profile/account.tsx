// ACCOUNT (onyx settings root, Bible Chat frame 32 — the canonical settings template). Big serif title +
// circular X; one grouped card (Login[guest] / Edit profile / Personalize / Reminders) + a second card for
// our extras (Translation / Sync / Redo setup) + Sign out + a version/UID footer. All logic reused.
import Constants from 'expo-constants';
import { type Href, Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import { TranslationSheet } from '@/components/translation-sheet';
import { Txt } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { SettingsCard, SettingsHeaderRoot, SettingsRow } from '@/components/ui/settings';
import { signOut, useAuth } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { updateProfile } from '@/lib/profile';
import { syncNow } from '@/lib/sync';
import { c, space } from '@/lib/theme';
import { translationMeta, useTranslation } from '@/lib/translations';

export default function AccountScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id: trId, setId: setTr } = useTranslation();
  const [trOpen, setTrOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const guest = !user || user.isAnonymous;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const go = (path: string) => {
    haptic.light();
    router.push(path as Href);
  };

  const onSync = async () => {
    if (syncing) return;
    haptic.light();
    setSyncing(true);
    const ok = await syncNow();
    setSyncing(false);
    setSynced(ok);
  };

  const onRedo = () => {
    Alert.alert('Redo setup?', 'You will answer the welcome questions again. Your reading progress and bookmarks are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Redo',
        onPress: async () => {
          haptic.light();
          await updateProfile({ onboarded: false });
        },
      },
    ]);
  };

  const onSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime — your account and Ameen posts are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          haptic.light();
          await signOut();
        },
      },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SettingsHeaderRoot title="Account" onClose={() => router.back()} />

        <SettingsCard>
          {guest ? (
            <SettingsRow icon="log-in-outline" title="Log in or create account" subtitle="Save and sync across your devices" onPress={() => go('/auth')} />
          ) : null}
          <SettingsRow icon="person-outline" title="Edit profile" onPress={() => go('/profile/edit')} />
          <SettingsRow icon="options-outline" title="Personalize your conversation" onPress={() => go('/profile/personalize')} />
          <SettingsRow icon="notifications-outline" title="Manage your reminders" onPress={() => go('/profile/reminders')} />
        </SettingsCard>

        <SettingsCard>
          <SettingsRow icon="language-outline" title="Translation" value={translationMeta(trId).short} onPress={() => { haptic.light(); setTrOpen(true); }} />
          {!guest ? (
            <SettingsRow
              icon="cloud-upload-outline"
              title="Sync now"
              subtitle={syncing ? 'Syncing…' : synced ? 'Backed up to your account' : 'Back up across your devices'}
              right={syncing ? <ActivityIndicator size="small" color={c.accent} /> : undefined}
              onPress={onSync}
            />
          ) : null}
          <SettingsRow icon="refresh-outline" title="Redo setup" subtitle="Re-answer the welcome questions" onPress={onRedo} />
        </SettingsCard>

        {!guest ? (
          <SettingsCard>
            <SettingsRow icon="log-out-outline" iconColor={c.danger} title="Sign out" danger chevron={false} onPress={onSignOut} />
          </SettingsCard>
        ) : null}

        <View style={styles.footer}>
          <Txt variant="caption" color={c.textMuted}>
            App Version {version}
          </Txt>
          {user ? (
            <Txt variant="caption" color={c.textMuted} numberOfLines={1} style={styles.uid}>
              UID {user.id}
            </Txt>
          ) : null}
        </View>
      </ScrollView>

      <TranslationSheet visible={trOpen} currentId={trId} onClose={() => setTrOpen(false)} onSelect={setTr} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingTop: space.sm, paddingBottom: space.section, gap: space.card },
  footer: { alignItems: 'center', gap: 3, marginTop: space.sm, paddingHorizontal: space.gutter },
  uid: { maxWidth: '90%' },
});
