import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui/primitives';
import { haptic } from '@/lib/haptics';
import { c, font, radius, space } from '@/lib/theme';
import { TRANSLATIONS, type TranslationId } from '@/lib/translations';

type Props = {
  visible: boolean;
  currentId: TranslationId;
  onClose: () => void;
  onSelect: (id: TranslationId) => void;
};

// A bottom sheet to pick the English translation. The choice is global + persists, and every scripture
// surface re-renders into it immediately (via useTranslation()).
export function TranslationSheet({ visible, currentId, onClose, onSelect }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.panel}>
          <View style={styles.handle} />
          <Txt variant="eyebrow" style={styles.title}>
            Translation
          </Txt>
          <ScrollView contentContainerStyle={styles.list}>
            {TRANSLATIONS.map((t) => {
              const active = t.id === currentId;
              return (
                <Pressable
                  key={t.id}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => {
                    haptic.light();
                    onSelect(t.id);
                    onClose();
                  }}>
                  <View style={styles.rowText}>
                    <Txt variant="body" color={active ? c.accent : c.textPrimary} style={active ? styles.nameActive : undefined}>
                      {t.label}
                    </Txt>
                    <Txt variant="caption">{t.note}</Txt>
                  </View>
                  {active ? <Ionicons name="checkmark-circle" size={22} color={c.accent} /> : null}
                </Pressable>
              );
            })}
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
    maxHeight: '70%',
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
  title: { marginBottom: space.xs },
  list: { paddingVertical: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairlineSoft,
    gap: 12,
  },
  rowPressed: { backgroundColor: c.surface3 },
  rowText: { flex: 1, gap: 2 },
  nameActive: { fontFamily: font.sansSemi },
});
