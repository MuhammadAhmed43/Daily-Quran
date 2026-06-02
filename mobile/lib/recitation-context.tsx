// App-level recitation player. Lives above the navigator so audio keeps playing as you move
// between screens, with one source of truth for "what's playing". It's Qur'an-aware: it tracks
// a {surah, ayah} position, advances ayah-by-ayah, and (in continuous mode) flows from one
// surah into the next — prefetching the upcoming clip so the hand-off stays gapless, even
// across a surah boundary.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { getSurah } from '@/lib/quran';
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
  reciter: Reciter;
  playFrom: (surah: number, ayah: number) => void;
  toggle: (surah: number, ayah: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
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
  const [reciter, setReciter] = useState<Reciter>(DEFAULT_RECITER);

  const continuousRef = useRef(continuous);
  continuousRef.current = continuous;
  const folderRef = useRef(reciter.folder);
  folderRef.current = reciter.folder;

  const currRef = useRef<{ pos: PlayingPos; player: AudioPlayer; sub: { remove: () => void } } | null>(null);
  const nextRef = useRef<{ pos: PlayingPos; player: AudioPlayer } | null>(null);
  const wantRef = useRef<PlayingPos | null>(null);
  const startedRef = useRef(false);
  const failRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    dropCurr();
    dropNext();
  };
  const stop = () => {
    wantRef.current = null;
    teardown();
    if (!mountedRef.current) return;
    setPlaying(null);
    setPaused(false);
    setLoading(false);
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
    const sub = player.addListener('playbackStatusUpdate', (st) => {
      if (!mountedRef.current || !samePos(wantRef.current, pos)) return;
      if (st.playing) {
        startedRef.current = true;
        setLoading(false);
        clearFail();
      }
      if (st.didJustFinish) advance(pos);
    });
    currRef.current = { pos, player, sub };
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

  const start = async (pos: PlayingPos) => {
    if (!mountedRef.current) return;
    if (pos.surah < 1 || pos.surah > LAST_SURAH || pos.ayah < 1 || pos.ayah > ayahCount(pos.surah)) {
      stop();
      return;
    }
    teardown();
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
    void start({ surah, ayah });
  };
  const toggle = (surah: number, ayah: number) => {
    if (playing && playing.surah === surah && playing.ayah === ayah) {
      if (paused) resume();
      else pause();
    } else {
      void start({ surah, ayah });
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
      void start({ ...wantRef.current });
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
    reciter,
    playFrom,
    toggle,
    pause,
    resume,
    stop,
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
