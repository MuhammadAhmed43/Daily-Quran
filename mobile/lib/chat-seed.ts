// A tiny hand-off so an entry point (a hub, a category card, Today/Reflect/Explain) can open the Ask chat
// with a starter question already asked — optionally scoped to a CATEGORY so it lands in that category's
// own persistent thread rather than the general chat. The Ask screen drains it once the thread has loaded.
export type ChatSeed = { question: string; hubId?: string };
let pending: ChatSeed | null = null;

export function setChatSeed(question: string, hubId?: string): void {
  pending = { question, hubId };
}

export function takeChatSeed(): ChatSeed | null {
  const q = pending;
  pending = null;
  return q;
}

/** Peek at a queued question WITHOUT consuming it — lets /ask resolve the target thread up front. */
export function peekChatSeed(): ChatSeed | null {
  return pending;
}

// A CATEGORY hand-off: the Ask tab sets a hub id and opens /ask, which opens that category's OWN persistent
// chat — a streaming opener if it's fresh, or the saved conversation if one already exists.
let pendingCategory: string | null = null;

export function setCategorySeed(hubId: string): void {
  pendingCategory = hubId;
}

export function takeCategorySeed(): string | null {
  const id = pendingCategory;
  pendingCategory = null;
  return id;
}
