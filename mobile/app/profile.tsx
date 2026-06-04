import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { VerseReminder } from '@/components/home/verse-reminder';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TranslationSheet } from '@/components/translation-sheet';
import { signOut, useAuth } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { updateProfile } from '@/lib/profile';
import { syncNow } from '@/lib/sync';
import { translationMeta, useTranslation } from '@/lib/translations';

const ACCENT = '#0a7ea4';

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { id: trId, setId: setTr } = useTranslation();
  const [trOpen, setTrOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const guest = !user || user.isAnonymous;

  const onSyncNow = async () => {
    if (syncing) return;
    haptic.light();
    setSyncing(true);
    const ok = await syncNow();
    setSyncing(false);
    setSynced(ok);
  };

  const onRedoSetup = () => {
    Alert.alert('Redo setup?', 'You will answer the welcome questions again. Your reading progress and bookmarks are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Redo',
        onPress: async () => {
          haptic.light();
          await updateProfile({ onboarded: false }); // the launch gate shows onboarding again
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
          await signOut(); // the launch gate returns to the landing screen automatically
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Profile', headerBackTitle: 'Home' }} />
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.account}>
            <View style={styles.avatar}>
              {guest ? (
                <Ionicons name="person" size={30} color="#fff" />
              ) : (
                <ThemedText style={styles.avatarText}>{(user?.name || 'F').charAt(0).toUpperCase()}</ThemedText>
              )}
            </View>
            <ThemedText style={styles.name}>{guest ? 'Guest' : user?.name}</ThemedText>
            {!guest && user?.email ? <ThemedText style={styles.email}>{user.email}</ThemedText> : null}
            {guest ? <ThemedText style={styles.email}>Browsing on this device only</ThemedText> : null}
          </View>

          {guest ? (
            <Pressable
              style={styles.primary}
              onPress={() => {
                haptic.light();
                router.push('/auth');
              }}>
              <Ionicons name="person-add-outline" size={18} color="#fff" />
              <ThemedText style={styles.primaryText}>Create an account or log in</ThemedText>
            </Pressable>
          ) : null}

          <ThemedText style={styles.sectionLabel}>SETTINGS</ThemedText>
          <View style={styles.card}>
            <Pressable
              style={styles.row}
              onPress={() => {
                haptic.light();
                setTrOpen(true);
              }}>
              <Ionicons name="language" size={20} color={ACCENT} />
              <View style={styles.rowText}>
                <ThemedText style={styles.rowTitle}>Translation</ThemedText>
                <ThemedText style={styles.rowSub}>{translationMeta(trId).label}</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(127,127,127,0.5)" />
            </Pressable>
            <View style={styles.rowDivider} />
            <Pressable style={styles.row} onPress={onRedoSetup}>
              <Ionicons name="refresh" size={20} color={ACCENT} />
              <View style={styles.rowText}>
                <ThemedText style={styles.rowTitle}>Redo setup</ThemedText>
                <ThemedText style={styles.rowSub}>Re-answer the welcome questions</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(127,127,127,0.5)" />
            </Pressable>
            {!guest ? (
              <>
                <View style={styles.rowDivider} />
                <Pressable style={styles.row} onPress={onSyncNow} disabled={syncing}>
                  <Ionicons name="cloud-upload-outline" size={20} color={ACCENT} />
                  <View style={styles.rowText}>
                    <ThemedText style={styles.rowTitle}>Sync now</ThemedText>
                    <ThemedText style={styles.rowSub}>
                      {syncing ? 'Syncing…' : synced ? 'Synced — your data is backed up' : 'Back up across your devices'}
                    </ThemedText>
                  </View>
                  {syncing ? (
                    <ActivityIndicator size="small" color={ACCENT} />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color="rgba(127,127,127,0.5)" />
                  )}
                </Pressable>
              </>
            ) : null}
          </View>

          <VerseReminder />

          {!guest ? (
            <Pressable style={styles.signOut} onPress={onSignOut}>
              <ThemedText style={styles.signOutText}>Sign out</ThemedText>
            </Pressable>
          ) : null}

          <ThemedText style={styles.version}>Daily Qur&apos;an</ThemedText>
        </ScrollView>
      </SafeAreaView>

      <TranslationSheet visible={trOpen} currentId={trId} onClose={() => setTrOpen(false)} onSelect={setTr} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 18, gap: 14, paddingBottom: 40 },
  account: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: { color: '#fff', fontSize: 34, fontWeight: '800' },
  name: { fontSize: 21, fontWeight: '800' },
  email: { fontSize: 14, opacity: 0.6 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryText: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
  sectionLabel: { fontSize: 12, fontWeight: '800', opacity: 0.45, letterSpacing: 0.6, marginTop: 8, marginLeft: 4 },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 14 },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(127,127,127,0.2)', marginLeft: 48 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15.5, fontWeight: '600' },
  rowSub: { fontSize: 13, opacity: 0.6 },
  signOut: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(214,84,84,0.4)',
    marginTop: 6,
  },
  signOutText: { color: '#c1554f', fontSize: 15.5, fontWeight: '700' },
  version: { fontSize: 12, opacity: 0.4, textAlign: 'center', marginTop: 10 },
});
