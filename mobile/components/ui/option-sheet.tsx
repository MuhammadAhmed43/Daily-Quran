// A slide-up option picker (onyx) — the reflect-style RN Modal sheet used for the settings enum pickers
// (answer detail, approach, age range, daily goal) and multi-select (what brings you here). Single-select
// closes on pick; multi-select toggles + has a Done button. See UI-REDESIGN-SPEC.md §3.7.
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';
import { c, font, radius, space } from '@/lib/theme';
import { PressableScale } from './pressable-scale';
import { Txt } from './primitives';

export type Option<T extends string> = { value: T; label: string; hint?: string };

export function OptionSheet<T extends string>({
  visible,
  title,
  subtitle,
  options,
  selected,
  multi = false,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: Option<T>[];
  selected: T | T[];
  multi?: boolean;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const isSel = (v: T) => (multi ? (selected as T[]).includes(v) : selected === v);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fill}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={[styles.panel, { paddingBottom: insets.bottom + space.gutter }]}>
          <View style={styles.handle} />
          <Txt variant="h2" style={styles.title}>
            {title}
          </Txt>
          {subtitle ? (
            <Txt variant="caption" color={c.textMuted} style={styles.subtitle}>
              {subtitle}
            </Txt>
          ) : null}
          <ScrollView style={styles.list} contentContainerStyle={styles.listInner} showsVerticalScrollIndicator={false}>
            {options.map((o) => {
              const on = isSel(o.value);
              return (
                <PressableScale
                  key={o.value}
                  style={[styles.opt, on && styles.optOn]}
                  onPress={() => {
                    haptic.light();
                    onSelect(o.value);
                    if (!multi) onClose();
                  }}>
                  <View style={styles.optText}>
                    <Txt style={[styles.optLabel, on && styles.optLabelOn]} numberOfLines={1}>
                      {o.label}
                    </Txt>
                    {o.hint ? (
                      <Txt variant="caption" color={c.textMuted} numberOfLines={2}>
                        {o.hint}
                      </Txt>
                    ) : null}
                  </View>
                  {on ? <Ionicons name="checkmark-circle" size={21} color={c.accent} /> : <View style={styles.radioOff} />}
                </PressableScale>
              );
            })}
          </ScrollView>
          {multi ? (
            <PressableScale style={styles.done} onPress={onClose}>
              <Txt style={styles.doneText}>Done</Txt>
            </PressableScale>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  panel: {
    backgroundColor: c.surface2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassLip,
    paddingTop: 10,
    paddingHorizontal: space.gutter,
    maxHeight: '78%',
  },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', marginBottom: 14 },
  title: { marginBottom: 2 },
  subtitle: { marginBottom: 12 },
  list: { flexGrow: 0 },
  listInner: { gap: 8, paddingBottom: 6 },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: radius.sm,
    backgroundColor: c.surface1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  optOn: { borderColor: c.accent, backgroundColor: 'rgba(201,189,166,0.10)' },
  optText: { flex: 1, gap: 2 },
  optLabel: { fontFamily: font.serif, fontSize: 16, lineHeight: 21, color: c.textPrimary },
  optLabelOn: { color: c.accentBright },
  radioOff: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)' },
  done: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.full,
    backgroundColor: c.primary,
  },
  doneText: { fontFamily: font.sansSemi, fontSize: 15.5, color: c.bg },
});
