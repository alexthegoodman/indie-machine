// Port of hyperfield/examples/yumon/model.ts (the example is not in the npm package). Differs only
// in the import and in disposing explicitly where the original has `using` declarations.
import * as hf from "hyperfield";

const { nn } = hf;
type Tensor = hf.Tensor;

/**
 * The Yumon decoder (yumon-pet python-train/dec_model.py, `YumonDec`) in Hyperfield, for
 * inference. Parameter names match the PyTorch state dict, so `model.pt` loads strictly.
 * Covers what the RunPod configs use: tied, factorized embeddings (token_embed_dim), a frozen
 * JL map in front of each SwiGLU MLP, an N-Grammer layer, elementwise attention gates,
 * interleaved-pair RoPE and RMSNorm (eps 1e-6).
 */

export interface NgramConfig {
  layers: number[];
  num_clusters: number;
  heads: number;
}

/** The "model" section of a train_dec.py config.json. */
export interface YumonConfig {
  vocab_size: number;
  embed_dim: number;
  n_layers: number;
  attn_heads: number;
  ff_dim: number;
  max_seq_len: number;
  token_embed_dim?: number | null;
  tie_embeddings?: boolean;
  jl_ffn_dim?: number | null;
  jl_from_layer?: number;
  ngram?: NgramConfig | null;
  gated_attention?: "none" | "headwise" | "elementwise";
}

const EPS = 1e-6;
const ROPE_THETA = 10_000;

const linear = (i: number, o: number) => new nn.Linear(i, o, { bias: false });
/** Linear layers become QLinear when a quantized checkpoint is loaded. */
type Lin = hf.nn.Linear | hf.nn.QLinear;
type Emb = hf.nn.Embedding | hf.nn.QEmbedding;

/**
 * RoPE on interleaved pairs (x[2i], x[2i+1]), as x * cos + rot(x) * sin. rot swaps each pair
 * with a sign, done as a matmul with a fixed [d, d] matrix, so no slicing is needed.
 */
class Rope extends nn.Module {
  readonly cos: hf.nn.Buffer;
  readonly sin: hf.nn.Buffer;
  readonly rot: hf.nn.Buffer;

  constructor(seq: number, dim: number) {
    super();
    const cos = new Float32Array(seq * dim);
    const sin = new Float32Array(seq * dim);
    for (let p = 0; p < seq; p++) {
      for (let i = 0; i < dim / 2; i++) {
        // f64 angles rounded to f32 once, like rope_tables.
        const a = p * ROPE_THETA ** (-(2 * i) / dim);
        cos[p * dim + 2 * i] = cos[p * dim + 2 * i + 1] = Math.cos(a);
        sin[p * dim + 2 * i] = sin[p * dim + 2 * i + 1] = Math.sin(a);
      }
    }
    const rot = new Float32Array(dim * dim);
    for (let i = 0; i < dim / 2; i++) {
      rot[(2 * i + 1) * dim + 2 * i] = -1; // out[2i] = -x[2i+1]
      rot[2 * i * dim + 2 * i + 1] = 1; // out[2i+1] = x[2i]
    }
    const buf = (d: Float32Array, shape: number[]) => {
      const t = hf.tensor(d, shape);
      try {
        return new nn.Buffer(t, { persistent: false });
      } finally {
        t.dispose();
      }
    };
    this.cos = buf(cos, [seq, dim]);
    this.sin = buf(sin, [seq, dim]);
    this.rot = buf(rot, [dim, dim]);
  }

  /** x [batch, heads, seq, dim] at positions offset, offset + 1, ... */
  forward(x: Tensor, offset = 0): Tensor {
    const s = x.shape[2];
    const pos = hf.arange(offset, offset + s);
    const cos = this.cos.indexSelect(0, pos);
    const sin = this.sin.indexSelect(0, pos);
    return x.mul(cos).add(x.matmul(this.rot).mul(sin));
  }
}

class SwiGLU extends nn.Module {
  readonly w1: Lin;
  readonly w3: Lin;
  readonly w2: Lin;
  constructor(dIn: number, hidden: number, dOut: number) {
    super();
    this.w1 = linear(dIn, hidden);
    this.w3 = linear(dIn, hidden);
    this.w2 = linear(hidden, dOut);
  }
  forward(x: Tensor): Tensor {
    return this.w2.call(nn.F.silu(this.w1.call(x)).mul(this.w3.call(x)));
  }
}

/** What a forward pass shares with every layer. */
interface Step {
  rope: Rope;
  /** Positions before this call's tokens (the cache length). */
  offset: number;
  cache?: hf.nn.KVCache;
}

/** Causal mask for `s` new queries at `offset` over offset + s keys (bottom-right aligned). */
function causalMask(s: number, offset: number): Tensor {
  const total = offset + s;
  const m = new Float32Array(s * total);
  for (let i = 0; i < s; i++) m.fill(-1e30, i * total + offset + i + 1, (i + 1) * total);
  return hf.tensor(m, [s, total]);
}

class Block extends nn.Module<[Tensor, Step], Tensor> {
  readonly layer: number;
  readonly heads: number;
  readonly attn_norm: hf.nn.RMSNorm;
  readonly q: Lin;
  readonly k: Lin;
  readonly v: Lin;
  readonly o: Lin;
  readonly ffn_norm: hf.nn.RMSNorm;
  readonly gate: Lin | null;
  readonly jl: hf.nn.Buffer | null;
  readonly mlp: SwiGLU;

  constructor(cfg: YumonConfig, layer: number) {
    super();
    const w = cfg.embed_dim;
    this.layer = layer;
    this.heads = cfg.attn_heads;
    const hd = w / this.heads;
    this.attn_norm = new nn.RMSNorm(w, { eps: EPS });
    this.q = linear(w, w);
    this.k = linear(w, w);
    this.v = linear(w, w);
    this.o = linear(w, w);
    this.ffn_norm = new nn.RMSNorm(w, { eps: EPS });
    const gated = cfg.gated_attention ?? "none";
    const gateW = gated === "elementwise" ? this.heads * hd : gated === "headwise" ? this.heads : 0;
    this.gate = gateW ? linear(w, gateW) : null;
    let mlpIn = w;
    if (cfg.jl_ffn_dim != null && layer >= (cfg.jl_from_layer ?? 0)) {
      mlpIn = cfg.jl_ffn_dim;
      const r = hf.zeros([w, mlpIn]); // loaded from the checkpoint
      this.jl = new nn.Buffer(r);
      r.dispose();
    } else this.jl = null;
    this.mlp = new SwiGLU(mlpIn, cfg.ff_dim, w);
  }

  forward([x, { rope, offset, cache }]: [Tensor, Step]): Tensor {
    const [b, s, w] = x.shape;
    const n = this.attn_norm.call(x);
    const split = (t: Tensor) => t.reshape([b, s, this.heads, -1]).transpose(1, 2);
    const q = rope.forward(split(this.q.call(n)), offset);
    let k = rope.forward(split(this.k.call(n)), offset);
    let v = split(this.v.call(n));
    if (cache) [k, v] = cache.append(this.layer, k, v);
    // One new token sees every cached key; a prompt after cached tokens needs the offset mask.
    const opts = offset === 0 ? { isCausal: s > 1 } : s > 1 ? { attnMask: causalMask(s, offset) } : {};
    let attn = nn.F.scaledDotProductAttention(q, k, v, opts);
    // headwise gates are [b, heads, s, 1] and broadcast over the head dim.
    if (this.gate) attn = attn.mul(split(this.gate.call(n)).sigmoid());
    x = x.add(this.o.call(attn.transpose(1, 2).reshape([b, s, w])));
    let m = this.ffn_norm.call(x);
    if (this.jl) m = m.matmul(this.jl);
    return x.add(this.mlp.call(m));
  }
}

/**
 * N-Grammer (ngrammer.rs): each head's RMS-normalized slice of the residual is snapped to its
 * nearest centroid; the (previous id, id) bigram picks an embedding that is added back
 * through `out`. The centroid loss only matters for training and is not computed.
 */
class Ngram extends nn.Module {
  readonly k: number;
  readonly h: number;
  readonly dh: number;
  readonly centroids: hf.nn.Parameter;
  readonly bigrams: Emb;
  readonly norm: hf.nn.RMSNorm;
  readonly out: Lin;

  constructor(cfg: NgramConfig, width: number) {
    super();
    this.k = cfg.num_clusters;
    this.h = cfg.heads;
    this.dh = width / this.h;
    const c = hf.zeros([this.h, this.k, this.dh]);
    this.centroids = new nn.Parameter(c);
    c.dispose();
    this.bigrams = new nn.Embedding(this.h * (this.k + 1) * this.k, this.dh);
    this.norm = new nn.RMSNorm(this.dh, { eps: EPS });
    this.out = linear(width, width);
  }

  /** Cluster id per (position, head): [b, s, h], integer-valued. */
  clusterIds(x: Tensor): Tensor {
    const [b, s] = x.shape;
    let h = x.reshape([b, s, this.h, this.dh]);
    h = h.mul(h.square().mean(-1, true).add(EPS).rsqrt());
    h = h.reshape([b * s, this.h, this.dh]).transpose(0, 1); // [heads, rows, dh]
    const c = this.centroids;
    // |c|² - 2 h·c, the row's |h|² is constant per row and dropped (as in PyTorch).
    const dist = c.square().sum(-1).unsqueeze(1).sub(h.matmul(c.transpose(1, 2)).mul(2)); // [heads, rows, k]
    return dist.neg().argmax(-1).transpose(0, 1).reshape([b, s, this.h]);
  }

  /**
   * With a cache, `key` holds the last position's cluster ids from the previous call, so the
   * first new token pairs with them instead of the "no previous" row.
   */
  forward(x: Tensor, cache?: hf.nn.KVCache, key = "ngram"): Tensor {
    const [b, s, w] = x.shape;
    const ids = this.clusterIds(x);
    // prev id: the id one position back, `k` (the "no previous" row) at position 0.
    const last = cache?.get(key); // [b, 1, h]
    let prev: Tensor;
    if (last) prev = s === 1 ? last : hf.cat([last, ids.indexSelect(1, hf.arange(s - 1))], 1);
    else {
      const back = hf.tensor(Float32Array.from({ length: s }, (_, i) => i - 1)); // -1 selects zeros
      const first = hf.tensor(Float32Array.from({ length: s }, (_, i) => (i === 0 ? this.k : 0)), [1, s, 1]);
      prev = ids.indexSelect(1, back).add(first);
    }
    const off = hf.arange(this.h).mul((this.k + 1) * this.k);
    const flat = prev.mul(this.k).add(ids).add(off); // exact: ids < 2^24
    const emb = this.norm.call(this.bigrams.call(flat)).reshape([b, s, w]);
    // Replaced only now: `last` (= prev) is used above and is disposed by the swap.
    if (cache) cache.set(key, s === 1 ? ids : ids.indexSelect(1, hf.tensor([s - 1])));
    return x.add(this.out.call(emb));
  }
}

export interface ForwardOptions {
  /** Only compute logits for the last position (generation). */
  lastOnly?: boolean;
  /** Called with each stage's hidden state [b, s, w] (embed_in, ngram.N, blocks.N, norm). */
  onStage?: (name: string, h: Tensor) => void;
  /**
   * Keys / values (and N-Grammer ids) of earlier calls. `tokens` are the ones after the
   * cached positions; the cache grows by their count.
   */
  cache?: hf.nn.KVCache;
}

export class YumonDec extends nn.Module<Tensor, Tensor> {
  readonly cfg: YumonConfig;
  readonly embedding: Emb;
  readonly embed_in: Lin | null;
  readonly blocks: Block[];
  readonly ngram: Ngram[];
  readonly norm: hf.nn.RMSNorm;
  readonly head_down: Lin | null;
  readonly token_head: Lin | null;
  readonly rope: Rope;

  constructor(cfg: YumonConfig) {
    super();
    const w = cfg.embed_dim;
    if (w % cfg.attn_heads || (w / cfg.attn_heads) % 2) throw new Error("embed_dim must split into attn_heads even-width heads");
    this.cfg = cfg;
    const t = cfg.token_embed_dim ?? w;
    const tied = cfg.tie_embeddings ?? false;
    this.embedding = new nn.Embedding(cfg.vocab_size, t);
    this.embed_in = t !== w ? linear(t, w) : null;
    this.blocks = Array.from({ length: cfg.n_layers }, (_, l) => new Block(cfg, l));
    // Sparse array indexed by layer, so names come out as "ngram.<layer>" like the ModuleDict.
    this.ngram = [];
    for (const l of cfg.ngram?.layers ?? []) this.ngram[l] = new Ngram(cfg.ngram!, w);
    this.norm = new nn.RMSNorm(w, { eps: EPS });
    this.head_down = tied && t !== w ? linear(w, t) : null;
    this.token_head = tied ? null : new nn.Linear(w, cfg.vocab_size);
    this.rope = new Rope(cfg.max_seq_len, w / cfg.attn_heads);
  }

  /** Token ids [b, s] (integer-valued floats) -> logits [b, s, vocab] (or [b, 1, vocab]). */
  forward(tokens: Tensor, { lastOnly = false, onStage, cache }: ForwardOptions = {}): Tensor {
    const offset = cache?.length ?? 0;
    if (offset + tokens.shape[1] > this.cfg.max_seq_len) throw new Error(`${offset + tokens.shape[1]} positions exceed the context of ${this.cfg.max_seq_len}`);
    const step: Step = { rope: this.rope, offset, cache };
    let x = this.embedding.call(tokens);
    if (this.embed_in) x = this.embed_in.call(x);
    onStage?.("embed_in", x);
    this.blocks.forEach((block, l) => {
      const ng = this.ngram[l];
      if (ng) {
        x = ng.forward(x, cache, `ngram.${l}`);
        onStage?.(`ngram.${l}`, x);
      }
      x = block.call([x, step]);
      onStage?.(`blocks.${l}`, x);
    });
    if (lastOnly && x.shape[1] > 1) x = x.indexSelect(1, hf.tensor([x.shape[1] - 1]));
    x = this.norm.call(x);
    onStage?.("norm", x);
    if (this.token_head) return this.token_head.call(x);
    if (this.head_down) x = this.head_down.call(x);
    return nn.F.linear(x, this.embedding.weight); // tied (and possibly quantized) table
  }

  /** `forward` with options (Module.call only passes the input). */
  logits(tokens: Tensor, opts: ForwardOptions = {}): Tensor {
    return this.forward(tokens, opts);
  }
}

export const PAD = 0;
export const BOS = 1;
export const EOS = 2;
/** samples.rs LANGUAGE_SEPARATOR. */
export const SEPARATOR = "\nYumon: ";

/** f32 (model.pt) or the quantized copies from `npm run quantize:yumon`. */
export type Variant = "f32" | "int8" | "int4";
export const VARIANTS: Variant[] = ["f32", "int8", "int4"];

export function weightsFile(variant: Variant): string {
  return variant === "f32" ? "model.pt" : `model-${variant}.safetensors`;
}

/** Everything needed to chat with a checkpoint directory (model.pt, config.json, tokenizer.json). */
export interface Yumon {
  model: YumonDec;
  tokenizer: hf.text.Tokenizer;
  config: YumonConfig;
  variant: Variant;
  /** Size of the weights file. */
  fileBytes: number;
}

export async function loadYumon(baseUrl: string, variant: Variant = "f32"): Promise<Yumon> {
  const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
  const url = base + weightsFile(variant);
  const [config, tokenizer, bytes] = await Promise.all([
    fetch(base + "config.json").then((r) => r.json()).then((c) => c.model as YumonConfig),
    hf.text.Tokenizer.fromUrl(base + "tokenizer.json"),
    hf.data.fetchBytes(url),
  ]);
  const weights = variant === "f32" ? hf.io.loadTorch(bytes) : hf.io.loadSafetensors(bytes);
  return { config, tokenizer, variant, fileBytes: bytes.byteLength, model: fromStateDict(config, weights) };
}

/** Bytes the weights occupy on the backend (quantized: packed ints + f32 scales). */
export function weightBytes(model: hf.nn.Module<any, any>): number {
  return model.namedState().reduce((n, [, t]) => n + (t instanceof hf.quant.QTensor ? t.byteSize : t.size * 4), 0);
}

export function fromStateDict(config: YumonConfig, weights: hf.nn.StateDict): YumonDec {
  const model = new YumonDec(config).eval();
  model.loadStateDict(weights);
  return model;
}

/** samples.rs human_prefix_for (non-Yumon-Talk tokenizers). */
export const HUMAN = "Human: ";

/** [BOS] "Human: <prompt>" SEPARATOR, the way the training cache lays out a turn. */
export function promptIds(tok: hf.text.Tokenizer, prompt: string): number[] {
  return [BOS, ...tok.encode(HUMAN + prompt, { addSpecialTokens: false }), ...tok.encode(SEPARATOR, { addSpecialTokens: false })];
}

/**
 * Text of `ids` without PAD/BOS/EOS. "\n", ":", "," and the brackets are special tokens in this
 * vocabulary, so skipSpecialTokens would drop them too.
 */
export function decodeText(tok: hf.text.Tokenizer, ids: number[]): string {
  return tok.decode(ids.filter((t) => t > EOS), { skipSpecialTokens: false });
}

/** One complete earlier exchange. */
export interface Memory {
  human: string;
  yumon: string;
}

export interface ChatPrompt {
  ids: number[];
  /** The message as sent (shortened when it did not fit). */
  message: string;
  /** How many of the memories made it in, newest first. */
  memories: number;
}

/** Tokens kept free for the reply (incl. EOS), like yumon_portal.rs chat_prompt. */
export const replyReserve = (context: number) => Math.min(256, Math.max(8, Math.floor(context / 4)));

/**
 * yumon_portal.rs chat_prompt + samples.rs language_prompt: earlier turns as
 * "Human: ..\nYumon: ..\n" before the message, adding the newest first until the context minus
 * BOS, separator and the reply reserve is full, then laid out oldest first. A message too long
 * on its own is cut from the end; one that cannot fit at all throws.
 */
export function chatPromptIds(tok: hf.text.Tokenizer, message: string, memories: Memory[], context: number): ChatPrompt {
  const count = (s: string) => tok.encode(s, { addSpecialTokens: false }).length;
  const sep = tok.encode(SEPARATOR, { addSpecialTokens: false });
  const budget = context - 1 - sep.length - replyReserve(context);
  if (budget <= count(HUMAN)) throw new Error("Checkpoint context is too short");
  // Longest prefix (by code point) that fits; binary search instead of popping one char at a time.
  const chars = [...message.trim()];
  let [lo, hi] = [0, chars.length];
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (count(HUMAN + chars.slice(0, mid).join("")) <= budget) lo = mid;
    else hi = mid - 1;
  }
  const fitted = chars.slice(0, lo).join("");
  if (!fitted.trim()) throw new Error("Checkpoint context cannot fit your message");
  const current = HUMAN + fitted;
  let prompt = current;
  let turns = "";
  let used = 0;
  for (let i = memories.length - 1; i >= 0; i--) {
    const candidateTurns = `${HUMAN}${memories[i].human}${SEPARATOR}${memories[i].yumon}\n` + turns;
    if (count(candidateTurns + current) > budget) break;
    turns = candidateTurns;
    prompt = turns + current;
    used++;
  }
  return { ids: [BOS, ...tok.encode(prompt, { addSpecialTokens: false }), ...sep], message: fitted, memories: used };
}

/** Where a reply runs on into the next turn (the tokenizer lowercases, so both cases). */
export const TURN_STOPS = ["\nHuman:", "\nhuman:", "\nperson:"];
const NEXT_TURN = /\n(?:human|person):/i;
const STRAY_MARKER = /\n(?:human|person|input|rejected|chosen):/i;

function stripOuterQuotes(s: string): string {
  let t = s.trim();
  for (const [open, close] of [['"', '"'], ["“", "”"], ["'", "'"]]) {
    if (t.startsWith(open)) t = t.slice(open.length);
    if (t.endsWith(close)) t = t.slice(0, -close.length);
  }
  return t.trim();
}

/**
 * yumon_portal.rs reply cleanup: cut at the next turn, then parse_chat_response_loose (drop a
 * leading "reply:" / "speak:" / "yumon:" label, stray INPUT:/REJECTED:/CHOSEN: lines and outer quotes).
 */
export function cleanReply(raw: string): string {
  let text = raw.split(NEXT_TURN)[0].trim();
  const lower = text.toLowerCase();
  for (const label of ["reply:", "speak:", "yumon:"]) {
    const i = lower.indexOf(label);
    if (i >= 0) {
      text = text.slice(i + label.length);
      break;
    }
  }
  text = text.trim().split(STRAY_MARKER)[0].trim();
  return stripOuterQuotes(text) || text;
}

export interface GenerateOptions {
  maxTokens?: number;
  /** 0 = greedy (argmax). Default 0.9. */
  temperature?: number;
  topK?: number;
  rng?: hf.Rng;
  /** Reuse keys / values between steps (default). false recomputes the whole prefix each step. */
  kvCache?: boolean;
  /** Called after each new token with the ids so far and the text. */
  onToken?: (ids: number[], text: string) => void;
  /** End early once the text contains one of these (e.g. TURN_STOPS). */
  stop?: string[];
}

export interface Generation {
  ids: number[];
  text: string;
  /** Seconds per token, by step. */
  stepTimes: number[];
}

/**
 * Top-k sampling like dec_model.generate (temperature 0.9, k 10), stopping at EOS/PAD or the
 * context length. With the KV cache (default) the first step runs the prompt and every later
 * step only the newest token; stepTimes[0] is that prefill.
 */
export async function generate({ model, tokenizer }: Yumon, prompt: number[], opts: GenerateOptions = {}): Promise<Generation> {
  const { maxTokens = 200, temperature = 0.9, topK = 10, rng = new hf.Rng(Date.now() >>> 0), kvCache = true, onToken, stop = [] } = opts;
  const ids = [...prompt];
  const out: number[] = [];
  const stepTimes: number[] = [];
  const decode = () => decodeText(tokenizer, out);
  const cache = new hf.nn.KVCache();
  try {
    for (let step = 0; step < maxTokens && ids.length < model.cfg.max_seq_len; step++) {
      const t0 = performance.now();
      const feed = kvCache ? ids.slice(cache.length) : ids;
      const logits = await hf.scope(async () =>
        hf.noGrad(() => model.logits(hf.tensor(Float32Array.from(feed), [1, feed.length]), { lastOnly: true, cache: kvCache ? cache : undefined })).data(),
      );
      const next = temperature <= 0 ? argmax(logits) : sampleTopK(logits, temperature, topK, rng);
      stepTimes.push((performance.now() - t0) / 1000);
      if (next === PAD || next === EOS) break;
      ids.push(next);
      out.push(next);
      const text = decode();
      onToken?.(out, text);
      if (stop.some((s) => text.includes(s))) break;
    }
  } finally {
    cache.dispose();
  }
  return { ids: out, text: decode(), stepTimes };
}

export function argmax(v: Float32Array): number {
  let best = 0;
  for (let i = 1; i < v.length; i++) if (v[i] > v[best]) best = i;
  return best;
}

/** The k largest logits as (id, probability) after temperature, highest first. */
export function topK(logits: Float32Array, k: number, temperature = 1): { id: number; p: number }[] {
  const idx = Array.from(logits.keys()).sort((a, b) => logits[b] - logits[a]).slice(0, k);
  const scaled = idx.map((i) => logits[i] / temperature);
  const m = Math.max(...scaled);
  const e = scaled.map((v) => Math.exp(v - m));
  const z = e.reduce((a, b) => a + b, 0);
  return idx.map((id, i) => ({ id, p: e[i] / z }));
}

function sampleTopK(logits: Float32Array, temperature: number, k: number, rng: hf.Rng): number {
  const cands = topK(logits, k, temperature);
  let r = rng.next();
  for (const c of cands) {
    if ((r -= c.p) <= 0) return c.id;
  }
  return cands[cands.length - 1].id;
}
