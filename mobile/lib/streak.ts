// The activity ledger — the spine of the app. Every meaningful action calls recordActivity(type);
// the streak (and "what you did today") is DERIVED from which days have at least one QUALIFYING
// activity. One ledger, many writers, one reader. Same tiny cache + pub/sub pattern as bookmarks,
// so the Home streak ring updates the instant anything is logged. On-device; syncs to an account
// later.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type ActType =
  | 'daily_verse' // opened/read the verse of the day
  | 'read_ayahs' // read ayahs in the reader
  | 'listened' // played recitation
  | 'study_step' // completed a study-plan step
  | 'asked' // asked the assistant (chat or voice)
  | 'watched' // watched a timeline video
  | 'checkin' // did the daily mood check-in
  | 'prayer_logged' // private prayer tracker
  | 'hub_opened' // opened a topical hub
  | 'ameen' // tapped Ameen on the wall
  | 'quiz'; // completed the daily quiz

// Which activities count toward the streak. Light/social taps (ameen, hub_opened) and the private
// prayer tracker deliberately DON'T — so the streak stays about genuinely engaging with the
// Qur'an, never about gamifying worship.
const QUALIFYING: ActType[] = [
  'daily_verse',
  'read_ayahs',
  'listened',
  'study_step',
  'asked',
  'watched',
  'checkin',
  'quiz',
];

// Milestone tiers — early ones (3, 7) give quick wins; later ones reward the long haul. Research:
// tiers starting low pull in users at every commitment depth, not just the 365-day cohort.
const MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];

type DayLog = { t: ActType[]; n: number };
type Ledger = Record<string, DayLog>; // keyed by local YYYY-MM-DD

export type StreakInfo = {
  current: number; // consecutive qualifying days ending today (or yesterday if today's not done yet)
  longest: number; // best run ever
  todayDone: boolean; // a qualifying activity happened today
  totalDays: number; // distinct active days, ever
  nextMilestone: number; // the next streak tier to aim for
};

const KEY = 'daily-quran:activity';
let cache: Ledger | null = null;
const listeners = new Set<() => void>();

/** Local YYYY-MM-DD day key — the one date scheme shared across the streak and the plan tracker. */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function load(): Promise<Ledger> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Ledger) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function persist() {
  AsyncStorage.setItem(KEY, JSON.stringify(cache ?? {})).catch(() => {});
  listeners.forEach((l) => l());
}

/** Re-read the ledger from storage + notify - cloud sync calls this after writing a merged value. */
export async function reloadStreak(): Promise<void> {
  cache = null;
  await load();
  listeners.forEach((l) => l());
}

export function subscribeStreak(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Log a meaningful action. Fire-and-forget — safe to call from anywhere, anytime. */
export function recordActivity(type: ActType): void {
  void (async () => {
    await load();
    const k = dayKey(new Date());
    const day = (cache![k] ??= { t: [], n: 0 });
    day.n += 1;
    if (!day.t.includes(type)) day.t.push(type);
    persist();
  })();
}

function qualifyingDays(ledger: Ledger): Set<string> {
  const set = new Set<string>();
  for (const [day, log] of Object.entries(ledger)) {
    if (log.t.some((t) => QUALIFYING.includes(t))) set.add(day);
  }
  return set;
}

function isNextDay(a: string, b: string): boolean {
  const da = new Date(`${a}T00:00:00`);
  da.setDate(da.getDate() + 1);
  return dayKey(da) === b;
}

function computeStreak(ledger: Ledger): StreakInfo {
  const days = qualifyingDays(ledger);
  const todayDone = days.has(dayKey(new Date()));

  // current: walk backwards from today. If today isn't done yet, the streak is still alive from
  // yesterday (today is "in progress"), so begin the walk there rather than breaking it.
  const cursor = new Date();
  if (!todayDone) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (days.has(dayKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // longest: max run of consecutive active days, ever
  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && isNextDay(prev, d) ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }

  const nextMilestone = MILESTONES.find((m) => m > current) ?? current + 100;
  return { current, longest, todayDone, totalDays: days.size, nextMilestone };
}

export async function getStreak(): Promise<StreakInfo> {
  return computeStreak(await load());
}

/** What's already been done today (for "what counts today" hints). */
export async function getTodayTypes(): Promise<ActType[]> {
  const ledger = await load();
  return ledger[dayKey(new Date())]?.t ?? [];
}

// The current calendar week (Sun-Sat) for the Today week-streak strip: each day's qualifying-activity
// state, with today + future flagged. Derived/read-only.
export type WeekDay = { key: string; letter: string; dayNum: number; done: boolean; isToday: boolean; isFuture: boolean };
const WEEK_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function computeWeek(ledger: Ledger): WeekDay[] {
  const done = qualifyingDays(ledger);
  const today = new Date();
  const todayIdx = today.getDay();
  const start = new Date(today);
  start.setDate(today.getDate() - todayIdx);
  const out: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = dayKey(d);
    out.push({ key, letter: WEEK_LETTERS[i], dayNum: d.getDate(), done: done.has(key), isToday: i === todayIdx, isFuture: i > todayIdx });
  }
  return out;
}

export async function getWeek(): Promise<WeekDay[]> {
  return computeWeek(await load());
}

export function useWeekStreak(): WeekDay[] {
  const [week, setWeek] = useState<WeekDay[]>(cache ? computeWeek(cache) : []);
  useEffect(() => {
    let active = true;
    const refresh = () => getWeek().then((w) => active && setWeek(w));
    refresh();
    const unsub = subscribeStreak(refresh);
    return () => {
      active = false;
      unsub();
    };
  }, []);
  return week;
}

/** The full set of days that had a qualifying activity — powers the streak-history heatmap. */
export async function getActiveDays(): Promise<Set<string>> {
  return qualifyingDays(await load());
}

export function useActiveDays(): Set<string> {
  const [days, setDays] = useState<Set<string>>(cache ? qualifyingDays(cache) : new Set());
  useEffect(() => {
    let on = true;
    const refresh = () => getActiveDays().then((d) => on && setDays(d));
    refresh();
    const unsub = subscribeStreak(refresh);
    return () => {
      on = false;
      unsub();
    };
  }, []);
  return days;
}

export function useStreak(): StreakInfo {
  const [info, setInfo] = useState<StreakInfo>(
    cache
      ? computeStreak(cache)
      : { current: 0, longest: 0, todayDone: false, totalDays: 0, nextMilestone: MILESTONES[0] },
  );
  useEffect(() => {
    let active = true;
    const refresh = () => getStreak().then((s) => active && setInfo(s));
    refresh();
    const unsub = subscribeStreak(refresh);
    return () => {
      active = false;
      unsub();
    };
  }, []);
  return info;
}
