// ASK — the full-screen conversation (Bible Chat frame 16). Pushed as a ROOT route so it has NO bottom tab
// bar — opened from the Ask tab's glass pill, a suggested question, a hub, Today/Reflect/Explain, or History.
// The active thread is PERSISTED (retained until New or delete); New archives it to History. All existing
// logic preserved: RAG streaming, image-in-chat, voice hand-off, markdown answers, verse/tafsir/video cards.
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Keyboard,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FadeIn } from '@/components/fade-in';
import { SpeakButton } from '@/components/speak-button';
import { StreamingText } from '@/components/streaming-text';
import { GlassSurface } from '@/components/ui/glass-surface';
import { Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { VerseSpeaker } from '@/components/verse-speaker';
import { streamChat, type ChatResponse, type TafsirSnippet, type VerseCard } from '@/lib/chat';
import { peekChatSeed, takeCategorySeed, takeChatSeed } from '@/lib/chat-seed';
import { archive, clearActive, loadActive, saveActive, takePendingRestore, type StoredMsg } from '@/lib/chat-history';
import { haptic } from '@/lib/haptics';
import { HUBS } from '@/lib/hubs';
import { parseMarkdownBlocks } from '@/lib/markdown';
import { choosePhoto, takePhoto, type PickResult } from '@/lib/photo';
import { useRecitation } from '@/lib/recitation-context';
import { streamSee } from '@/lib/see';
import { recordActivity } from '@/lib/streak';
import { c, font, radius, space } from '@/lib/theme';
import { getVerse } from '@/lib/today';
import { useTranslation, verseText } from '@/lib/translations';
import { takeVoiceExchanges } from '@/lib/voice-bridge';
import { fmtDuration, getChapter, ytThumb } from '@/lib/watch';
import { freshWelcome } from '@/lib/welcome';

type Message =
  | { id: string; role: 'user'; text: string; image?: string }
  | { id: string; role: 'assistant'; status: 'loading' }
  | { id: string; role: 'assistant'; status: 'streaming'; text: string; final: boolean; pending?: ChatResponse }
  | { id: string; role: 'assistant'; status: 'done'; data: ChatResponse }
  | { id: string; role: 'assistant'; status: 'error'; error: string };

let counter = 0;
const nextId = () => `m${++counter}`;

// Approximation of iOS's keyboard animation curve, so the composer glides in lockstep with the keyboard.
const KEYBOARD_EASING = Easing.bezier(0.17, 0.59, 0.4, 0.77);

function toStored(msgs: Message[]): StoredMsg[] {
  const out: StoredMsg[] = [];
  for (const m of msgs) {
    if (m.role === 'user') out.push({ role: 'user', text: m.text, image: m.image });
    else if (m.role === 'assistant' && m.status === 'done') out.push({ role: 'assistant', data: m.data });
  }
  return out;
}
function fromStored(stored: StoredMsg[]): Message[] {
  return stored.map((s) =>
    s.role === 'user'
      ? { id: nextId(), role: 'user', text: s.text, image: s.image }
      : { id: nextId(), role: 'assistant', status: 'done', data: s.data },
  );
}

export default function AskScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [photo, setPhoto] = useState<{ uri: string; dataUrl: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [booting, setBooting] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const stick = useRef(true);
  const recitation = useRecitation();
  const [kbUp, setKbUp] = useState(false);
  const hydrated = useRef(false);
  const kbPad = useRef(new Animated.Value(0)).current;
  const threadId = useRef('general'); // which chat this screen is bound to: general · cat:<hubId> · hist:<id>

  // Build a fresh chat curated to a category: a streaming opening (the hub's framing + a few hand-vetted
  // verses). Each category keeps its OWN persistent thread, so this only runs when that thread is empty.
  const startCategory = (hubId: string) => {
    const hub = HUBS.find((h) => h.id === hubId);
    if (!hub) return;
    const verses: VerseCard[] = hub.verses
      .map((v) => {
        const verse = getVerse(v.surah, v.ayah);
        return verse ? { surah: v.surah, ayah: v.ayah, arabic: verse.ar, translation: verseText(v.surah, v.ayah) } : null;
      })
      .filter((x): x is VerseCard => !!x)
      .slice(0, 4);
    const intro = hub.crisis
      ? `${hub.intro}\n\nIf you’re in crisis or thinking about harming yourself, please reach out now — call or text 988 (Suicide & Crisis Lifeline). You matter, and help is here.`
      : hub.intro;
    const opening: ChatResponse = { answer: intro, verses, tafsir: [], disclaimer: 'A gentle place to begin — ask me anything from here.' };
    setMessages([{ id: nextId(), role: 'assistant', status: 'streaming', text: intro, final: true, pending: opening }]);
  };

  // A general warm opener for a brand-new chat — a gentle greeting + one comforting verse that streams in,
  // so a fresh conversation feels alive (like a category chat), not a cold blank screen. Curated, not an LLM
  // call (grounded + $0 + safe).
  const startWelcome = () => {
    const w = freshWelcome();
    const verse = getVerse(w.surah, w.ayah);
    const verses: VerseCard[] = verse
      ? [{ surah: w.surah, ayah: w.ayah, arabic: verse.ar, translation: verseText(w.surah, w.ayah) }]
      : [];
    const intro = `${w.greeting}\n\nWhenever you’re ready, ask about a verse, a feeling, or anything on your heart — I’ll ground every answer in the Qur’an and classical tafsir. A gentle place to begin:`;
    const opening: ChatResponse = { answer: intro, verses, tafsir: [], disclaimer: 'A gentle place to begin — ask me anything from here.' };
    setMessages([{ id: nextId(), role: 'assistant', status: 'streaming', text: intro, final: true, pending: opening }]);
  };

  // On mount, bind this screen to the right chat THREAD and load it:
  //  • reopened from History → its own hist:<id> thread;
  //  • a category → that category's own persistent cat:<hubId> thread (stream the opener only if it's empty);
  //  • a queued question scoped to a category → that category's thread; otherwise the general thread;
  //  • a fresh general chat with no queued question → a warm streaming welcome.
  // Threads never merge — each category and the general chat persist side by side.
  useEffect(() => {
    let active = true;
    const restore = takePendingRestore();
    if (restore) {
      threadId.current = `hist:${restore.id}`;
      setMessages(fromStored(restore.msgs));
      hydrated.current = true;
      setBooting(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 150);
      return;
    }
    const category = takeCategorySeed();
    const seed = peekChatSeed();
    const tid = category ? `cat:${category}` : seed?.hubId ? `cat:${seed.hubId}` : 'general';
    threadId.current = tid;
    loadActive(tid).then((stored) => {
      if (!active) return;
      if (stored.length > 0) setMessages(fromStored(stored));
      else if (category) startCategory(category);
      else if (!seed) startWelcome();
      hydrated.current = true;
      setBooting(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // Persist settled turns to THIS thread (debounced).
  useEffect(() => {
    if (!hydrated.current) return;
    const t = setTimeout(() => saveActive(threadId.current, toStored(messages)), 400);
    return () => clearTimeout(t);
  }, [messages]);

  // Smoothly avoid the keyboard with an Animated padding matched to the keyboard's own duration + curve.
  // (Driven manually rather than via KeyboardAvoidingView, whose LayoutAnimation is dead on the New
  // Architecture — that made the composer jump instead of glide.)
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => {
      setKbUp(true);
      Animated.timing(kbPad, { toValue: e.endCoordinates?.height ?? 0, duration: e.duration || 250, easing: KEYBOARD_EASING, useNativeDriver: false }).start();
    });
    const hide = Keyboard.addListener('keyboardWillHide', (e) => {
      setKbUp(false);
      Animated.timing(kbPad, { toValue: 0, duration: e.duration || 250, easing: KEYBOARD_EASING, useNativeDriver: false }).start();
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [kbPad]);
  const liftForMini = !!recitation.playing && !kbUp;
  const hasMessages = messages.length > 0;
  // The chat fills to the very top edge; content scrolls up into the status bar, faded by the dark veil
  // (faintest behind the clock, clear just below it) with frosted-glass controls floating over it.
  const fadeH = insets.top + 56;

  const openVerse = (surah: number, ayah: number) =>
    router.push({ pathname: '/surah/[number]', params: { number: String(surah), ayah: String(ayah) } });

  const revealComplete = (id: string, data: ChatResponse) =>
    setMessages((m) => m.map((msg) => (msg.id === id ? { id, role: 'assistant', status: 'done', data } : msg)));

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || sending) return;
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
      setMessages((m) => [...m, { id: userId, role: 'user', text: q }, { id: loadingId, role: 'assistant', status: 'loading' }]);
      stick.current = true;
      setSending(true);
      try {
        const data = await streamChat(q, history, (full) => {
          setMessages((m) => m.map((msg) => (msg.id === loadingId ? { id: loadingId, role: 'assistant', status: 'streaming', text: full, final: false } : msg)));
        });
        recordActivity('asked');
        setMessages((m) => m.map((msg) => (msg.id === loadingId ? { id: loadingId, role: 'assistant', status: 'streaming', text: data.answer, final: true, pending: data } : msg)));
      } catch (e) {
        setMessages((m) => m.map((msg) => (msg.id === loadingId ? { id: loadingId, role: 'assistant', status: 'error', error: String((e as Error)?.message ?? e) } : msg)));
      } finally {
        setSending(false);
      }
    },
    [sending, messages],
  );

  const sendImage = useCallback(
    async (p: { uri: string; dataUrl: string }, text: string) => {
      if (sending) return;
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
      const q = text.trim();
      setInput('');
      setPhoto(null);
      const userId = nextId();
      const loadingId = nextId();
      setMessages((m) => [...m, { id: userId, role: 'user', text: q, image: p.uri }, { id: loadingId, role: 'assistant', status: 'loading' }]);
      stick.current = true;
      setSending(true);
      try {
        const data = await streamSee(p.dataUrl, q, history, (full) => {
          setMessages((m) => m.map((msg) => (msg.id === loadingId ? { id: loadingId, role: 'assistant', status: 'streaming', text: full, final: false } : msg)));
        });
        recordActivity('asked');
        setMessages((m) => m.map((msg) => (msg.id === loadingId ? { id: loadingId, role: 'assistant', status: 'streaming', text: data.answer, final: true, pending: data } : msg)));
      } catch (e) {
        setMessages((m) => m.map((msg) => (msg.id === loadingId ? { id: loadingId, role: 'assistant', status: 'error', error: String((e as Error)?.message ?? e) } : msg)));
      } finally {
        setSending(false);
      }
    },
    [sending, messages],
  );

  const runPick = useCallback(async (fn: () => Promise<PickResult>) => {
    setPicking(true);
    try {
      const r = await fn();
      if (r === 'denied') {
        Alert.alert('Photo access needed', 'Allow photo or camera access to share an image here.');
      } else if (r !== 'canceled') {
        haptic.light();
        setPhoto(r);
      }
    } finally {
      setPicking(false);
    }
  }, []);

  const onAddPhoto = useCallback(() => {
    if (sending || picking) return;
    haptic.light();
    Keyboard.dismiss();
    Alert.alert('Add a photo', 'Reflect on a scene, or check a claim against the Qur’an. Your photo is sent to AI to read it and is not saved.', [
      { text: 'Take photo', onPress: () => void runPick(takePhoto) },
      { text: 'Choose from library', onPress: () => void runPick(choosePhoto) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [sending, picking, runPick]);

  // Returning from the voice screen → fold its exchanges into the current thread.
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
      stick.current = true;
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 150);
    }, []),
  );

  // A seeded question (from a topic / hub / Today / Reflect) sends itself once this thread has loaded — so it
  // lands AFTER any restored category history rather than racing the load.
  useEffect(() => {
    if (booting) return;
    const seed = takeChatSeed();
    if (seed) void send(seed.question);
  }, [booting, send]);

  const newChat = () => {
    haptic.light();
    void archive(toStored(messages)); // keep the old conversation in History
    clearActive(threadId.current);
    setInput('');
    setPhoto(null);
    stick.current = true;
    // A fresh chat in the SAME place: re-stream the category opener for a category thread, else a welcome.
    if (threadId.current.startsWith('cat:')) startCategory(threadId.current.slice(4));
    else {
      threadId.current = 'general';
      startWelcome();
    }
  };

  const deleteChat = () => {
    Alert.alert('Delete this chat?', 'It won’t be saved to your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          haptic.light();
          clearActive(threadId.current);
          router.back();
        },
      },
    ]);
  };

  const regenerate = (assistantId: string) => {
    const idx = messages.findIndex((m) => m.id === assistantId);
    if (idx < 0) return;
    for (let i = idx - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'user') {
        void send(m.text);
        return;
      }
    }
  };

  return (
    <Screen edges={[]}>
      <Animated.View style={[styles.fill, { paddingBottom: kbPad }]}>
        <View style={styles.content}>
          <ScrollView
            ref={scrollRef}
            style={styles.fill}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            contentContainerStyle={[styles.thread, { paddingTop: fadeH + 4 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            scrollEventThrottle={16}
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              const fromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
              stick.current = fromBottom < 90;
            }}
            onContentSizeChange={() => {
              if (stick.current) scrollRef.current?.scrollToEnd({ animated: false });
            }}>
            {messages.map((msg) => (
              <View key={msg.id}>
                <MessageView msg={msg} onOpenVerse={openVerse} onRevealComplete={revealComplete} onRegenerate={regenerate} />
              </View>
            ))}
          </ScrollView>

          {!hasMessages && !booting ? (
            <View style={styles.emptyHint} pointerEvents="none">
              <Ionicons name="sparkles-outline" size={30} color={c.accent} />
              <Txt variant="h2" style={styles.emptyTitle}>
                Ask anything
              </Txt>
              <Txt variant="body" color={c.textMuted} style={styles.emptyText}>
                Grounded in the Qur’an and classical tafsir.
              </Txt>
            </View>
          ) : null}
          {/* top fade — content melts as it scrolls up into the status bar (faintest behind the clock) */}
          <LinearGradient
            colors={['rgba(10,10,10,0.85)', 'rgba(10,10,10,0.45)', 'rgba(10,10,10,0)']}
            locations={[0, insets.top / fadeH, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[styles.topFade, { height: fadeH }]}
            pointerEvents="none"
          />

          {/* Floating frosted-glass controls (Bible Chat frame 16) — discs over the content, no top bar */}
          <View style={[styles.floatLeft, { top: insets.top + 6 }]}>
            <FloatBtn name="chevron-back" onPress={() => router.back()} size={22} color={c.textPrimary} />
          </View>
          {hasMessages ? (
            <View style={[styles.floatRight, { top: insets.top + 6 }]}>
              <FloatBtn name="trash-outline" onPress={deleteChat} size={18} color={c.textSecondary} />
              <FloatBtn name="add" onPress={newChat} size={22} color={c.accent} />
            </View>
          ) : null}
        </View>

        <View style={[styles.composerWrap, liftForMini && styles.composerRaised]}>
          {photo ? (
            <View style={styles.photoPreview}>
              <Image source={{ uri: photo.uri }} style={styles.photoThumb} contentFit="cover" />
              <View style={styles.photoMeta}>
                <Txt variant="caption" color={c.textPrimary} style={styles.photoMetaText}>
                  Photo ready
                </Txt>
                <Txt variant="caption" color={c.textMuted}>
                  Sent to AI to read it · not saved
                </Txt>
              </View>
              <Pressable onPress={() => setPhoto(null)} hitSlop={10} style={styles.photoRemove} accessibilityLabel="Remove photo">
                <Ionicons name="close-circle" size={24} color={c.textMuted} />
              </Pressable>
            </View>
          ) : null}

          <GlassSurface interactive={false} radius={radius.xl}>
            <View style={styles.pillRow}>
              <Ionicons name="sparkles" size={17} color={c.accent} style={styles.pillSpark} />
              <TextInput
                ref={inputRef}
                value={input}
                onChangeText={setInput}
                placeholder={photo ? 'Add a question (optional)…' : 'Ask about the Qur’an…'}
                placeholderTextColor={c.textMuted}
                style={styles.input}
                multiline
                autoFocus={!hasMessages}
                editable={!sending}
              />
              <Pressable style={styles.pillBtn} onPress={() => router.push('/voice')} accessibilityLabel="Voice conversation">
                <Ionicons name="mic" size={20} color={c.textSecondary} />
              </Pressable>
              <Pressable style={styles.pillBtn} onPress={onAddPhoto} disabled={sending || picking} accessibilityLabel="Add a photo">
                <Ionicons name={picking ? 'hourglass-outline' : 'camera'} size={20} color={c.textSecondary} />
              </Pressable>
              <PressableScale
                style={[styles.sendBtn, (sending || (!input.trim() && !photo)) && styles.sendBtnDisabled]}
                onPress={() => (photo ? void sendImage(photo, input) : void send(input))}
                disabled={sending || (!input.trim() && !photo)}>
                <Ionicons name="arrow-up" size={20} color={c.bg} />
              </PressableScale>
            </View>
          </GlassSurface>
        </View>
      </Animated.View>
    </Screen>
  );
}

// A floating circular control (back / delete / new) — Bible Chat frame 16: a frosted-glass disc (a native
// iOS blur clipped to the circle) with a faint light rim, floating over the conversation.
function FloatBtn({ name, onPress, color, size = 20 }: { name: keyof typeof Ionicons.glyphMap; onPress: () => void; color: string; size?: number }) {
  return (
    <PressableScale onPress={onPress} style={styles.floatBtn}>
      <BlurView intensity={32} tint="systemThinMaterialDark" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Ionicons name={name} size={size} color={color} />
    </PressableScale>
  );
}

function TypingDots() {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(d, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((2 - i) * 180),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);
  return (
    <View style={styles.dotsRow}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }), transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] }]} />
      ))}
    </View>
  );
}

function Toolbar({ answer, onRegenerate }: { answer: string; onRegenerate: () => void }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    haptic.light();
    void Clipboard.setStringAsync(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <View style={styles.toolbar}>
      <Pressable onPress={onCopy} style={styles.toolBtn} accessibilityLabel="Copy">
        <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={17} color={copied ? c.success : c.textSecondary} />
      </Pressable>
      <Pressable onPress={() => { haptic.light(); void Share.share({ message: answer }); }} style={styles.toolBtn} accessibilityLabel="Share">
        <Ionicons name="share-outline" size={17} color={c.textSecondary} />
      </Pressable>
      <SpeakButton text={answer} compact />
      <Pressable onPress={() => { haptic.light(); onRegenerate(); }} style={styles.toolBtn} accessibilityLabel="Regenerate">
        <Ionicons name="refresh" size={17} color={c.textSecondary} />
      </Pressable>
    </View>
  );
}

function MessageView({
  msg,
  onOpenVerse,
  onRevealComplete,
  onRegenerate,
}: {
  msg: Message;
  onOpenVerse: (surah: number, ayah: number) => void;
  onRevealComplete: (id: string, data: ChatResponse) => void;
  onRegenerate: (id: string) => void;
}) {
  const [showTafsir, setShowTafsir] = useState(false);
  useTranslation();
  if (msg.role === 'user') {
    return (
      <View style={styles.userRow}>
        {msg.image ? <Image source={{ uri: msg.image }} style={styles.userImage} contentFit="cover" /> : null}
        {msg.text ? (
          <View style={styles.userBubble}>
            <Txt style={styles.userText}>{msg.text}</Txt>
          </View>
        ) : null}
      </View>
    );
  }
  if (msg.status === 'loading') {
    return (
      <View style={styles.assistantRow}>
        <TypingDots />
      </View>
    );
  }
  if (msg.status === 'streaming') {
    return (
      <View style={styles.assistantRow}>
        <StreamingText text={msg.text} final={msg.final} style={styles.answer} onComplete={msg.final && msg.pending ? () => onRevealComplete(msg.id, msg.pending!) : undefined} />
      </View>
    );
  }
  if (msg.status === 'error') {
    return (
      <View style={styles.assistantRow}>
        <Txt style={styles.errorText}>{msg.error}</Txt>
      </View>
    );
  }
  const data = msg.data;
  const [primary, ...others] = data.verses;
  return (
    <View style={styles.assistantRow}>
      <RichAnswer text={data.answer} />
      <Toolbar answer={data.answer} onRegenerate={() => onRegenerate(msg.id)} />

      {primary ? (
        <FadeIn>
          <Pressable style={styles.verseCard} onPress={() => onOpenVerse(primary.surah, primary.ayah)}>
            <View style={styles.verseHead}>
              <Txt variant="caption" color={c.accent} style={styles.verseRef}>
                {primary.surah}:{primary.ayah}
              </Txt>
              <View style={styles.verseHeadRight}>
                <VerseSpeaker surah={primary.surah} ayah={primary.ayah} />
                <Txt variant="caption" color={c.accent} style={styles.openLink}>
                  Open →
                </Txt>
              </View>
            </View>
            <Txt style={styles.verseArabic}>{primary.arabic}</Txt>
            <Txt style={styles.verseTrans}>{verseText(primary.surah, primary.ayah)}</Txt>
          </Pressable>
        </FadeIn>
      ) : null}

      {others.length > 0 ? (
        <FadeIn delay={70}>
          <View style={styles.chipRow}>
            <Txt variant="caption" style={styles.chipLabel}>
              Also
            </Txt>
            {others.slice(0, 6).map((v) => (
              <Pressable key={`${v.surah}:${v.ayah}`} style={styles.refChip} onPress={() => onOpenVerse(v.surah, v.ayah)}>
                <Txt variant="caption" color={c.accent} style={styles.refChipText}>
                  {v.surah}:{v.ayah}
                </Txt>
              </Pressable>
            ))}
          </View>
        </FadeIn>
      ) : null}

      {data.video ? <ChatVideoCard id={data.video.id} /> : null}

      {data.tafsir.length > 0 ? (
        <FadeIn delay={120}>
          <View>
            <Pressable style={styles.tafsirBtn} onPress={() => setShowTafsir((s) => !s)}>
              <Txt variant="caption" color={c.accent} style={styles.tafsirBtnText}>
                {showTafsir ? 'Hide commentary' : 'Show Ibn Kathir’s commentary'}
              </Txt>
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
        <Txt variant="caption" color={c.textMuted} style={styles.disclaimer}>
          {data.disclaimer}
        </Txt>
      </FadeIn>
    </View>
  );
}

function ChatVideoCard({ id }: { id: string }) {
  const router = useRouter();
  const ch = getChapter(id);
  if (!ch) return null;
  return (
    <FadeIn delay={105}>
      <Pressable
        style={styles.videoCard}
        onPress={() => {
          haptic.light();
          router.push({ pathname: '/watch/[id]', params: { id } });
        }}>
        <View style={styles.videoThumb}>
          <Image source={{ uri: ytThumb(ch.videos[0].youtubeId) }} style={styles.videoThumbImg} contentFit="cover" transition={200} />
          <View style={styles.videoPlay}>
            <Ionicons name="play" size={13} color="#fff" />
          </View>
        </View>
        <View style={styles.videoBody}>
          <Txt variant="eyebrow">Watch</Txt>
          <Txt variant="cardTitle" numberOfLines={2} style={styles.videoTitle}>
            {ch.title}
          </Txt>
          <Txt variant="caption">
            {ch.track === 'seerah' ? 'Seerah' : 'History'} · {fmtDuration(ch.videos[0].durationSec)}
          </Txt>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </Pressable>
    </FadeIn>
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

function RichAnswer({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdownBlocks(text), [text]);
  return (
    <View style={styles.answerBlock}>
      {blocks.map((blk, i) => {
        if (blk.type === 'heading')
          return (
            <Txt key={i} style={styles.mdHeading}>
              {renderInline(blk.text, `h${i}`)}
            </Txt>
          );
        if (blk.type === 'rule') return <View key={i} style={styles.mdRule} />;
        if (blk.type === 'table') return <MarkdownTable key={i} rows={blk.rows} />;
        if (blk.type === 'bullet')
          return (
            <View key={i} style={styles.bulletRow}>
              <Txt style={[styles.answer, styles.bulletMarker]}>{blk.marker} </Txt>
              <Txt style={[styles.answer, styles.bulletText]}>{renderInline(blk.text, `b${i}`)}</Txt>
            </View>
          );
        return (
          <Txt key={i} style={styles.answer}>
            {renderInline(blk.text, `p${i}`)}
          </Txt>
        );
      })}
    </View>
  );
}

function MarkdownTable({ rows }: { rows: string[][] }) {
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 1);
  return (
    <View style={styles.table}>
      {rows.map((row, r) => (
        <View key={r} style={[styles.tableRow, r === 0 && styles.tableHeadRow]}>
          {Array.from({ length: cols }).map((_, col) => (
            <View key={col} style={[styles.tableCell, col > 0 && styles.tableCellDivide]}>
              <Txt style={[styles.tableCellText, r === 0 && styles.tableHeadText]}>{renderInline(row[col] ?? '', `t${r}-${col}`)}</Txt>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function TafsirItem({ t }: { t: TafsirSnippet }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Pressable onPress={() => setExpanded((e) => !e)} style={styles.tafsirItem}>
      <Txt style={styles.tafsirText} numberOfLines={expanded ? undefined : 4}>
        <Txt style={styles.tafsirRef}>
          {t.surah}:{t.ayah} —{' '}
        </Txt>
        {t.snippet}
      </Txt>
      <Txt variant="caption" color={c.accent} style={styles.tafsirToggle}>
        {expanded ? 'Show less ▲' : 'Show more ▼'}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flex: 1 },
  floatLeft: { position: 'absolute', left: space.gutter, zIndex: 10 },
  floatRight: { position: 'absolute', right: space.gutter, zIndex: 10, flexDirection: 'row', gap: 8 },
  floatBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(18,18,18,0.35)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },

  thread: { paddingHorizontal: space.gutter, paddingBottom: 28, gap: 18 },
  emptyHint: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: space.section },
  emptyTitle: { textAlign: 'center' },
  emptyText: { textAlign: 'center' },

  topFade: { position: 'absolute', top: 0, left: 0, right: 0 },

  userRow: { alignItems: 'flex-end' },
  userBubble: {
    maxWidth: '88%',
    backgroundColor: c.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  userText: { fontFamily: font.sans, fontSize: 15, lineHeight: 21, color: c.textPrimary },

  assistantRow: { gap: 12 },
  dotsRow: { flexDirection: 'row', gap: 6, paddingVertical: 10, paddingLeft: 2 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: c.accent },
  errorText: { fontFamily: font.sans, fontSize: 14, color: c.danger },

  answer: { fontFamily: font.serifReg, fontSize: 16, lineHeight: 25, color: c.scriptureInk },
  answerBlock: { gap: 8 },
  bold: { fontFamily: font.serif },
  italic: { fontFamily: font.serifItalic },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start' },
  bulletMarker: { opacity: 0.7 },
  bulletText: { flex: 1 },
  mdHeading: { fontFamily: font.serif, fontSize: 17, lineHeight: 24, color: c.textPrimary, marginTop: 2 },
  mdRule: { height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginVertical: 2 },
  table: { borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, borderRadius: radius.badge, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.hairlineSoft },
  tableHeadRow: { borderTopWidth: 0, backgroundColor: c.surface2 },
  tableCell: { flex: 1, paddingVertical: 8, paddingHorizontal: 10 },
  tableCellDivide: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.hairlineSoft },
  tableCellText: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 19, color: c.textSecondary },
  tableHeadText: { fontFamily: font.sansSemi, color: c.textPrimary },

  toolbar: { flexDirection: 'row', gap: 8, marginTop: -2 },
  toolBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },

  verseCard: { gap: 10, padding: 14, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, backgroundColor: c.surface1 },
  verseHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  verseHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  verseRef: { fontFamily: font.sansBold },
  openLink: { fontFamily: font.sansSemi },
  verseArabic: { fontFamily: font.arabic, fontSize: 23, lineHeight: 48, textAlign: 'right', writingDirection: 'rtl', color: c.scriptureInk },
  verseTrans: { fontFamily: font.serifReg, fontSize: 14.5, lineHeight: 22, color: c.scriptureInk },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chipLabel: { marginRight: 2 },
  refChip: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.badge, backgroundColor: 'rgba(201,189,166,0.12)' },
  refChipText: { fontFamily: font.sansSemi },

  tafsirBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.sm, backgroundColor: 'rgba(201,189,166,0.12)' },
  tafsirBtnText: { fontFamily: font.sansSemi },
  tafsirWrap: { gap: 6, padding: 12, borderRadius: radius.sm, backgroundColor: c.surface1, borderLeftWidth: 3, borderLeftColor: c.accent, marginTop: 8 },
  tafsirText: { fontFamily: font.sans, fontSize: 13, lineHeight: 19, color: c.textSecondary },
  tafsirItem: { gap: 2, paddingVertical: 2 },
  tafsirToggle: { fontFamily: font.sansSemi },
  tafsirRef: { fontFamily: font.sansBold, color: c.textSecondary },
  disclaimer: { lineHeight: 16, fontStyle: 'italic' },

  videoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.md, backgroundColor: c.surface1, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
  videoThumb: { width: 92, height: 52, borderRadius: 8, overflow: 'hidden', backgroundColor: c.surface3 },
  videoThumbImg: { width: '100%', height: '100%' },
  videoPlay: { position: 'absolute', top: 16, left: 35, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  videoBody: { flex: 1, gap: 2 },
  videoTitle: { lineHeight: 19 },

  composerWrap: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10 },
  composerRaised: { marginBottom: 60 },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 14, paddingRight: 6, minHeight: 52 },
  pillSpark: { marginRight: 2 },
  input: { flex: 1, maxHeight: 120, minHeight: 44, paddingVertical: 11, fontFamily: font.sans, fontSize: 16, color: c.textPrimary },
  pillBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },

  userImage: { width: 220, height: 165, borderRadius: radius.md, marginBottom: 6, backgroundColor: c.surface2 },
  photoPreview: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, padding: 8, borderRadius: radius.md, backgroundColor: c.surface1, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
  photoThumb: { width: 46, height: 46, borderRadius: 8, backgroundColor: c.surface3 },
  photoMeta: { flex: 1, gap: 1 },
  photoMetaText: { fontFamily: font.sansSemi },
  photoRemove: { padding: 4 },
});
