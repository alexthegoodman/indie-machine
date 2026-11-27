// The Hyperfield side of the Yumon chats (post pages and /free-ai). Only lib/yumon/session.ts and
// lib/yumon/threads.ts import this, and only by dynamic import once a reader asks for Yumon, so
// pages never ship it otherwise.
import * as hf from "hyperfield";
import { type Memory, type Yumon, TURN_STOPS, chatPromptIds, cleanReply, fromStateDict, generate, type YumonConfig } from "./model";

/**
 * Folder with config.json, tokenizer.json and model-int4.safetensors. Each checkpoint gets its
 * own folder (cp1-int4, loop1-int4, ...) so a URL's bytes never change. NEXT_PUBLIC_YUMON_MODEL_URL
 * overrides it, e.g. with a local copy under public/.
 */
const DEFAULT_MODEL_URL = "https://pbd11pvl9gfr63ve.public.blob.vercel-storage.com/yumon/loop1-int4/";
const configured = process.env.NEXT_PUBLIC_YUMON_MODEL_URL || DEFAULT_MODEL_URL;
export const MODEL_URL = configured.endsWith("/") ? configured : configured + "/";
const WEIGHTS = "model-int4.safetensors";

export type Loaded = { yumon: Yumon; backend: string; fellBack: boolean };

/** fetch with download progress (0..1). Falls back to no progress when the size is unknown. */
async function fetchWithProgress(url: string, onProgress: (p: number) => void): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
  // With Content-Encoding the length is the compressed size, so progress is only a guide.
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.byteLength;
    if (total) onProgress(Math.min(1, got / total));
  }
  const bytes = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  return bytes;
}

/** WebGPU when the browser can give us an adapter, else the CPU reference backend. */
async function pickBackend(): Promise<{ backend: hf.Backend; fellBack: boolean }> {
  if (hf.WebGpuBackend.isSupported()) {
    try {
      return { backend: await hf.init({ backend: "webgpu" }), fellBack: false };
    } catch {
      // No adapter (blocklisted GPU, headless, power settings): use the CPU below.
    }
  }
  return { backend: await hf.init({ backend: "cpu" }), fellBack: true };
}

export async function loadYumon(onProgress: (p: number) => void): Promise<Loaded> {
  const { backend, fellBack } = await pickBackend();
  const [config, tokenizer, bytes] = await Promise.all([
    fetch(MODEL_URL + "config.json")
      .then((r) => r.json())
      .then((c) => c.model as YumonConfig),
    hf.text.Tokenizer.fromUrl(MODEL_URL + "tokenizer.json"),
    fetchWithProgress(MODEL_URL + WEIGHTS, onProgress),
  ]);
  const model = fromStateDict(config, hf.io.loadSafetensors(bytes));
  await hf.sync();
  if (backend instanceof hf.WebGpuBackend) backend.trim(); // drop the random-init buffers loadStateDict replaced
  return { yumon: { model, tokenizer, config, variant: "int4", fileBytes: bytes.byteLength }, backend: backend.name, fellBack };
}

export type Reply = { text: string; message: string; tokens: number; msPerToken: number; memories: number; stopped: boolean };
export type ReplyOptions = { temperature?: number; topK?: number; maxTokens?: number; signal?: AbortSignal };

class Stopped extends Error {}

/**
 * One chat turn, the way examples/yumon/main.ts runs it: KV cache on, top-10 at 0.9 unless the
 * options say otherwise. Aborting `signal` ends the reply after the current token and returns
 * what Yumon had said so far (stopped: true).
 */
export async function reply(yumon: Yumon, prompt: string, memories: Memory[], onText: (text: string) => void, opts: ReplyOptions = {}): Promise<Reply> {
  const { temperature = 0.9, topK = 10, maxTokens = 120, signal } = opts;
  const chat = chatPromptIds(yumon.tokenizer, prompt, memories, yumon.config.max_seq_len);
  let raw = "";
  let tokens = 0;
  let stopped = false;
  // Time between tokens, so the prefill (the first step runs the whole prompt) is left out.
  const at: number[] = [performance.now()];
  try {
    const out = await generate(yumon, chat.ids, {
      maxTokens,
      temperature,
      topK,
      kvCache: true,
      stop: TURN_STOPS,
      onToken: (ids, text) => {
        at.push(performance.now());
        raw = text;
        tokens = ids.length;
        onText(cleanReply(text));
        // generate has no abort option; throwing here still runs its cleanup (the KV cache).
        if (signal?.aborted) throw new Stopped();
      },
    });
    raw = out.text;
  } catch (e) {
    if (!(e instanceof Stopped)) throw e;
    stopped = true;
  }
  const span = at.length > 2 ? at.slice(1) : at;
  const msPerToken = (span[span.length - 1] - span[0]) / Math.max(1, span.length - 1);
  return { text: cleanReply(raw), message: chat.message, tokens, msPerToken, memories: chat.memories, stopped };
}
