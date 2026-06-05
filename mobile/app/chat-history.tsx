// HISTORY — past Ask conversations (frame 22). Tap to reopen one in the Ask tab; trash to delete.
// Conversations are archived here whenever the user starts a New chat. Stored on-device (chat-history.ts).
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import {
  deleteConversation,
  restoreConversation,
  setPendingRestore,
  useHistory,
  type Conversation,
} from '@/lib/chat-history';
import { haptic } from '@/lib/haptics';
import { c, font, space } from '@/lib/theme';

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ${d === 1 ? 'day' : 'days'} ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function previewOf(conv: Conversation): string {
  const firstAnswer = conv.msgs.find((m) => m.role === 'assistant');
  return firstAnswer && firstAnswer.role === 'assistant' ? firstAnswer.data.answer : '';
}

export default function ChatHistoryScreen() {
  const router = useRouter();
  const history = useHistory();

  const open = async (id: string) => {
    haptic.light();
    const msgs = await restoreConversation(id);
    setPendingRestore(msgs, id); // /ask reopens it in its own thread (hist:<id>)
    router.replace('/ask'); // reopen it in the full-screen conversation (no tab bar)
  };

  const remove = (conv: Conversation) => {
    Alert.alert('Delete conversation?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          haptic.light();
          void deleteConversation(conv.id);
        },
      },
    ]);
  };

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <IconButton name="chevron-back" onPress={() => router.back()} diameter={38} size={22} color={c.textPrimary} />
        <Txt variant="cardTitle">History</Txt>
        <View style={styles.spacer} />
      </View>

      {history.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="time-outline" size={34} color={c.textMuted} />
          <Txt variant="body" color={c.textMuted} style={styles.emptyText}>
            Your past conversations will appear here.
          </Txt>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {history.map((conv) => {
            const replies = conv.msgs.filter((m) => m.role === 'assistant').length;
            const preview = previewOf(conv);
            return (
              <PressableScale key={conv.id} style={styles.row} onPress={() => void open(conv.id)}>
                <View style={styles.rowMid}>
                  <Txt variant="cardTitle" numberOfLines={2}>
                    {conv.title}
                  </Txt>
                  {preview ? (
                    <Txt variant="body" color={c.textSecondary} numberOfLines={2} style={styles.preview}>
                      {preview}
                    </Txt>
                  ) : null}
                  <Txt variant="caption" style={styles.meta}>
                    {replies} {replies === 1 ? 'reply' : 'replies'} · {timeAgo(conv.updatedAt)}
                  </Txt>
                </View>
                <Pressable hitSlop={10} onPress={() => remove(conv)} style={styles.trash} accessibilityLabel="Delete conversation">
                  <Ionicons name="trash-outline" size={18} color={c.textMuted} />
                </Pressable>
              </PressableScale>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingBottom: space.sm,
  },
  spacer: { width: 38 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: space.section },
  emptyText: { textAlign: 'center' },
  list: { paddingHorizontal: space.gutter, paddingBottom: space.section },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: space.gutter,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairlineSoft,
  },
  rowMid: { flex: 1, gap: 4 },
  preview: { lineHeight: 20 },
  meta: { fontFamily: font.sansMed, marginTop: 2 },
  trash: { padding: 4, marginTop: 2 },
});
