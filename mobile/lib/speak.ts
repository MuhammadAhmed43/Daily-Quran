import { File, Paths } from 'expo-file-system';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? '').replace(/\/$/, '');

export type WordMark = { t: number; w: string };
export type SpokenReply = { uri: string; marks: WordMark[]; spoken: string; dur: number };

let seq = 0;

/** Fetch the spoken reply as a LOCAL mp3 file plus per-word timestamps, so the caller can switch
 *  caption cards exactly as each word is spoken. Downloading to a file (rather than streaming a
 *  URL) also gives a reliable duration. Returns null on any failure so the caller can fall back
 *  to streaming / on-device speech — the voice still works, only the sync degrades. */
export async function fetchSpokenReply(text: string): Promise<SpokenReply | null> {
  if (!API_BASE || !text) return null;
  try {
    const res = await fetch(`${API_BASE}/api/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, marks: true }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      audio?: string;
      marks?: WordMark[];
      spoken?: string;
      dur?: number;
    };
    if (!data || !data.audio) return null;
    const file = new File(Paths.cache, `voice-reply-${seq++}.mp3`);
    try {
      file.create();
    } catch {
      // already exists from a prior turn — write() overwrites its contents below
    }
    file.write(data.audio, { encoding: 'base64' });
    return {
      uri: file.uri,
      marks: Array.isArray(data.marks) ? data.marks : [],
      spoken: typeof data.spoken === 'string' && data.spoken ? data.spoken : text,
      dur: typeof data.dur === 'number' ? data.dur : 0,
    };
  } catch {
    return null;
  }
}
