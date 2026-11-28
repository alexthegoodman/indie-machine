// /free-ai/gherkin: Yumon fine-tuned on procedural Gherkin (yumon-pet checkpoints/yumon-gherkin-proc-1024-extended,
// int4). It is not a chat model: it was trained on whole feature files, so the reader's text goes in as
// [BOS] text and Yumon continues it until it ends the feature (EOS) or runs out of context. The model
// lives at module level next to the chat's (lib/yumon/session.ts) and loads only when asked.
//
// Analytics get counts and timings only, never the text: gherkin_load, gherkin_write.
import { track } from "@/lib/analytics/client";
import type { Loaded } from "./runtime";

/** Folder with config.json, tokenizer.json and model-int4.safetensors; never overwritten. */
const DEFAULT_MODEL_URL = "https://pbd11pvl9gfr63ve.public.blob.vercel-storage.com/yumon/gherkin-proc-1024-extended-int4/";
const configured = process.env.NEXT_PUBLIC_YUMON_GHERKIN_URL || DEFAULT_MODEL_URL;
export const GHERKIN_MODEL_URL = configured.endsWith("/") ? configured : configured + "/";
/** Size of model-int4.safetensors in that folder. */
export const GHERKIN_WEIGHTS_MB = 12.1;

export type GherkinStatus = "idle" | "loading" | "ready" | "writing" | "error";
export type GherkinSettings = { temperature: number; topK: number; maxTokens: number };
export const GHERKIN_DEFAULTS: GherkinSettings = { temperature: 0.7, topK: 10, maxTokens: 200 };
export const GHERKIN_LIMITS = {
  temperature: { min: 0, max: 1.5, step: 0.05 },
  topK: { min: 1, max: 40, step: 1 },
  maxTokens: { min: 16, max: 1023, step: 1 },
};

export type Draft = {
  prompt: string;
  /** Yumon's continuation, as decoded (lowercase: the tokenizer lowercases). */
  text: string;
  tokens: number;
  promptTokens: number;
  msPerToken: number;
  /** "eos" = Yumon ended the feature, "context" = all 1,024 tokens used, "max" = the token limit, "stopped" = STOP. */
  end?: "eos" | "context" | "max" | "stopped";
  error?: string;
};

export type GherkinState = {
  status: GherkinStatus;
  progress: number;
  backend?: string;
  fellBack: boolean;
  context?: number;
  error?: string;
  draft?: Draft;
  /** Continuations written since the page loaded. */
  writes: number;
};

let state: GherkinState = { status: "idle", progress: 0, fellBack: false, writes: 0 };
const listeners = new Set<() => void>();
let loaded: Loaded | null = null;
let loading: Promise<Loaded | null> | null = null;
let stopAsked = false;

function set(patch: Partial<GherkinState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export const gherkinStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => state,
};

export function wakeGherkin(): Promise<Loaded | null> {
  if (loaded) return Promise.resolve(loaded);
  if (loading) return loading;
  set({ status: "loading", progress: 0, error: undefined });
  const t0 = performance.now();
  loading = (async () => {
    try {
      const { loadYumonFrom } = await import("./runtime");
      const l = await loadYumonFrom(GHERKIN_MODEL_URL, (p) => set({ progress: p }));
      loaded = l;
      set({ status: "ready", progress: 1, backend: l.backend, fellBack: l.fellBack, context: l.yumon.config.max_seq_len });
      track("gherkin_load", { ok: true, ms: Math.round(performance.now() - t0), backend: l.backend, fallback: l.fellBack });
      return l;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ status: "error", error: msg });
      track("gherkin_load", { ok: false, ms: Math.round(performance.now() - t0), err: msg.slice(0, 120) });
      return null;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Ends the current continuation after the token being written. */
export function stopGherkin() {
  if (state.status === "writing") stopAsked = true;
}

/**
 * Continues `prompt`. `source` says where the text came from: "input" (typed or edited) or
 * "example" (an example button, unedited).
 */
export async function writeGherkin(prompt: string, settings: GherkinSettings, source: "input" | "example" = "input") {
  if (!prompt.trim() || state.status === "writing" || state.status === "loading") return;
  const l = loaded ?? (await wakeGherkin());
  if (!l) return;
  const { generate, rawPromptIds } = await import("./model");
  const ids = rawPromptIds(l.yumon.tokenizer, prompt);
  const context = l.yumon.config.max_seq_len;
  const draft: Draft = { prompt, text: "", tokens: 0, promptTokens: ids.length, msPerToken: 0 };
  if (ids.length >= context) {
    set({ draft: { ...draft, error: `The opening is ${ids.length} tokens; Yumon's context is ${context}. Shorten it.` } });
    return;
  }
  stopAsked = false;
  set({ status: "writing", draft });
  const room = context - ids.length;
  const maxTokens = Math.min(settings.maxTokens, room);
  const at: number[] = [performance.now()];
  let stopped = false;
  try {
    const out = await generate(l.yumon, ids, {
      maxTokens,
      temperature: settings.temperature,
      topK: settings.topK,
      kvCache: true,
      onToken: (outIds, text) => {
        at.push(performance.now());
        set({ draft: { ...draft, text, tokens: outIds.length } });
        // generate has no abort option; throwing here still runs its cleanup (the KV cache).
        if (stopAsked) throw new Stopped();
      },
    });
    // The prefill (first step) is left out of the per-token time.
    const span = at.length > 2 ? at.slice(1) : at;
    const ms = (span[span.length - 1] - span[0]) / Math.max(1, span.length - 1);
    const end: Draft["end"] = out.ids.length >= room ? "context" : out.ids.length >= maxTokens ? "max" : "eos";
    set({ status: "ready", writes: state.writes + 1, draft: { ...draft, text: out.text, tokens: out.ids.length, msPerToken: ms, end } });
    track("gherkin_write", { ok: true, source, promptTokens: ids.length, tokens: out.ids.length, msPerToken: Math.round(ms * 10) / 10, end, temperature: settings.temperature, backend: l.backend });
  } catch (e) {
    if (e instanceof Stopped) stopped = true;
    const span = at.length > 2 ? at.slice(1) : at;
    const ms = (span[span.length - 1] - span[0]) / Math.max(1, span.length - 1);
    const current = state.draft ?? draft;
    if (stopped) {
      set({ status: "ready", writes: state.writes + 1, draft: { ...current, msPerToken: ms, end: "stopped" } });
      track("gherkin_write", { ok: true, source, promptTokens: ids.length, tokens: current.tokens, msPerToken: Math.round(ms * 10) / 10, end: "stopped", temperature: settings.temperature, backend: l.backend });
    } else {
      const msg = e instanceof Error ? e.message : String(e);
      set({ status: "ready", draft: { ...current, error: `Could not continue: ${msg}` } });
      track("gherkin_write", { ok: false, source, promptTokens: ids.length, backend: l.backend, err: msg.slice(0, 120) });
    }
  }
}

class Stopped extends Error {}

const KEYWORD = /^(\s*)(feature|background|scenario outline|scenario|examples|rule|given|when|then|and|but)\b/;

/**
 * Display form of a lowercase continuation: line-leading Gherkin keywords capitalized and the
 * pronoun "i" as "I". The model's own text is kept as written otherwise.
 */
export function displayGherkin(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(KEYWORD, (_m, sp: string, kw: string) => sp + kw[0].toUpperCase() + kw.slice(1)).replace(/(^|\s)i(?=\s)/g, "$1I"))
    .join("\n");
}
