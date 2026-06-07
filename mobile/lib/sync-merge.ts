/* eslint-disable @typescript-eslint/no-explicit-any */
// Pure, dependency-free merge logic for cloud sync. lib/sync.ts orchestrates (pull -> merge -> write ->
// push); THIS file is the algorithm, unit-tested by scripts/test-sync-merge.mjs which MIRRORS these
// functions - keep the two in lockstep. Principle: UNION (add-only, commutative) for ledgers/lists so
// two devices never lose data; LAST-WRITE-WINS (by an embedded timestamp) for single documents;
// "your explicit local choice wins" for timestampless preferences.

// AsyncStorage keys of the stores we sync (must match each store's own KEY constant).
export const SYNC_KEYS = {
  profile: 'daily-quran:profile',
  activity: 'daily-quran:activity',
  bookmarks: 'daily-quran:bookmarks',
  prayerLog: 'daily-quran:prayer-log',
  quranPlan: 'daily-quran:quran-plan',
  journeys: 'daily-quran:plans',
  affinity: 'daily-quran:hub-affinity',
  translation: 'daily-quran:translation',
  verseNotif: 'daily-quran:verse-notif',
  lastRead: 'daily-quran:lastRead',
  quiz: 'daily-quran:quiz',
} as const;

type Obj = Record<string, any>;

// profile: a single document -> last-write-wins by updatedAt.
export function mergeProfile(local: any, remote: any): any {
  if (local == null) return remote ?? null;
  if (remote == null) return local;
  return (remote.updatedAt ?? 0) > (local.updatedAt ?? 0) ? remote : local;
}

// activity ledger { 'YYYY-MM-DD': { t: ActType[], n } }: union per day - union the type list, keep the
// larger tap count. Days are never deleted, so union is loss-free + commutative (the streak spine).
export function mergeLedger(local: any, remote: any): any {
  const out: Obj = { ...(local ?? {}) };
  for (const [day, r] of Object.entries((remote ?? {}) as Obj)) {
    const l = out[day];
    if (!l) out[day] = r;
    else out[day] = { t: Array.from(new Set([...(l.t ?? []), ...(r.t ?? [])])), n: Math.max(l.n ?? 0, r.n ?? 0) };
  }
  return out;
}

// bookmarks [{ surah, ayah, at, deleted? }]: union by surah:ayah, keep the LATEST 'at'. A removal is a
// tombstone ({deleted:true} with a fresh 'at'), so latest-wins makes a delete beat an older add (and a
// re-add beat the tombstone) — deletions propagate instead of the bookmark resurrecting. Tombstones are
// retained in the synced value; getBookmarks() hides them.
export function mergeBookmarks(local: any, remote: any): any {
  const byKey = new Map<string, any>();
  for (const b of [...(local ?? []), ...(remote ?? [])]) {
    if (!b) continue;
    const k = `${b.surah}:${b.ayah}`;
    const ex = byKey.get(k);
    if (!ex || (b.at ?? 0) > (ex.at ?? 0)) byKey.set(k, b);
  }
  return Array.from(byKey.values());
}

// prayer log { v, days: { 'YYYY-MM-DD': { fajr?:true, ... } } }: union the marked prayers per day.
export function mergePrayerLog(local: any, remote: any): any {
  const ld = (local && local.days) || {};
  const rd = (remote && remote.days) || {};
  const days: Obj = {};
  for (const day of new Set([...Object.keys(ld), ...Object.keys(rd)])) {
    const merged = { ...(ld[day] || {}), ...(rd[day] || {}) };
    if (Object.keys(merged).length) days[day] = merged;
  }
  return { v: 1, days };
}

// Qur'an reading plan (single active plan, or null): same plan (same startedAt) -> keep the one further
// along (max position); different plans -> the newer one (later startedAt). One side null -> the other.
export function mergeQuranPlan(local: any, remote: any): any {
  if (local == null) return remote ?? null;
  if (remote == null) return local;
  if (local.startedAt === remote.startedAt) return (remote.position ?? 0) > (local.position ?? 0) ? remote : local;
  return (remote.startedAt ?? 0) > (local.startedAt ?? 0) ? remote : local;
}

// per-journey progress: union the completed-step maps (earliest completion day wins), advance to the
// furthest currentOrder, keep the earliest startedAt + latest lastStepDay. Active focus: local wins.
function mergePlanState(l: any, r: any): any {
  if (!l) return r;
  if (!r) return l;
  const completed: Obj = { ...(l.completed || {}) };
  for (const [order, day] of Object.entries(r.completed || {})) {
    if (!completed[order] || (day as string) < completed[order]) completed[order] = day;
  }
  const lastStepDay = [l.lastStepDay, r.lastStepDay].filter(Boolean).sort().pop() ?? null;
  return {
    startedAt: Math.min(l.startedAt ?? r.startedAt, r.startedAt ?? l.startedAt),
    currentOrder: Math.max(l.currentOrder ?? 1, r.currentOrder ?? 1),
    completed,
    completedAt: l.completedAt ?? r.completedAt ?? null,
    lastStepDay,
  };
}
export function mergeJourneys(local: any, remote: any): any {
  const lp = (local && local.plans) || {};
  const rp = (remote && remote.plans) || {};
  const plans: Obj = {};
  for (const id of new Set([...Object.keys(lp), ...Object.keys(rp)])) plans[id] = mergePlanState(lp[id], rp[id]);
  const active = (local && local.active) ?? (remote && remote.active) ?? null;
  return { v: 1, active, plans };
}

// hub affinity { hubId: { s, t } }: per hub keep the entry with the later timestamp (freshest signal).
export function mergeAffinity(local: any, remote: any): any {
  const out: Obj = { ...(local ?? {}) };
  for (const [id, r] of Object.entries((remote ?? {}) as Obj)) {
    const l = out[id];
    if (!l || (r.t ?? 0) > (l.t ?? 0)) out[id] = r;
  }
  return out;
}

// translation id: timestampless preference -> your explicit choice wins; inherit the cloud's only when
// you haven't set one (null / still the default 'itani').
export function mergeTranslation(local: any, remote: any): any {
  if (local == null || local === 'itani') return remote ?? local ?? null;
  return local;
}

// generic timestampless pref (verse-notif prefs, last-read): keep local if set, else inherit cloud.
export function mergeKeepLocal(local: any, remote: any): any {
  return local != null ? local : (remote ?? null);
}

// daily quiz { v, days: { 'YYYY-MM-DD': { score, total, answers, at } } }: union per day; if both
// devices played the same day, keep the better attempt (higher score). Days are never deleted, so the
// union is loss-free + commutative — same family as the activity ledger.
export function mergeQuiz(local: any, remote: any): any {
  const ld = (local && local.days) || {};
  const rd = (remote && remote.days) || {};
  const days: Obj = {};
  for (const day of new Set([...Object.keys(ld), ...Object.keys(rd)])) {
    const l = ld[day];
    const r = rd[day];
    if (!l) days[day] = r;
    else if (!r) days[day] = l;
    else days[day] = (r.score ?? 0) > (l.score ?? 0) ? r : l;
  }
  return { v: 1, days };
}
