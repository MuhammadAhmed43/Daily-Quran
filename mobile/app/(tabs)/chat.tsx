import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VerseSpeaker } from '@/components/verse-speaker';
import { askQuestion, type ChatResponse, type TafsirSnippet } from '@/lib/chat';
import { takeVoiceExchanges } from '@/lib/voice-bridge';

type Message =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; loading: true }
  | { id: string; role: 'assistant'; loading: false; data?: ChatResponse; error?: string };

const EXAMPLES = [
  'What does the Qur’an say about patience?',
  'How should I treat my parents?',
  'What is Ayat al-Kursi about?',
  'Verses about hope when I feel low',
];

let counter = 0;
const nextId = () => `m${++counter}`;

export default function ChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const pendingScroll = useRef<string | null>(null);

  // Pin the most recent question to the top so a new answer reads from its start
  // (instead of the view snapping to the bottom of a long block).
  const onMsgLayout = (id: string, y: number) => {
    positions.current[id] = y;
    const target = pendingScroll.current;
    if (target && positions.current[target] != null) {
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ y: Math.max(0, positions.current[target] - 8), animated: true }),
      );
    }
  };

  const openVerse = (surah: number, ayah: number) =>
    router.push({ pathname: '/surah/[number]', params: { number: String(surah), ayah: String(ayah) } });

  // When returning from the voice screen, fold its conversation into the chat thread.
  useFocusEffect(
    useCallback(() => {
      const exchanges = takeVoiceExchanges();
      if (!exchanges.length) return;
      setMessages((m) => {
        const added: Message[] = [];
        for (const ex of exchanges) {
          added.push({ id: nextId(), role: 'user', text: ex.question });
          added.push({ id: nextId(), role: 'assistant', loading: false, data: ex.response });
        }
        return [...m, ...added];
      });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 150);
    }, []),
  );

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || sending) return;
      // Build conversation history (prior questions + answers) so follow-ups have context.
      const history = messages
        .map((m) =>
          m.role === 'user'
            ? { role: 'user' as const, content: m.text }
            : !m.loading && m.data
              ? { role: 'assistant' as const, content: m.data.answer }
              : null,
        )
        .filter((x): x is { role: 'user' | 'assistant'; content: string } => !!x && !!x.content)
        .slice(-6);
      setInput('');
      const userId = nextId();
      const loadingId = nextId();
      setMessages((m) => [
        ...m,
        { id: userId, role: 'user', text: q },
        { id: loadingId, role: 'assistant', loading: true },
      ]);
      pendingScroll.current = userId;
      setSending(true);
      try {
        const data = await askQuestion(q, history);
        setMessages((m) =>
          m.map((msg) =>
            msg.id === loadingId ? { id: loadingId, role: 'assistant', loading: false, data } : msg,
          ),
        );
      } catch (e) {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === loadingId
              ? {
                  id: loadingId,
                  role: 'assistant',
                  loading: false,
                  error: String((e as Error)?.message ?? e),
                }
              : msg,
          ),
        );
      } finally {
        setSending(false);
      }
    },
    [sending, messages],
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.container}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Ask</ThemedText>
            <ThemedText style={styles.subtitle}>Grounded in the Qur’an + classical tafsir</ThemedText>
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.thread}
            keyboardShouldPersistTaps="handled">
            {messages.length === 0 ? (
              <View style={styles.empty}>
                <ThemedText style={styles.emptyTitle}>Ask anything about the Qur’an</ThemedText>
                <ThemedText style={styles.emptyBody}>
                  Answers are grounded in the verses and Ibn Kathir’s tafsir, with citations you can tap to open.
                </ThemedText>
                <View style={styles.examples}>
                  {EXAMPLES.map((ex) => (
                    <Pressable key={ex} style={styles.chip} onPress={() => send(ex)}>
                      <ThemedText style={styles.chipText}>{ex}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              messages.map((msg) => (
                <View key={msg.id} onLayout={(e) => onMsgLayout(msg.id, e.nativeEvent.layout.y)}>
                  <MessageView msg={msg} onOpenVerse={openVerse} />
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.inputBar}>
            <Pressable
              style={styles.voiceBtn}
              onPress={() => router.push('/voice')}
              accessibilityLabel="Voice conversation">
              <Ionicons name="mic" size={22} color="#0a7ea4" />
            </Pressable>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask a question…"
              placeholderTextColor="rgba(127,127,127,0.7)"
              style={styles.input}
              multiline
              editable={!sending}
            />
            <Pressable
              style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
              onPress={() => send(input)}
              disabled={!input.trim() || sending}>
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function MessageView({
  msg,
  onOpenVerse,
}: {
  msg: Message;
  onOpenVerse: (surah: number, ayah: number) => void;
}) {
  const [showTafsir, setShowTafsir] = useState(false);
  if (msg.role === 'user') {
    return (
      <View style={styles.userRow}>
        <View style={styles.userBubble}>
          <ThemedText style={styles.userText}>{msg.text}</ThemedText>
        </View>
      </View>
    );
  }
  if (msg.loading) {
    return (
      <View style={styles.assistantRow}>
        <View style={styles.thinking}>
          <ActivityIndicator size="small" color="#0a7ea4" />
          <ThemedText style={styles.thinkingText}>Searching the Qur’an…</ThemedText>
        </View>
      </View>
    );
  }
  if (msg.error) {
    return (
      <View style={styles.assistantRow}>
        <ThemedText style={styles.errorText}>{msg.error}</ThemedText>
      </View>
    );
  }
  const data = msg.data;
  if (!data) return null;
  const [primary, ...others] = data.verses;
  return (
    <View style={styles.assistantRow}>
      <RichAnswer text={data.answer} />

      {/* One prominent verse card... */}
      {primary ? (
        <Pressable
          style={styles.verseCard}
          onPress={() => onOpenVerse(primary.surah, primary.ayah)}>
          <View style={styles.verseHead}>
            <ThemedText style={styles.verseRef}>
              {primary.surah}:{primary.ayah}
            </ThemedText>
            <View style={styles.verseHeadRight}>
              <VerseSpeaker surah={primary.surah} ayah={primary.ayah} />
              <ThemedText style={styles.openLink}>Open →</ThemedText>
            </View>
          </View>
          <ThemedText style={styles.verseArabic}>{primary.arabic}</ThemedText>
          <ThemedText style={styles.verseTrans}>{primary.translation}</ThemedText>
        </Pressable>
      ) : null}

      {/* ...the rest as compact, tappable citation chips. */}
      {others.length > 0 ? (
        <View style={styles.chipRow}>
          <ThemedText style={styles.chipLabel}>Also</ThemedText>
          {others.slice(0, 6).map((v) => (
            <Pressable
              key={`${v.surah}:${v.ayah}`}
              style={styles.refChip}
              onPress={() => onOpenVerse(v.surah, v.ayah)}>
              <ThemedText style={styles.refChipText}>
                {v.surah}:{v.ayah}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Tafsir stays behind a tap — only offered when the answer used it. */}
      {data.tafsir.length > 0 ? (
        <View>
          <Pressable style={styles.tafsirBtn} onPress={() => setShowTafsir((s) => !s)}>
            <ThemedText style={styles.tafsirBtnText}>
              {showTafsir ? '📖  Hide commentary' : '📖  Show Ibn Kathir’s commentary'}
            </ThemedText>
          </Pressable>
          {showTafsir ? (
            <View style={styles.tafsirWrap}>
              {data.tafsir.map((t, i) => (
                <TafsirItem key={`${t.surah}:${t.ayah}:${i}`} t={t} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <ThemedText style={styles.disclaimer}>{data.disclaimer}</ThemedText>
    </View>
  );
}

function renderInline(s: string, keyBase: string) {
  return s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
    const b = part.match(/^\*\*([\s\S]+)\*\*$/);
    if (b)
      return (
        <Text key={`${keyBase}-${i}`} style={styles.bold}>
          {b[1]}
        </Text>
      );
    const it = part.match(/^\*([\s\S]+)\*$/);
    if (it)
      return (
        <Text key={`${keyBase}-${i}`} style={styles.italic}>
          {it[1]}
        </Text>
      );
    return part;
  });
}

// Lightweight Markdown: renders **bold**, *italic*, and "- " bullets so the raw
// markers don't leak into the answer text.
function RichAnswer({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  return (
    <View style={styles.answerBlock}>
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return null;
        const bullet = /^[-*]\s+/.test(t);
        const content = bullet ? t.replace(/^[-*]\s+/, '') : t;
        return (
          <View key={i} style={bullet ? styles.bulletRow : undefined}>
            {bullet ? <ThemedText style={styles.answer}>{'•  '}</ThemedText> : null}
            <ThemedText style={[styles.answer, bullet ? styles.bulletText : null]}>
              {renderInline(content, String(i))}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

// A tafsir excerpt that shows ~4 lines, expandable to the full commentary on tap.
function TafsirItem({ t }: { t: TafsirSnippet }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Pressable onPress={() => setExpanded((e) => !e)} style={styles.tafsirItem}>
      <ThemedText style={styles.tafsirText} numberOfLines={expanded ? undefined : 4}>
        <ThemedText style={styles.tafsirRef}>
          {t.surah}:{t.ayah} —{' '}
        </ThemedText>
        {t.snippet}
      </ThemedText>
      <ThemedText style={styles.tafsirToggle}>{expanded ? 'Show less ▲' : 'Show more ▼'}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, gap: 1 },
  title: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  subtitle: { fontSize: 12, opacity: 0.55 },
  thread: { padding: 16, gap: 16, paddingBottom: 24 },

  empty: { paddingTop: 32, gap: 10, alignItems: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, opacity: 0.6, textAlign: 'center', paddingHorizontal: 12 },
  examples: { gap: 8, marginTop: 12, alignSelf: 'stretch' },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(10,126,164,0.1)',
  },
  chipText: { fontSize: 14, color: '#0a7ea4', fontWeight: '500' },

  userRow: { alignItems: 'flex-end' },
  userBubble: {
    maxWidth: '88%',
    backgroundColor: '#0a7ea4',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  userText: { color: '#fff', fontSize: 15, lineHeight: 21 },

  assistantRow: { gap: 12 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thinkingText: { fontSize: 14, opacity: 0.6 },
  errorText: { fontSize: 14, color: '#e0245e' },
  answer: { fontSize: 15.5, lineHeight: 24 },
  answerBlock: { gap: 8 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start' },
  bulletText: { flex: 1 },

  verseCard: {
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.3)',
    backgroundColor: 'rgba(127,127,127,0.05)',
  },
  verseHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  verseHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  verseRef: { fontSize: 13, fontWeight: '700', color: '#0a7ea4' },
  openLink: { fontSize: 12, color: '#0a7ea4', opacity: 0.8 },
  verseArabic: {
    fontFamily: 'AmiriQuran',
    fontSize: 22,
    lineHeight: 50,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  verseTrans: { fontSize: 14, lineHeight: 21, opacity: 0.85 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chipLabel: { fontSize: 12, opacity: 0.5, marginRight: 2 },
  refChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(10,126,164,0.12)',
  },
  refChipText: { fontSize: 13, fontWeight: '600', color: '#0a7ea4' },
  tafsirBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(180,140,40,0.14)',
  },
  tafsirBtnText: { fontSize: 13, fontWeight: '600', color: '#b8923c' },

  tafsirWrap: {
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(180,140,40,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(180,140,40,0.5)',
  },
  tafsirLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, opacity: 0.55 },
  tafsirText: { fontSize: 13, lineHeight: 19, opacity: 0.8 },
  tafsirItem: { gap: 2, paddingVertical: 2 },
  tafsirToggle: { fontSize: 11, fontWeight: '600', color: '#0a7ea4', opacity: 0.9 },
  tafsirRef: { fontWeight: '700', opacity: 0.9 },
  disclaimer: { fontSize: 11, opacity: 0.45, lineHeight: 16, fontStyle: 'italic' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(127,127,127,0.25)',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    backgroundColor: 'rgba(127,127,127,0.12)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    color: 'rgba(127,127,127,1)',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0a7ea4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  voiceBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,126,164,0.12)',
  },
});
