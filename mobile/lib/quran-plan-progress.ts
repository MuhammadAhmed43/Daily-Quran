// The user's single active Qur'an reading plan, persisted on device — same cache + pub/sub + hook
// shape as plan-progress / watch-progress, so Home, the dashboard, and the portion screen all update
// the instant a portion is completed. Position-based: progress is "you're at ayah N," never a pile of
// overdue days. Day boundaries reuse streak.ts's dayKey so "done today" flips with the streak.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { corpusLength, portionAt, remainingPortions, type Corpus, type Portion } from './quran-plan';
import { dayKey } from './streak';

export type QuranPlanState = {
  v: 1;
  corpus: Corpus;
  durationDays: number; // intended pace (total days from the start); re-pace updates this
  startedAt: number;
  position: number; // ayahs completed so far (flat index into the corpus)
  portionsDone: number;
  lastDay: string | null; // dayKey of the most recent completion (soft one-portion-per-day on Home)
  finishedAt: number | null;
};

const KEY = 'daily-quran:quran-plan';
let cache: QuranPlanState | null | undefined; // undefined = not loaded yet; null = loaded, no plan
const listeners = new Set<() => void>();

function migrate(raw: unknown): QuranPlanState | null {
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<QuranPlanState>;
    if (r.v === 1 && r.corpus && typeof r.durationDays === 'number') {
      return {
        v: 1,
        corpus: r.corpus,
        durationDays: r.durationDays,
        startedAt: r.startedAt ?? Date.now(),
        position: r.position ?? 0,
        portionsDone: r.portionsDone ?? 0,
        lastDay: r.lastDay ?? null,
        finishedAt: r.finishedAt ?? null,
      };
    }
  }
  return null;
}

async function load(): Promise<QuranPlanState | null> {
  if (cache !== undefined) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? migrate(JSON.parse(raw)) : null;
  } catch {
    cache = null;
  }
  return cache;
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(cache ?? null)).catch(() => {});
  listeners.forEach((l) => l());
}

/** Re-read the plan from storage + notify - cloud sync calls this after writing a merged value. */
export async function reloadQuranPlan(): Promise<void> {
  cache = undefined;
  await load();
  listeners.forEach((l) => l());
}

export function subscribeQuranPlan(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export async function getQuranPlan(): Promise<QuranPlanState | null> {
  return load();
}

/** Start (or replace) the active plan. One personalized plan at a time. */
export function createPlan(corpus: Corpus, durationDays: number): void {
  void (async () => {
    await load();
    cache = {
      v: 1,
      corpus,
      durationDays: Math.max(1, Math.round(durationDays)),
      startedAt: Date.now(),
      position: 0,
      portionsDone: 0,
      lastDay: null,
      finishedAt: null,
    };
    persist();
  })();
}

/** Mark today's portion read: advance position to its end, stamp the day, finish if the corpus ends.
 *  Idempotent-ish — caller fires recordActivity('study_step') itself (mirrors watch/[id].tsx). */
export function completePortion(): void {
  void (async () => {
    await load();
    if (!cache) return;
    const portion = portionAt(cache.corpus, cache.position, cache.durationDays, cache.portionsDone);
    if (!portion) return; // already finished
    const ended = portion.endIdx >= corpusLength(cache.corpus);
    cache = {
      ...cache,
      position: portion.endIdx,
      portionsDone: cache.portionsDone + 1,
      lastDay: dayKey(new Date()),
      finishedAt: ended ? Date.now() : cache.finishedAt,
    };
    persist();
  })();
}

/** Gently change the pace — set a new intended total duration (the remaining corpus re-portions). */
export function repace(durationDays: number): void {
  void (async () => {
    await load();
    if (!cache) return;
    cache = { ...cache, durationDays: Math.max(1, Math.round(durationDays)) };
    persist();
  })();
}

/** Drop the plan entirely (start over / abandon). */
export function resetPlan(): void {
  void (async () => {
    await load();
    cache = null;
    persist();
  })();
}

export type QuranPlanView = {
  plan: QuranPlanState | null;
  today: Portion | null; // the portion to read now (null when finished)
  doneToday: boolean;
  finished: boolean;
  percent: number; // 0..1
  portionNumber: number; // 1-based current portion
  totalPortionsCount: number; // current + remaining (re-pace aware)
  projectedFinish: Date | null;
};

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function derive(plan: QuranPlanState | null): QuranPlanView {
  if (!plan) {
    return {
      plan: null,
      today: null,
      doneToday: false,
      finished: false,
      percent: 0,
      portionNumber: 0,
      totalPortionsCount: 0,
      projectedFinish: null,
    };
  }
  const N = corpusLength(plan.corpus);
  const finished = plan.position >= N;
  const today = finished ? null : portionAt(plan.corpus, plan.position, plan.durationDays, plan.portionsDone);
  const remaining = finished
    ? 0
    : remainingPortions(plan.corpus, plan.position, plan.durationDays, plan.portionsDone);
  return {
    plan,
    today,
    doneToday: plan.lastDay === dayKey(new Date()),
    finished,
    percent: N ? plan.position / N : 0,
    portionNumber: plan.portionsDone + 1,
    totalPortionsCount: plan.portionsDone + remaining,
    projectedFinish: finished
      ? plan.finishedAt
        ? new Date(plan.finishedAt)
        : null
      : addDays(new Date(), Math.max(1, remaining)),
  };
}

export function useQuranPlan() {
  const [plan, setPlan] = useState<QuranPlanState | null>(cache ?? null);
  useEffect(() => {
    let active = true;
    const refresh = () => getQuranPlan().then((p) => active && setPlan(p));
    refresh();
    const unsub = subscribeQuranPlan(refresh);
    return () => {
      active = false;
      unsub();
    };
  }, []);
  return { ...derive(plan), createPlan, completePortion, repace, resetPlan };
}
