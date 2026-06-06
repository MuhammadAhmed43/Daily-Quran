import {
  AudioModule,
  createAudioPlayer,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioPlayer,
} from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { askQuestion, type ChatResponse, type ChatTurn } from '@/lib/chat';
import { haptic } from '@/lib/haptics';
import { useRecitation } from '@/lib/recitation-context';
import { fetchSpokenReply } from '@/lib/speak';
import { recordActivity } from '@/lib/streak';
import { c, font, grad } from '@/lib/theme';
import { transcribeAudio } from '@/lib/voice';
import { pushVoiceExchange } from '@/lib/voice-bridge';
import { streamSpokenReply, type SpokenClip, type VoiceReplyHandle } from '@/lib/voice-reply';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? '').replace(/\/$/, '');

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'denied';

// One streaming spoken-reply turn. The screen owns playback of the in-order clips the
// voice-reply pipeline produces; this holds that turn's mutable state so a stale turn can never
// touch a newer one (every callback checks `cancelled` and that it's still the current pipe).
type VoicePipe = {
  cancelled: boolean;
  items: SpokenClip[]; // ready sentence clips, in order
  playIdx: number; // which clip is playing / up next
  playing: boolean; // a clip is currently playing
  everSpoke: boolean; // has any audio started? (gates the fallback + the safety timer)
  streamDone: boolean; // the answer finished generating + all sentences were synthesized
  logged: boolean; // streak/history/hand-off recorded once
  files: string[]; // temp clip URIs to clean up
  answer: string; // cumulative answer text (kept fresh for the fallback)
  handle: VoiceReplyHandle | null;
  question: string;
};

// The "Andrew" voice speaks ~15 chars/sec; used to estimate how long the reply takes so the
// caption cards keep pace (slightly leading rather than lagging). Streamed MP3s don't report a
// reliable duration, so we estimate.
const CHARS_PER_SEC = 16;
// Minimum time a caption card stays up — guarantees a short card (e.g. the citation) is never
// skipped past unread, while still letting the captions keep up with brisk speech.
const MIN_DWELL = 800;

// Voice-activity detection works RELATIVE to the room's noise floor, since absolute mic dB
// varies wildly by device/room: speech = clearly above ambient, silence = back near ambient.
const SPEECH_MARGIN = 9; // dB above the noise floor that counts as speaking
const SILENCE_MARGIN = 6; // back within this many dB of the floor = silence again
const SILENCE_HOLD = 1400; // ms of CONTINUOUS silence after speech → end of turn (tolerates a breath / mid-sentence pause so we don't cut you off)
const MIN_SPEECH_FRAMES = 6; // need ~0.6s of real speech before we'll answer (noise blips don't)
const NO_SPEECH_TIMEOUT = 12000; // ms with no speech at all → recycle the listen window
const WAVE_BARS = 13; // bars in the live input equalizer shown while you speak
// center-weighted bar heights/opacity, so the equalizer blooms from the middle outward
const BAR_WEIGHTS = Array.from({ length: WAVE_BARS }, (_, i) => {
  const c = (WAVE_BARS - 1) / 2;
  return 1 - (Math.abs(i - c) / (c + 1)) * 0.6;
});
const CAPTION_LEAD = 90; // ms — switch a caption card slightly before its word so it reads as in-sync

function forSpeech(answer: string): string {
  const clean = answer
    .replace(/[*_#>`]/g, '')
    // drop "(2:22)" digit refs — the surah name + "verse N" is what's spoken (matches /api/speak)
    .replace(/\s*\(\d{1,3}:\d{1,3}(?:[-–]\d{1,3})?\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  let out = '';
  for (const s of sentences) {
    if (out && (out + s).length > 320) break;
    out += s;
  }
  return out.trim() || clean.slice(0, 320);
}

// Break the spoken text into caption "cards" of ~2–3 lines. Each card shows whole — it doesn't
// crawl word-by-word — and the next card swaps in as the voice reaches it.
function makeChunks(text: string): string[] {
  const MAX = 104; // ~three lines at the caption font size
  // Sentences — keep a trailing closing quote and any ayah citation attached, so a verse and
  // its "(13:28)" can never be split onto different cards.
  const sentences =
    text.match(
      /[^.!?]+[.!?]+['"”’)\]]*(?:\s*\(\d{1,3}:\d{1,3}(?:[-–]\d{1,3})?\))?|\S[^.!?]*$/g,
    ) || [text];
  // A sentence longer than a card is broken at clause boundaries (, ; :). The citation sits at
  // the end, so it lands on the last piece and stays on screen.
  const pieces: string[] = [];
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length <= MAX) {
      pieces.push(s);
      continue;
    }
    // Split at clause punctuation only when it's FOLLOWED BY SPACE — never inside a "13:28"
    // citation (whose colon has no surrounding space), so the ayah ref stays intact and gold.
    const clauses = s.match(/.*?[,;:](?=\s)|.+$/g) || [s];
    let acc = '';
    for (const raw2 of clauses) {
      const c = raw2.trim();
      if (!c) continue;
      if (acc && (acc + ' ' + c).length > MAX) {
        pieces.push(acc);
        acc = c;
      } else {
        acc = acc ? acc + ' ' + c : c;
      }
    }
    if (acc) pieces.push(acc);
  }
  // Pack short consecutive pieces together up to a card's worth.
  const chunks: string[] = [];
  let cur = '';
  for (const p of pieces) {
    if (cur && (cur + ' ' + p).length > MAX) {
      chunks.push(cur);
      cur = p;
    } else {
      cur = cur ? cur + ' ' + p : p;
    }
  }
  if (cur) chunks.push(cur);
  return chunks.length ? chunks : [text];
}

// Which card should be on screen at progress `frac` (0..1), weighted by card length so a
// long card lingers and a short one passes quickly — keeping the text in step with the voice.
function chunkAt(chunks: string[], frac: number): number {
  const total = chunks.reduce((n, c) => n + c.length, 0) || 1;
  let acc = 0;
  for (let i = 0; i < chunks.length; i++) {
    acc += chunks[i].length;
    if (frac < acc / total) return i;
  }
  return chunks.length - 1;
}

// Match a spoken reference — "Surah Al-Baqara, verse 22" (with optional "the"/leading words) —
// or a bare "(2:22)" — so we can tint it gold in the caption.
const REF_RE = /(Surah\s+[^\s,]+(?:,?\s+verse\s+\d{1,3})?|\(?\d{1,3}:\d{1,3}(?:[-–]\d{1,3})?\)?)/g;
const isRef = (s: string) =>
  /^(Surah\s+[^\s,]+(?:,?\s+verse\s+\d{1,3})?|\(?\d{1,3}:\d{1,3}(?:[-–]\d{1,3})?\)?)$/.test(s);

// Render a card, tinting any verse reference ("Surah Al-Baqara, verse 22" or "(13:28)") gold.
function renderCaption(text: string) {
  return text.split(REF_RE).map((part, i) =>
    isRef(part) ? (
      <Text key={i} style={styles.captionRef}>
        {part}
      </Text>
    ) : (
      <Text key={i}>{part}</Text>
    ),
  );
}

// Whisper invents "Thank you" / "you" etc. on (near-)silent clips.
function isJunk(t: string): boolean {
  const s = t
    .trim()
    .toLowerCase()
    .replace(/[.!?…]+$/, '')
    .trim();
  if (s.length < 4) return true; // too short to be a real question
  return /^(thank you( so much| very much| for watching)?|thanks( for watching)?|you|bye( bye)?|okay|ok|uh+|um+|hmm+|mm+|ah+|oh+|yeah|yes|no|so|the|a|i|please subscribe.*|subscribe.*|♪.*)$/.test(
    s,
  );
}

// Map each caption card to the moment its first word is spoken, using msedge word timestamps
// (ms). Falls back to a duration-proportional split when no per-word marks are available.
function buildCardTimes(
  cards: string[],
  spoken: string,
  marks: { t: number }[],
  dur: number,
): number[] {
  const times = new Array<number>(cards.length).fill(0);
  const words = spoken.split(/\s+/).filter(Boolean);
  if (marks.length > 0 && words.length > 0) {
    const ratio = marks.length / words.length;
    let wi = 0;
    for (let k = 0; k < cards.length; k++) {
      const mi = Math.min(marks.length - 1, Math.max(0, Math.round(wi * ratio)));
      times[k] = marks[mi] ? marks[mi].t : 0;
      wi += cards[k].split(/\s+/).filter(Boolean).length;
    }
    times[0] = 0; // first card shows the instant the voice starts
  } else {
    const total = cards.reduce((n, c) => n + c.length, 0) || 1;
    const D = dur > 0 ? dur : (total / CHARS_PER_SEC) * 1000;
    let acc = 0;
    for (let k = 0; k < cards.length; k++) {
      times[k] = (acc / total) * D;
      acc += cards[k].length;
    }
  }
  return times;
}

export default function VoiceScreen() {
  const router = useRouter();
  const recitation = useRecitation();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recState = useAudioRecorderState(recorder, 90);

  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [note, setNote] = useState('');
  const [chunks, setChunks] = useState<string[]>([]);
  const [chunkIdx, setChunkIdx] = useState(0);
  const [muted, setMuted] = useState(false);

  const phaseRef = useRef<Phase>('idle');
  const mutedRef = useRef(false);
  const speechStartedRef = useRef(false); // has the user begun speaking this turn?
  const silenceStartRef = useRef(0); // when silence began after speech (ms)
  const listenStartRef = useRef(0); // when the current listen started (ms)
  const lvlRef = useRef(-50); // smoothed mic level (dB)
  const floorRef = useRef(-50); // adaptive noise floor (dB)
  const speechFramesRef = useRef(0); // consecutive frames above the speech margin
  const speechTotalRef = useRef(0); // total speech frames this turn (must clear MIN_SPEECH_FRAMES)
  const lvlBufRef = useRef<number[]>([]); // recent smoothed levels, for a percentile noise floor
  const transcriptTimerRef = useRef<ReturnType<typeof setInterval> | null>(null); // word-by-word reveal
  const barsRef = useRef<Animated.Value[]>(
    Array.from({ length: WAVE_BARS }, () => new Animated.Value(0.12)),
  );
  const barSmoothRef = useRef<number[]>(new Array(WAVE_BARS).fill(0.12));
  const cardTimesRef = useRef<number[]>([]); // ms onset of each caption card (true word sync)
  const meterRef = useRef(-60);
  const smoothRef = useRef(0.2);
  const historyRef = useRef<ChatTurn[]>([]);
  const chunksRef = useRef<string[]>([]);
  const estTotalRef = useRef(1); // estimated speech length in seconds, for caption pacing
  const dispRef = useRef(0); // index of the card currently shown (advances monotonically)
  const dwellRef = useRef(0); // when that card appeared (ms), for the MIN_DWELL floor
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const capTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  // The reply player is created ON DEMAND (only while speaking) and removed before listening,
  // so no audio player ever holds the iOS audio session while the mic needs to record.
  const playerRef = useRef<AudioPlayer | null>(null);
  const subRef = useRef<{ remove: () => void } | null>(null);
  // Streaming spoken-reply pipeline (the low-latency path): current turn + its first-audio safety
  // timer + a throttle so we warm the serverless functions during listening, not on every frame.
  const voicePipeRef = useRef<VoicePipe | null>(null);
  const firstAudioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWarmRef = useRef(0);
  const intensity = useRef(new Animated.Value(0.12)).current;
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const rafRef = useRef<number | null>(null);
  const t0Ref = useRef(0);
  const envRef = useRef(0.12);
  const burstRef = useRef(0); // momentary swell when a new spoken sentence begins

  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const teardownPlayer = () => {
    try {
      subRef.current?.remove();
    } catch {}
    subRef.current = null;
    try {
      playerRef.current?.pause(); // pause before remove so the reply audio can't linger
    } catch {}
    try {
      playerRef.current?.remove();
    } catch {}
    playerRef.current = null;
  };

  useEffect(() => {
    if (typeof recState.metering === 'number') meterRef.current = recState.metering;
  }, [recState.metering]);

  // ---- orb pulse ----
  // One rAF-driven, sum-of-sines envelope makes the orb breathe and swell smoothly and
  // continuously — like ChatGPT's voice orb — instead of jerky random steps. The whole envelope
  // is low-passed each frame so phase changes glide rather than snap. (This screen is light, so
  // a JS-thread rAF stays buttery here — unlike the heavy reader ScrollView.)
  const pulse = () => {
    if (!mountedRef.current) return;
    const t = (Date.now() - t0Ref.current) / 1000;
    const phase = phaseRef.current;
    let target: number;
    if (phase === 'speaking') {
      // a quick, speech-like flutter + a swell on each new spoken sentence (burstRef, set in
      // advanceCaption) — so the moon visibly tracks the cadence of the speech, not just breathes
      const flutter =
        0.09 * Math.sin(t * 11.0) + 0.06 * Math.sin(t * 17.3 + 1.1) + 0.05 * Math.sin(t * 6.5 + 2.0);
      target = 0.42 + flutter + burstRef.current;
    } else if (phase === 'listening') {
      const raw = Math.max(0, Math.min(1, (meterRef.current + 50) / 45));
      smoothRef.current = smoothRef.current * 0.82 + raw * 0.18;
      target = 0.14 + smoothRef.current * 0.62 + 0.025 * Math.sin(t * 3.0);
    } else if (phase === 'thinking') {
      target = 0.3 + 0.12 * Math.sin(t * 2.4);
    } else {
      target = 0.13 + 0.05 * Math.sin(t * 1.3); // idle / denied — gentle breathing
    }
    burstRef.current *= 0.92; // the per-sentence swell decays quickly
    // smooth while speaking, but settle back to calm quickly once speech stops (no laggy drift)
    const k = phase === 'speaking' ? 0.16 : 0.32;
    envRef.current += (target - envRef.current) * k;
    intensity.setValue(envRef.current);
    // listening equalizer: smooth 60fps bars driven by the live mic level (rest flat otherwise)
    const lvl = phase === 'listening' ? smoothRef.current : 0;
    for (let i = 0; i < WAVE_BARS; i++) {
      const flut =
        phase === 'listening' ? 0.12 * (0.5 + 0.5 * Math.sin(t * (6 + i * 0.6) + i * 1.3)) : 0;
      const tgt = phase === 'listening' ? 0.16 + lvl * BAR_WEIGHTS[i] * 0.95 + flut * lvl : 0.1;
      const nv = barSmoothRef.current[i] + (tgt - barSmoothRef.current[i]) * 0.28;
      barSmoothRef.current[i] = nv;
      barsRef.current[i].setValue(nv);
    }
    rafRef.current = requestAnimationFrame(pulse);
  };
  // Phase changes just set the phase now (via go()) — the pulse loop reads phaseRef and follows,
  // so this is a no-op kept only so existing call sites stay tidy.
  const stopAnim = () => {};

  // ---- caption pacing ----
  const resetCaption = () => {
    dispRef.current = 0;
    dwellRef.current = Date.now();
    setChunkIdx(0);
  };
  // Move toward `frac` (0..1) of the reply, but only ever FORWARD and at most one card per
  // MIN_DWELL — so a lurch in the estimate can never skip a card (the citation included).
  const advanceCaption = (frac: number) => {
    const cs = chunksRef.current;
    const target = chunkAt(cs, frac);
    const now = Date.now();
    if (target > dispRef.current && now - dwellRef.current >= MIN_DWELL) {
      dispRef.current = Math.min(dispRef.current + 1, cs.length - 1);
      dwellRef.current = now;
      setChunkIdx(dispRef.current);
      burstRef.current = 0.32; // a new sentence is being spoken → swell the moon
    }
  };
  const restCaptionAtEnd = () => {
    if (capTimerRef.current) {
      clearInterval(capTimerRef.current);
      capTimerRef.current = null;
    }
    dispRef.current = Math.max(0, chunksRef.current.length - 1);
    setChunkIdx(dispRef.current);
  };
  // True word-synced switch: show the latest card whose first word the voice has reached (ms).
  const syncCaption = (ms: number) => {
    const times = cardTimesRef.current;
    if (times.length === 0) return;
    let idx = 0;
    for (let i = 0; i < times.length; i++) {
      if (ms >= times[i] - CAPTION_LEAD) idx = i;
      else break;
    }
    if (idx > dispRef.current) {
      dispRef.current = idx;
      dwellRef.current = Date.now();
      setChunkIdx(idx);
      burstRef.current = 0.32; // swell the moon as a new card begins
    }
  };
  // Caption fallback for on-device speech (no audio-progress events): walk frac over an estimate.
  const startTimedCaption = () => {
    if (capTimerRef.current) clearInterval(capTimerRef.current);
    resetCaption();
    const cs = chunksRef.current;
    if (cs.length <= 1) return;
    const totalChars = cs.reduce((n, c) => n + c.length, 0) || 1;
    const totalMs = Math.max(1500, (totalChars / CHARS_PER_SEC) * 1000);
    const start = Date.now();
    capTimerRef.current = setInterval(() => {
      const frac = Math.min(1, (Date.now() - start) / totalMs);
      advanceCaption(frac);
      if (frac >= 1 && capTimerRef.current) {
        clearInterval(capTimerRef.current);
        capTimerRef.current = null;
      }
    }, 200);
  };

  // ---- conversation: auto-listen, detect when you stop speaking, then answer (no tapping) ----
  const startListening = async () => {
    if (!mountedRef.current || mutedRef.current) return;
    try {
      stopAnim();
      Speech.stop();
      teardownPlayer();
      cancelVoicePipeline(); // a previous reply must never bleed into the new turn
      if (capTimerRef.current) clearInterval(capTimerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      if (transcriptTimerRef.current) {
        clearInterval(transcriptTimerRef.current);
        transcriptTimerRef.current = null;
      }
      setNote('');
      setTranscript('');
      setChunks([]);
      setChunkIdx(0);
      chunksRef.current = [];
      smoothRef.current = 0.2;
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      if (!mountedRef.current || mutedRef.current) return;
      await recorder.prepareToRecordAsync();
      recorder.record();
      go('listening');
      warm(); // spin up the serverless functions while the user speaks → no cold start after
      // Voice-activity detection: once you've begun speaking, a short pause ends the turn.
      speechStartedRef.current = false;
      silenceStartRef.current = 0;
      listenStartRef.current = Date.now();
      lvlRef.current = -50;
      floorRef.current = -50;
      speechFramesRef.current = 0;
      speechTotalRef.current = 0;
      lvlBufRef.current = [];
      tickRef.current = setInterval(() => {
        if (phaseRef.current !== 'listening') return;
        const now = Date.now();
        const age = now - listenStartRef.current;
        lvlRef.current = lvlRef.current * 0.6 + meterRef.current * 0.4;
        if (age < 300) {
          // the mic's cold-start readings (e.g. -96) are garbage — let it settle before measuring
          return;
        }
        // floor = 20th-percentile of the last ~4s of levels: a robust "quiet reference" that sits
        // above brief dropouts but below speech, and keeps a quiet anchor even through a long
        // sentence — so a real pause clearly drops back down to it.
        lvlBufRef.current.push(lvlRef.current);
        if (lvlBufRef.current.length > 40) lvlBufRef.current.shift();
        if (lvlBufRef.current.length >= 5) {
          const sorted = [...lvlBufRef.current].sort((a, b) => a - b);
          floorRef.current = sorted[Math.floor(sorted.length * 0.2)];
        } else {
          floorRef.current = lvlRef.current;
        }
        const above = lvlRef.current - floorRef.current; // dB above ambient
        if (above > SPEECH_MARGIN) {
          speechFramesRef.current += 1;
          speechTotalRef.current += 1;
          if (speechFramesRef.current >= 2) speechStartedRef.current = true; // need it sustained
          silenceStartRef.current = 0;
        } else {
          speechFramesRef.current = 0;
          if (speechStartedRef.current && above < SILENCE_MARGIN) {
            if (silenceStartRef.current === 0) silenceStartRef.current = now;
            else if (now - silenceStartRef.current > SILENCE_HOLD) endTurn();
          }
        }
        // safety: never hang in "Listening" — cap a single turn even if the pause isn't detected
        if (speechStartedRef.current && now - listenStartRef.current > 30000) endTurn();
        // nothing said for a while → recycle the recording (stay listening, don't grow a huge file)
        if (!speechStartedRef.current && now - listenStartRef.current > NO_SPEECH_TIMEOUT) {
          if (tickRef.current) {
            clearInterval(tickRef.current);
            tickRef.current = null;
          }
          recorder.stop().catch(() => {});
          relisten();
        }
      }, 100);
    } catch {
      go('idle');
    }
  };

  // Continuous conversation: after a reply (or a missed turn), listen again unless muted.
  const relisten = () => {
    if (!mutedRef.current && mountedRef.current) setTimeout(() => void startListening(), 500);
  };

  // End the listening turn: answer only if there was enough REAL speech; otherwise it was just
  // noise/silence — recycle the mic rather than transcribe (and answer) gibberish.
  const endTurn = () => {
    if (speechTotalRef.current >= MIN_SPEECH_FRAMES) {
      void stopListeningAndProcess();
    } else {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      recorder.stop().catch(() => {});
      relisten();
    }
  };

  // Reveal the recognized question word-by-word. Expo Go can't stream live partial speech, so
  // rather than dropping the whole transcript as a block, we animate it building in — which runs
  // concurrently with the chat request, so the question "types out" while the answer is fetched.
  const revealTranscript = (full: string) => {
    if (transcriptTimerRef.current) clearInterval(transcriptTimerRef.current);
    const words = full.split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
      setTranscript(full);
      return;
    }
    let i = 0;
    setTranscript('');
    transcriptTimerRef.current = setInterval(() => {
      i += 1;
      setTranscript(words.slice(0, i).join(' '));
      if (i >= words.length) {
        if (transcriptTimerRef.current) clearInterval(transcriptTimerRef.current);
        transcriptTimerRef.current = null;
      }
    }, 65);
  };

  const stopListeningAndProcess = async () => {
    if (phaseRef.current !== 'listening') return;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    go('thinking');
    // Transcribe the clip. A transcription failure recycles the mic; once we have a question, the
    // reply pipeline owns its own error handling (and falls back to the buffered path).
    let text = '';
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('no audio');
      text = (await transcribeAudio(uri)).trim();
    } catch {
      if (!mountedRef.current) return;
      setNote('Something went wrong.');
      go('idle');
      relisten();
      return;
    }
    if (!mountedRef.current) return;
    if (!text || isJunk(text)) {
      setNote('I didn’t catch that.');
      go('idle');
      relisten();
      return;
    }
    revealTranscript(text); // types the question out while the answer streams + speaks
    setNote('');
    void playReplyStreaming(text);
  };

  // ---- low-latency streaming reply: stream the answer + speak it sentence-by-sentence ----
  const safeDeleteUri = (uri: string) => {
    try {
      new File(uri).delete();
    } catch {}
  };
  const cleanupFiles = (pipe: VoicePipe) => {
    for (const u of pipe.files.splice(0)) safeDeleteUri(u);
  };

  // Tear down any in-flight streaming reply (a new turn, mute, or close). Aborts the chat stream +
  // synth, deletes orphan clips, and clears the latency timers so nothing from the old turn fires.
  const cancelVoicePipeline = () => {
    const pipe = voicePipeRef.current;
    if (pipe) {
      pipe.cancelled = true;
      try {
        pipe.handle?.cancel();
      } catch {}
      cleanupFiles(pipe);
      voicePipeRef.current = null;
    }
    if (firstAudioTimerRef.current) {
      clearTimeout(firstAudioTimerRef.current);
      firstAudioTimerRef.current = null;
    }
    if (failTimerRef.current) {
      clearTimeout(failTimerRef.current);
      failTimerRef.current = null;
    }
  };

  // Warm the serverless functions DURING listening so the first real round-trip (transcribe → chat
  // → speak) doesn't pay a cold start. Each GET hits the function's fast early-return; throttled.
  const warm = () => {
    if (!API_BASE) return;
    const now = Date.now();
    if (now - lastWarmRef.current < 60000) return;
    lastWarmRef.current = now;
    const ctrl = new AbortController();
    setTimeout(() => {
      try {
        ctrl.abort();
      } catch {}
    }, 4000);
    for (const p of ['/api/transcribe', '/api/chat', '/api/speak']) {
      fetch(`${API_BASE}${p}`, { method: 'GET', signal: ctrl.signal }).catch(() => {});
    }
  };

  // Record the turn ONCE (streak + conversation history + chat hand-off) — guarded so the streaming
  // and fallback paths can never double-log the same turn.
  const logTurn = (pipe: VoicePipe, answer: string, response: ChatResponse) => {
    if (pipe.logged) return;
    pipe.logged = true;
    recordActivity('asked');
    historyRef.current.push(
      { role: 'user', content: pipe.question },
      { role: 'assistant', content: answer },
    );
    pushVoiceExchange({ question: pipe.question, response });
  };

  // Play the next ready clip; if the queue is drained AND the stream is done, finish the reply.
  const pumpPipe = (pipe: VoicePipe) => {
    if (pipe.cancelled || !mountedRef.current || voicePipeRef.current !== pipe) return;
    if (pipe.playing) return;
    const item = pipe.items[pipe.playIdx];
    if (!item) {
      if (pipe.streamDone) finishPipe(pipe);
      return; // otherwise wait — more clips are still arriving
    }
    pipe.playing = true;

    // captions for THIS sentence — word-synced via its own marks, or paced off an estimate
    const cs = makeChunks(item.spoken);
    chunksRef.current = cs;
    cardTimesRef.current = buildCardTimes(cs, item.spoken, item.marks, item.dur);
    estTotalRef.current = Math.max(1.2, (item.dur || (item.spoken.length / CHARS_PER_SEC) * 1000) / 1000);
    setChunks(cs);
    resetCaption();

    let finishedOnce = false;
    try {
      const player = createAudioPlayer({ uri: item.uri }, { updateInterval: 90 });
      playerRef.current = player;
      subRef.current = player.addListener('playbackStatusUpdate', (st) => {
        if (pipe.cancelled || !mountedRef.current || voicePipeRef.current !== pipe) return;
        if (st.playing && phaseRef.current === 'thinking') {
          // the first clip of the reply has begun — stop the safety timer, switch to "Speaking"
          if (firstAudioTimerRef.current) {
            clearTimeout(firstAudioTimerRef.current);
            firstAudioTimerRef.current = null;
          }
          pipe.everSpoke = true;
          go('speaking');
          haptic.light();
        }
        if (phaseRef.current === 'speaking' && st.currentTime > 0) {
          if (cardTimesRef.current.length) syncCaption(st.currentTime * 1000);
          else advanceCaption(st.currentTime / estTotalRef.current);
        }
        if (st.didJustFinish && !finishedOnce) {
          finishedOnce = true;
          teardownPlayer();
          safeDeleteUri(item.uri);
          pipe.playing = false;
          pipe.playIdx += 1;
          pumpPipe(pipe);
        }
      });
      player.play();
    } catch {
      // couldn't create/play this clip — skip it and keep the reply moving
      teardownPlayer();
      safeDeleteUri(item.uri);
      pipe.playing = false;
      pipe.playIdx += 1;
      pumpPipe(pipe);
    }
  };

  const finishPipe = (pipe: VoicePipe) => {
    if (pipe.cancelled || !mountedRef.current || voicePipeRef.current !== pipe) return;
    if (pipe.playing || pipe.playIdx < pipe.items.length || !pipe.streamDone) return;
    // If NOTHING was ever spoken (every sentence's TTS failed) fall back so the user still hears it.
    if (!pipe.everSpoke) {
      if (pipe.answer.trim()) {
        fallbackToBuffered(pipe);
        return;
      }
      voicePipeRef.current = null;
      cleanupFiles(pipe);
      go('idle');
      relisten();
      return;
    }
    voicePipeRef.current = null;
    restCaptionAtEnd();
    cleanupFiles(pipe);
    go('idle');
    relisten();
  };

  // Safety net: abandon the streaming pipeline and use the proven buffered path (which itself falls
  // back to on-device speech). Triggered by a stream error or the first-audio deadline.
  const fallbackToBuffered = (pipe: VoicePipe) => {
    if (pipe.cancelled) return;
    pipe.cancelled = true;
    try {
      pipe.handle?.cancel();
    } catch {}
    if (firstAudioTimerRef.current) {
      clearTimeout(firstAudioTimerRef.current);
      firstAudioTimerRef.current = null;
    }
    teardownPlayer();
    cleanupFiles(pipe);
    if (voicePipeRef.current === pipe) voicePipeRef.current = null;

    const partial = pipe.answer.trim();
    if (partial) {
      logTurn(pipe, partial, { answer: partial, verses: [], tafsir: [], video: null, disclaimer: '' });
      void playBuffered(partial);
      return;
    }
    // no text at all yet → the original full round-trip (buffered chat → buffered TTS → on-device)
    go('thinking');
    void (async () => {
      try {
        const data = await askQuestion(pipe.question, historyRef.current.slice(-6), { voice: true });
        if (!mountedRef.current) return;
        logTurn(pipe, data.answer, data);
        void playBuffered(data.answer);
      } catch {
        if (!mountedRef.current) return;
        setNote('Something went wrong.');
        go('idle');
        relisten();
      }
    })();
  };

  // The fast path: stream the grounded answer and speak it sentence-by-sentence as it generates.
  const playReplyStreaming = async (question: string) => {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    if (!mountedRef.current) return;
    teardownPlayer();

    const pipe: VoicePipe = {
      cancelled: false,
      items: [],
      playIdx: 0,
      playing: false,
      everSpoke: false,
      streamDone: false,
      logged: false,
      files: [],
      answer: '',
      handle: null,
      question,
    };
    voicePipeRef.current = pipe;

    if (firstAudioTimerRef.current) clearTimeout(firstAudioTimerRef.current);
    // if no audio has started within 10s, abandon streaming for the buffered path — never hang
    firstAudioTimerRef.current = setTimeout(() => {
      if (!mountedRef.current || pipe.cancelled || pipe.everSpoke) return;
      fallbackToBuffered(pipe);
    }, 10000);

    pipe.handle = streamSpokenReply({
      question,
      history: historyRef.current.slice(-6),
      onText: (full) => {
        if (!pipe.cancelled) pipe.answer = full;
      },
      onClip: (clip) => {
        if (pipe.cancelled || !mountedRef.current) {
          safeDeleteUri(clip.uri);
          return;
        }
        pipe.items.push(clip);
        pipe.files.push(clip.uri);
        pumpPipe(pipe);
      },
      onDone: (m) => {
        if (pipe.cancelled || !mountedRef.current) return;
        pipe.answer = m.answer;
        pipe.streamDone = true;
        logTurn(pipe, m.answer, {
          answer: m.answer,
          verses: m.verses,
          tafsir: m.tafsir,
          video: m.video,
          disclaimer: m.disclaimer,
        });
        pumpPipe(pipe); // play next, or finish if there is nothing left to play
      },
      onError: () => {
        if (pipe.cancelled || !mountedRef.current) return;
        fallbackToBuffered(pipe);
      },
    });
  };

  // Buffered fallback: synthesize the WHOLE reply at once via /api/speak (on-demand player), with
  // on-device speech if that's slow or fails. The streaming path above falls back to this; it's the
  // original, proven path kept intact as the safety net.
  const playBuffered = async (full: string) => {
    const speakText = forSpeech(full);
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    teardownPlayer();
    if (failTimerRef.current) clearTimeout(failTimerRef.current);
    // overall guard: if nothing is speaking within 15s, fall back to on-device speech
    failTimerRef.current = setTimeout(() => {
      if (mountedRef.current && phaseRef.current === 'thinking') {
        teardownPlayer();
        speakOnDevice(speakText);
      }
    }, 15000);

    // Preferred path: fetch the audio as a LOCAL file + per-word timestamps → true caption sync.
    const reply = await fetchSpokenReply(speakText);
    if (!mountedRef.current) return;

    let srcUri: string;
    if (reply) {
      const cs = makeChunks(reply.spoken);
      chunksRef.current = cs;
      cardTimesRef.current = buildCardTimes(cs, reply.spoken, reply.marks, reply.dur);
      estTotalRef.current = Math.max(
        1.2,
        (reply.dur || (reply.spoken.length / CHARS_PER_SEC) * 1000) / 1000,
      );
      setChunks(cs);
      setChunkIdx(0);
      srcUri = reply.uri;
    } else {
      // marks endpoint unavailable → stream the audio (Andrew voice) and pace off an estimate
      const cs = makeChunks(speakText);
      chunksRef.current = cs;
      cardTimesRef.current = [];
      estTotalRef.current = Math.max(1.2, speakText.length / CHARS_PER_SEC);
      setChunks(cs);
      setChunkIdx(0);
      srcUri = `${API_BASE}/api/speak?text=${encodeURIComponent(speakText)}`;
    }

    try {
      const player = createAudioPlayer({ uri: srcUri }, { updateInterval: 90 });
      playerRef.current = player;
      subRef.current = player.addListener('playbackStatusUpdate', (st) => {
        if (!mountedRef.current) return;
        if (st.playing && phaseRef.current === 'thinking') {
          if (failTimerRef.current) {
            clearTimeout(failTimerRef.current);
            failTimerRef.current = null;
          }
          go('speaking');
          haptic.light(); // gentle cue that the reply is starting
          resetCaption();
        }
        if (phaseRef.current === 'speaking' && st.currentTime > 0) {
          // word-synced when we have real timestamps; otherwise proportional to the estimate
          if (cardTimesRef.current.length) syncCaption(st.currentTime * 1000);
          else advanceCaption(st.currentTime / estTotalRef.current);
        }
        if (st.didJustFinish) {
          teardownPlayer();
          restCaptionAtEnd();
          go('idle');
          relisten();
        }
      });
      player.play();
    } catch {
      if (failTimerRef.current) {
        clearTimeout(failTimerRef.current);
        failTimerRef.current = null;
      }
      speakOnDevice(reply ? reply.spoken : speakText);
    }
  };

  const speakOnDevice = (text: string) => {
    go('speaking');
    haptic.light();
    startTimedCaption();
    Speech.stop();
    Speech.speak(text, {
      rate: 0.95,
      onDone: () => {
        if (mountedRef.current && phaseRef.current === 'speaking') {
          restCaptionAtEnd();
          go('idle');
          relisten();
        }
      },
      onError: () => {
        if (mountedRef.current && phaseRef.current === 'speaking') {
          go('idle');
          relisten();
        }
      },
    });
  };

  useEffect(() => {
    mountedRef.current = true;
    recitation.stop(); // voice mode needs the mic — never let recitation play (or hold the session) under it
    t0Ref.current = Date.now();
    rafRef.current = requestAnimationFrame(pulse);
    (async () => {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        go('denied');
        return;
      }
      void startListening();
    })();
    return () => {
      mountedRef.current = false;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      if (capTimerRef.current) clearInterval(capTimerRef.current);
      if (failTimerRef.current) clearTimeout(failTimerRef.current);
      if (transcriptTimerRef.current) clearInterval(transcriptTimerRef.current);
      stopAnim();
      Speech.stop();
      teardownPlayer();
      cancelVoicePipeline();
      recorder.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ambient ripples radiating from the orb — a calm, alive "I'm here, listening" pulse.
  useEffect(() => {
    const loop = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: 2800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
    const a = loop(ripple1, 0);
    const b = loop(ripple2, 1400);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [ripple1, ripple2]);

  const toggleMute = () => {
    haptic.medium();
    if (mutedRef.current) {
      mutedRef.current = false;
      setMuted(false);
      if (phaseRef.current === 'idle' || phaseRef.current === 'denied') void startListening();
    } else {
      mutedRef.current = true;
      setMuted(true);
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      cancelVoicePipeline(); // stop a streaming reply mid-speech too, not just a listening session
      Speech.stop();
      teardownPlayer();
      if (phaseRef.current === 'listening') recorder.stop().catch(() => {});
      go('idle');
    }
  };

  const close = () => {
    mountedRef.current = false;
    if (tickRef.current) clearInterval(tickRef.current);
    if (capTimerRef.current) clearInterval(capTimerRef.current);
    if (failTimerRef.current) clearTimeout(failTimerRef.current);
    if (transcriptTimerRef.current) clearInterval(transcriptTimerRef.current);
    stopAnim();
    Speech.stop();
    teardownPlayer();
    cancelVoicePipeline();
    recorder.stop().catch(() => {});
    router.back();
  };

  const status = muted
    ? 'Mic off — tap the mic to talk'
    : phase === 'listening'
      ? "I'm listening"
      : phase === 'thinking'
        ? 'Thinking…'
        : phase === 'speaking'
          ? 'Speaking…'
          : phase === 'denied'
            ? 'Microphone access is needed'
            : "I'm listening";

  const orbScale = intensity.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.28] });
  const rscale1 = ripple1.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.7] });
  const rop1 = ripple1.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.5, 0] });
  const rscale2 = ripple2.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.7] });
  const rop2 = ripple2.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.5, 0] });
  const capText =
    (phase === 'speaking' || phase === 'idle') && chunks.length
      ? chunks[Math.min(chunkIdx, chunks.length - 1)]
      : '';

  return (
    <View style={styles.fill}>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
      <SafeAreaView style={styles.fill}>
        <Text style={styles.brand}>Voice</Text>

        {transcript ? (
          <Text style={styles.transcript} numberOfLines={2}>
            “{transcript}”
          </Text>
        ) : phase === 'listening' && !muted ? (
          <View style={styles.waveRow}>
            {barsRef.current.map((v, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.waveBar,
                  { opacity: 0.45 + 0.45 * BAR_WEIGHTS[i], transform: [{ scaleY: v }] },
                ]}
              />
            ))}
          </View>
        ) : (
          <View style={styles.transcriptPad} />
        )}

        <View style={styles.center}>
          <View style={styles.orbStage}>
            <Animated.View style={[styles.ripple, { transform: [{ scale: rscale1 }], opacity: rop1 }]} pointerEvents="none" />
            <Animated.View style={[styles.ripple, { transform: [{ scale: rscale2 }], opacity: rop2 }]} pointerEvents="none" />
            <Animated.View style={[styles.orbGlow, { transform: [{ scale: orbScale }] }]}>
              <LinearGradient colors={c.goldGrad} start={grad.diagStart} end={grad.diagEnd} style={styles.orb} />
            </Animated.View>
          </View>

          <Text style={styles.status}>{status}</Text>

          <View style={styles.captionWrap}>
            {note ? (
              <Text style={styles.note}>{note}</Text>
            ) : capText ? (
              <Text style={styles.caption} numberOfLines={3}>
                {renderCaption(capText)}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.controls}>
          <Pressable onPress={close} hitSlop={12} style={styles.ctrlBtn}>
            <Ionicons name="close" size={26} color={c.textPrimary} />
          </Pressable>
          <Pressable
            onPress={toggleMute}
            hitSlop={12}
            style={[styles.micBtn, muted && styles.micBtnOff]}>
            {!muted ? (
              <LinearGradient colors={c.goldGrad} start={grad.diagStart} end={grad.diagEnd} style={StyleSheet.absoluteFill} />
            ) : null}
            <Ionicons name={muted ? 'mic-off' : 'mic'} size={28} color={muted ? c.textSecondary : c.bg} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: c.bg },
  brand: {
    fontFamily: font.sansSemi,
    color: c.textSecondary,
    fontSize: 14,
    letterSpacing: 1,
    textAlign: 'center',
    paddingTop: 10,
  },

  transcript: {
    fontFamily: font.serifItalic,
    color: c.textSecondary,
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 28,
    marginTop: 18,
  },
  transcriptPad: { height: 40, marginTop: 18 },
  waveRow: {
    height: 40,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  waveBar: { width: 3, height: 28, borderRadius: 2, backgroundColor: c.accent },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  orbStage: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  ripple: { position: 'absolute', width: 188, height: 188, borderRadius: 94, borderWidth: 1.5, borderColor: 'rgba(201,189,166,0.5)' },
  orbGlow: {
    width: 168,
    height: 168,
    borderRadius: 84,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 40,
    shadowOpacity: 0.55,
  },
  orb: {
    width: 168,
    height: 168,
    borderRadius: 84,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },

  status: {
    fontFamily: font.sansMed,
    color: c.textMuted,
    fontSize: 15,
    textAlign: 'center',
    letterSpacing: 0.3,
    marginTop: 24,
  },

  captionWrap: { minHeight: 112, justifyContent: 'center', paddingHorizontal: 28, paddingTop: 14 },
  caption: { fontFamily: font.serifReg, color: c.scriptureInk, fontSize: 17, lineHeight: 26, textAlign: 'center' },
  captionRef: { fontFamily: font.sansSemi, color: c.accent },
  note: { fontFamily: font.sans, color: c.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingTop: 10,
    paddingBottom: 28,
  },
  ctrlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.hairline,
  },
  micBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  micBtnOff: { backgroundColor: c.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: c.hairline },
});
