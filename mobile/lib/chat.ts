import { streamNDJSON } from './stream';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? '').replace(/\/$/, '');

export type VerseCard = {
  surah: number;
  ayah: number;
  arabic: string;
  translation: string;
  related?: boolean;
};
export type TafsirSnippet = { source: string; surah: number; ayah: number; snippet: string };
export type VideoRef = { id: string }; // a Watch chapter id; the app looks up the rest from watch.ts
export type ChatResponse = {
  answer: string;
  verses: VerseCard[];
  tafsir: TafsirSnippet[];
  video?: VideoRef | null;
  disclaimer: string;
};

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

export function isChatConfigured(): boolean {
  return API_BASE.length > 0;
}

/** Ask the grounded Qur'an assistant. Returns the answer + cited verses + tafsir.
 *  Pass `voice: true` for the spoken assistant → short, conversational, spoken-style answers. */
export async function askQuestion(
  question: string,
  history: ChatTurn[] = [],
  opts: { voice?: boolean } = {},
): Promise<ChatResponse> {
  if (!API_BASE) throw new Error('Chat isn’t configured yet (EXPO_PUBLIC_API_BASE is missing).');
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history, voice: opts.voice ?? false }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Chat failed (${res.status}). ${detail}`.trim());
  }
  return (await res.json()) as ChatResponse;
}

type ChatStreamEvent =
  | { t: string }
  | {
      done: true;
      answer?: string; // the server's ref-sanitized final text — settle on this, not the raw tokens
      verses: VerseCard[];
      tafsir: TafsirSnippet[];
      video?: VideoRef | null;
      disclaimer: string;
    }
  | { error: string };

/** Streaming Q&A: `onToken` receives the cumulative answer text as it arrives; the resolved
 *  ChatResponse carries the final answer + the verse/tafsir cards (sent once the answer completes). */
export async function streamChat(
  question: string,
  history: ChatTurn[],
  onToken: (fullText: string) => void,
): Promise<ChatResponse> {
  let answer = '';
  let gotToken = false;
  let lastEmit = 0;
  const out = {
    answer: '',
    verses: [] as VerseCard[],
    tafsir: [] as TafsirSnippet[],
    video: null as VideoRef | null,
    disclaimer: '',
    error: '',
  };
  try {
    await streamNDJSON<ChatStreamEvent>('/api/chat', { question, history, stream: true }, (ev) => {
      if ('t' in ev) {
        gotToken = true;
        answer += ev.t;
        const now = Date.now();
        if (now - lastEmit >= 50) {
          lastEmit = now;
          onToken(answer);
        }
      } else if ('done' in ev) {
        if (typeof ev.answer === 'string' && ev.answer) out.answer = ev.answer;
        out.verses = ev.verses;
        out.tafsir = ev.tafsir;
        out.video = ev.video ?? null;
        out.disclaimer = ev.disclaimer;
      } else if ('error' in ev) {
        out.error = ev.error;
      }
    });
  } catch (e) {
    if (gotToken) throw e; // it started then broke — surface the error
    return askQuestion(question, history); // streaming unavailable → buffered fallback
  }
  if (out.error) throw new Error(out.error);
  // Settle on the server's sanitized text (refs the model couldn't ground are stripped); fall back to
  // the raw token accumulation only if the server didn't send a final answer.
  return { answer: out.answer || answer, verses: out.verses, tafsir: out.tafsir, video: out.video, disclaimer: out.disclaimer };
}
