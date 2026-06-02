import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { haptic } from '@/lib/haptics';
import { RECITERS } from '@/lib/recitation';

const ACCENT = '#0a7ea4';

type Props = {
  visible: boolean;
  currentId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
};

// A bottom sheet to pick the qāri. The choice persists and (if something is playing) the
// current ayah restarts in the new voice immediately.
export function ReciterSheet({ visible, currentId, onClose, onSelect }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <ThemedView style={styles.panel}>
          <View style={styles.handle} />
          <ThemedText style={styles.title}>Reciter</ThemedText>
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
                  <ThemedText style={[styles.name, active && styles.nameActive]}>{r.name}</ThemedText>
                  {active ? <Ionicons name="checkmark-circle" size={22} color={ACCENT} /> : null}
                </Pressable>
              );
            })}
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
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(127,127,127,0.4)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 13, fontWeight: '700', opacity: 0.5, letterSpacing: 0.5, marginBottom: 4 },
  list: { paddingVertical: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
  },
  rowPressed: { backgroundColor: 'rgba(127,127,127,0.12)' },
  name: { fontSize: 16, fontWeight: '500' },
  nameActive: { color: ACCENT, fontWeight: '700' },
});
