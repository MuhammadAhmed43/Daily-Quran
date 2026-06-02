import {
  AudioModule,
  createAudioPlayer,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioPlayer,
} from 'expo-audio';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { askQuestion, type ChatTurn } from '@/lib/chat';
import { useRecitation } from '@/lib/recitation-context';
import { transcribeAudio } from '@/lib/voice';
import { pushVoiceExchange } from '@/lib/voice-bridge';

const BG = '#000000';
const CRESCENT = require('../assets/voice/crescent-2.jpg');
const API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? '').replace(/\/$/, '');

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'denied';

// Slow "Christopher" voice speaks ~12 chars/sec; used to estimate how long the reply takes so
// the caption cards keep pace. (Streamed MP3s don't report a reliable duration, so we estimate.)
const CHARS_PER_SEC = 12;
// Minimum time a caption card stays up — guarantees a short card (e.g. the citation) is never
// skipped past unread, even if the pacing estimate lurches forward.
const MIN_DWELL = 1300;

function forSpeech(answer: string): string {
  const clean = answer
    .replace(/[*_#>`]/g, '')
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

const REF_RE = /(\(?\d{1,3}:\d{1,3}(?:[-–]\d{1,3})?\)?)/g;
const isRef = (s: string) => /^\(?\d{1,3}:\d{1,3}(?:[-–]\d{1,3})?\)?$/.test(s);

// Render a card, tinting any ayah reference (e.g. "(13:28)") gold like the storyboard.
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
  const s = t.trim().toLowerCase().replace(/[.!?]+$/, '');
  if (s.length < 2) return true;
  return /^(thank you|thanks for watching|thanks|thank you so much|you|bye|bye bye|okay|ok|uh|um|hmm|\.\.\.|subscribe.*|please subscribe.*)$/.test(
    s,
  );
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

  const phaseRef = useRef<Phase>('idle');
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
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const organicRef = useRef(false);
  const mountedRef = useRef(true);
  // The reply player is created ON DEMAND (only while speaking) and removed before listening,
  // so no audio player ever holds the iOS audio session while the mic needs to record.
  const playerRef = useRef<AudioPlayer | null>(null);
  const subRef = useRef<{ remove: () => void } | null>(null);
  const intensity = useRef(new Animated.Value(0.12)).current;

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
      playerRef.current?.remove();
    } catch {}
    playerRef.current = null;
  };

  useEffect(() => {
    if (typeof recState.metering === 'number') meterRef.current = recState.metering;
  }, [recState.metering]);

  // ---- crescent animation ----
  // Always stop whatever is mid-flight on the value before starting the next motion, so phase
  // changes never snap or fight each other.
  const stopAnim = () => {
    organicRef.current = false;
    loopRef.current?.stop();
    loopRef.current = null;
    intensity.stopAnimation();
  };
  // A very soft, slow breath for idle — the moon stays gently alive, never frozen.
  const idleBreathe = () => {
    stopAnim();
    const leg = (to: number) =>
      Animated.timing(intensity, {
        toValue: to,
        duration: 2200,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      });
    loopRef.current = Animated.loop(Animated.sequence([leg(0.22), leg(0.08)]));
    loopRef.current.start();
  };
  // A slightly fuller breath while thinking.
  const breathe = () => {
    stopAnim();
    const leg = (to: number) =>
      Animated.timing(intensity, {
        toValue: to,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      });
    loopRef.current = Animated.loop(Animated.sequence([leg(0.34), leg(0.16)]));
    loopRef.current.start();
  };
  // While speaking: a gentle random WALK (each target near the last) rather than hard random
  // jumps, eased in/out — reads as living, speech-like swell without the jitter.
  const organic = () => {
    stopAnim();
    organicRef.current = true;
    let level = 0.55;
    const step = () => {
      if (!organicRef.current || !mountedRef.current) return;
      level = Math.max(0.32, Math.min(0.9, level + (Math.random() - 0.45) * 0.45));
      Animated.timing(intensity, {
        toValue: level,
        duration: 300 + Math.random() * 240,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) step();
      });
    };
    step();
  };
  // Ease back to a calm resting glow instead of snapping with setValue().
  const settleToIdle = () => {
    stopAnim();
    Animated.timing(intensity, {
      toValue: 0.14,
      duration: 420,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && mountedRef.current && phaseRef.current === 'idle') idleBreathe();
    });
  };

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

  // ---- conversation: tap-to-talk; crescent reacts to your voice ----
  const startListening = async () => {
    if (!mountedRef.current) return;
    try {
      stopAnim();
      Speech.stop();
      teardownPlayer();
      if (capTimerRef.current) clearInterval(capTimerRef.current);
      setNote('');
      setTranscript('');
      setChunks([]);
      setChunkIdx(0);
      chunksRef.current = [];
      smoothRef.current = 0.2;
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      go('listening');
      if (tickRef.current) clearInterval(tickRef.current);
      tickRef.current = setInterval(() => {
        if (phaseRef.current !== 'listening') return;
        const raw = Math.max(0, Math.min(1, (meterRef.current + 50) / 45));
        // low-pass the mic level so the moon answers the voice smoothly, not in jerks
        smoothRef.current = smoothRef.current * 0.7 + raw * 0.3;
        Animated.timing(intensity, {
          toValue: smoothRef.current,
          duration: 150,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
      }, 130);
    } catch {
      go('idle');
      settleToIdle();
    }
  };

  const stopListeningAndProcess = async () => {
    if (phaseRef.current !== 'listening') return;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    go('thinking');
    breathe();
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error('no audio');
      const text = (await transcribeAudio(uri)).trim();
      if (!mountedRef.current) return;
      if (!text || isJunk(text)) {
        setNote('I didn’t catch that — tap the moon and speak again.');
        go('idle');
        settleToIdle();
        return;
      }
      setTranscript(text);
      setNote('');
      const data = await askQuestion(text, historyRef.current.slice(-6));
      if (!mountedRef.current) return;
      historyRef.current.push(
        { role: 'user', content: text },
        { role: 'assistant', content: data.answer },
      );
      pushVoiceExchange({ question: text, response: data });
      void playReply(data.answer);
    } catch {
      if (!mountedRef.current) return;
      setNote('Something went wrong — tap the moon to try again.');
      go('idle');
      settleToIdle();
    }
  };

  // Speak in the deep "Christopher" voice via /api/speak (on-demand player); fall back to
  // on-device if it's slow or fails.
  const playReply = async (full: string) => {
    const speakText = forSpeech(full);
    const cs = makeChunks(speakText);
    chunksRef.current = cs;
    estTotalRef.current = Math.max(1.2, speakText.length / CHARS_PER_SEC);
    setChunks(cs);
    setChunkIdx(0);
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    teardownPlayer();
    if (failTimerRef.current) clearTimeout(failTimerRef.current);
    try {
      const player = createAudioPlayer(
        { uri: `${API_BASE}/api/speak?text=${encodeURIComponent(speakText)}` },
        { updateInterval: 110 },
      );
      playerRef.current = player;
      subRef.current = player.addListener('playbackStatusUpdate', (st) => {
        if (!mountedRef.current) return;
        if (st.playing && phaseRef.current === 'thinking') {
          if (failTimerRef.current) {
            clearTimeout(failTimerRef.current);
            failTimerRef.current = null;
          }
          go('speaking');
          organic();
          resetCaption();
        }
        // Drive the cards off the real playback head (currentTime), measured against our
        // estimated total. We must NOT gate on st.duration — streamed MP3s report duration:0
        // for most of playback, which would freeze the caption on the very first card.
        if (phaseRef.current === 'speaking' && st.currentTime > 0) {
          advanceCaption(st.currentTime / estTotalRef.current);
        }
        if (st.didJustFinish) {
          teardownPlayer();
          restCaptionAtEnd();
          go('idle');
          settleToIdle();
        }
      });
      player.play();
      failTimerRef.current = setTimeout(() => {
        if (mountedRef.current && phaseRef.current === 'thinking') {
          teardownPlayer();
          speakOnDevice(speakText);
        }
      }, 9000);
    } catch {
      speakOnDevice(speakText);
    }
  };

  const speakOnDevice = (text: string) => {
    go('speaking');
    organic();
    startTimedCaption();
    Speech.stop();
    Speech.speak(text, {
      rate: 0.95,
      onDone: () => {
        if (mountedRef.current && phaseRef.current === 'speaking') {
          restCaptionAtEnd();
          go('idle');
          settleToIdle();
        }
      },
      onError: () => {
        if (mountedRef.current && phaseRef.current === 'speaking') {
          go('idle');
          settleToIdle();
        }
      },
    });
  };

  useEffect(() => {
    mountedRef.current = true;
    recitation.stop(); // voice mode needs the mic — never let recitation play (or hold the session) under it
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
      if (tickRef.current) clearInterval(tickRef.current);
      if (capTimerRef.current) clearInterval(capTimerRef.current);
      if (failTimerRef.current) clearTimeout(failTimerRef.current);
      stopAnim();
      Speech.stop();
      teardownPlayer();
      recorder.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTapMoon = () => {
    if (phaseRef.current === 'listening') void stopListeningAndProcess();
    else if (phaseRef.current !== 'thinking') void startListening();
  };

  const close = () => {
    mountedRef.current = false;
    if (tickRef.current) clearInterval(tickRef.current);
    if (capTimerRef.current) clearInterval(capTimerRef.current);
    if (failTimerRef.current) clearTimeout(failTimerRef.current);
    stopAnim();
    Speech.stop();
    teardownPlayer();
    recorder.stop().catch(() => {});
    router.back();
  };

  const status =
    phase === 'listening'
      ? 'Listening… tap when you’re done'
      : phase === 'thinking'
        ? 'Thinking…'
        : phase === 'speaking'
          ? 'Speaking…'
          : phase === 'denied'
            ? 'Microphone access is needed'
            : 'Tap the moon to speak';

  const moonScale = intensity.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.24] });
  const capText =
    (phase === 'speaking' || phase === 'idle') && chunks.length
      ? chunks[Math.min(chunkIdx, chunks.length - 1)]
      : '';

  return (
    <View style={styles.fill}>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
      <SafeAreaView style={styles.fill}>
        <View style={styles.top}>
          <View style={styles.sidePad} />
          <Text style={styles.brand}>Voice</Text>
          <Pressable onPress={close} hitSlop={14} style={styles.closeBtn}>
            <Text style={styles.closeTxt}>✕</Text>
          </Pressable>
        </View>

        {transcript ? (
          <Text style={styles.transcript} numberOfLines={2}>
            “{transcript}”
          </Text>
        ) : (
          <View style={styles.transcriptPad} />
        )}

        <Pressable style={styles.center} onPress={onTapMoon}>
          <Animated.View style={{ transform: [{ scale: moonScale }] }}>
            <Image source={CRESCENT} style={styles.moon} contentFit="contain" />
          </Animated.View>
        </Pressable>

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

        <View style={styles.bottomSpacer} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: BG },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  sidePad: { width: 40 },
  brand: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  closeTxt: { color: '#fff', fontSize: 18, fontWeight: '500' },

  transcript: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 16,
    lineHeight: 22,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 28,
    marginTop: 18,
  },
  transcriptPad: { height: 40, marginTop: 18 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  moon: { width: 320, height: 320 },

  status: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  captionWrap: { minHeight: 112, justifyContent: 'center', paddingHorizontal: 28, paddingTop: 14 },
  caption: { color: 'rgba(255,255,255,0.92)', fontSize: 16, lineHeight: 25, textAlign: 'center' },
  captionRef: { color: '#d6a84e', fontWeight: '700' },
  note: { color: 'rgba(255,200,120,0.85)', fontSize: 14, lineHeight: 20, textAlign: 'center' },

  bottomSpacer: { flex: 0.5 },
});
