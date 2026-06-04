// Daily-quiz results store. Same tiny cache + pub/sub + hook pattern as streak/bookmarks, so the
// Profile card + stat block update the instant a quiz is finished. ONE result per day (the daily
// quiz); practice mode never writes here. Completing the daily quiz credits the streak exactly once
// via recordActivity('quiz'). On-device; syncs to an account (union by day, best attempt kept).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { dayKey, recordActivity } from './streak';

const KEY = 'daily-quran:quiz';

// One completed daily quiz. `answers` is the chosen option index per question (-1 if skipped), kept so
// a finished day could be reviewed later. `at` is the completion time (ms).
export type QuizDay = { score: number; total: number; answers: number[]; at: number };
type QuizState = { v: 1; days: Record<string, QuizDay> };

export type QuizStats = {
  todayDone: boolean;
  todayScore: number | null;
  todayTotal: number | null;
  daysPlayed: number; // distinct days the daily quiz was completed
  totalCorrect: number;
  totalQuestions: number;
  accuracy: number; // 0..1 over all daily quizzes
  bestScore: number; // best correct-count in a single day
  bestTotal: number; // the total that best score was out of
};

const EMPTY: QuizState = { v: 1, days: {} };

let cache: QuizState | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<QuizState> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as QuizState) : null;
    cache = parsed && parsed.days ? parsed : { ...EMPTY };
  } catch {
    cache = { ...EMPTY };
  }
  return cache;
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(cache ?? EMPTY)).catch(() => {});
  listeners.forEach((l) => l());
}

/** Re-read from storage + notify — cloud sync calls this after writing a merged value. */
export async function reloadQuiz(): Promise<void> {
  cache = null;
  await load();
  listeners.forEach((l) => l());
}

export function subscribeQuiz(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Record a completed DAILY quiz. Write-once per day: if today is already recorded it's a no-op (the
 * daily quiz is one shot — replays go through practice mode, which never lands here). Credits the
 * streak once, the first time today's quiz is finished.
 */
export async function recordDailyResult(score: number, total: number, answers: number[]): Promise<void> {
  await load();
  const k = dayKey(new Date());
  if (cache!.days[k]) return; // already done today
  cache!.days[k] = { score, total, answers, at: Date.now() };
  persist();
  recordActivity('quiz'); // a finished daily quiz counts toward the streak
}

function computeStats(state: QuizState): QuizStats {
  const entries = Object.values(state.days);
  const today = state.days[dayKey(new Date())] ?? null;
  let totalCorrect = 0;
  let totalQuestions = 0;
  let bestScore = 0;
  let bestTotal = 0;
  for (const d of entries) {
    totalCorrect += d.score;
    totalQuestions += d.total;
    // "best" = highest accuracy day, tie-broken by raw score, so a 9/10 beats a 5/5? No — keep it
    // intuitive: highest raw correct-count, with its own total shown alongside.
    if (d.score > bestScore) {
      bestScore = d.score;
      bestTotal = d.total;
    }
  }
  return {
    todayDone: !!today,
    todayScore: today?.score ?? null,
    todayTotal: today?.total ?? null,
    daysPlayed: entries.length,
    totalCorrect,
    totalQuestions,
    accuracy: totalQuestions ? totalCorrect / totalQuestions : 0,
    bestScore,
    bestTotal,
  };
}

export async function getQuizStats(): Promise<QuizStats> {
  return computeStats(await load());
}

const emptyStats: QuizStats = {
  todayDone: false,
  todayScore: null,
  todayTotal: null,
  daysPlayed: 0,
  totalCorrect: 0,
  totalQuestions: 0,
  accuracy: 0,
  bestScore: 0,
  bestTotal: 0,
};

export function useQuizStats(): QuizStats {
  const [stats, setStats] = useState<QuizStats>(cache ? computeStats(cache) : emptyStats);
  useEffect(() => {
    let active = true;
    const refresh = () => getQuizStats().then((s) => active && setStats(s));
    refresh();
    const unsub = subscribeQuiz(refresh);
    return () => {
      active = false;
      unsub();
    };
  }, []);
  return stats;
}
