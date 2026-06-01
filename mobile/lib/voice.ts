import { File } from 'expo-file-system';

// Base URL of our deployed Vercel API (set EXPO_PUBLIC_API_BASE in mobile/.env).
// EXPO_PUBLIC_* vars are inlined by Expo at build time.
const API_BASE = (process.env.EXPO_PUBLIC_API_BASE ?? '').replace(/\/$/, '');

export function isVoiceConfigured(): boolean {
  return API_BASE.length > 0;
}

/**
 * Reads a recorded clip from disk, sends it to our /api/transcribe endpoint
 * (Groq Whisper, server-side), and returns the transcript text.
 */
export async function transcribeAudio(uri: string): Promise<string> {
  if (!API_BASE) {
    throw new Error('Voice search isn’t configured yet (EXPO_PUBLIC_API_BASE is missing).');
  }

  const audioBase64 = await new File(uri).base64();

  const res = await fetch(`${API_BASE}/api/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audioBase64, mimeType: 'audio/m4a' }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Transcription failed (${res.status}). ${detail}`.trim());
  }

  const data = (await res.json()) as { text?: string };
  return (data.text ?? '').trim();
}
