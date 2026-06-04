import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui/primitives';
import { haptic } from '@/lib/haptics';
import { RECITERS } from '@/lib/recitation';
import { c, font, radius, space } from '@/lib/theme';

type Props = {
  visible: boolean;
  currentId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
};

// A bottom sheet to pick the qari. The choice persists and (if something is playing) the
// current ayah restarts in the new voice immediately.
export function ReciterSheet({ visible, currentId, onClose, onSelect }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.panel}>
          <View style={styles.handle} />
          <Txt variant="eyebrow" style={styles.title}>
            Reciter
          </Txt>
          <ScrollView contentContainerStyle={styles.list}>
            {RECITERS.map((r) => {
              const active = r.id === currentId;
              return (
                <Pressable
                  key={r.id}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => {
                    haptic.light();
                    onSelect(r.id);
                    onClose();
                  }}>
                  <Txt variant="body" color={active ? c.accent : c.textPrimary} style={active ? styles.nameActive : undefined}>
                    {r.name}
                  </Txt>
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
    paddingVertical: 15,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairlineSoft,
  },
  rowPressed: { backgroundColor: c.surface3 },
  nameActive: { fontFamily: font.sansSemi },
});
