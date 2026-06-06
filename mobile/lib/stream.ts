// Streaming reader. React Native's built-in fetch can't read a response body incrementally, so we
// use `expo/fetch` (which exposes a real ReadableStream). The server sends NDJSON — one JSON object
// per line — and we invoke onEvent for each as it arrives.
import { fetch as streamFetch } from 'expo/fetch';

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? '').replace(/\/$/, '');

export async function streamNDJSON<T>(
  path: string,
  body: unknown,
  onEvent: (obj: T) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!API_BASE) throw new Error('Streaming isn’t configured (EXPO_PUBLIC_API_BASE is missing).');
  const res = await streamFetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Stream failed (${res.status}).`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line) as T);
        } catch {
          // ignore a malformed / partial line
        }
      }
    }
  }
  const tail = buf.trim();
  if (tail) {
    try {
      onEvent(JSON.parse(tail) as T);
    } catch {
      // ignore
    }
  }
}
