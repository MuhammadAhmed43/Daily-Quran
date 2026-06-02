import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { haptic } from '@/lib/haptics';
import { getSurah, resolveReference, SURAHS } from '@/lib/quran';

const ACCENT = '#0a7ea4';

type Props = {
  visible: boolean;
  onClose: () => void;
  currentSurahNo: number;
  onJump: (surah: number, ayah: number) => void;
};

// A bottom sheet to jump anywhere in the muṣḥaf: type a reference (2:255 / a name), pick a
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
        <ThemedView style={styles.panel}>
          <View style={styles.handle} />

          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color="rgba(127,127,127,0.7)" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={submitRef}
              placeholder="Go to 2:255 or a surah name"
              placeholderTextColor="rgba(127,127,127,0.7)"
              style={styles.input}
              autoCorrect={false}
              returnKeyType="go"
            />
          </View>

          <Pressable style={styles.surahBtn} onPress={() => setPicking((p) => !p)}>
            <ThemedText style={styles.surahBtnText} numberOfLines={1}>
              {selected ? `${selected.englishName} · Surah ${selected.number}` : 'Pick a surah'}
            </ThemedText>
            <Ionicons name={picking ? 'chevron-up' : 'chevron-down'} size={18} color={ACCENT} />
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
                    <ThemedText style={styles.badgeText}>{s.number}</ThemedText>
                  </View>
                  <View style={styles.surahMid}>
                    <ThemedText type="defaultSemiBold">{s.englishName}</ThemedText>
                    <ThemedText style={styles.sub}>
                      {s.numberOfAyahs} ayat · {s.revelationType}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.arabicName}>{s.name}</ThemedText>
                </Pressable>
              ))
            ) : selected ? (
              <View style={styles.grid}>
                {Array.from({ length: selected.numberOfAyahs }, (_, i) => i + 1).map((n) => (
                  <Pressable
                    key={n}
                    style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
                    onPress={() => jump(selected.number, n)}>
                    <ThemedText style={styles.cellText}>{n}</ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: {
    maxHeight: '74%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(127,127,127,0.4)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(127,127,127,0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  input: { flex: 1, fontSize: 16, color: 'rgba(127,127,127,1)' },
  surahBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 2,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  surahBtnText: { flex: 1, fontSize: 15, fontWeight: '700', color: ACCENT },
  body: { paddingVertical: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: 'rgba(10,126,164,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { fontSize: 15, fontWeight: '600' },
  cellPressed: { opacity: 0.5, transform: [{ scale: 0.92 }], backgroundColor: 'rgba(10,126,164,0.22)' },
  pressed: { opacity: 0.6 },
  surahRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
  },
  surahRowOn: { backgroundColor: 'rgba(10,126,164,0.1)', borderRadius: 8 },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(127,127,127,0.15)',
  },
  badgeText: { fontSize: 13, fontWeight: '600' },
  surahMid: { flex: 1, gap: 2 },
  sub: { opacity: 0.6, fontSize: 12 },
  arabicName: { fontFamily: 'AmiriQuran', fontSize: 20, lineHeight: 34, writingDirection: 'rtl' },
});
