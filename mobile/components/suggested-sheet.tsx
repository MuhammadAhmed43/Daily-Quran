// suggested-sheet.tsx — the recommended-questions sheet (Bible Chat frame 21), 1:1 layout: a grab handle,
// the title "You might want to ask about…", a list of plain question rows separated by faint hairlines (no
// chips, no arrows), and a light full-width "Ask your own question" pill pinned at the bottom. Tapping a row
// opens the curated chat with that question; the pill opens the curated chat to type your own.
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { haptic } from '@/lib/haptics';
import { c, font, radius, space } from '@/lib/theme';

export function SuggestedSheet({
  visible,
  questions,
  onPick,
  onAskOwn,
  onClose,
}: {
  visible: boolean;
  questions: string[];
  onPick: (q: string) => void;
  onAskOwn: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Txt style={styles.title}>You might want to ask about…</Txt>

          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {questions.map((q, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => {
                  haptic.light();
                  onPick(q);
                }}>
                <Txt style={styles.q}>{q}</Txt>
              </Pressable>
            ))}
          </ScrollView>

          <PressableScale
            onPress={() => {
              haptic.light();
              onAskOwn();
            }}
            style={styles.cta}>
            <Txt style={styles.ctaLabel}>Ask your own question</Txt>
          </PressableScale>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    maxHeight: '82%',
    backgroundColor: c.surface2,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    paddingHorizontal: space.gutter,
    paddingTop: space.sm,
    paddingBottom: space.gutter,
  },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.16)', alignSelf: 'center', marginBottom: space.md },
  title: { fontFamily: font.sansMed, fontSize: 16.5, lineHeight: 22, color: c.textPrimary, marginBottom: space.xs },
  list: { paddingBottom: space.sm },
  row: { paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.hairlineSoft },
  rowPressed: { opacity: 0.55 },
  q: { fontFamily: font.sans, fontSize: 15.5, lineHeight: 22, color: c.textPrimary },
  cta: {
    marginTop: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.full,
    backgroundColor: c.primary,
  },
  ctaLabel: { fontFamily: font.sansBold, fontSize: 14, color: c.bg },
});
