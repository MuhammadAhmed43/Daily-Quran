// Client for the image endpoint (api/see.js). Mirrors lib/chat.ts's streaming: `onToken` receives the
// cumulative text as it streams; the resolved response carries the FINAL, server-sanitized answer plus
// the verse/tafsir cards. The photo is sent as a base64 data URL and is never stored server-side.
import type { ChatResponse, ChatTurn } from './chat';
import { streamNDJSON } from './stream';

type SeeStreamEvent =
  | { t: string }
  | {
      done: true;
      answer?: string;
      verses: ChatResponse['verses'];
      tafsir: ChatResponse['tafsir'];
      caption?: string;
      mode?: string;
      disclaimer: string;
    }
  | { error: string };

export async function streamSee(
  imageDataUrl: string,
  question: string,
  history: ChatTurn[],
  onToken: (fullText: string) => void,
): Promise<ChatResponse> {
  let answer = '';
  let lastEmit = 0;
  const out = {
    answer: '',
    verses: [] as ChatResponse['verses'],
    tafsir: [] as ChatResponse['tafsir'],
    disclaimer: '',
    error: '',
  };
  await streamNDJSON<SeeStreamEvent>(
    '/api/see',
    { image: imageDataUrl, question, history, stream: true },
    (ev) => {
      if ('t' in ev) {
        answer += ev.t;
        const now = Date.now();
        if (now - lastEmit >= 50) {
          lastEmit = now;
          onToken(answer);
        }
      } else if ('done' in ev) {
        out.answer = ev.answer ?? answer; // the server sends the sanitized final text (refs stripped)
        out.verses = ev.verses ?? [];
        out.tafsir = ev.tafsir ?? [];
        out.disclaimer = ev.disclaimer ?? '';
      } else if ('error' in ev) {
        out.error = ev.error;
      }
    },
  );
  if (out.error) throw new Error(out.error);
  return { answer: out.answer || answer, verses: out.verses, tafsir: out.tafsir, video: null, disclaimer: out.disclaimer };
}
