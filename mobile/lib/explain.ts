import { streamNDJSON } from './stream';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? '').replace(/\/$/, '');

export type Explanation = {
  explanation: string;
  surah: number;
  ayah: number;
  hasTafsir: boolean;
  disclaimer: string;
};

/** Grounded explanation of a single ayah (looked up by surah:ayah, explained from its Ibn Kathir
 *  tafsir). `level`/`tone` come from the user's profile so the depth/voice fits the reader. */
export async function explainAyah(
  surah: number,
  ayah: number,
  opts: { name?: string; level?: 'simple' | 'standard'; tone?: 'explore' | 'default' } = {},
): Promise<Explanation> {
  if (!API_BASE) throw new Error('Explanations aren’t configured yet (EXPO_PUBLIC_API_BASE is missing).');
  const res = await fetch(`${API_BASE}/api/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ surah, ayah, name: opts.name, level: opts.level, tone: opts.tone }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Explain failed (${res.status}). ${detail}`.trim());
  }
  return (await res.json()) as Explanation;
}

type ExplainStreamEvent =
  | { t: string }
  | { done: true; hasTafsir: boolean; disclaimer: string }
  | { error: string };

/** Streaming explanation: `onToken` receives the cumulative text as it arrives. */
export async function streamExplain(
  surah: number,
  ayah: number,
  opts: { name?: string; level?: 'simple' | 'standard'; tone?: 'explore' | 'default' },
  onToken: (fullText: string) => void,
): Promise<Explanation> {
  let explanation = '';
  let gotToken = false;
  let lastEmit = 0;
  const out = { hasTafsir: false, disclaimer: '', error: '' };
  try {
    await streamNDJSON<ExplainStreamEvent>(
      '/api/explain',
      { surah, ayah, name: opts.name, level: opts.level, tone: opts.tone, stream: true },
      (ev) => {
        if ('t' in ev) {
          gotToken = true;
          explanation += ev.t;
          const now = Date.now();
          if (now - lastEmit >= 50) {
            lastEmit = now;
            onToken(explanation);
          }
        } else if ('done' in ev) {
          out.hasTafsir = ev.hasTafsir;
          out.disclaimer = ev.disclaimer;
        } else if ('error' in ev) {
          out.error = ev.error;
        }
      },
    );
  } catch (e) {
    if (gotToken) throw e;
    return explainAyah(surah, ayah, opts); // streaming unavailable → buffered fallback
  }
  if (out.error) throw new Error(out.error);
  return { explanation, surah, ayah, hasTafsir: out.hasTafsir, disclaimer: out.disclaimer };
}
