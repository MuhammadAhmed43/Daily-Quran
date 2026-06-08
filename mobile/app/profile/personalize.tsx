// PERSONALIZE YOUR CONVERSATION (onyx settings sub-screen, Bible Chat frame 33). Maps to the profile
// fields that genuinely shape the assistant's explanations: `knowledge` -> explanation depth and
// `journey` -> voice (both passed to /api/explain, see explain-sheet.tsx). No change to the
// religiously-sensitive server prompt — these are honest, already-wired controls.
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BuildLoader } from '@/components/ui/build-loader';
import { OptionSheet, type Option } from '@/components/ui/option-sheet';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Txt } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { SettingsCard, SettingsHeaderSub, SettingsRow } from '@/components/ui/settings';
import { haptic } from '@/lib/haptics';
import { type Journey, type Knowledge, updateProfile, useProfile } from '@/lib/profile';
import { c, font, radius, space } from '@/lib/theme';

const KNOWLEDGE: Option<Knowledge>[] = [
  { value: 'new', label: 'New to the Qur’an', hint: 'Simple, gentle explanations' },
  { value: 'some', label: 'Some background', hint: 'A little more context' },
  { value: 'comfortable', label: 'Comfortable', hint: 'Standard depth' },
  { value: 'advanced', label: 'Advanced', hint: 'Fuller, more detailed answers' },
];

const APPROACH: Option<Journey>[] = [
  { value: 'practicing', label: 'Practicing', hint: 'Faith-centred and warm' },
  { value: 'learning', label: 'Learning', hint: 'Clear and instructive' },
  { value: 'exploring', label: 'Exploring', hint: 'Open and curious, no assumptions' },
  { value: 'academic', label: 'Academic', hint: 'A scholarly framing' },
];

export default function PersonalizeScreen() {
  const router = useRouter();
  const { profile } = useProfile();
  const [sheet, setSheet] = useState<null | 'knowledge' | 'journey'>(null);
  const [building, setBuilding] = useState(false);

  const knowledgeLabel = KNOWLEDGE.find((o) => o.value === profile.knowledge)?.label ?? 'Choose';
  const journeyLabel = APPROACH.find((o) => o.value === profile.journey)?.label ?? 'Choose';

  const reset = () => {
    haptic.light();
    updateProfile({ knowledge: 'new', journey: 'unspecified' });
  };

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SettingsHeaderSub title="Personalize your conversation" onBack={() => router.back()} />

        <Txt variant="caption" color={c.textMuted} style={styles.intro}>
          These shape how the assistant explains verses to you.
        </Txt>

        <SettingsCard dividerInset={0}>
          <SettingsRow
            title="Answer detail"
            subtitle="How much background the assistant assumes"
            value={knowledgeLabel}
            onPress={() => {
              haptic.light();
              setSheet('knowledge');
            }}
          />
          <SettingsRow
            title="Approach"
            subtitle="The voice the assistant leans into"
            value={journeyLabel}
            onPress={() => {
              haptic.light();
              setSheet('journey');
            }}
          />
          <PressableScale onPress={reset} style={styles.reset}>
            <Txt style={styles.resetText}>Reset to defaults</Txt>
          </PressableScale>
        </SettingsCard>
      </ScrollView>

      <View style={styles.footer}>
        <PressableScale
          style={styles.doneCta}
          onPress={() => {
            haptic.light();
            setBuilding(true);
          }}>
          <Txt style={styles.doneText}>Done</Txt>
        </PressableScale>
      </View>

      <OptionSheet
        visible={sheet === 'knowledge'}
        title="Answer detail"
        subtitle="How much background the assistant assumes"
        options={KNOWLEDGE}
        selected={profile.knowledge}
        onSelect={(v) => updateProfile({ knowledge: v })}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'journey'}
        title="Approach"
        subtitle="The voice the assistant leans into"
        options={APPROACH}
        selected={profile.journey}
        onSelect={(v) => updateProfile({ journey: v })}
        onClose={() => setSheet(null)}
      />

      {building ? (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <BuildLoader
            title="Updating your experience"
            stages={['Saving your preferences', 'Re-tuning explanations', 'Refreshing your space']}
            onDone={() => router.back()}
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingTop: space.sm, paddingBottom: space.section, gap: space.md },
  intro: { paddingHorizontal: space.gutter, marginBottom: 2 },
  reset: { alignItems: 'center', paddingVertical: 16 },
  resetText: { fontFamily: font.sansSemi, fontSize: 14.5, color: c.accent },
  footer: { paddingHorizontal: space.gutter, paddingTop: 8, paddingBottom: 20 },
  doneCta: { backgroundColor: c.primary, paddingVertical: 15, borderRadius: radius.full, alignItems: 'center' },
  doneText: { color: c.bg, fontFamily: font.sansSemi, fontSize: 16 },
  overlay: { backgroundColor: c.bg },
});
