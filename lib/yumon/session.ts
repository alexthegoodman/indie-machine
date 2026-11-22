// One Yumon chat per browser tab. The model and the conversation live at module level, so they
// survive client-side navigation between posts; a reload starts over. Hyperfield and the model
// code are imported only when a reader wakes Yumon (lib/yumon/runtime.ts).
//
// Analytics get counts and timings only, never message text: yumon_load, yumon_message,
// yumon_clear, yumon_open (see lib/analytics/events.ts).
import { track } from "@/lib/analytics/client";
import type { Memory } from "./model";
import type { Loaded } from "./runtime";

export type Status = "idle" | "loading" | "ready" | "thinking" | "error";
export type Message = { id: number; who: "you" | "yumon" | "error"; text: string; meta?: string };
export type YumonState = {
  status: Status;
  /** Weights download, 0..1, while loading. */
  progress: number;
  backend?: string;
  /** No usable WebGPU adapter, so Yumon runs on the (slower) CPU backend. */
  fellBack: boolean;
  error?: string;
  messages: Message[];
};

/** Size of public/models/yumon/model-int4.safetensors, for the wake button. */
export const WEIGHTS_MB = 17.1;
/** localStorage: "1" once this browser has woken Yumon, so later visits load it without a click. */
const AUTO_KEY = "im_yumon_auto";

let state: YumonState = { status: "idle", progress: 0, fellBack: false, messages: [] };
const listeners = new Set<() => void>();
let loaded: Loaded | null = null;
let loading: Promise<Loaded | null> | null = null;
let memories: Memory[] = [];
let nextId = 1;

function set(patch: Partial<YumonState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

function patchMessage(id: number, patch: Partial<Message>) {
  set({ messages: state.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
}

export const yumonStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => state,
};

export function wantsAutoLoad(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
}

export function wakeYumon(auto = false): Promise<Loaded | null> {
  if (loaded) return Promise.resolve(loaded);
  if (loading) return loading;
  set({ status: "loading", progress: 0, error: undefined });
  const t0 = performance.now();
  loading = (async () => {
    try {
      const { loadYumon } = await import("./runtime");
      const l = await loadYumon((p) => set({ progress: p }));
      loaded = l;
      set({ status: "ready", progress: 1, backend: l.backend, fellBack: l.fellBack });
      track("yumon_load", { ok: true, ms: Math.round(performance.now() - t0), backend: l.backend, fallback: l.fellBack, auto });
      try {
        localStorage.setItem(AUTO_KEY, "1");
      } catch {
        // Storage blocked: the reader clicks again next time.
      }
      return l;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ status: "error", error: msg });
      track("yumon_load", { ok: false, ms: Math.round(performance.now() - t0), auto, err: msg.slice(0, 120) });
      return null;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Send a message. `source` says how it was typed: "input" or "suggestion". */
export async function sendToYumon(text: string, source: "input" | "suggestion" = "input") {
  const prompt = text.trim();
  if (!prompt || state.status === "thinking" || state.status === "loading") return;
  const l = loaded ?? (await wakeYumon());
  if (!l) return;
  const you: Message = { id: nextId++, who: "you", text: prompt };
  const bot: Message = { id: nextId++, who: "yumon", text: "" };
  set({ status: "thinking", messages: [...state.messages, you, bot] });
  const turn = memories.length + 1;
  try {
    const { reply } = await import("./runtime");
    const r = await reply(l.yumon, prompt, memories, (t) => patchMessage(bot.id, { text: t }));
    if (!r.text) throw new Error("Yumon returned an empty reply");
    if (r.message !== prompt) patchMessage(you.id, { text: r.message, meta: "shortened to fit Yumon's context" });
    patchMessage(bot.id, { text: r.text, meta: `${r.tokens} tokens · ${r.msPerToken.toFixed(0)} ms/token` });
    memories.push({ human: r.message, yumon: r.text });
    set({ status: "ready" });
    track("yumon_message", {
      ok: true,
      turn,
      source,
      chars: prompt.length,
      tokens: r.tokens,
      msPerToken: Math.round(r.msPerToken * 10) / 10,
      memories: r.memories,
      backend: l.backend,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    patchMessage(bot.id, { who: "error", text: `Could not reply: ${msg}` });
    set({ status: "ready" });
    track("yumon_message", { ok: false, turn, source, chars: prompt.length, backend: l.backend, err: msg.slice(0, 120) });
  }
}

export function clearYumon() {
  if (state.status === "thinking") return;
  track("yumon_clear", { turns: memories.length });
  memories = [];
  set({ messages: [] });
}
