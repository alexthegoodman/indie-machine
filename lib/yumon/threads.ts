// Saved Yumon threads for /free-ai. Every thread lives in this browser's localStorage and nowhere
// else; the model itself is the one lib/yumon/session.ts loads, shared with the post pages' chat.
//
// Analytics get counts and timings only, never message or title text: yumon_message (with
// source = input | suggestion | regenerate) and yumon_thread { action, threads }.
import { track } from "@/lib/analytics/client";
import type { Memory } from "./model";
import { claimModel, releaseModel, wakeYumon } from "./session";

export type ThreadMessage = {
  id: string;
  who: "you" | "yumon" | "error";
  text: string;
  meta?: string;
  at: number;
  /** The reply was stopped before Yumon finished. */
  stopped?: boolean;
  /** Reply size and speed, for the thread's stats. */
  tokens?: number;
  msPerToken?: number;
};

export type ThreadSettings = {
  /** Pack earlier turns of this thread into the prompt. */
  memory: boolean;
  temperature: number;
  topK: number;
  maxTokens: number;
};

export type Thread = {
  id: string;
  title: string;
  /** The title was set by hand, so the first message no longer names the thread. */
  named?: boolean;
  pinned?: boolean;
  createdAt: number;
  updatedAt: number;
  settings: ThreadSettings;
  messages: ThreadMessage[];
};

export type ThreadsState = {
  hydrated: boolean;
  threads: Thread[];
  activeId: string | null;
  /** Thread a reply is being written into, if any. */
  generating: string | null;
  /** False once a read or write to localStorage failed (private window, quota). */
  storageOk: boolean;
};

export const DEFAULT_SETTINGS: ThreadSettings = { memory: true, temperature: 0.9, topK: 10, maxTokens: 120 };
export const SETTING_LIMITS = {
  temperature: { min: 0, max: 1.5, step: 0.05 },
  topK: { min: 1, max: 50, step: 1 },
  maxTokens: { min: 16, max: 256, step: 8 },
} as const;
export const UNTITLED = "New thread";

const KEY = "im-yumon-threads-v1";
const TITLE_MAX = 48;

let state: ThreadsState = { hydrated: false, threads: [], activeId: null, generating: null, storageOk: true };
const listeners = new Set<() => void>();
let controller: AbortController | null = null;

function set(patch: Partial<ThreadsState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export const threadsStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => state,
};

const SERVER: ThreadsState = { hydrated: false, threads: [], activeId: null, generating: null, storageOk: true };
export const serverThreads = () => SERVER;

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function blank(): Thread {
  const now = Date.now();
  return { id: uid(), title: UNTITLED, createdAt: now, updatedAt: now, settings: { ...DEFAULT_SETTINGS }, messages: [] };
}

function clamp(v: unknown, { min, max }: { min: number; max: number }, fallback: number) {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

/** Keep whatever parses; a hand-edited or older entry should not take the page down. */
function sanitize(raw: unknown): Thread[] {
  if (!Array.isArray(raw)) return [];
  const out: Thread[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object" || typeof t.id !== "string") continue;
    const s = t.settings ?? {};
    out.push({
      id: t.id,
      title: typeof t.title === "string" && t.title.trim() ? t.title : UNTITLED,
      named: !!t.named,
      pinned: !!t.pinned,
      createdAt: Number(t.createdAt) || Date.now(),
      updatedAt: Number(t.updatedAt) || Date.now(),
      settings: {
        memory: s.memory !== false,
        temperature: clamp(s.temperature, SETTING_LIMITS.temperature, DEFAULT_SETTINGS.temperature),
        topK: Math.round(clamp(s.topK, SETTING_LIMITS.topK, DEFAULT_SETTINGS.topK)),
        maxTokens: Math.round(clamp(s.maxTokens, SETTING_LIMITS.maxTokens, DEFAULT_SETTINGS.maxTokens)),
      },
      messages: (Array.isArray(t.messages) ? t.messages : [])
        .filter((m: ThreadMessage) => m && typeof m.text === "string" && ["you", "yumon", "error"].includes(m.who))
        .map((m: ThreadMessage) => ({ id: String(m.id ?? uid()), who: m.who, text: m.text, meta: m.meta, at: Number(m.at) || 0, stopped: m.stopped || undefined, tokens: num(m.tokens), msPerToken: num(m.msPerToken) })),
    });
  }
  return out;
}

function num(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function read(): { threads: Thread[]; activeId: string | null } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { threads: [], activeId: null };
    const data = JSON.parse(raw);
    return { threads: sanitize(data.threads), activeId: typeof data.activeId === "string" ? data.activeId : null };
  } catch {
    return null;
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, activeId: state.activeId, threads: state.threads }));
    if (!state.storageOk) set({ storageOk: true });
  } catch {
    if (state.storageOk) set({ storageOk: false });
  }
}

/** Load saved threads once per tab (call from an effect, so the server render stays empty). */
export function hydrateThreads() {
  if (state.hydrated) return;
  const saved = read();
  const threads = saved?.threads ?? [];
  if (!threads.length) threads.push(blank());
  const activeId = threads.some((t) => t.id === saved?.activeId) ? saved!.activeId : threads[0].id;
  set({ hydrated: true, threads, activeId, storageOk: saved !== null });
  window.addEventListener("storage", (e) => {
    // Another tab saved; take its copy unless this tab is mid-reply.
    if (e.key !== KEY || state.generating) return;
    const other = read();
    if (!other) return;
    const list = other.threads.length ? other.threads : [blank()];
    set({ threads: list, activeId: list.some((t) => t.id === state.activeId) ? state.activeId : list[0].id });
  });
}

function patchThread(id: string, patch: Partial<Thread> | ((t: Thread) => Partial<Thread>), save = true) {
  set({ threads: state.threads.map((t) => (t.id === id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)) });
  if (save) persist();
}

function patchMessage(threadId: string, msgId: string, patch: Partial<ThreadMessage>, save = true) {
  patchThread(threadId, (t) => ({ messages: t.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)) }), save);
}

export function activeThread(s: ThreadsState = state): Thread | undefined {
  return s.threads.find((t) => t.id === s.activeId);
}

/** Pinned first, then the most recently used. */
export function sortedThreads(threads: Thread[]): Thread[] {
  return [...threads].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);
}

/** Pairs of a message and the reply right after it, for the prompt's memory. */
export function threadMemories(messages: ThreadMessage[]): Memory[] {
  const out: Memory[] = [];
  for (let i = 0; i + 1 < messages.length; i++) {
    const [a, b] = [messages[i], messages[i + 1]];
    if (a.who === "you" && b.who === "yumon" && b.text) {
      out.push({ human: a.text, yumon: b.text });
      i++;
    }
  }
  return out;
}

export function newThread() {
  if (state.generating) return;
  // An empty thread is already a new thread; reuse it rather than piling up blanks.
  const empty = state.threads.find((t) => t.messages.length === 0 && !t.named);
  const t = empty ? { ...empty, updatedAt: Date.now() } : blank();
  set({ threads: [t, ...state.threads.filter((x) => x.id !== t.id)], activeId: t.id });
  persist();
  if (!empty) track("yumon_thread", { action: "new", threads: state.threads.length });
}

export function selectThread(id: string) {
  if (state.activeId === id || !state.threads.some((t) => t.id === id)) return;
  set({ activeId: id });
  persist();
}

export function renameThread(id: string, title: string) {
  const clean = title.trim().slice(0, 80);
  if (!clean) return;
  patchThread(id, { title: clean, named: true });
  track("yumon_thread", { action: "rename", threads: state.threads.length });
}

export function togglePin(id: string) {
  patchThread(id, (t) => ({ pinned: !t.pinned }));
  track("yumon_thread", { action: "pin", threads: state.threads.length });
}

export function deleteThread(id: string) {
  if (state.generating === id) return;
  const rest = state.threads.filter((t) => t.id !== id);
  const threads = rest.length ? rest : [blank()];
  const activeId = state.activeId === id ? sortedThreads(threads)[0].id : state.activeId;
  set({ threads, activeId });
  persist();
  track("yumon_thread", { action: "delete", threads: rest.length });
}

export function deleteAllThreads() {
  if (state.generating) return;
  const t = blank();
  const count = state.threads.length;
  set({ threads: [t], activeId: t.id });
  persist();
  track("yumon_thread", { action: "delete_all", threads: count });
}

export function updateSettings(id: string, patch: Partial<ThreadSettings>) {
  patchThread(id, (t) => ({ settings: { ...t.settings, ...patch } }));
}

export function stopReply() {
  controller?.abort();
}

/** The thread as Markdown, for the export button. */
export function threadMarkdown(t: Thread): string {
  const lines = [`# ${t.title}`, "", `Exported from Indie Machine Free AI (Yumon, in-browser) on ${new Date().toISOString().slice(0, 10)}.`, ""];
  for (const m of t.messages) {
    const who = m.who === "you" ? "You" : m.who === "yumon" ? "Yumon" : "Error";
    lines.push(`**${who}:** ${m.text}${m.stopped ? " _(stopped)_" : ""}`, "");
  }
  return lines.join("\n");
}

export function exportThread(id: string) {
  const t = state.threads.find((x) => x.id === id);
  if (!t) return;
  const blob = new Blob([threadMarkdown(t)], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${t.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "yumon-thread"}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  track("yumon_thread", { action: "export", threads: state.threads.length });
}

type Source = "input" | "suggestion" | "regenerate";

/** Write Yumon's reply to `you` (already in the thread) using the messages before it as memory. */
async function run(threadId: string, you: ThreadMessage, before: ThreadMessage[], source: Source) {
  const l = await wakeYumon();
  if (!l) {
    patchThread(threadId, (t) => ({ messages: [...t.messages, { id: uid(), who: "error", text: "Yumon could not wake up.", at: Date.now() }] }));
    return;
  }
  if (!claimModel()) {
    patchThread(threadId, (t) => ({ messages: [...t.messages, { id: uid(), who: "error", text: "Yumon is busy with another chat. Try again in a moment.", at: Date.now() }] }));
    return;
  }
  const thread = state.threads.find((t) => t.id === threadId)!;
  const { settings } = thread;
  const memories = settings.memory ? threadMemories(before) : [];
  const bot: ThreadMessage = { id: uid(), who: "yumon", text: "", at: Date.now() };
  patchThread(threadId, (t) => ({ messages: [...t.messages, bot], updatedAt: Date.now() }));
  set({ generating: threadId });
  controller = new AbortController();
  const turn = memories.length + 1;
  try {
    const { reply } = await import("./runtime");
    const r = await reply(l.yumon, you.text, memories, (text) => patchMessage(threadId, bot.id, { text }, false), {
      temperature: settings.temperature,
      topK: settings.topK,
      maxTokens: settings.maxTokens,
      signal: controller.signal,
    });
    if (!r.text && !r.stopped) throw new Error("Yumon returned an empty reply");
    if (r.message !== you.text) patchMessage(threadId, you.id, { text: r.message, meta: "shortened to fit Yumon's context" }, false);
    patchMessage(threadId, bot.id, {
      text: r.text || "...",
      stopped: r.stopped || undefined,
      tokens: r.tokens,
      msPerToken: Math.round(r.msPerToken * 10) / 10,
      meta: `${r.tokens} tokens · ${r.msPerToken.toFixed(0)} ms/token${r.stopped ? " · stopped" : ""}`,
    });
    track("yumon_message", {
      ok: true,
      turn,
      source,
      chars: you.text.length,
      tokens: r.tokens,
      msPerToken: Math.round(r.msPerToken * 10) / 10,
      memories: r.memories,
      backend: l.backend,
      stopped: r.stopped,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    patchMessage(threadId, bot.id, { who: "error", text: `Could not reply: ${msg}` });
    track("yumon_message", { ok: false, turn, source, chars: you.text.length, backend: l.backend, err: msg.slice(0, 120) });
  } finally {
    controller = null;
    releaseModel();
    set({ generating: null });
    persist();
  }
}

/** Send a message in the active thread. */
export async function sendInThread(text: string, source: "input" | "suggestion" = "input") {
  const prompt = text.trim();
  const thread = activeThread();
  if (!prompt || !thread || state.generating) return;
  const before = thread.messages;
  const you: ThreadMessage = { id: uid(), who: "you", text: prompt.slice(0, 2000), at: Date.now() };
  patchThread(thread.id, (t) => ({
    messages: [...t.messages, you],
    updatedAt: Date.now(),
    ...(t.named || t.messages.some((m) => m.who === "you") ? {} : { title: titleFrom(prompt) }),
  }));
  await run(thread.id, you, before, source);
}

/** Drop the last reply in the active thread and ask again. */
export async function regenerate() {
  const thread = activeThread();
  if (!thread || state.generating) return;
  const msgs = thread.messages;
  const lastYou = msgs.map((m) => m.who).lastIndexOf("you");
  if (lastYou < 0) return;
  const you = msgs[lastYou];
  patchThread(thread.id, { messages: msgs.slice(0, lastYou + 1) });
  await run(thread.id, you, msgs.slice(0, lastYou), "regenerate");
}

function titleFrom(prompt: string) {
  const one = prompt.replace(/\s+/g, " ").trim();
  return one.length > TITLE_MAX ? one.slice(0, TITLE_MAX - 1).trimEnd() + "…" : one;
}
