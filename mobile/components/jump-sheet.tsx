import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Txt } from '@/components/ui/primitives';
import { haptic } from '@/lib/haptics';
import { getSurah, resolveReference, SURAHS } from '@/lib/quran';
import { c, font, radius, space } from '@/lib/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  currentSurahNo: number;
  onJump: (surah: number, ayah: number) => void;
};

// A bottom sheet to jump anywhere in the mushaf: type a reference (2:255 / a name), pick a
// surah, then tap an ayah in the grid.
export function JumpSheet({ visible, onClose, currentSurahNo, onJump }: Props) {
  const [selectedNo, setSelectedNo] = useState(currentSurahNo);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedNo(currentSurahNo);
      setPicking(false);
      setQuery('');
    }
  }, [visible, currentSurahNo]);

  const selected = getSurah(selectedNo);

  const jump = (s: number, a: number) => {
    haptic.medium();
    onJump(s, a);
    onClose();
  };
  const submitRef = () => {
    const r = resolveReference(query.trim());
    if (r) jump(r.surah, r.ayah ?? 1);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.panel}>
          <View style={styles.handle} />

          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={c.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={submitRef}
              placeholder="Go to 2:255 or a surah name"
              placeholderTextColor={c.textMuted}
              style={styles.input}
              autoCorrect={false}
              returnKeyType="go"
            />
          </View>

          <Pressable style={styles.surahBtn} onPress={() => setPicking((p) => !p)}>
            <Txt variant="body" color={c.accent} style={styles.surahBtnText} numberOfLines={1}>
              {selected ? `${selected.englishName} · Surah ${selected.number}` : 'Pick a surah'}
            </Txt>
            <Ionicons name={picking ? 'chevron-up' : 'chevron-down'} size={18} color={c.accent} />
          </Pressable>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            {picking ? (
              SURAHS.map((s) => (
                <Pressable
                  key={s.number}
                  style={({ pressed }) => [
                    styles.surahRow,
                    s.number === selectedNo && styles.surahRowOn,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    haptic.light();
                    setSelectedNo(s.number);
                    setPicking(false);
                  }}>
                  <View style={styles.badge}>
                    <Txt style={styles.badgeText}>{s.number}</Txt>
                  </View>
                  <View style={styles.surahMid}>
                    <Txt variant="cardTitle" numberOfLines={1}>
                      {s.englishName}
                    </Txt>
                    <Txt variant="caption">
                      {s.numberOfAyahs} ayat · {s.revelationType}
                    </Txt>
                  </View>
                  <Txt style={styles.arabicName}>{s.name}</Txt>
                </Pressable>
              ))
            ) : selected ? (
              <View style={styles.grid}>
                {Array.from({ length: selected.numberOfAyahs }, (_, i) => i + 1).map((n) => (
                  <Pressable
                    key={n}
                    style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
                    onPress={() => jump(selected.number, n)}>
                    <Txt style={styles.cellText}>{n}</Txt>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  panel: {
    maxHeight: '74%',
    backgroundColor: c.surface2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    paddingHorizontal: space.gutter,
    paddingTop: space.sm,
    paddingBottom: space.section,
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.16)', alignSelf: 'center', marginBottom: space.md },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.surface3,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    paddingHorizontal: 12,
    height: 46,
  },
  input: { flex: 1, fontFamily: font.sans, fontSize: 16, color: c.textPrimary, padding: 0 },
  surahBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 2,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  surahBtnText: { flex: 1, fontFamily: font.sansSemi },
  body: { paddingVertical: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    width: 46,
    height: 46,
    borderRadius: radius.badge,
    backgroundColor: c.surface3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { fontFamily: font.sansSemi, fontSize: 15, color: c.textPrimary },
  cellPressed: { transform: [{ scale: 0.92 }], backgroundColor: 'rgba(201,189,166,0.18)', borderColor: 'transparent' },
  pressed: { opacity: 0.6 },
  surahRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairlineSoft,
  },
  surahRowOn: { backgroundColor: 'rgba(201,189,166,0.10)', borderRadius: radius.sm },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  badgeText: { fontFamily: font.serifMed, fontSize: 13, color: c.accent },
  surahMid: { flex: 1, gap: 2 },
  arabicName: { fontFamily: font.arabic, fontSize: 20, lineHeight: 34, color: c.scriptureInk, writingDirection: 'rtl' },
});
