// A tiny hand-off so a hub's "Talk it through" opens the Chat tab with a starter question already
// asked. The hub sets the seed and navigates to Chat; the Chat tab drains it on focus and sends it.
let pending: string | null = null;

export function setChatSeed(question: string): void {
  pending = question;
}

export function takeChatSeed(): string | null {
  const q = pending;
  pending = null;
  return q;
}
