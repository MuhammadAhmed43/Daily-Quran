// Streaming voice-reply pipeline — the heart of the low-latency spoken assistant.
//
// Instead of waiting for the WHOLE answer to generate and then synthesizing it all at once
// (~6s to first word), this streams the grounded chat answer token-by-token, peels off each
// COMPLETE sentence the moment it lands, synthesizes that one sentence to a local mp3 (with
// per-word marks), and hands the ready clip to the caller. The caller can start speaking after
// just one sentence's worth of TTS (~3s to first word).
//
// Guarantees / design choices (so the screen stays robust):
//  - Clips are emitted strictly IN ORDER. We synthesize one sentence at a time, which also means
//    only ONE msedge connection is ever open (Edge resets parallel connections) while still
//    staying comfortably ahead of playback.
//  - A sentence whose TTS fails (after one retry) is skipped — a small gap, never a stuck reply.
//  - cancel() stops the chat stream, aborts the in-flight synth, deletes any orphan clip, and makes
//    every later callback a no-op.
//  - This module does pure IO: no expo-audio, no React. The CONSUMER owns playback, the audio
//    session, captions, and the buffered / on-device fallbacks. Keeps this unit testable.

import { File } from 'expo-file-system';

import type { ChatTurn, TafsirSnippet, VerseCard, VideoRef } from './chat';
import { fetchSpokenReply, type SpokenReply } from './speak';
import { streamNDJSON } from './stream';

export type SpokenClip = SpokenReply & { index: number };

export type VoiceReplyMeta = {
  answer: string;
  verses: VerseCard[];
  tafsir: TafsirSnippet[];
  video: VideoRef | null;
  disclaimer: string;
};

export type VoiceReplyHandle = { cancel: () => void };

type StreamEvent =
  | { t: string }
  | { done: true; answer?: string; verses: VerseCard[]; tafsir: TafsirSnippet[]; video?: VideoRef | null; disclaimer: string }
  | { error: string };

// A spoken reply is 1–3 sentences (the server caps voice at max_tokens 260). These are defensive
// ceilings so a runaway answer can never queue an unbounded amount of audio.
const MAX_SENTENCES = 8;
const MAX_SPEAK_CHARS = 700;
// A single sentence's TTS must never stall the whole reply — if /api/speak hangs past this, we abort
// that request and skip the sentence (a small gap beats a silent, stuck reply).
const SYNTH_TIMEOUT_MS = 9000;

// A sentence is "complete" when its terminator (. ! ?) — plus any closing quote/bracket — is
// followed by whitespace AND the next visible char looks like a new sentence start (a capital,
// digit, or opening quote). Requiring the next char avoids splitting abbreviations ("e.g.", "i.e.")
// and keeps an ayah ref glued on ("...patient (11:11)."). While streaming, a terminator at the very
// end of the buffer simply waits one more token for that next char; finalize() flushes the tail.
const SENTENCE_RE = /^([\s\S]*?[.!?]+["'”’)\]]*)\s+(?=[A-Z0-9"'“‘(])([\s\S]*)$/;

/** Peel every complete sentence off the front of `buf`. Returns the finished sentences plus the
 *  not-yet-terminated remainder. With `finalize`, the remainder is emitted as a final sentence. */
export function pullSentences(buf: string, finalize: boolean): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  let rest = buf;
  for (;;) {
    const m = rest.match(SENTENCE_RE);
    if (!m) break;
    const s = m[1].trim();
    rest = m[2];
    if (s) sentences.push(s);
  }
  if (finalize) {
    const tail = rest.trim();
    if (tail) {
      sentences.push(tail);
      rest = '';
    }
  }
  return { sentences, rest };
}

function deleteClip(uri: string): void {
  try {
    new File(uri).delete();
  } catch {
    // best-effort — the OS clears the cache dir eventually
  }
}

/** Start a streaming spoken reply. Returns a handle whose cancel() tears the whole thing down. */
export function streamSpokenReply(opts: {
  question: string;
  history: ChatTurn[];
  /** A sentence's audio is ready as a local file. Clips arrive strictly in order. */
  onClip: (clip: SpokenClip) => void;
  /** The answer finished generating and all its sentences have been synthesized (clips already
   *  delivered via onClip). Carries the full answer + cards for history / the chat hand-off. */
  onDone: (meta: VoiceReplyMeta) => void;
  /** The chat stream failed before producing ANY text — the caller should fall back. */
  onError: (err: Error) => void;
  /** Cumulative answer text as it streams — lets the caller keep the partial answer for its own
   *  fallback (e.g. if its first-audio deadline trips mid-stream). Optional. */
  onText?: (full: string) => void;
}): VoiceReplyHandle {
  const { question, history, onClip, onDone, onError, onText } = opts;

  let cancelled = false;
  const ctrl = new AbortController();

  let answer = '';
  let finalAnswer = ''; // the server's ref-sanitized text (done event); preferred for history/hand-off
  let consumed = 0; // chars of `answer` already turned into sentences
  let gotToken = false;
  let streamErr = '';
  let meta: Omit<VoiceReplyMeta, 'answer'> = { verses: [], tafsir: [], video: null, disclaimer: '' };

  const queue: string[] = [];
  let draining = false;
  let streamEnded = false;
  let emitted = 0;
  let spokenChars = 0;
  let capped = false;

  const enqueue = (sentences: string[]) => {
    for (const s of sentences) {
      if (capped) break;
      queue.push(s);
      spokenChars += s.length;
      if (emitted + queue.length >= MAX_SENTENCES || spokenChars >= MAX_SPEAK_CHARS) {
        capped = true;
        break;
      }
    }
  };

  // Extract any newly-complete sentences from the part of `answer` we haven't consumed yet.
  const pull = (finalize: boolean) => {
    const { sentences, rest } = pullSentences(answer.slice(consumed), finalize);
    consumed = answer.length - rest.length;
    if (sentences.length) {
      enqueue(sentences);
      void drain();
    }
  };

  const synthOnce = async (text: string): Promise<SpokenReply | null> => {
    for (let attempt = 0; attempt < 2 && !cancelled; attempt++) {
      // Per-attempt timeout that aborts the request (so a hung synth can't stall the queue, and we
      // don't leak a half-written clip). The global cancel also aborts it.
      const ac = new AbortController();
      const onAbort = () => ac.abort();
      ctrl.signal.addEventListener('abort', onAbort);
      const timer = setTimeout(() => ac.abort(), SYNTH_TIMEOUT_MS);
      const clip = await fetchSpokenReply(text, ac.signal).catch(() => null);
      clearTimeout(timer);
      ctrl.signal.removeEventListener('abort', onAbort);
      if (clip) return clip;
      if (cancelled) return null;
    }
    return null;
  };

  // Synthesize queued sentences one at a time, in order. Stays ahead of playback without ever
  // opening two msedge connections at once.
  const drain = async () => {
    if (draining) return;
    draining = true;
    while (queue.length && !cancelled) {
      const text = queue.shift() as string;
      const clip = await synthOnce(text);
      if (cancelled) {
        if (clip) deleteClip(clip.uri);
        break;
      }
      if (clip) onClip({ ...clip, index: emitted++ });
      // a failed sentence is simply skipped — a small gap is far better than a hung reply
    }
    draining = false;
    maybeDone();
  };

  const maybeDone = () => {
    if (cancelled) return;
    if (!streamEnded || draining || queue.length) return;
    onDone({ answer: finalAnswer || answer, ...meta });
  };

  void (async () => {
    try {
      await streamNDJSON<StreamEvent>(
        '/api/chat',
        { question, history, voice: true, stream: true },
        (ev) => {
          if (cancelled) return;
          if ('t' in ev) {
            gotToken = true;
            answer += ev.t;
            onText?.(answer);
            pull(false);
          } else if ('done' in ev) {
            if (typeof ev.answer === 'string' && ev.answer) finalAnswer = ev.answer;
            meta = {
              verses: ev.verses || [],
              tafsir: ev.tafsir || [],
              video: ev.video ?? null,
              disclaimer: ev.disclaimer || '',
            };
          } else if ('error' in ev) {
            streamErr = ev.error;
          }
        },
        ctrl.signal,
      );
    } catch (e) {
      if (cancelled) return;
      if (!gotToken) {
        // the stream broke before any text — let the caller fall back to the buffered path
        onError(e instanceof Error ? e : new Error(String(e)));
        return;
      }
      // we already have partial text — speak what we got rather than discarding it
    }
    if (cancelled) return;
    if (streamErr && !answer.trim()) {
      onError(new Error(streamErr));
      return;
    }
    streamEnded = true;
    pull(true); // flush the final (possibly unterminated) sentence
    void drain();
    maybeDone(); // covers an empty answer (no sentences at all)
  })();

  return {
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      try {
        ctrl.abort();
      } catch {
        // ignore
      }
    },
  };
}
