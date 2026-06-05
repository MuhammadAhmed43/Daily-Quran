// EDIT PROFILE (onyx, Bible Chat frame 31). Circular X + centered gradient avatar; a label-over-outlined
// stack: Name (editable when signed in -> auth full_name; guests are sent to sign-in), then picker rows
// for Age range / What brings you here (focuses) / Daily reading goal / Preferred translation — all real
// profile fields. Logic preserved; this only adds the editing surface.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { TranslationSheet } from '@/components/translation-sheet';
import { OptionSheet, type Option } from '@/components/ui/option-sheet';
import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { updateDisplayName, useAuth } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { type AgeBand, updateProfile, useProfile } from '@/lib/profile';
import { c, font, grad, radius, space } from '@/lib/theme';
import { translationMeta, useTranslation } from '@/lib/translations';

const AGES: Option<AgeBand>[] = [
  { value: '13-17', label: '13 to 17' },
  { value: '18-24', label: '18 to 24' },
  { value: '25-34', label: '25 to 34' },
  { value: '35-49', label: '35 to 49' },
  { value: '50+', label: '50 and over' },
];

const FOCUSES: Option<string>[] = [
  { value: 'anxiety', label: 'Anxiety & worry' },
  { value: 'grief', label: 'Grief & loss' },
  { value: 'hopelessness', label: 'Hopelessness' },
  { value: 'doubt', label: 'Doubt' },
  { value: 'temptation', label: 'Temptation' },
  { value: 'relationships', label: 'Relationships' },
  { value: 'curious', label: 'Just curious' },
];

const GOALS: Option<string>[] = [
  { value: '2', label: '2 minutes a day' },
  { value: '5', label: '5 minutes a day' },
  { value: '10', label: '10 minutes a day' },
  { value: '15', label: '15 minutes a day' },
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Txt variant="caption" color={c.textMuted} style={styles.fieldLabel}>
        {label}
      </Txt>
      {children}
    </View>
  );
}

function PickerRow({ icon, value, set, onPress }: { icon: keyof typeof Ionicons.glyphMap; value: string; set: boolean; onPress: () => void }) {
  return (
    <PressableScale style={styles.input} onPress={onPress}>
      <Ionicons name={icon} size={18} color={c.textSecondary} />
      <Txt style={[styles.inputText, !set && styles.inputPlaceholder]} numberOfLines={1}>
        {value}
      </Txt>
      <Ionicons name="chevron-forward" size={17} color={c.textMuted} />
    </PressableScale>
  );
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { id: trId, setId: setTr } = useTranslation();
  const guest = !user || user.isAnonymous;

  const [nameInput, setNameInput] = useState(guest ? '' : user?.name ?? '');
  const [sheet, setSheet] = useState<null | 'age' | 'focus' | 'goal'>(null);
  const [trOpen, setTrOpen] = useState(false);

  useEffect(() => {
    if (!guest && user?.name) setNameInput(user.name);
  }, [guest, user?.name]);

  const initial = (guest ? '' : nameInput || user?.name || '').trim().charAt(0).toUpperCase();

  const saveName = () => {
    const next = nameInput.trim();
    if (guest || !next || next === user?.name) return;
    updateDisplayName(next);
  };

  const toggleFocus = (value: string) => {
    const has = profile.focuses.includes(value);
    updateProfile({ focuses: has ? profile.focuses.filter((f) => f !== value) : [...profile.focuses, value] });
  };

  const openSheet = (k: 'age' | 'focus' | 'goal') => {
    haptic.light();
    setSheet(k);
  };

  const ageSet = AGES.some((a) => a.value === profile.ageBand);
  const ageLabel = AGES.find((a) => a.value === profile.ageBand)?.label ?? 'Add your age range';
  const focusLabel = profile.focuses.length
    ? profile.focuses.map((f) => FOCUSES.find((o) => o.value === f)?.label ?? f).join(', ')
    : 'What brings you here';
  const goalLabel = GOALS.find((g) => g.value === String(profile.dailyMinutes))?.label ?? `${profile.dailyMinutes} minutes a day`;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.flex} />
          <IconButton name="close" onPress={() => router.back()} diameter={38} size={20} bg={c.surface2} color={c.textSecondary} />
        </View>

        <View style={styles.avatarWrap}>
          <LinearGradient colors={c.goldGrad} start={grad.diagStart} end={grad.diagEnd} style={styles.avatar}>
            {initial ? <Txt style={styles.avatarInitial}>{initial}</Txt> : <Ionicons name="person" size={34} color={c.bg} />}
          </LinearGradient>
        </View>

        <Field label="Your name">
          {guest ? (
            <PressableScale
              style={styles.input}
              onPress={() => {
                haptic.light();
                router.push('/auth');
              }}>
              <Ionicons name="person-outline" size={18} color={c.textMuted} />
              <Txt style={[styles.inputText, styles.inputPlaceholder]}>Sign in to set your name</Txt>
              <Ionicons name="chevron-forward" size={17} color={c.textMuted} />
            </PressableScale>
          ) : (
            <View style={styles.input}>
              <Ionicons name="person-outline" size={18} color={c.textSecondary} />
              <TextInput
                style={styles.inputText}
                value={nameInput}
                onChangeText={setNameInput}
                onBlur={saveName}
                placeholder="Your name"
                placeholderTextColor={c.textMuted}
                returnKeyType="done"
                maxLength={40}
              />
            </View>
          )}
        </Field>

        <Field label="Age range">
          <PickerRow icon="calendar-outline" value={ageLabel} set={ageSet} onPress={() => openSheet('age')} />
        </Field>

        <Field label="What brings you here">
          <PickerRow icon="heart-outline" value={focusLabel} set={profile.focuses.length > 0} onPress={() => openSheet('focus')} />
        </Field>

        <Field label="Daily reading goal">
          <PickerRow icon="time-outline" value={goalLabel} set onPress={() => openSheet('goal')} />
        </Field>

        <Field label="Preferred translation">
          <PickerRow icon="language-outline" value={translationMeta(trId).label} set onPress={() => { haptic.light(); setTrOpen(true); }} />
        </Field>
      </ScrollView>

      <OptionSheet
        visible={sheet === 'age'}
        title="Age range"
        options={AGES}
        selected={profile.ageBand}
        onSelect={(v) => updateProfile({ ageBand: v })}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'focus'}
        title="What brings you here"
        subtitle="Choose any that fit — they help surface the right verses for you."
        options={FOCUSES}
        selected={profile.focuses}
        multi
        onSelect={toggleFocus}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'goal'}
        title="Daily reading goal"
        options={GOALS}
        selected={String(profile.dailyMinutes)}
        onSelect={(v) => updateProfile({ dailyMinutes: parseInt(v, 10) })}
        onClose={() => setSheet(null)}
      />
      <TranslationSheet visible={trOpen} currentId={trId} onClose={() => setTrOpen(false)} onSelect={setTr} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: space.gutter, paddingTop: space.sm, paddingBottom: space.section, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  avatarWrap: { alignItems: 'center', marginTop: 2, marginBottom: 8 },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: font.serif, fontSize: 36, color: c.bg },
  field: { gap: 7 },
  fieldLabel: { marginLeft: 3 },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    height: 52,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    backgroundColor: c.surface1,
  },
  inputText: { flex: 1, fontFamily: font.sans, fontSize: 15.5, color: c.textPrimary, paddingVertical: 0 },
  inputPlaceholder: { color: c.textMuted },
});
