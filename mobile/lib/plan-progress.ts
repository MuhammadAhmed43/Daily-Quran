// Per-journey progress, persisted on device — the same tiny cache + pub/sub + hook pattern as
// watch-progress.ts / streak.ts, so the Home "today's step" card, the plan list, and the overview
// all update the instant a step is completed. Local-first; syncs to an account later.
//
// Design (locked with the user): progress is POSITION-BASED and never "behind" — a missed day just
// waits, there is no red/overdue state. Pacing is SOFT one-step-per-day: the Home card surfaces one
// step per calendar day (gated by lastStepDay), but the overview never hard-locks. Many journeys can
// be enrolled at once; exactly ONE is `active` (today's focus) and surfaced on Home. Day boundaries
// reuse streak.ts's dayKey, so a journey's "done today" flips at the exact moment the streak's day
// rolls over (no off-by-a-day between the two systems).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { getPlan, planLength, type PlanId } from './plans';
import { dayKey } from './streak';

export type PlanState = {
  startedAt: number; // ms, first enrolled
  currentOrder: number; // 1-based next/current step (≤ length; length+1 once finished)
  completed: Record<number, string>; // step order → dayKey (YYYY-MM-DD) it was completed
  completedAt: number | null; // ms when the LAST step was finished; null until done
  lastStepDay: string | null; // dayKey of the most recent completion (gates one-step-per-day)
};
export type ProgressMap = Record<string, PlanState>; // keyed by PlanId
export type Store = { v: 1; active: PlanId | null; plans: ProgressMap };

// What to surface on Home for the active journey.
export type TodayStep =
  | { kind: 'none' } // no active journey
  | { kind: 'todo'; id: PlanId; order: number } // active, today's step not done yet
  | { kind: 'done-today'; id: PlanId; order: number } // already took a step today
  | { kind: 'finished'; id: PlanId }; // every step complete

const KEY = 'daily-quran:plans';
const EMPTY: Store = { v: 1, active: null, plans: {} };
let cache: Store | null = null;
const listeners = new Set<() => void>();

const freshState = (): PlanState => ({
  startedAt: Date.now(),
  currentOrder: 1,
  completed: {},
  completedAt: null,
  lastStepDay: null,
});

// Versioned envelope from day one (watch-progress was a bare record; this shape is richer and more
// likely to evolve). Bump v + add a case here when it changes; never silently reshape.
function migrate(raw: unknown): Store {
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<Store>;
    if (r.v === 1 && r.plans && typeof r.plans === 'object') {
      return { v: 1, active: r.active ?? null, plans: r.plans as ProgressMap };
    }
  }
  return { v: 1, active: null, plans: {} };
}

async function load(): Promise<Store> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? migrate(JSON.parse(raw)) : { v: 1, active: null, plans: {} };
  } catch {
    cache = { v: 1, active: null, plans: {} };
  }
  return cache;
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(cache ?? EMPTY)).catch(() => {});
  listeners.forEach((l) => l());
}

/** Re-read journey progress from storage + notify - cloud sync calls this after writing a merge. */
export async function reloadPlans(): Promise<void> {
  cache = null;
  await load();
  listeners.forEach((l) => l());
}

export function subscribePlans(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function getPlans(): Promise<Store> {
  return load();
}

/** Enroll in (or re-focus) a journey. Idempotent: existing progress is kept; only `active` moves. */
export function startPlan(id: PlanId): void {
  void (async () => {
    await load();
    if (!cache!.plans[id]) cache!.plans[id] = freshState();
    cache!.active = id;
    persist();
  })();
}

/** Mark a step done: stamp today's dayKey, advance, and record completion at the end. Idempotent —
 *  re-completing a step is a no-op (so the streak can't be double-credited). Auto-enrolls if needed,
 *  but does NOT change `active` (focus is moved explicitly via startPlan / setActive). */
export function completeStep(id: PlanId, order: number): void {
  void (async () => {
    await load();
    const st = (cache!.plans[id] ??= freshState());
    if (st.completed[order]) return; // already done → no-op
    const k = dayKey(new Date());
    st.completed[order] = k;
    st.lastStepDay = k;
    if (order >= st.currentOrder) st.currentOrder = order + 1;
    if (st.currentOrder > planLength(id)) st.completedAt = Date.now();
    persist();
  })();
}

/** Re-take a journey from the top (e.g. after finishing). Celebrated, never blocked. */
export function restartPlan(id: PlanId): void {
  void (async () => {
    await load();
    cache!.plans[id] = freshState();
    cache!.active = id;
    persist();
  })();
}

export function setActive(id: PlanId | null): void {
  void (async () => {
    await load();
    cache!.active = id;
    persist();
  })();
}

// What to show on Home for the active journey. Position-based: never "behind".
function deriveToday(store: Store): TodayStep {
  const id = store.active;
  if (!id || !getPlan(id)) return { kind: 'none' }; // none, or `active` points at a removed track
  const st = store.plans[id];
  if (!st) return { kind: 'none' };
  if (st.currentOrder > planLength(id)) return { kind: 'finished', id };
  if (st.lastStepDay === dayKey(new Date())) return { kind: 'done-today', id, order: st.currentOrder - 1 };
  return { kind: 'todo', id, order: st.currentOrder };
}

export type PlanSummary = {
  done: number;
  total: number;
  currentOrder: number;
  started: boolean;
  finished: boolean;
  isActive: boolean;
};

function summarize(store: Store, id: string): PlanSummary {
  const st = store.plans[id];
  const total = planLength(id);
  return {
    done: st ? Object.keys(st.completed).length : 0,
    total,
    currentOrder: st?.currentOrder ?? 1,
    started: !!st,
    finished: !!st && total > 0 && st.currentOrder > total,
    isActive: store.active === id,
  };
}

export function usePlanProgress() {
  const [store, setStore] = useState<Store>(() => (cache ? { ...cache } : { ...EMPTY }));
  useEffect(() => {
    let active = true;
    const refresh = () => getPlans().then((s) => active && setStore({ ...s }));
    refresh();
    const unsub = subscribePlans(refresh);
    return () => {
      active = false;
      unsub();
    };
  }, []);
  return {
    store,
    active: store.active,
    today: deriveToday(store),
    stateOf: (id: string): PlanState | null => store.plans[id] ?? null,
    summary: (id: string) => summarize(store, id),
    isStepDone: (id: string, order: number) => !!store.plans[id]?.completed[order],
    startPlan,
    completeStep,
    restartPlan,
    setActive,
  };
}
