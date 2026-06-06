// App-level recitation player. Lives above the navigator so audio keeps playing as you move
// between screens, with one source of truth for "what's playing". It's Qur'an-aware: it tracks
// a {surah, ayah} position, advances ayah-by-ayah, and (in continuous mode) flows from one
// surah into the next — prefetching the upcoming clip so the hand-off stays gapless, even
// across a surah boundary.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { getSurah } from '@/lib/quran';
import { recordActivity } from '@/lib/streak';
import { setListenPos } from '@/lib/storage';
import {
  ayahAudioUrl,
  DEFAULT_RECITER,
  getPreferredReciter,
  RECITERS,
  setPreferredReciter,
  type Reciter,
} from '@/lib/recitation';

export type PlayingPos = { surah: number; ayah: number };

export type RecitationApi = {
  playing: PlayingPos | null;
  paused: boolean;
  loading: boolean;
  continuous: boolean;
  queued: boolean; // a playlist (e.g. a hub's "narrate all") is running
  wholeQuran: boolean; // the active session is the continuous whole-Qur'an "Listen", not a manual ayah play
  reciter: Reciter;
  playFrom: (surah: number, ayah: number) => void;
  playWhole: (surah: number, ayah: number) => void; // start/resume the whole-Qur'an listen (tracks listenPos)
  playList: (verses: PlayingPos[]) => void;
  toggle: (surah: number, ayah: number) => void;
  toggleAyah: (surah: number, ayah: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  fadeStop: (duration?: number) => void; // ramp volume down, then stop (for leaving a study step)
  setContinuous: (v: boolean) => void;
  chooseReciter: (id: string) => void;
};

const LAST_SURAH = 114;
const ayahCount = (surah: number) => getSurah(surah)?.numberOfAyahs ?? 0;
const samePos = (a: PlayingPos | null, b: PlayingPos | null) =>
  !!a && !!b && a.surah === b.surah && a.ayah === b.ayah;

const Ctx = createContext<RecitationApi | null>(null);

function useEngine(): RecitationApi {
  const [playing, setPlaying] = useState<PlayingPos | null>(null);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [continuous, setContinuousState] = useState(false);
  const [queued, setQueued] = useState(false);
  const [wholeQuran, setWholeQuran] = useState(false);
  const [reciter, setReciter] = useState<Reciter>(DEFAULT_RECITER);

  const continuousRef = useRef(continuous);
  continuousRef.current = continuous;
  const wholeQuranRef = useRef(false); // true while the whole-Qur'an "Listen" session is active
  const folderRef = useRef(reciter.folder);
  folderRef.current = reciter.folder;

  const currRef = useRef<{ pos: PlayingPos; player: AudioPlayer; sub: { remove: () => void } } | null>(null);
  const nextRef = useRef<{ pos: PlayingPos; player: AudioPlayer } | null>(null);
  const wantRef = useRef<PlayingPos | null>(null);
  const startedRef = useRef(false);
  const onceRef = useRef(false); // one-shot ayah (verse-card speaker): stop at end, don't advance
  const queueRef = useRef<PlayingPos[] | null>(null); // active playlist (e.g. a hub's "narrate all")
  const qIdxRef = useRef(0);
  const failRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadingRef = useRef(false); // a volume fade-out is in progress (ignore the natural clip-end)
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioReadyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    getPreferredReciter().then(setReciter);
  }, []);

  // When a prayer time arrives (adhan notification, foreground), pause recitation so the call
  // to prayer is heard and isn't drowned out — the user can resume from the mini-player.
  // (Backgrounded recitation is already suspended by iOS in Expo Go, so this covers the real case.)
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((n) => {
      if (n.request.content.data?.type === 'adhan' && currRef.current) pause();
    });
    return () => sub.remove();
  }, []);

  // Where to go after `pos`: next ayah in the surah, or (continuous) the next surah's first
  // ayah, or null at the very end.
  const nextPos = (pos: PlayingPos): PlayingPos | null => {
    if (pos.ayah < ayahCount(pos.surah)) return { surah: pos.surah, ayah: pos.ayah + 1 };
    if (continuousRef.current && pos.surah < LAST_SURAH) return { surah: pos.surah + 1, ayah: 1 };
    return null;
  };

  const clearFail = () => {
    if (failRef.current) {
      clearTimeout(failRef.current);
      failRef.current = null;
    }
  };
  const clearFade = () => {
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  };
  const safeRemove = (p?: AudioPlayer | null) => {
    try {
      p?.pause();
    } catch {}
    try {
      p?.remove();
    } catch {}
  };
  const dropNext = () => {
    safeRemove(nextRef.current?.player);
    nextRef.current = null;
  };
  const dropCurr = () => {
    try {
      currRef.current?.sub.remove();
    } catch {}
    safeRemove(currRef.current?.player);
    currRef.current = null;
  };
  const teardown = () => {
    clearFail();
    clearFade();
    fadingRef.current = false;
    dropCurr();
    dropNext();
  };
  const stop = () => {
    wantRef.current = null;
    queueRef.current = null;
    teardown();
    if (!mountedRef.current) return;
    setPlaying(null);
    setPaused(false);
    setLoading(false);
    setQueued(false);
  };

  // Smoothly ramp the current playback's volume to silence, then stop — so leaving a study step
  // doesn't cut its recitation (a single ayah or the "narrate this step" playlist) off mid-word.
  // The CALLER decides WHETHER to fade (the step player only fades audio it started), so recitation
  // started elsewhere — e.g. continuous reading in the reader — is never cut off.
  const fadeStop = (duration = 800) => {
    const player = currRef.current?.player;
    if (!player) {
      stop(); // nothing playing — just ensure a clean reset
      return;
    }
    queueRef.current = null; // a playlist/one-shot can't advance once the fade starts
    if (mountedRef.current) setQueued(false);
    fadingRef.current = true;
    clearFail();
    clearFade();
    const steps = Math.max(8, Math.round(duration / 50));
    let startVol = 1;
    try {
      startVol = player.volume ?? 1;
    } catch {}
    let i = 0;
    fadeTimerRef.current = setInterval(() => {
      i += 1;
      try {
        player.volume = Math.max(0, startVol * (1 - i / steps));
      } catch {}
      if (i >= steps) {
        clearFade();
        fadingRef.current = false;
        stop();
      }
    }, Math.round(duration / steps));
  };

  const makePlayer = (pos: PlayingPos) =>
    createAudioPlayer({ uri: ayahAudioUrl(folderRef.current, pos.surah, pos.ayah) }, { updateInterval: 500 });

  const prefetch = (pos: PlayingPos | null) => {
    if (!pos) {
      dropNext();
      return;
    }
    if (nextRef.current && samePos(nextRef.current.pos, pos)) return;
    dropNext();
    try {
      nextRef.current = { pos, player: makePlayer(pos) };
    } catch {
      nextRef.current = null;
    }
  };

  const attachAndPlay = (pos: PlayingPos, player: AudioPlayer, cold: boolean) => {
    wantRef.current = pos;
    startedRef.current = false;
    setPlaying(pos);
    setPaused(false);
    setLoading(cold);
    if (wholeQuranRef.current) setListenPos({ surah: pos.surah, ayah: pos.ayah }); // save the whole-Qur'an resume point each ayah
    const sub = player.addListener('playbackStatusUpdate', (st) => {
      if (!mountedRef.current || !samePos(wantRef.current, pos)) return;
      if (st.playing) {
        if (!startedRef.current) recordActivity('listened'); // counts toward the streak, once per clip
        startedRef.current = true;
        setLoading(false);
        clearFail();
      }
      if (st.didJustFinish) {
        if (fadingRef.current) return; // a fade-out is finishing the clip — don't advance
        if (queueRef.current) advanceQueue();
        else if (onceRef.current) stop();
        else advance(pos);
      }
    });
    currRef.current = { pos, player, sub };
    try {
      player.volume = 1; // reset in case a prior fade-out left a (reused) player turned down
    } catch {}
    try {
      player.play();
    } catch {
      stop();
      return;
    }
    prefetch(nextPos(pos));
    clearFail();
    failRef.current = setTimeout(() => {
      if (mountedRef.current && samePos(wantRef.current, pos) && !startedRef.current) stop();
    }, 8000);
  };

  const advance = (pos: PlayingPos) => {
    const next = nextPos(pos);
    if (!next) {
      stop();
      return;
    }
    const old = currRef.current;
    currRef.current = null;
    const pre = nextRef.current && samePos(nextRef.current.pos, next) ? nextRef.current : null;
    if (pre) nextRef.current = null;
    setTimeout(() => {
      try {
        old?.sub.remove();
      } catch {}
      safeRemove(old?.player);
    }, 0);
    attachAndPlay(next, pre ? pre.player : makePlayer(next), !pre);
  };

  // Playlist step: hard-start the next verse in the queue (a tiny gap between scattered comfort
  // verses is fine — no need for the gapless prefetch the surah-by-surah flow uses).
  const advanceQueue = () => {
    const q = queueRef.current;
    if (!q) return;
    const i = qIdxRef.current + 1;
    if (i < q.length) {
      qIdxRef.current = i;
      void start(q[i]);
    } else {
      stop();
    }
  };

  const start = async (pos: PlayingPos, once = false, whole = false) => {
    if (!mountedRef.current) return;
    if (pos.surah < 1 || pos.surah > LAST_SURAH || pos.ayah < 1 || pos.ayah > ayahCount(pos.surah)) {
      stop();
      return;
    }
    teardown();
    onceRef.current = once;
    // Any non-whole start (tap an ayah, a one-shot, a playlist) ends the whole-Qur'an session, freezing
    // listenPos where it was. Centralised here so every entry point gets it right.
    wholeQuranRef.current = whole;
    setWholeQuran(whole);
    wantRef.current = pos;
    startedRef.current = false;
    setPlaying(pos);
    setPaused(false);
    setLoading(true);
    try {
      if (!audioReadyRef.current) {
        await setAudioModeAsync({ playsInSilentMode: true });
        audioReadyRef.current = true;
      }
      if (!mountedRef.current || !samePos(wantRef.current, pos)) return;
      attachAndPlay(pos, makePlayer(pos), true);
    } catch {
      stop();
    }
  };

  const pause = () => {
    try {
      currRef.current?.player.pause();
      setPaused(true);
    } catch {}
  };
  const resume = () => {
    try {
      currRef.current?.player.play();
      setPaused(false);
    } catch {}
  };
  const playFrom = (surah: number, ayah: number) => {
    queueRef.current = null;
    setQueued(false);
    void start({ surah, ayah });
  };
  // Start / resume the continuous whole-Qur'an "Listen". Marks the session so its progress is saved to
  // listenPos (the resume point), kept separate from lastRead (the reading position). A later manual play
  // (tapping an ayah, etc.) goes through start() with whole=false, which freezes listenPos where it was.
  const playWhole = (surah: number, ayah: number) => {
    queueRef.current = null;
    setQueued(false);
    continuousRef.current = true;
    setContinuousState(true);
    setListenPos({ surah, ayah });
    void start({ surah, ayah }, false, true);
  };
  // Play a curated playlist of (often scattered) verses in order — e.g. a hub's "narrate all".
  const playList = (verses: PlayingPos[]) => {
    const valid = verses.filter(
      (v) => v.surah >= 1 && v.surah <= LAST_SURAH && v.ayah >= 1 && v.ayah <= ayahCount(v.surah),
    );
    if (!valid.length) return;
    queueRef.current = valid;
    qIdxRef.current = 0;
    setQueued(true);
    void start(valid[0]);
  };
  const toggle = (surah: number, ayah: number) => {
    if (playing && playing.surah === surah && playing.ayah === ayah) {
      if (paused) resume();
      else pause();
    } else {
      queueRef.current = null;
      setQueued(false);
      void start({ surah, ayah });
    }
  };
  // One-shot: play just this ayah (stops at the end, never rolls into the next) — for the speaker
  // buttons on chat verse cards and the daily reminder. Same engine = it can't overlap recitation,
  // stories, or voice (whichever starts last wins, the rest are torn down).
  const toggleAyah = (surah: number, ayah: number) => {
    if (playing && playing.surah === surah && playing.ayah === ayah) {
      if (paused) resume();
      else pause();
    } else {
      queueRef.current = null;
      setQueued(false);
      void start({ surah, ayah }, true);
    }
  };
  const setContinuous = (v: boolean) => setContinuousState(v);
  const chooseReciter = (id: string) => {
    const r = RECITERS.find((x) => x.id === id);
    if (!r || r.id === reciter.id) return;
    setReciter(r);
    void setPreferredReciter(id);
    // If something's playing, restart the current ayah in the new voice so the change is heard
    // immediately (folderRef set synchronously since setReciter only applies next render).
    if (wantRef.current) {
      folderRef.current = r.folder;
      void start({ ...wantRef.current }, onceRef.current, wholeQuranRef.current);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      wantRef.current = null;
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    playing,
    paused,
    loading,
    continuous,
    queued,
    wholeQuran,
    reciter,
    playFrom,
    playWhole,
    playList,
    toggle,
    toggleAyah,
    pause,
    resume,
    stop,
    fadeStop,
    setContinuous,
    chooseReciter,
  };
}

export function RecitationProvider({ children }: { children: ReactNode }) {
  const api = useEngine();
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useRecitation(): RecitationApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRecitation must be used within RecitationProvider');
  return v;
}
