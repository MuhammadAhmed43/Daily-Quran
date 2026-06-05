// Community — the Ameen wall (onyx). A shared space to post a short intention / du'a and add your ameen to
// others'. This screen is BOTH the Community tab and the /ameen route (re-exported). Re-skin only — the age
// gate, feed (sort + pagination), optimistic posting, Ameen toggle, payoff banner, verse-attach + suggest,
// crisis handling, and moderation flow are all unchanged.
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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

import { SealMedallion } from '@/components/atlas-tile';
import { IconButton, Txt } from '@/components/ui/primitives';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { VerseSpeaker } from '@/components/verse-speaker';
import {
  communityReady,
  currentUserId,
  cursorOf,
  deleteMyIntention,
  fetchFeed,
  type FeedCursor,
  getAgeOk,
  getDisplayName,
  looksLikeCrisis,
  myIntentionsSummary,
  PAGE_SIZE,
  type FeedItem,
  type FeedSort,
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
import { c, font, radius, space } from '@/lib/theme';

const MAX = 140;

const TEMPLATES = [
  'Please pray for my family.',
  'Please pray for the ummah everywhere.',
  'Please pray for someone going through hardship.',
  'Please pray that I find guidance and direction.',
  'Please pray for healing for someone who is unwell.',
  'Please pray for steadfastness in my prayers.',
];

const SORTS: { key: FeedSort; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'trending', label: 'Trending' },
  { key: 'top', label: 'Most prayed' },
];

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

type AgeState = 'checking' | 'gate' | 'ok' | 'blocked';
type Draft = { body: string; name: string; attached: string | null; errorKind: 'crisis' | 'other'; message: string };
type PostInput = { body: string; authorName: string; verseRefs: string[] };

// Keep the locally-mutated feed in the SAME order the server uses, so a new post (or a replaced optimistic
// one) lands in its correct place for the active sort — not pinned to the top when sorting by Most prayed
// (where a brand-new, 0-prayer intention belongs below the ones people have actually prayed for).
function sortFeed(items: FeedItem[], sort: FeedSort): FeedItem[] {
  return [...items].sort((a, b) =>
    sort === 'top' && b.ameen_count !== a.ameen_count
      ? b.ameen_count - a.ameen_count
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

function Header() {
  const router = useRouter();
  return (
    <View style={styles.header}>
      {router.canGoBack() ? (
        <IconButton name="chevron-back" onPress={() => router.back()} diameter={38} size={22} color={c.textPrimary} />
      ) : null}
      <Txt variant="h1">Community</Txt>
    </View>
  );
}

export default function AmeenWall() {
  const [age, setAge] = useState<AgeState>('checking');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [summary, setSummary] = useState<{ posts: number; ameens: number }>({ posts: 0, ameens: 0 });
  const [sort, setSort] = useState<FeedSort>('recent');
  const sortRef = useRef<FeedSort>('recent');
  const cursorRef = useRef<FeedCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [composeKey, setComposeKey] = useState(0);

  useEffect(() => {
    getAgeOk().then((v) => setAge(v === true ? 'ok' : v === false ? 'blocked' : 'gate'));
  }, []);

  const load = useCallback(async () => {
    const [items, myId, sum] = await Promise.all([fetchFeed(sortRef.current, null, PAGE_SIZE), currentUserId(), myIntentionsSummary()]);
    setFeed(items);
    setUid(myId);
    setSummary(sum);
    cursorRef.current = items.length ? cursorOf(items[items.length - 1]) : null;
    setHasMore(items.length === PAGE_SIZE);
    setLoading(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const page = await fetchFeed(sortRef.current, cursorRef.current, PAGE_SIZE);
    if (page.length) cursorRef.current = cursorOf(page[page.length - 1]);
    setFeed((f) => {
      const seen = new Set(f.map((x) => x.id));
      return [...f, ...page.filter((p) => !seen.has(p.id))];
    });
    setHasMore(page.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [loadingMore, hasMore, loading]);

  const changeSort = (s: FeedSort) => {
    if (s === sortRef.current) return;
    haptic.light();
    sortRef.current = s;
    cursorRef.current = null;
    setSort(s);
    setLoading(true);
    setFeed([]);
    void load();
  };

  // Optimistic post: show the intention immediately (pending), then confirm or roll back. Crisis text never
  // reaches here (it stays on the modal's blocking flow), so nothing heavy flashes into the feed.
  const optimisticPost = (input: PostInput) => {
    const tempId = `temp-${Date.now()}`;
    const optimistic: FeedItem = {
      id: tempId,
      user_id: uid ?? '',
      author_name: input.authorName || 'Anonymous',
      body: input.body,
      category: null,
      verse_refs: input.verseRefs.length ? input.verseRefs : null,
      ameen_count: 0,
      created_at: new Date().toISOString(),
      ameenedByMe: false,
      pending: true,
    };
    setFeed((f) => sortFeed([optimistic, ...f], sortRef.current));
    haptic.light();
    void (async () => {
      const r = await postIntention(input);
      if (r.ok) {
        haptic.success();
        setFeed((f) => {
          if (f.some((x) => x.id === tempId)) {
            return sortFeed(
              f.map((x) => (x.id === tempId ? { ...r.intention, ameenedByMe: false } : x)),
              sortRef.current,
            );
          }
          if (f.some((x) => x.id === r.intention.id)) return f; // a refresh already pulled it in
          return sortFeed([{ ...r.intention, ameenedByMe: false }, ...f], sortRef.current);
        });
      } else {
        setFeed((f) => f.filter((x) => x.id !== tempId));
        setDraft({
          body: input.body,
          name: input.authorName === 'Anonymous' ? '' : input.authorName,
          attached: input.verseRefs[0] ?? null,
          errorKind: r.kind === 'crisis' ? 'crisis' : 'other',
          message: r.message,
        });
        setComposeKey((k) => k + 1);
        setComposeOpen(true);
      }
    })();
  };

  // Refresh whenever the wall regains focus, so the count climbs the moment you return. Silent.
  useFocusEffect(
    useCallback(() => {
      if (age === 'ok') void load();
    }, [age, load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onAmeen = async (item: FeedItem) => {
    const on = !item.ameenedByMe;
    if (on) haptic.success();
    else haptic.light();
    setFeed((f) => f.map((x) => (x.id === item.id ? { ...x, ameenedByMe: on, ameen_count: Math.max(0, x.ameen_count + (on ? 1 : -1)) } : x)));
    const okk = await toggleAmeen(item.id, on);
    if (!okk) {
      setFeed((f) => f.map((x) => (x.id === item.id ? { ...x, ameenedByMe: !on, ameen_count: Math.max(0, x.ameen_count + (on ? -1 : 1)) } : x)));
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
            setSummary((s) => ({ posts: Math.max(0, s.posts - 1), ameens: Math.max(0, s.ameens - item.ameen_count) }));
          }
        },
      },
    ]);
  };

  if (age === 'checking') {
    return (
      <Screen stars>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      </Screen>
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
      <Screen stars>
        <Stack.Screen options={{ headerShown: false }} />
        <Header />
        <View style={styles.center}>
          <Txt variant="body" color={c.textMuted}>
            The community isn&apos;t set up yet.
          </Txt>
        </View>
      </Screen>
    );
  }

  return (
    <Screen stars>
      <Stack.Screen options={{ headerShown: false }} />
      <Header />
      <FlatList
        data={feed}
        keyExtractor={(it) => it.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} />}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={c.accent} style={styles.footerSpin} />
          ) : hasMore && feed.length > 0 ? (
            <PressableScale style={styles.loadMore} onPress={() => void loadMore()}>
              <Txt variant="caption" color={c.accent} style={styles.loadMoreText}>
                Load more
              </Txt>
            </PressableScale>
          ) : null
        }
        ListHeaderComponent={
          <View style={styles.head}>
            {summary.ameens > 0 ? <PayoffBanner posts={summary.posts} ameens={summary.ameens} /> : null}
            <Txt variant="body" color={c.textSecondary} style={styles.intro}>
              Share an intention or du&apos;a, and add your ameen to others&apos;. A space for prayer — please keep it kind.
            </Txt>
            <PressableScale
              style={styles.postBtn}
              onPress={() => {
                haptic.light();
                setDraft(null);
                setComposeKey((k) => k + 1);
                setComposeOpen(true);
              }}>
              <Ionicons name="add" size={18} color={c.bg} />
              <Txt style={styles.postBtnText}>Post an intention</Txt>
            </PressableScale>
            {feed.length > 0 || sort !== 'recent' ? (
              <View style={styles.sortRow}>
                {SORTS.map((o) => (
                  <PressableScale key={o.key} style={[styles.sortChip, sort === o.key && styles.sortChipOn]} onPress={() => changeSort(o.key)}>
                    <Txt variant="caption" style={[styles.sortChipText, sort === o.key && styles.sortChipTextOn]}>
                      {o.label}
                    </Txt>
                  </PressableScale>
                ))}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={c.accent} style={styles.emptySpin} />
          ) : (
            <Txt variant="body" color={c.textMuted} style={styles.empty}>
              {sort === 'trending' ? 'Nothing prayed for in the last 7 days yet — try Recent.' : 'Be the first to share an intention.'}
            </Txt>
          )
        }
        renderItem={({ item }) => {
          if (item.pending) {
            return (
              <View style={[styles.card, styles.cardPending]}>
                <View style={styles.cardHead}>
                  <Txt numberOfLines={1} style={styles.author}>
                    {item.author_name || 'Anonymous'}
                  </Txt>
                  <Txt style={styles.time}>now</Txt>
                </View>
                <Txt style={styles.body}>{item.body}</Txt>
                {item.verse_refs && item.verse_refs[0] ? <AttachedVerse refStr={item.verse_refs[0]} /> : null}
                <View style={styles.pendingRow}>
                  <ActivityIndicator size="small" color={c.accent} />
                  <Txt style={styles.pendingText}>Posting…</Txt>
                </View>
              </View>
            );
          }
          const mine = item.user_id === uid;
          return (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Txt numberOfLines={1} style={styles.author}>
                  {item.author_name || 'Anonymous'}
                </Txt>
                <Txt style={styles.time}>{timeAgo(item.created_at)}</Txt>
              </View>
              <Txt style={styles.body}>{item.body}</Txt>
              {item.verse_refs && item.verse_refs[0] ? <AttachedVerse refStr={item.verse_refs[0]} /> : null}
              <View style={styles.cardActions}>
                {mine ? (
                  <View style={styles.minePayoff}>
                    <MaterialCommunityIcons name="hands-pray" size={14} color={item.ameen_count === 0 ? c.textMuted : c.accent} />
                    <Txt style={[styles.minePayoffText, item.ameen_count === 0 && styles.minePayoffMuted]}>
                      {item.ameen_count === 0
                        ? 'No ameens yet'
                        : `${item.ameen_count} ${item.ameen_count === 1 ? 'person' : 'people'} prayed for this`}
                    </Txt>
                  </View>
                ) : (
                  <AmeenButton on={item.ameenedByMe} count={item.ameen_count} onPress={() => onAmeen(item)} />
                )}
                <Pressable hitSlop={10} style={styles.overflow} onPress={() => (mine ? onDelete(item) : onReport(item))}>
                  <Ionicons name={mine ? 'trash-outline' : 'flag-outline'} size={16} color={c.textMuted} />
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      <ComposeModal
        key={composeKey}
        visible={composeOpen}
        initial={draft ?? undefined}
        onClose={() => setComposeOpen(false)}
        onOptimistic={optimisticPost}
        onPosted={(it) => {
          setFeed((f) => sortFeed([{ ...it, ameenedByMe: false }, ...f], sortRef.current));
          setComposeOpen(false);
        }}
      />
    </Screen>
  );
}

// The Ameen toggle for OTHER people's posts. Springs a little bounce when you join the prayer.
function AmeenButton({ on, count, onPress }: { on: boolean; count: number; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const handle = () => {
    if (!on) {
      scale.stopAnimation();
      scale.setValue(1);
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.16, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
      ]).start();
    }
    onPress();
  };
  return (
    <Pressable onPress={handle}>
      <Animated.View style={[styles.ameen, on && styles.ameenOn, { transform: [{ scale }] }]}>
        <MaterialCommunityIcons name="hands-pray" size={15} color={on ? c.bg : c.accent} />
        <Txt style={[styles.ameenText, on && styles.ameenTextOn]}>Ameen{count > 0 ? ` · ${count}` : ''}</Txt>
      </Animated.View>
    </Pressable>
  );
}

// The "people prayed for you" payoff banner — gently fades and rises in the first time it appears.
function PayoffBanner({ posts, ameens }: { posts: number; ameens: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a]);
  return (
    <Animated.View style={[styles.payoffBanner, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      <MaterialCommunityIcons name="hands-pray" size={26} color={c.accent} />
      <View style={styles.payoffTextWrap}>
        <Txt style={styles.payoffHead}>
          {ameens} {ameens === 1 ? 'prayer' : 'prayers'} for your {posts === 1 ? 'intention' : 'intentions'}
        </Txt>
        <Txt variant="caption" color={c.textSecondary}>
          Others are praying with you.
        </Txt>
      </View>
    </Animated.View>
  );
}

function AgeGate({ onAnswer }: { onAnswer: (ok: boolean) => void }) {
  return (
    <Screen stars>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.gateWrap}>
        <SealMedallion name="hands-pray" frame={74} ring={52} glyph={32} glowStrength={0.28} />
        <Txt variant="h1" style={styles.centerText}>
          A space for prayer
        </Txt>
        <Txt variant="body" color={c.textSecondary} style={styles.gateText}>
          The community is a shared space where people post intentions and pray for one another. To use it, you need to be 13 or older.
        </Txt>
        <PressableScale style={styles.cta} onPress={() => onAnswer(true)}>
          <Txt style={styles.ctaText}>I&apos;m 13 or older</Txt>
        </PressableScale>
        <PressableScale style={styles.ghost} onPress={() => onAnswer(false)}>
          <Txt variant="body" color={c.accent} style={styles.ghostText}>
            I&apos;m under 13
          </Txt>
        </PressableScale>
      </View>
    </Screen>
  );
}

function Blocked() {
  return (
    <Screen stars>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.gateWrap}>
        <SealMedallion name="sprout-outline" frame={70} ring={50} glyph={30} glowStrength={0.24} />
        <Txt variant="h1" style={styles.centerText}>
          For ages 13 and up
        </Txt>
        <Txt variant="body" color={c.textSecondary} style={styles.gateText}>
          The community is for ages 13 and older. The rest of Daily Qur&apos;an is all yours — keep reading, listening, and reflecting.
        </Txt>
      </View>
    </Screen>
  );
}

function AttachedVerse({ refStr }: { refStr: string }) {
  const v = verseForRef(refStr);
  if (!v) return null;
  return (
    <View style={styles.attached}>
      <Txt style={styles.attachedAr}>{v.ar}</Txt>
      <Txt style={styles.attachedEn}>{v.en}</Txt>
      <View style={styles.attachedFoot}>
        <Txt style={styles.attachedRef}>
          {v.name} · {v.ref}
        </Txt>
        <VerseSpeaker surah={v.surah} ayah={v.ayah} size={18} />
      </View>
    </View>
  );
}

function ComposeModal({
  visible,
  initial,
  onClose,
  onOptimistic,
  onPosted,
}: {
  visible: boolean;
  initial?: Draft;
  onClose: () => void;
  onOptimistic: (input: PostInput) => void;
  onPosted: (it: Intention) => void;
}) {
  const [body, setBody] = useState(initial?.body ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(initial && initial.errorKind === 'other' ? initial.message : null);
  const [crisis, setCrisis] = useState<string | null>(initial && initial.errorKind === 'crisis' ? initial.message : null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<{ label: string; verses: SuggestedVerse[] } | null>(null);
  const [attached, setAttached] = useState<string | null>(initial?.attached ?? null);

  useEffect(() => {
    if (!initial) getDisplayName().then((n) => setName((cur) => cur || n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setError(null);
    setCrisis(null);
    const cleanName = name.trim();
    if (cleanName) await setDisplayName(cleanName);
    const input: PostInput = { body: text, authorName: cleanName || 'Anonymous', verseRefs: attached ? [attached] : [] };
    if (looksLikeCrisis(text)) {
      setPosting(true);
      const r = await postIntention(input);
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
      return;
    }
    onOptimistic(input);
    setBody('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.scrim}>
        <Pressable style={styles.scrimFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Txt variant="cardTitle">Share an intention</Txt>
            <IconButton name="close" onPress={onClose} diameter={34} size={20} color={c.accent} />
          </View>

          <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.chips}>
              {TEMPLATES.map((t) => (
                <PressableScale
                  key={t}
                  style={styles.chip}
                  onPress={() => {
                    haptic.light();
                    setBody(t);
                  }}>
                  <Txt variant="caption" numberOfLines={1} style={styles.chipText}>
                    {t.replace(/^Please pray /, '').replace(/\.$/, '')}
                  </Txt>
                </PressableScale>
              ))}
            </View>

            <TextInput
              value={body}
              onChangeText={(t) => setBody(t.slice(0, MAX))}
              placeholder="Write a short intention or du'a…"
              placeholderTextColor={c.textMuted}
              style={styles.input}
              multiline
              maxLength={MAX}
              editable={!posting}
            />
            <Txt style={styles.counter}>
              {body.length}/{MAX}
            </Txt>

            <TextInput
              value={name}
              onChangeText={(t) => setName(t.slice(0, 24))}
              placeholder="Your name (optional — defaults to Anonymous)"
              placeholderTextColor={c.textMuted}
              style={styles.nameInput}
              editable={!posting}
            />

            <PressableScale style={[styles.findVerse, (!body.trim() || suggesting) && styles.findVerseOff]} onPress={findVerse} disabled={!body.trim() || suggesting}>
              <Ionicons name="sparkles-outline" size={15} color={c.accent} />
              <Txt style={styles.findVerseText}>{suggesting ? 'Finding a verse…' : suggestion ? 'Find another verse' : 'Add a comforting verse'}</Txt>
            </PressableScale>

            {suggestion && suggestion.verses.length ? (
              <View style={styles.suggestWrap}>
                <Txt style={styles.suggestLabel}>{suggestion.label}</Txt>
                {suggestion.verses.map((v) => {
                  const on = attached === v.ref;
                  return (
                    <View key={v.ref} style={[styles.suggestCard, on && styles.suggestCardOn]}>
                      <View style={styles.suggestHead}>
                        <Txt style={styles.suggestRef}>
                          {v.name} · {v.ref}
                        </Txt>
                        <View style={styles.suggestActions}>
                          <VerseSpeaker surah={v.surah} ayah={v.ayah} size={18} />
                          <Pressable
                            hitSlop={8}
                            onPress={() => {
                              haptic.light();
                              setAttached(on ? null : v.ref);
                            }}>
                            <Ionicons name={on ? 'checkmark-circle' : 'add-circle-outline'} size={24} color={c.accent} />
                          </Pressable>
                        </View>
                      </View>
                      <Txt style={styles.suggestAr}>{v.ar}</Txt>
                      <Txt style={styles.suggestEn}>{v.en}</Txt>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {crisis ? (
              <View style={styles.crisisCard}>
                <Txt style={styles.crisisTitle}>Please reach out — you matter</Txt>
                <Txt style={styles.crisisText}>{crisis}</Txt>
              </View>
            ) : error ? (
              <Txt style={styles.errorText}>{error}</Txt>
            ) : null}

            <PressableScale style={[styles.share, (!body.trim() || posting) && styles.shareOff]} onPress={submit} disabled={!body.trim() || posting}>
              <Txt style={styles.shareText}>{posting ? 'Sharing…' : 'Share intention'}</Txt>
            </PressableScale>
            <Txt style={styles.modNote}>Posts are checked before they appear. Be kind — this is a space for prayer, not chat.</Txt>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.gutter, paddingBottom: space.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: space.section },
  centerText: { textAlign: 'center' },

  list: { paddingHorizontal: space.gutter, paddingBottom: space.section, gap: 12 },
  head: { gap: 12, paddingBottom: 4 },
  intro: { lineHeight: 21 },
  postBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: c.primary, paddingVertical: 14, borderRadius: radius.full },
  postBtnText: { fontFamily: font.sansBold, fontSize: 15, color: c.bg },
  empty: { textAlign: 'center', marginTop: 40 },
  emptySpin: { marginTop: 40 },
  footerSpin: { marginVertical: 18 },

  card: { padding: space.card, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, backgroundColor: c.surface1, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  author: { flex: 1, fontFamily: font.sansBold, fontSize: 13.5, color: c.accent },
  time: { fontFamily: font.sans, fontSize: 12, color: c.textMuted },
  body: { fontFamily: font.serifReg, fontSize: 16, lineHeight: 23, color: c.scriptureInk },
  cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ameen: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.full, backgroundColor: 'rgba(201,189,166,0.12)' },
  ameenOn: { backgroundColor: c.primary },
  ameenText: { fontFamily: font.sansBold, fontSize: 14, color: c.accent },
  ameenTextOn: { color: c.bg },
  overflow: { padding: 6 },
  minePayoff: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, paddingVertical: 8, paddingRight: 8 },
  minePayoffText: { flexShrink: 1, fontFamily: font.sansSemi, fontSize: 13.5, color: c.accent },
  minePayoffMuted: { color: c.textMuted },

  payoffBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: space.card,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(201,189,166,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,189,166,0.3)',
  },
  payoffTextWrap: { flex: 1, gap: 2 },
  payoffHead: { fontFamily: font.sansBold, fontSize: 15.5, color: c.accent },

  cardPending: { opacity: 0.6 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingText: { fontFamily: font.sansSemi, fontSize: 13, color: c.textMuted },
  sortRow: { flexDirection: 'row', gap: 8, paddingTop: 2 },
  sortChip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, backgroundColor: c.surface1 },
  sortChipOn: { backgroundColor: c.primary, borderColor: c.primary },
  sortChipText: { fontFamily: font.sansSemi, color: c.textSecondary },
  sortChipTextOn: { color: c.bg },
  loadMore: { alignSelf: 'center', paddingVertical: 12, paddingHorizontal: 24, marginTop: 4 },
  loadMoreText: { fontFamily: font.sansSemi },

  gateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: space.section },
  gateText: { textAlign: 'center', lineHeight: 23 },
  cta: { backgroundColor: c.primary, paddingVertical: 14, paddingHorizontal: 30, borderRadius: radius.full, marginTop: 6 },
  ctaText: { fontFamily: font.sansBold, fontSize: 15.5, color: c.bg },
  ghost: { paddingVertical: 8 },
  ghostText: { fontFamily: font.sansSemi },

  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  scrimFill: { flex: 1 },
  sheet: { backgroundColor: c.surface1, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: 16, paddingHorizontal: 18, maxHeight: '85%', borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetBody: { flexShrink: 1 },
  sheetScroll: { gap: 10, paddingBottom: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: 'rgba(201,189,166,0.12)' },
  chipText: { fontFamily: font.sansSemi, color: c.accent },
  input: { minHeight: 72, backgroundColor: c.surface2, borderRadius: radius.md, padding: 14, fontFamily: font.sans, fontSize: 16, color: c.textPrimary, textAlignVertical: 'top' },
  counter: { alignSelf: 'flex-end', fontFamily: font.sans, fontSize: 11.5, color: c.textMuted },
  nameInput: { backgroundColor: c.surface2, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11, fontFamily: font.sans, fontSize: 14.5, color: c.textPrimary },
  findVerse: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 10, borderRadius: radius.md, backgroundColor: 'rgba(201,189,166,0.1)' },
  findVerseOff: { opacity: 0.45 },
  findVerseText: { fontFamily: font.sansSemi, fontSize: 13.5, color: c.accent },
  suggestWrap: { gap: 8 },
  suggestLabel: { fontFamily: font.sansBold, fontSize: 12.5, color: c.accent },
  suggestCard: { padding: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline, backgroundColor: c.surface2, gap: 8 },
  suggestCardOn: { borderColor: c.accent, backgroundColor: 'rgba(201,189,166,0.08)' },
  suggestHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  suggestActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  suggestRef: { fontFamily: font.sansBold, fontSize: 12, color: c.accent },
  suggestAr: { fontFamily: 'AmiriQuran', fontSize: 20, lineHeight: 42, textAlign: 'right', writingDirection: 'rtl', color: c.scriptureInk },
  suggestEn: { fontFamily: font.serifReg, fontSize: 13.5, lineHeight: 20, color: c.textSecondary },
  crisisCard: { backgroundColor: 'rgba(214,84,84,0.12)', borderColor: 'rgba(214,84,84,0.35)', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: 14, gap: 6 },
  crisisTitle: { fontFamily: font.sansBold, fontSize: 14.5, color: '#E0867E' },
  crisisText: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 20, color: c.textSecondary },
  errorText: { fontFamily: font.sans, fontSize: 13.5, color: '#E0867E', lineHeight: 19 },
  share: { backgroundColor: c.primary, paddingVertical: 14, borderRadius: radius.full, alignItems: 'center', marginTop: 2 },
  shareOff: { opacity: 0.4 },
  shareText: { fontFamily: font.sansBold, fontSize: 15.5, color: c.bg },
  modNote: { fontFamily: font.sans, fontSize: 11.5, color: c.textMuted, lineHeight: 16, textAlign: 'center' },

  attached: { gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: 'rgba(201,189,166,0.06)', borderLeftWidth: 2, borderLeftColor: c.accent },
  attachedAr: { fontFamily: 'AmiriQuran', fontSize: 20, lineHeight: 42, textAlign: 'right', writingDirection: 'rtl', color: c.scriptureInk },
  attachedEn: { fontFamily: font.serifReg, fontSize: 14, lineHeight: 21, color: c.textSecondary },
  attachedFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  attachedRef: { fontFamily: font.sansBold, fontSize: 11.5, color: c.accent },
});
