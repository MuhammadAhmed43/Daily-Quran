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
