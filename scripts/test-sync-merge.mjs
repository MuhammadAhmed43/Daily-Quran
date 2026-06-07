// Mirror of lib/sync-merge.ts - verifies the cloud-sync merge algorithm without a device or network.
// Keep these functions in lockstep with lib/sync-merge.ts. Covers: LWW direction, union/no-loss,
// dedupe, empty/null sides, commutativity + idempotency of the unions, and the preference rules.
//   node scripts/test-sync-merge.mjs

// ---- mirrored merge functions ----
function mergeProfile(local, remote) {
  if (local == null) return remote ?? null;
  if (remote == null) return local;
  return (remote.updatedAt ?? 0) > (local.updatedAt ?? 0) ? remote : local;
}
function mergeLedger(local, remote) {
  const out = { ...(local ?? {}) };
  for (const [day, r] of Object.entries(remote ?? {})) {
    const l = out[day];
    if (!l) out[day] = r;
    else out[day] = { t: Array.from(new Set([...(l.t ?? []), ...(r.t ?? [])])), n: Math.max(l.n ?? 0, r.n ?? 0) };
  }
  return out;
}
function mergeBookmarks(local, remote) {
  const byKey = new Map();
  for (const b of [...(local ?? []), ...(remote ?? [])]) {
    if (!b) continue;
    const k = `${b.surah}:${b.ayah}`;
    const ex = byKey.get(k);
    if (!ex || (b.at ?? 0) > (ex.at ?? 0)) byKey.set(k, b);
  }
  return Array.from(byKey.values());
}
function mergePrayerLog(local, remote) {
  const ld = (local && local.days) || {};
  const rd = (remote && remote.days) || {};
  const days = {};
  for (const day of new Set([...Object.keys(ld), ...Object.keys(rd)])) {
    const merged = { ...(ld[day] || {}), ...(rd[day] || {}) };
    if (Object.keys(merged).length) days[day] = merged;
  }
  return { v: 1, days };
}
function mergeQuranPlan(local, remote) {
  if (local == null) return remote ?? null;
  if (remote == null) return local;
  if (local.startedAt === remote.startedAt) return (remote.position ?? 0) > (local.position ?? 0) ? remote : local;
  return (remote.startedAt ?? 0) > (local.startedAt ?? 0) ? remote : local;
}
function mergePlanState(l, r) {
  if (!l) return r;
  if (!r) return l;
  const completed = { ...(l.completed || {}) };
  for (const [order, day] of Object.entries(r.completed || {})) {
    if (!completed[order] || day < completed[order]) completed[order] = day;
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
function mergeJourneys(local, remote) {
  const lp = (local && local.plans) || {};
  const rp = (remote && remote.plans) || {};
  const plans = {};
  for (const id of new Set([...Object.keys(lp), ...Object.keys(rp)])) plans[id] = mergePlanState(lp[id], rp[id]);
  const active = (local && local.active) ?? (remote && remote.active) ?? null;
  return { v: 1, active, plans };
}
function mergeAffinity(local, remote) {
  const out = { ...(local ?? {}) };
  for (const [id, r] of Object.entries(remote ?? {})) {
    const l = out[id];
    if (!l || (r.t ?? 0) > (l.t ?? 0)) out[id] = r;
  }
  return out;
}
function mergeTranslation(local, remote) {
  if (local == null || local === 'itani') return remote ?? local ?? null;
  return local;
}
function mergeKeepLocal(local, remote) {
  return local != null ? local : remote ?? null;
}
function mergeQuiz(local, remote) {
  const ld = (local && local.days) || {};
  const rd = (remote && remote.days) || {};
  const days = {};
  for (const day of new Set([...Object.keys(ld), ...Object.keys(rd)])) {
    const l = ld[day];
    const r = rd[day];
    if (!l) days[day] = r;
    else if (!r) days[day] = l;
    else days[day] = (r.score ?? 0) > (l.score ?? 0) ? r : l;
  }
  return { v: 1, days };
}

// ---- harness ----
function canon(v) {
  if (Array.isArray(v)) return v.map(canon).sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = canon(v[k]);
    return o;
  }
  return v;
}
const eq = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
let fails = 0;
const ok = (c, m) => {
  if (!c) fails++;
  console.log((c ? '  OK  ' : '  XX  ') + m);
};

console.log('profile (LWW by updatedAt)');
ok(mergeProfile({ updatedAt: 1, j: 'a' }, { updatedAt: 2, j: 'b' }).j === 'b', 'newer remote wins');
ok(mergeProfile({ updatedAt: 3, j: 'a' }, { updatedAt: 2, j: 'b' }).j === 'a', 'newer local wins');
ok(mergeProfile(null, { updatedAt: 2, j: 'b' }).j === 'b', 'null local -> remote');
ok(mergeProfile({ updatedAt: 1, j: 'a' }, null).j === 'a', 'null remote -> local');
ok(mergeProfile({ updatedAt: 2, j: 'a' }, { updatedAt: 2, j: 'b' }).j === 'a', 'tie -> keeps local (deterministic)');

console.log('activity ledger (union, no loss)');
const L1 = { '2024-01-01': { t: ['asked'], n: 2 } };
const R1 = { '2024-01-01': { t: ['watched'], n: 1 }, '2024-01-02': { t: ['listened'], n: 1 } };
const m1 = mergeLedger(L1, R1);
ok(eq(m1['2024-01-01'].t, ['asked', 'watched']), 'same day: types unioned');
ok(m1['2024-01-01'].n === 2, 'same day: keeps larger tap count');
ok(!!m1['2024-01-02'], 'remote-only day kept');
ok(eq(mergeLedger({ d: { t: ['asked'], n: 1 } }, { d: { t: ['asked'], n: 5 } }).d, { t: ['asked'], n: 5 }), 'duplicate type deduped, n=max');
ok(eq(mergeLedger(null, R1), R1), 'empty local -> remote');
ok(eq(mergeLedger(L1, R1), mergeLedger(R1, L1)), 'union is commutative');
ok(eq(mergeLedger(L1, mergeLedger(L1, R1)), mergeLedger(L1, R1)), 'union is idempotent');

console.log('bookmarks (union by surah:ayah, latest at; tombstones)');
const b1 = mergeBookmarks([{ surah: 2, ayah: 255, at: 9 }], [{ surah: 1, ayah: 1, at: 3 }]);
ok(b1.length === 2, 'disjoint bookmarks unioned');
const b2 = mergeBookmarks([{ surah: 2, ayah: 255, at: 9 }], [{ surah: 2, ayah: 255, at: 3 }]);
ok(b2.length === 1 && b2[0].at === 9, 'duplicate deduped, latest at kept');
const b3 = mergeBookmarks([{ surah: 2, ayah: 255, at: 10, deleted: true }], [{ surah: 2, ayah: 255, at: 5 }]);
ok(b3.length === 1 && b3[0].deleted === true, 'tombstone (newer) wins -> deletion propagates, not resurrected');
const b4 = mergeBookmarks([{ surah: 2, ayah: 255, at: 10, deleted: true }], [{ surah: 2, ayah: 255, at: 20 }]);
ok(b4.length === 1 && !b4[0].deleted, 're-add (newer than the tombstone) brings the bookmark back');
ok(mergeBookmarks([], []).length === 0, 'both empty -> empty');
ok(eq(mergeBookmarks([{ surah: 1, ayah: 1, at: 1 }], [{ surah: 2, ayah: 2, at: 2 }]), mergeBookmarks([{ surah: 2, ayah: 2, at: 2 }], [{ surah: 1, ayah: 1, at: 1 }])), 'commutative');

console.log('prayer log (union marks per day)');
const p1 = mergePrayerLog({ v: 1, days: { d1: { fajr: true } } }, { v: 1, days: { d1: { isha: true }, d2: { asr: true } } });
ok(eq(p1.days.d1, { fajr: true, isha: true }), 'same day: prayers unioned');
ok(!!p1.days.d2, 'remote-only day kept');
ok(eq(mergePrayerLog({ v: 1, days: {} }, { v: 1, days: {} }), { v: 1, days: {} }), 'both empty');

console.log('quran plan (same plan -> progress; different -> newer)');
ok(mergeQuranPlan({ startedAt: 1, position: 50 }, { startedAt: 1, position: 100 }).position === 100, 'same plan: further along wins');
ok(mergeQuranPlan({ startedAt: 1, position: 200 }, { startedAt: 5, position: 0 }).startedAt === 5, 'different plan: newer wins');
ok(mergeQuranPlan(null, { startedAt: 1, position: 0 }).startedAt === 1, 'null local -> remote');
ok(mergeQuranPlan({ startedAt: 1, position: 9 }, null).position === 9, 'null remote -> local');

console.log('journeys (union per-track progress; local active wins)');
const j1 = {
  v: 1,
  active: 'patience',
  plans: { patience: { startedAt: 5, currentOrder: 2, completed: { 1: '2024-01-02' }, completedAt: null, lastStepDay: '2024-01-02' } },
};
const j2 = {
  v: 1,
  active: 'gratitude',
  plans: {
    patience: { startedAt: 2, currentOrder: 3, completed: { 1: '2024-01-01', 2: '2024-01-03' }, completedAt: null, lastStepDay: '2024-01-03' },
    gratitude: { startedAt: 9, currentOrder: 1, completed: {}, completedAt: null, lastStepDay: null },
  },
};
const jm = mergeJourneys(j1, j2);
ok(jm.active === 'patience', 'local active focus wins');
ok(!!jm.plans.gratitude, 'remote-only track kept');
ok(eq(jm.plans.patience.completed, { 1: '2024-01-01', 2: '2024-01-03' }), 'completed steps unioned, earliest day');
ok(jm.plans.patience.currentOrder === 3, 'furthest currentOrder');
ok(jm.plans.patience.startedAt === 2, 'earliest startedAt');
ok(jm.plans.patience.lastStepDay === '2024-01-03', 'latest lastStepDay');
ok(eq(mergeJourneys(j1, j2).plans.patience, mergeJourneys(j2, j1).plans.patience), 'per-track merge is commutative');

console.log('hub affinity (freshest signal per hub)');
ok(mergeAffinity({ h: { s: 3, t: 100 } }, { h: { s: 5, t: 200 } }).h.t === 200, 'later timestamp wins');
ok(mergeAffinity({ h: { s: 3, t: 300 } }, { h: { s: 5, t: 200 } }).h.t === 300, 'local kept when newer');
ok(!!mergeAffinity({ a: { s: 1, t: 1 } }, { b: { s: 1, t: 1 } }).b, 'disjoint hubs unioned');

console.log('preferences');
ok(mergeTranslation('itani', 'pickthall') === 'pickthall', 'default local -> inherit cloud');
ok(mergeTranslation('yusufali', 'pickthall') === 'yusufali', 'explicit local choice wins');
ok(mergeTranslation(null, 'pickthall') === 'pickthall', 'no local -> cloud');
ok(mergeKeepLocal({ enabled: true }, { enabled: false }).enabled === true, 'keep-local pref: local wins');
ok(mergeKeepLocal(null, { enabled: false }).enabled === false, 'keep-local pref: inherit when unset');

console.log('daily quiz (union per day, best attempt kept)');
const qL = { v: 1, days: { '2024-01-01': { score: 7, total: 10, answers: [], at: 1 } } };
const qR = { v: 1, days: { '2024-01-01': { score: 9, total: 10, answers: [], at: 2 }, '2024-01-02': { score: 5, total: 10, answers: [], at: 3 } } };
const qm = mergeQuiz(qL, qR);
ok(qm.days['2024-01-01'].score === 9, 'same day: higher score wins');
ok(!!qm.days['2024-01-02'], 'remote-only day kept');
ok(eq(mergeQuiz(qL, qR), mergeQuiz(qR, qL)), 'union is commutative');
ok(eq(mergeQuiz(qL, mergeQuiz(qL, qR)), mergeQuiz(qL, qR)), 'union is idempotent');
ok(eq(mergeQuiz(null, qR), qR), 'null local -> remote');
ok(eq(mergeQuiz({ v: 1, days: {} }, { v: 1, days: {} }), { v: 1, days: {} }), 'both empty');

console.log(fails === 0 ? '\nALL MERGE CASES PASS' : `\n${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
