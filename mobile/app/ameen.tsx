import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VerseSpeaker } from '@/components/verse-speaker';
import {
  communityReady,
  currentUserId,
  deleteMyIntention,
  fetchFeed,
  getAgeOk,
  getDisplayName,
  myIntentionsSummary,
  type FeedItem,
  type Intention,
  postIntention,
  reportIntention,
  setAgeOk,
  setDisplayName,
  type SuggestedVerse,
  suggestVerses,
  toggleAmeen,
  verseForRef,
} from '@/lib/community';
import { haptic } from '@/lib/haptics';

const ACCENT = '#0a7ea4';
const MAX = 140;

const TEMPLATES = [
  'Please pray for my family.',
  'Please pray for the ummah everywhere.',
  'Please pray for someone going through hardship.',
  'Please pray that I find guidance and direction.',
  'Please pray for healing for someone who is unwell.',
  'Please pray for steadfastness in my prayers.',
];

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

type AgeState = 'checking' | 'gate' | 'ok' | 'blocked';

export default function AmeenWall() {
  const [age, setAge] = useState<AgeState>('checking');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [summary, setSummary] = useState<{ posts: number; ameens: number }>({ posts: 0, ameens: 0 });

  useEffect(() => {
    getAgeOk().then((v) => setAge(v === true ? 'ok' : v === false ? 'blocked' : 'gate'));
  }, []);

  const load = useCallback(async () => {
    const [items, myId, sum] = await Promise.all([fetchFeed(), currentUserId(), myIntentionsSummary()]);
    setFeed(items);
    setUid(myId);
    setSummary(sum);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (age === 'ok') void load();
  }, [age, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onAmeen = async (item: FeedItem) => {
    haptic.light();
    const on = !item.ameenedByMe;
    setFeed((f) =>
      f.map((x) => (x.id === item.id ? { ...x, ameenedByMe: on, ameen_count: Math.max(0, x.ameen_count + (on ? 1 : -1)) } : x)),
    );
    const okk = await toggleAmeen(item.id, on);
    if (!okk) {
      setFeed((f) =>
        f.map((x) => (x.id === item.id ? { ...x, ameenedByMe: !on, ameen_count: Math.max(0, x.ameen_count + (on ? -1 : 1)) } : x)),
      );
    }
  };

  const onReport = (item: FeedItem) => {
    Alert.alert('Report this intention?', 'It will be reviewed, and hidden automatically if others report it too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: async () => {
          await reportIntention(item.id);
          setFeed((f) => f.filter((x) => x.id !== item.id));
        },
      },
    ]);
  };

  const onDelete = (item: FeedItem) => {
    Alert.alert('Delete your intention?', 'This removes it for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await deleteMyIntention(item.id)) {
            setFeed((f) => f.filter((x) => x.id !== item.id));
            setSummary((s) => ({
              posts: Math.max(0, s.posts - 1),
              ameens: Math.max(0, s.ameens - item.ameen_count),
            }));
          }
        },
      },
    ]);
  };

  if (age === 'checking') {
    return (
      <Centered>
        <ActivityIndicator color={ACCENT} />
      </Centered>
    );
  }
  if (age === 'gate') {
    return (
      <AgeGate
        onAnswer={(ok) => {
          haptic.light();
          void setAgeOk(ok);
          setAge(ok ? 'ok' : 'blocked');
        }}
      />
    );
  }
  if (age === 'blocked') return <Blocked />;
  if (!communityReady) {
    return (
      <Centered>
        <Stack.Screen options={{ title: 'Ameen wall', headerBackTitle: 'Home' }} />
        <ThemedText style={styles.muted}>The community isn’t set up yet.</ThemedText>
      </Centered>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Ameen wall', headerBackTitle: 'Home' }} />
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <FlatList
          data={feed}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
          ListHeaderComponent={
            <View style={styles.head}>
              {summary.ameens > 0 ? (
                <View style={styles.payoffBanner}>
                  <ThemedText style={styles.payoffEmoji}>🤲</ThemedText>
                  <View style={styles.payoffTextWrap}>
                    <ThemedText style={styles.payoffHead}>
                      {summary.ameens} {summary.ameens === 1 ? 'prayer' : 'prayers'} for your{' '}
                      {summary.posts === 1 ? 'intention' : 'intentions'}
                    </ThemedText>
                    <ThemedText style={styles.payoffSub}>Others are praying with you.</ThemedText>
                  </View>
                </View>
              ) : null}
              <ThemedText style={styles.intro}>
                Share an intention or du’a, and add your ameen to others’. A space for prayer — please
                keep it kind.
              </ThemedText>
              <Pressable
                style={styles.postBtn}
                onPress={() => {
                  haptic.light();
                  setComposeOpen(true);
                }}>
                <Ionicons name="add" size={18} color="#fff" />
                <ThemedText style={styles.postBtnText}>Post an intention</ThemedText>
              </Pressable>
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
            ) : (
              <ThemedText style={styles.empty}>Be the first to share an intention.</ThemedText>
            )
          }
          renderItem={({ item }) => {
            const mine = item.user_id === uid;
            return (
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <ThemedText style={styles.author} numberOfLines={1}>
                    {item.author_name || 'Anonymous'}
                  </ThemedText>
                  <ThemedText style={styles.time}>{timeAgo(item.created_at)}</ThemedText>
                </View>
                <ThemedText style={styles.body}>{item.body}</ThemedText>
                {item.verse_refs && item.verse_refs[0] ? <AttachedVerse refStr={item.verse_refs[0]} /> : null}
                <View style={styles.cardActions}>
                  {mine ? (
                    <View style={styles.minePayoff}>
                      <ThemedText
                        style={[styles.minePayoffText, item.ameen_count === 0 && styles.minePayoffMuted]}>
                        {item.ameen_count === 0
                          ? '🤲 No ameens yet'
                          : `🤲 ${item.ameen_count} ${item.ameen_count === 1 ? 'person' : 'people'} prayed for this`}
                      </ThemedText>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.ameen, item.ameenedByMe && styles.ameenOn]}
                      onPress={() => onAmeen(item)}>
                      <ThemedText style={[styles.ameenText, item.ameenedByMe && styles.ameenTextOn]}>
                        🤲 Ameen{item.ameen_count > 0 ? ` · ${item.ameen_count}` : ''}
                      </ThemedText>
                    </Pressable>
                  )}
                  <Pressable hitSlop={10} style={styles.overflow} onPress={() => (mine ? onDelete(item) : onReport(item))}>
                    <Ionicons
                      name={mine ? 'trash-outline' : 'flag-outline'}
                      size={16}
                      color="rgba(127,127,127,0.7)"
                    />
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      </SafeAreaView>

      <ComposeModal
        visible={composeOpen}
        onClose={() => setComposeOpen(false)}
        onPosted={(it) => {
          setFeed((f) => [{ ...it, ameenedByMe: false }, ...f]);
          setComposeOpen(false);
        }}
      />
    </ThemedView>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <ThemedView style={[styles.container, styles.center]}>
      <SafeAreaView edges={['bottom']} style={[styles.container, styles.center]}>
        {children}
      </SafeAreaView>
    </ThemedView>
  );
}

function AgeGate({ onAnswer }: { onAnswer: (ok: boolean) => void }) {
  return (
    <ThemedView style={[styles.container, styles.center]}>
      <Stack.Screen options={{ title: 'Ameen wall', headerBackTitle: 'Home' }} />
      <ThemedText style={styles.gateEmoji}>🤲</ThemedText>
      <ThemedText style={styles.gateTitle}>A space for prayer</ThemedText>
      <ThemedText style={styles.gateText}>
        The Ameen wall is a shared space where people post intentions and pray for one another. To use
        it, you need to be 13 or older.
      </ThemedText>
      <Pressable style={styles.gatePrimary} onPress={() => onAnswer(true)}>
        <ThemedText style={styles.gatePrimaryText}>I’m 13 or older</ThemedText>
      </Pressable>
      <Pressable style={styles.gateGhost} onPress={() => onAnswer(false)}>
        <ThemedText style={styles.gateGhostText}>I’m under 13</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function Blocked() {
  return (
    <ThemedView style={[styles.container, styles.center]}>
      <Stack.Screen options={{ title: 'Ameen wall', headerBackTitle: 'Home' }} />
      <ThemedText style={styles.gateEmoji}>🌱</ThemedText>
      <ThemedText style={styles.gateTitle}>For ages 13 and up</ThemedText>
      <ThemedText style={styles.gateText}>
        The community is for ages 13 and older. The rest of Daily Qur’an is all yours — keep reading,
        listening, and reflecting.
      </ThemedText>
    </ThemedView>
  );
}

function AttachedVerse({ refStr }: { refStr: string }) {
  const v = verseForRef(refStr);
  if (!v) return null;
  return (
    <View style={styles.attached}>
      <ThemedText style={styles.attachedAr}>{v.ar}</ThemedText>
      <ThemedText style={styles.attachedEn}>{v.en}</ThemedText>
      <View style={styles.attachedFoot}>
        <ThemedText style={styles.attachedRef}>
          {v.name} · {v.ref}
        </ThemedText>
        <VerseSpeaker surah={v.surah} ayah={v.ayah} size={18} />
      </View>
    </View>
  );
}

function ComposeModal({
  visible,
  onClose,
  onPosted,
}: {
  visible: boolean;
  onClose: () => void;
  onPosted: (it: Intention) => void;
}) {
  const [body, setBody] = useState('');
  const [name, setName] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [crisis, setCrisis] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<{ label: string; verses: SuggestedVerse[] } | null>(null);
  const [attached, setAttached] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setError(null);
      setCrisis(null);
      setSuggestion(null);
      setAttached(null);
      getDisplayName().then(setName);
    }
  }, [visible]);

  const findVerse = async () => {
    const text = body.trim();
    if (!text || suggesting) return;
    haptic.light();
    setSuggesting(true);
    const s = await suggestVerses(text);
    setSuggesting(false);
    setSuggestion(s);
  };

  const submit = async () => {
    const text = body.trim();
    if (!text || posting) return;
    Keyboard.dismiss();
    setPosting(true);
    setError(null);
    setCrisis(null);
    const cleanName = name.trim();
    if (cleanName) await setDisplayName(cleanName);
    const r = await postIntention({
      body: text,
      authorName: cleanName || 'Anonymous',
      verseRefs: attached ? [attached] : [],
    });
    setPosting(false);
    if (r.ok) {
      haptic.success();
      setBody('');
      onPosted(r.intention);
    } else if (r.kind === 'crisis') {
      setCrisis(r.message);
    } else {
      setError(r.message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.scrim}>
        <Pressable style={styles.scrimFill} onPress={onClose} />
        <ThemedView style={styles.sheet}>
          <View style={styles.sheetHead}>
            <ThemedText style={styles.sheetTitle}>Share an intention</ThemedText>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={ACCENT} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.sheetBody}
            contentContainerStyle={styles.sheetScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.chips}>
            {TEMPLATES.map((t) => (
              <Pressable
                key={t}
                style={styles.chip}
                onPress={() => {
                  haptic.light();
                  setBody(t);
                }}>
                <ThemedText style={styles.chipText} numberOfLines={1}>
                  {t.replace(/^Please pray /, '').replace(/\.$/, '')}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={body}
            onChangeText={(t) => setBody(t.slice(0, MAX))}
            placeholder="Write a short intention or du’a…"
            placeholderTextColor="rgba(127,127,127,0.7)"
            style={styles.input}
            multiline
            maxLength={MAX}
            editable={!posting}
          />
          <ThemedText style={styles.counter}>
            {body.length}/{MAX}
          </ThemedText>

          <TextInput
            value={name}
            onChangeText={(t) => setName(t.slice(0, 24))}
            placeholder="Your name (optional — defaults to Anonymous)"
            placeholderTextColor="rgba(127,127,127,0.7)"
            style={styles.nameInput}
            editable={!posting}
          />

          <Pressable
            style={[styles.findVerse, (!body.trim() || suggesting) && styles.findVerseOff]}
            onPress={findVerse}
            disabled={!body.trim() || suggesting}>
            <Ionicons name="sparkles-outline" size={15} color={ACCENT} />
            <ThemedText style={styles.findVerseText}>
              {suggesting ? 'Finding a verse…' : suggestion ? 'Find another verse' : 'Add a comforting verse'}
            </ThemedText>
          </Pressable>

          {suggestion && suggestion.verses.length ? (
            <View style={styles.suggestWrap}>
              <ThemedText style={styles.suggestLabel}>{suggestion.label}</ThemedText>
              {suggestion.verses.map((v) => {
                const on = attached === v.ref;
                return (
                  <View key={v.ref} style={[styles.suggestCard, on && styles.suggestCardOn]}>
                    <View style={styles.suggestHead}>
                      <ThemedText style={styles.suggestRef}>
                        {v.name} · {v.ref}
                      </ThemedText>
                      <View style={styles.suggestActions}>
                        <VerseSpeaker surah={v.surah} ayah={v.ayah} size={18} />
                        <Pressable
                          hitSlop={8}
                          onPress={() => {
                            haptic.light();
                            setAttached(on ? null : v.ref);
                          }}>
                          <Ionicons
                            name={on ? 'checkmark-circle' : 'add-circle-outline'}
                            size={24}
                            color={ACCENT}
                          />
                        </Pressable>
                      </View>
                    </View>
                    <ThemedText style={styles.suggestAr}>{v.ar}</ThemedText>
                    <ThemedText style={styles.suggestEn}>{v.en}</ThemedText>
                  </View>
                );
              })}
            </View>
          ) : null}

          {crisis ? (
            <View style={styles.crisisCard}>
              <ThemedText style={styles.crisisTitle}>Please reach out — you matter</ThemedText>
              <ThemedText style={styles.crisisText}>{crisis}</ThemedText>
            </View>
          ) : error ? (
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          ) : null}

          <Pressable
            style={[styles.share, (!body.trim() || posting) && styles.shareOff]}
            onPress={submit}
            disabled={!body.trim() || posting}>
            <ThemedText style={styles.shareText}>{posting ? 'Sharing…' : 'Share intention'}</ThemedText>
          </Pressable>
          <ThemedText style={styles.modNote}>
            Posts are checked before they appear. Be kind — this is a space for prayer, not chat.
          </ThemedText>
          </ScrollView>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  muted: { opacity: 0.65, fontSize: 16, textAlign: 'center' },
  list: { padding: 16, paddingBottom: 40, gap: 12 },
  head: { gap: 12, paddingBottom: 4 },
  intro: { fontSize: 14, lineHeight: 20, opacity: 0.7 },
  postBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 13,
    borderRadius: 14,
  },
  postBtnText: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
  empty: { textAlign: 'center', opacity: 0.55, marginTop: 40, fontSize: 15 },
  card: {
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.22)',
    backgroundColor: 'rgba(127,127,127,0.04)',
    gap: 10,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  author: { fontSize: 13.5, fontWeight: '700', color: ACCENT, flex: 1 },
  time: { fontSize: 12, opacity: 0.5 },
  body: { fontSize: 15.5, lineHeight: 22 },
  cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ameen: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(10,126,164,0.1)',
  },
  ameenOn: { backgroundColor: ACCENT },
  ameenText: { fontSize: 14, fontWeight: '700', color: ACCENT },
  ameenTextOn: { color: '#fff' },
  overflow: { padding: 6 },
  minePayoff: { flexShrink: 1, paddingVertical: 8, paddingRight: 8 },
  minePayoffText: { fontSize: 13.5, fontWeight: '700', color: ACCENT },
  minePayoffMuted: { color: 'rgba(127,127,127,0.85)', fontWeight: '600' },

  payoffBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(10,126,164,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(10,126,164,0.3)',
  },
  payoffEmoji: { fontSize: 26 },
  payoffTextWrap: { flex: 1, gap: 2 },
  payoffHead: { fontSize: 15.5, fontWeight: '800', color: ACCENT },
  payoffSub: { fontSize: 13, opacity: 0.7 },

  gateEmoji: { fontSize: 44 },
  gateTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  gateText: { fontSize: 15, lineHeight: 23, opacity: 0.8, textAlign: 'center' },
  gatePrimary: { backgroundColor: ACCENT, paddingVertical: 14, paddingHorizontal: 30, borderRadius: 14, marginTop: 8 },
  gatePrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  gateGhost: { paddingVertical: 10 },
  gateGhostText: { color: ACCENT, fontSize: 14.5, fontWeight: '600' },

  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  scrimFill: { flex: 1 },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 16, paddingHorizontal: 18, maxHeight: '85%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetBody: { flexShrink: 1 },
  sheetScroll: { gap: 10, paddingBottom: 20 },
  suggestActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(10,126,164,0.12)' },
  chipText: { fontSize: 12.5, fontWeight: '600', color: ACCENT },
  input: {
    minHeight: 72,
    backgroundColor: 'rgba(127,127,127,0.1)',
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: 'rgba(127,127,127,1)',
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', fontSize: 11.5, opacity: 0.5 },
  nameInput: {
    backgroundColor: 'rgba(127,127,127,0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14.5,
    color: 'rgba(127,127,127,1)',
  },
  crisisCard: {
    backgroundColor: 'rgba(214,84,84,0.1)',
    borderColor: 'rgba(214,84,84,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  crisisTitle: { fontSize: 14.5, fontWeight: '800', color: '#c1554f' },
  crisisText: { fontSize: 13.5, lineHeight: 20, opacity: 0.85 },
  errorText: { fontSize: 13.5, color: '#c1554f', lineHeight: 19 },
  share: { backgroundColor: ACCENT, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginTop: 2 },
  shareOff: { opacity: 0.4 },
  shareText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modNote: { fontSize: 11.5, opacity: 0.5, lineHeight: 16, textAlign: 'center' },
  findVerse: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(10,126,164,0.1)',
  },
  findVerseOff: { opacity: 0.45 },
  findVerseText: { fontSize: 13.5, fontWeight: '700', color: ACCENT },
  suggestWrap: { gap: 8 },
  suggestLabel: { fontSize: 12.5, fontWeight: '800', color: ACCENT, opacity: 0.85 },
  suggestCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(127,127,127,0.25)',
    gap: 8,
  },
  suggestCardOn: { borderColor: ACCENT, backgroundColor: 'rgba(10,126,164,0.07)' },
  suggestHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  suggestRef: { fontSize: 12, fontWeight: '700', color: ACCENT },
  suggestAr: { fontFamily: 'AmiriQuran', fontSize: 20, lineHeight: 42, textAlign: 'right', writingDirection: 'rtl' },
  suggestEn: { fontSize: 13.5, lineHeight: 20, opacity: 0.85 },
  attached: {
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(10,126,164,0.06)',
    borderLeftWidth: 2,
    borderLeftColor: ACCENT,
  },
  attachedAr: { fontFamily: 'AmiriQuran', fontSize: 20, lineHeight: 42, textAlign: 'right', writingDirection: 'rtl' },
  attachedEn: { fontSize: 14, lineHeight: 21, opacity: 0.85 },
  attachedFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  attachedRef: { fontSize: 11.5, fontWeight: '700', color: ACCENT, opacity: 0.8 },
});
