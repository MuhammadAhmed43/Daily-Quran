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
export type ChatResponse = {
  answer: string;
  verses: VerseCard[];
  tafsir: TafsirSnippet[];
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
  | { done: true; verses: VerseCard[]; tafsir: TafsirSnippet[]; disclaimer: string }
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
  const out = { verses: [] as VerseCard[], tafsir: [] as TafsirSnippet[], disclaimer: '', error: '' };
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
        out.verses = ev.verses;
        out.tafsir = ev.tafsir;
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
  return { answer, verses: out.verses, tafsir: out.tafsir, disclaimer: out.disclaimer };
}
