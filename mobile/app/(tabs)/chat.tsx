import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
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

import { FadeIn } from '@/components/fade-in';
import { StreamingText } from '@/components/streaming-text';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VerseSpeaker } from '@/components/verse-speaker';
import { streamChat, type ChatResponse, type TafsirSnippet } from '@/lib/chat';
import { takeChatSeed } from '@/lib/chat-seed';
import { haptic } from '@/lib/haptics';
import { useForYou } from '@/lib/hub-affinity';
import { HUBS, type Hub } from '@/lib/hubs';
import { useProfile } from '@/lib/profile';
import { useRecitation } from '@/lib/recitation-context';
import { recordActivity } from '@/lib/streak';
import { takeVoiceExchanges } from '@/lib/voice-bridge';

type Message =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; status: 'loading' }
  | {
      id: string;
      role: 'assistant';
      status: 'streaming';
      text: string;
      final: boolean;
      pending?: ChatResponse;
    }
  | { id: string; role: 'assistant'; status: 'done'; data: ChatResponse }
  | { id: string; role: 'assistant'; status: 'error'; error: string };

let counter = 0;
const nextId = () => `m${++counter}`;

// A feeling-based hub card in the Ask empty-state browse grid.
function HubCard({ hub, featured, onPress }: { hub: Hub; featured?: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.hubCard,
        featured && styles.hubCardForYou,
        pressed && styles.hubCardPressed,
      ]}
      onPress={onPress}>
      <ThemedText style={styles.hubEmoji}>{hub.emoji}</ThemedText>
      <ThemedText style={styles.hubTitle}>{hub.title}</ThemedText>
      <ThemedText style={styles.hubBlurb} numberOfLines={2}>
        {hub.blurb}
      </ThemedText>
    </Pressable>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const pendingScroll = useRef<string | null>(null);
  const recitation = useRecitation();
  const { profile } = useProfile();
  const [kbUp, setKbUp] = useState(false);
  const emptyAnim = useRef(new Animated.Value(1)).current; // 1 = browse shown, 0 = faded out
  const [showBrowse, setShowBrowse] = useState(true);

  // The global mini-player floats just above the tab bar — give the composer room so it's never
  // hidden under it. Only while the keyboard is DOWN (when it's up, it covers the mini-player).
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setKbUp(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const liftForMini = !!recitation.playing && !kbUp;

  // Smoothly fade + slide the browse away the first time a message exists, and back on "New".
  const hasMessages = messages.length > 0;
  useEffect(() => {
    if (hasMessages) {
      Animated.timing(emptyAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setShowBrowse(false);
      });
    } else {
      setShowBrowse(true);
      Animated.timing(emptyAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [hasMessages, emptyAnim]);

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

  // The typewriter finished revealing the full text → flip to the finished render (cards appear).
  const revealComplete = (id: string, data: ChatResponse) =>
    setMessages((m) =>
      m.map((msg) => (msg.id === id ? { id, role: 'assistant', status: 'done', data } : msg)),
    );

  // When returning from the voice screen, fold its conversation into the chat thread.
  useFocusEffect(
    useCallback(() => {
      const exchanges = takeVoiceExchanges();
      if (!exchanges.length) return;
      setMessages((m) => {
        const added: Message[] = [];
        for (const ex of exchanges) {
          added.push({ id: nextId(), role: 'user', text: ex.question });
          added.push({ id: nextId(), role: 'assistant', status: 'done', data: ex.response });
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
            : m.status === 'done'
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
        { id: loadingId, role: 'assistant', status: 'loading' },
      ]);
      pendingScroll.current = userId;
      setSending(true);
      try {
        const data = await streamChat(q, history, (full) => {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === loadingId
                ? { id: loadingId, role: 'assistant', status: 'streaming', text: full, final: false }
                : msg,
            ),
          );
        });
        recordActivity('asked'); // counts toward the streak
        // Stream finished — hand the FULL text to the typewriter; it keeps revealing to the end,
        // then onComplete flips the message to 'done' (cards appear). Same text → seamless.
        setMessages((m) =>
          m.map((msg) =>
            msg.id === loadingId
              ? {
                  id: loadingId,
                  role: 'assistant',
                  status: 'streaming',
                  text: data.answer,
                  final: true,
                  pending: data,
                }
              : msg,
          ),
        );
      } catch (e) {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === loadingId
              ? {
                  id: loadingId,
                  role: 'assistant',
                  status: 'error',
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

  // A hub's "Talk it through" seeds a starter question — send it when this tab gains focus.
  useFocusEffect(
    useCallback(() => {
      const seed = takeChatSeed();
      if (seed) void send(seed);
    }, [send]),
  );

  // The empty state IS the guidance browse — adaptive "For you" first, then the rest.
  const forYou = useForYou(profile.focuses);
  const forYouIds = new Set(forYou.map((h) => h.id));
  const rest = HUBS.filter((h) => !forYouIds.has(h.id));
  const openHub = (id: string) => {
    haptic.light();
    router.push({ pathname: '/hub/[id]', params: { id } });
  };
  const newChat = () => {
    haptic.light();
    setMessages([]);
    setInput('');
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.container}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText style={styles.title}>Ask</ThemedText>
              <ThemedText style={styles.subtitle}>
                Grounded in the Qur’an + classical tafsir
              </ThemedText>
            </View>
            {messages.length > 0 ? (
              <Pressable style={styles.newBtn} onPress={newChat} hitSlop={8}>
                <Ionicons name="add" size={16} color="#0a7ea4" />
                <ThemedText style={styles.newBtnText}>New</ThemedText>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.content}>
            <ScrollView
              ref={scrollRef}
              style={styles.fill}
              contentContainerStyle={styles.thread}
              keyboardShouldPersistTaps="handled">
              {messages.map((msg) => (
                <View key={msg.id} onLayout={(e) => onMsgLayout(msg.id, e.nativeEvent.layout.y)}>
                  <MessageView msg={msg} onOpenVerse={openVerse} onRevealComplete={revealComplete} />
                </View>
              ))}
            </ScrollView>

            {showBrowse ? (
              <Animated.View
                style={[
                  styles.browseOverlay,
                  {
                    opacity: emptyAnim,
                    transform: [
                      {
                        translateY: emptyAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-24, 0],
                        }),
                      },
                    ],
                  },
                ]}
                pointerEvents={hasMessages ? 'none' : 'auto'}>
                <ThemedView style={styles.fill}>
                  <ScrollView
                    contentContainerStyle={styles.thread}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled">
                    <View style={styles.browse}>
                      <ThemedText style={styles.browseIntro}>
                        However you’re feeling, there’s a place to begin.
                      </ThemedText>
                      <ThemedText style={styles.browseHint}>
                        Tap a topic, or ask anything below.
                      </ThemedText>

                      {forYou.length > 0 ? (
                        <View style={styles.section}>
                          <ThemedText style={styles.sectionLabel}>For you</ThemedText>
                          <View style={styles.grid}>
                            {forYou.map((h) => (
                              <HubCard key={h.id} hub={h} featured onPress={() => openHub(h.id)} />
                            ))}
                          </View>
                        </View>
                      ) : null}

                      <View style={styles.section}>
                        <ThemedText style={styles.sectionLabel}>
                          {forYou.length > 0 ? 'Explore' : 'Browse by feeling'}
                        </ThemedText>
                        <View style={styles.grid}>
                          {rest.map((h) => (
                            <HubCard key={h.id} hub={h} onPress={() => openHub(h.id)} />
                          ))}
                        </View>
                      </View>
                    </View>
                  </ScrollView>
                </ThemedView>
              </Animated.View>
            ) : null}
          </View>

          <View style={[styles.inputBar, liftForMini && styles.inputBarRaised]}>
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
  onRevealComplete,
}: {
  msg: Message;
  onOpenVerse: (surah: number, ayah: number) => void;
  onRevealComplete: (id: string, data: ChatResponse) => void;
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
  if (msg.status === 'loading') {
    return (
      <View style={styles.assistantRow}>
        <View style={styles.thinking}>
          <ActivityIndicator size="small" color="#0a7ea4" />
          <ThemedText style={styles.thinkingText}>Searching the Qur’an…</ThemedText>
        </View>
      </View>
    );
  }
  if (msg.status === 'streaming') {
    return (
      <View style={styles.assistantRow}>
        <StreamingText
          text={msg.text}
          final={msg.final}
          style={styles.answer}
          onComplete={
            msg.final && msg.pending ? () => onRevealComplete(msg.id, msg.pending!) : undefined
          }
        />
      </View>
    );
  }
  if (msg.status === 'error') {
    return (
      <View style={styles.assistantRow}>
        <ThemedText style={styles.errorText}>{msg.error}</ThemedText>
      </View>
    );
  }
  const data = msg.data;
  const [primary, ...others] = data.verses;
  return (
    <View style={styles.assistantRow}>
      <RichAnswer text={data.answer} />

      {/* One prominent verse card — fades + rises in once the answer settles. */}
      {primary ? (
        <FadeIn>
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
        </FadeIn>
      ) : null}

      {/* ...the rest as compact, tappable citation chips. */}
      {others.length > 0 ? (
        <FadeIn delay={70}>
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
        </FadeIn>
      ) : null}

      {/* Tafsir stays behind a tap — only offered when the answer used it. */}
      {data.tafsir.length > 0 ? (
        <FadeIn delay={120}>
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
        </FadeIn>
      ) : null}

      <FadeIn delay={160}>
        <ThemedText style={styles.disclaimer}>{data.disclaimer}</ThemedText>
      </FadeIn>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  headerText: { flex: 1, gap: 1 },
  title: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  subtitle: { fontSize: 12, opacity: 0.55 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(10,126,164,0.12)',
  },
  newBtnText: { fontSize: 13, fontWeight: '700', color: '#0a7ea4' },
  thread: { padding: 16, gap: 16, paddingBottom: 24 },
  content: { flex: 1 },
  fill: { flex: 1 },
  browseOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  browse: { paddingTop: 10, gap: 16 },
  browseIntro: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  browseHint: { fontSize: 13, opacity: 0.55, textAlign: 'center', marginTop: -8 },
  section: { gap: 10 },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, opacity: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  hubCard: {
    width: '48%',
    minHeight: 100,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(127,127,127,0.07)',
    gap: 5,
  },
  hubCardForYou: {
    backgroundColor: 'rgba(10,126,164,0.09)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(10,126,164,0.22)',
  },
  hubCardPressed: { opacity: 0.6 },
  hubEmoji: { fontSize: 24 },
  hubTitle: { fontSize: 15, fontWeight: '700', lineHeight: 19 },
  hubBlurb: { fontSize: 12, opacity: 0.55, lineHeight: 16 },

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
  inputBarRaised: { marginBottom: 60 }, // clear the floating mini-player
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
