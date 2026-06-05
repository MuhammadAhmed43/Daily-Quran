// chat-history.ts — persists the Ask conversations. There is ONE active thread PER CHAT, keyed by a thread
// id (general · cat:<hubId> · hist:<convId>), each saved on-device so it survives leaving the tab and
// restarting — so every category keeps its own conversation and they never merge. "New chat" ARCHIVES the
// current thread into a shared History list the user can reopen. Only SETTLED turns are stored (user
// messages + finished answers); transient loading/streaming/error states are dropped.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import type { ChatResponse } from './chat';

// A serializable turn (mirrors the screen's Message union, minus the transient states).
export type StoredMsg =
  | { role: 'user'; text: string; image?: string }
  | { role: 'assistant'; data: ChatResponse };

export type Conversation = { id: string; title: string; msgs: StoredMsg[]; updatedAt: number };

const ACTIVE_PREFIX = 'daily-quran:chat-active:'; // per-thread: general · cat:<hubId> · hist:<convId>
const activeKey = (threadId: string) => `${ACTIVE_PREFIX}${threadId}`;
const HISTORY_KEY = 'daily-quran:chat-history';
const MAX_HISTORY = 50;

let convSeq = 0;
const newConvId = () => `c${Date.now().toString(36)}${++convSeq}`;

/** A title derived from the first user message (truncated), or a fallback. */
export function titleFor(msgs: StoredMsg[]): string {
  const firstUser = msgs.find((m) => m.role === 'user') as Extract<StoredMsg, { role: 'user' }> | undefined;
  const t = (firstUser?.text ?? '').trim();
  if (t) return t.length > 64 ? `${t.slice(0, 64).trimEnd()}…` : t;
  return 'Conversation';
}

// --- the ACTIVE threads (one per chat, retained across restarts) ---
export async function loadActive(threadId: string): Promise<StoredMsg[]> {
  try {
    const raw = await AsyncStorage.getItem(activeKey(threadId));
    return raw ? (JSON.parse(raw) as StoredMsg[]) : [];
  } catch {
    return [];
  }
}

export function saveActive(threadId: string, msgs: StoredMsg[]): void {
  if (msgs.length === 0) {
    AsyncStorage.removeItem(activeKey(threadId)).catch(() => {});
    return;
  }
  AsyncStorage.setItem(activeKey(threadId), JSON.stringify(msgs)).catch(() => {});
}

/** Clear one chat thread WITHOUT archiving it (the "delete this chat" action). */
export function clearActive(threadId: string): void {
  AsyncStorage.removeItem(activeKey(threadId)).catch(() => {});
}

// --- the history ARCHIVE (cache + pub/sub) ---
let cache: Conversation[] | null = null;
const listeners = new Set<() => void>();

async function loadHistory(): Promise<Conversation[]> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    cache = raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function persistHistory() {
  AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(cache ?? [])).catch(() => {});
  listeners.forEach((l) => l());
}

/** Push the given thread into the shared History list, newest first. No-op unless the user actually took
 *  part (a welcome/category opener alone isn't history). The caller clears the live thread separately. */
export async function archive(msgs: StoredMsg[]): Promise<void> {
  const settled = msgs.filter((m) => m.role === 'user' || m.role === 'assistant');
  if (!settled.some((m) => m.role === 'user')) return;
  await loadHistory();
  cache = [{ id: newConvId(), title: titleFor(settled), msgs: settled, updatedAt: Date.now() }, ...(cache ?? [])].slice(0, MAX_HISTORY);
  persistHistory();
}

/** Pull a past conversation out of History (returns its turns). The Ask screen reopens it in its own
 *  thread (hist:<id>) and persists it from there. */
export async function restoreConversation(id: string): Promise<StoredMsg[]> {
  await loadHistory();
  const convo = (cache ?? []).find((c) => c.id === id);
  if (!convo) return [];
  cache = (cache ?? []).filter((c) => c.id !== id);
  persistHistory();
  return convo.msgs;
}

export async function deleteConversation(id: string): Promise<void> {
  await loadHistory();
  cache = (cache ?? []).filter((c) => c.id !== id);
  persistHistory();
}

// One-shot hand-off so the History screen can reopen a conversation INTO the Ask tab: it restores + sets
// this, then navigates; the Ask screen takes it on mount and loads it as its own thread (hist:<id>).
let pendingRestore: { msgs: StoredMsg[]; id: string } | null = null;
export function setPendingRestore(msgs: StoredMsg[], id: string): void {
  pendingRestore = { msgs, id };
}
export function takePendingRestore(): { msgs: StoredMsg[]; id: string } | null {
  const p = pendingRestore;
  pendingRestore = null;
  return p;
}

/** Reactive history list (newest first). */
export function useHistory(): Conversation[] {
  const [list, setList] = useState<Conversation[]>(cache ?? []);
  useEffect(() => {
    let active = true;
    const refresh = () => loadHistory().then((h) => active && setList([...h]));
    refresh();
    listeners.add(refresh);
    return () => {
      active = false;
      listeners.delete(refresh);
    };
  }, []);
  return list;
}
