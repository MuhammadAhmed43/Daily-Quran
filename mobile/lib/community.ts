// Community ("Ameen wall") data layer - the one feature that talks to Supabase directly (anonymous
// auth + RLS), plus the server moderation endpoint for posting. Reads / Ameens / reports / deletes go
// direct under RLS; creating an intention ALWAYS goes through /api/ameen-post so the moderation gate
// can't be bypassed. Display name + the 13+ age gate are local (AsyncStorage).
import AsyncStorage from '@react-native-async-storage/async-storage';

import { classifierThemes, themeById } from './intention-verses';
import { getAyah, getSurah } from './quran';
import { communityReady, ensureAnonSession, supabase } from './supabase';
import { verseText } from './translations';

export { communityReady };

export type Intention = {
  id: string;
  user_id: string;
  author_name: string;
  body: string;
  category: string | null;
  verse_refs: string[] | null;
  ameen_count: number;
  created_at: string;
};
export type FeedItem = Intention & { ameenedByMe: boolean; pending?: boolean };
export type FeedSort = 'recent' | 'top' | 'trending';
export type FeedCursor = { ameen_count: number; created_at: string };
export const PAGE_SIZE = 20;
const TRENDING_DAYS = 7; // "Trending" = intentions from the last week, ranked by most prayed

// The keyset cursor for the LAST item of a page — pass it to fetchFeed to load the next page.
export const cursorOf = (it: Pick<Intention, 'ameen_count' | 'created_at'>): FeedCursor => ({
  ameen_count: it.ameen_count,
  created_at: it.created_at,
});

export type SuggestedVerse = { ref: string; surah: number; ayah: number; name: string; ar: string; en: string };

const NAME_KEY = 'daily-quran:community-name';
const AGE_KEY = 'daily-quran:community-13plus';
const API = process.env.EXPO_PUBLIC_API_BASE;

export async function getDisplayName(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(NAME_KEY)) ?? '';
  } catch {
    return '';
  }
}
export async function setDisplayName(name: string): Promise<void> {
  try {
    await AsyncStorage.setItem(NAME_KEY, name.trim().slice(0, 24));
  } catch {}
}
export async function getAgeOk(): Promise<boolean | null> {
  try {
    const v = await AsyncStorage.getItem(AGE_KEY);
    return v === 'yes' ? true : v === 'no' ? false : null;
  } catch {
    return null;
  }
}
export async function setAgeOk(ok: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(AGE_KEY, ok ? 'yes' : 'no');
  } catch {}
}

export async function currentUserId(): Promise<string | null> {
  const s = await ensureAnonSession();
  return s?.user.id ?? null;
}

// Fetch a page of the feed via KEYSET (cursor) pagination, so a shifting ameen_count never skips or dupes
// rows across pages the way offset (.range) did. Pass the LAST item's cursor (cursorOf) for the next page;
// null for the first page. Sorts:
//   recent   - newest first
//   top      - most prayed first (all time)
//   trending - most prayed among intentions from the last TRENDING_DAYS days
// (A keyset on a mutable key still isn't perfectly immune to an item moving across the cursor between
//  fetches, but it removes the systematic offset skew; the caller also de-dupes by id.)
export async function fetchFeed(sort: FeedSort = 'recent', cursor: FeedCursor | null = null, limit = PAGE_SIZE): Promise<FeedItem[]> {
  if (!supabase) return [];
  await ensureAnonSession();
  let q = supabase
    .from('intentions')
    .select('id,user_id,author_name,body,category,verse_refs,ameen_count,created_at')
    .eq('hidden', false);

  if (sort === 'trending') {
    const since = new Date(Date.now() - TRENDING_DAYS * 86400000).toISOString();
    q = q.gte('created_at', since);
  }

  if (sort === 'top' || sort === 'trending') {
    q = q.order('ameen_count', { ascending: false }).order('created_at', { ascending: false });
    // rows strictly after (ameen_count, created_at) in (desc, desc) order
    if (cursor) q = q.or(`ameen_count.lt.${cursor.ameen_count},and(ameen_count.eq.${cursor.ameen_count},created_at.lt.${cursor.created_at})`);
  } else {
    q = q.order('created_at', { ascending: false });
    if (cursor) q = q.lt('created_at', cursor.created_at);
  }

  const { data: rows } = await q.limit(limit);
  const items = (rows ?? []) as Intention[];
  if (!items.length) return [];
  const { data: mine } = await supabase
    .from('ameens')
    .select('intention_id')
    .in(
      'intention_id',
      items.map((i) => i.id),
    );
  const set = new Set((mine ?? []).map((m) => (m as { intention_id: string }).intention_id));
  return items.map((it) => ({ ...it, ameenedByMe: set.has(it.id) }));
}

// Summary of YOUR own intentions, for the "people prayed for you" payoff. ameen_count already EXCLUDES
// your own Ameen (you can't Ameen your own intention - enforced by RLS), so `ameens` here is purely the
// prayers OTHER people added to your posts. Counts only your visible (non-hidden) intentions.
export async function myIntentionsSummary(): Promise<{ posts: number; ameens: number }> {
  if (!supabase) return { posts: 0, ameens: 0 };
  const s = await ensureAnonSession();
  if (!s) return { posts: 0, ameens: 0 };
  const { data } = await supabase
    .from('intentions')
    .select('ameen_count')
    .eq('user_id', s.user.id)
    .eq('hidden', false);
  const rows = (data ?? []) as { ameen_count: number }[];
  return { posts: rows.length, ameens: rows.reduce((sum, r) => sum + (r.ameen_count || 0), 0) };
}

export type PostResult =
  | { ok: true; intention: Intention }
  | { ok: false; kind: 'crisis' | 'rejected' | 'rate' | 'error'; message: string };

// Client-side mirror of the server's crisis check (api/ameen-post). Used only to keep crisis-suspected
// text on the gentle blocking flow - never an optimistic public flash. The SERVER stays authoritative.
const CRISIS_RE =
  /suicid|kill (?:myself|me)|end (?:my life|it all)|want to die|self.?harm|hurt myself|harming myself|no (?:point|reason) (?:in|to) (?:living|life)|kill her|kill him/i;
export function looksLikeCrisis(text: string): boolean {
  return CRISIS_RE.test(text);
}

export async function postIntention(input: {
  body: string;
  category?: string | null;
  authorName?: string;
  verseRefs?: string[];
}): Promise<PostResult> {
  if (!supabase || !API) return { ok: false, kind: 'error', message: "The community isn't available right now." };
  const session = await ensureAnonSession();
  if (!session) return { ok: false, kind: 'error', message: "Couldn't connect - please try again." };
  try {
    const res = await fetch(`${API}/api/ameen-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(input),
    });
    const j = await res.json().catch(() => ({}));
    if (res.status === 200 && j.intention) return { ok: true, intention: j.intention as Intention };
    if (j.blocked === 'crisis') return { ok: false, kind: 'crisis', message: String(j.message || '') };
    if (res.status === 429) return { ok: false, kind: 'rate', message: String(j.error || 'Posting too quickly.') };
    return { ok: false, kind: 'rejected', message: String(j.error || "That didn't go through.") };
  } catch {
    return { ok: false, kind: 'error', message: 'Network error - please try again.' };
  }
}

export async function toggleAmeen(intentionId: string, on: boolean): Promise<boolean> {
  if (!supabase) return false;
  const s = await ensureAnonSession();
  if (!s) return false;
  if (on) {
    const { error } = await supabase.from('ameens').insert({ intention_id: intentionId, user_id: s.user.id });
    return !error;
  }
  const { error } = await supabase
    .from('ameens')
    .delete()
    .eq('intention_id', intentionId)
    .eq('user_id', s.user.id);
  return !error;
}

export async function reportIntention(intentionId: string): Promise<boolean> {
  if (!supabase) return false;
  const s = await ensureAnonSession();
  if (!s) return false;
  const { error } = await supabase.from('intention_reports').insert({ intention_id: intentionId, user_id: s.user.id });
  return !error;
}

export async function deleteMyIntention(intentionId: string): Promise<boolean> {
  if (!supabase) return false;
  await ensureAnonSession();
  const { error } = await supabase.from('intentions').delete().eq('id', intentionId);
  return !error;
}

// Suggest a comforting ayah for an intention. The server only returns a THEME id; we map it to our
// hand-vetted verses and render the text locally from the bundled Qur'an (scripture never comes from
// the model). Always returns something comforting (falls back to the general "comfort" theme).
export async function suggestVerses(intention: string): Promise<{ label: string; verses: SuggestedVerse[] }> {
  const text = intention.trim();
  if (!API || !text) return { label: '', verses: [] };
  let themeId = 'comfort';
  try {
    const res = await fetch(`${API}/api/ameen-suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intention: text, themes: classifierThemes() }),
    });
    const j = await res.json().catch(() => ({}));
    if (j.themeId) themeId = String(j.themeId);
  } catch {}
  const theme = themeById(themeId) ?? themeById('comfort');
  if (!theme) return { label: '', verses: [] };
  const verses: SuggestedVerse[] = [];
  for (const r of theme.verses) {
    const a = getAyah(r.surah, r.ayah);
    if (a) {
      verses.push({
        ref: `${r.surah}:${r.ayah}`,
        surah: r.surah,
        ayah: r.ayah,
        name: getSurah(r.surah)?.englishName ?? '',
        ar: a.ar,
        en: verseText(r.surah, r.ayah),
      });
    }
  }
  return { label: theme.label, verses };
}

// Render an attached "surah:ayah" ref to a verse (for the feed card), or null.
export function verseForRef(ref: string): SuggestedVerse | null {
  const m = ref.match(/^(\d+):(\d+)$/);
  if (!m) return null;
  const surah = Number(m[1]);
  const ayah = Number(m[2]);
  const a = getAyah(surah, ayah);
  if (!a) return null;
  return { ref, surah, ayah, name: getSurah(surah)?.englishName ?? '', ar: a.ar, en: verseText(surah, ayah) };
}
