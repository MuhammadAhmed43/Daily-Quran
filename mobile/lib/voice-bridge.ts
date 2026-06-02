// A tiny hand-off so a voice conversation shows up in the text Chat tab when you close
// the voice screen. The voice screen pushes each exchange; the Chat tab drains them on focus.
import type { ChatResponse } from './chat';

export type VoiceExchange = { question: string; response: ChatResponse };

let pending: VoiceExchange[] = [];

export function pushVoiceExchange(e: VoiceExchange): void {
  pending.push(e);
}

export function takeVoiceExchanges(): VoiceExchange[] {
  const out = pending;
  pending = [];
  return out;
}
