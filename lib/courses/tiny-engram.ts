// A tiny Engram layer in Hyperfield, the one the Engram course runs in the browser and shows
// in its coding lesson. Same math as deepseek-ai/Engram engram_demo_v1.py with one residual
// stream (hc_mult = 1), written as plain functions over explicit weights so every step can be
// inspected. Uses only Hyperfield 0.1.0 ops; the packaged layer is hf.nn.Engram (0.2.0).
// tests/courses-engram-parity.mjs checks it against PyTorch.
import * as hf from "hyperfield";
import type { Tensor } from "hyperfield";
import { DEMO, type HashConfig, engramHash, pickPrimes, wordId } from "./engram-hash.ts";

export { DEMO, engramHash, normalize, pickPrimes, wordId } from "./engram-hash.ts";
export type { HashConfig } from "./engram-hash.ts";

// ---- 3. The layer ----------------------------------------------------------------------

export interface EngramWeights extends HashConfig {
  table: Tensor; // [sum of primes, dh], every head's rows back to back
  keyW: Tensor; // [d, memory]
  keyB: Tensor; // [d]
  valueW: Tensor; // [d, memory]
  valueB: Tensor; // [d]
  norm1: Tensor; // [d] RMSNorm weight on the key
  norm2: Tensor; // [d] RMSNorm weight on the hidden state (the query)
  convNorm: Tensor; // [d] RMSNorm weight before the conv
  conv: Tensor; // [d, 1, kernel] depthwise causal conv, dilation maxNgram
}

export interface EngramTrace {
  rows: Int32Array; // [b, s, heads] head-local rows
  gate: Tensor; // [b, s] how much of the memory each position lets in
  value: Tensor; // [b, s, d] gate * value projection
  y: Tensor; // [b, s, d] the update; the block adds it to x
}

const rmsNorm = (t: Tensor, weight: Tensor, eps: number) => t.mul(t.square().mean(-1, true).add(eps).rsqrt()).mul(weight);

export function engramLayer(x: Tensor, ids: ArrayLike<number>, w: EngramWeights): EngramTrace {
  const [b, s, d] = x.shape;

  // 1. Hash every 2..N-gram ending at each position into one row per head.
  const rows = engramHash(ids, b, s, w);
  const sizes = w.primes.flat();
  const offsets = sizes.map((_, i) => sizes.slice(0, i).reduce((a, p) => a + p, 0));
  const global = Float32Array.from(rows, (r, i) => r + offsets[i % sizes.length]);

  // 2. Read the rows and concatenate them: the memory vector e.
  const memory = w.table.indexSelect(0, hf.tensor(global, [global.length])).reshape([b, s, -1]);

  // 3. Gate: compare a key from the memory with the hidden state, both RMS-normalized.
  const key = rmsNorm(hf.linear(memory, w.keyW, w.keyB), w.norm1, 2 ** -23);
  const query = rmsNorm(x, w.norm2, 2 ** -23);
  const dot = key.mul(query).sum(-1).div(Math.sqrt(d));
  const gate = dot.abs().maximum(1e-6).sqrt().mul(dot.sign()).sigmoid(); // sigmoid(signed sqrt)

  // 4. Value: the gated projection of the memory.
  const value = gate.unsqueeze(-1).mul(hf.linear(memory, w.valueW, w.valueB));

  // 5. Short causal conv over RMSNorm(value): tap j reads position t - (k-1-j) * dilation.
  const k = w.conv.shape[2];
  const dil = w.maxNgram;
  const pad = (k - 1) * dil;
  const normed = hf.cat([hf.zeros([b, pad, d]), rmsNorm(value, w.convNorm, 1e-5)], 1);
  const taps = w.conv.reshape([d, k]);
  let conv = hf.zeros([b, s, d]);
  for (let j = 0; j < k; j++) {
    const shifted = normed.indexSelect(1, hf.arange(j * dil, j * dil + s));
    conv = conv.add(shifted.mul(taps.indexSelect(1, hf.tensor([j])).reshape([d])));
  }
  const y = value.add(conv.mul(conv.sigmoid())); // value + SiLU(conv)
  return { rows, gate, value, y };
}

// ---- Demo weights and inputs -----------------------------------------------------------

/** Deterministic values in [-1, 1] so every run builds the same weights. */
export const wave = (i: number, seed: number) => Math.sin(seed * 12.9898 + i * 78.233);

export function demoWeights({ convScale = 0.5 } = {}): EngramWeights {
  const { width: d, heads, dh, kernel, maxNgram, tableSizes, padId } = DEMO;
  const primes = pickPrimes(tableSizes, heads);
  const rows = primes.flat().reduce((a, p) => a + p, 0);
  const memory = (maxNgram - 1) * heads * dh;
  const fill = (n: number, seed: number, scale = 1) => Float32Array.from({ length: n }, (_, i) => wave(i, seed) * scale);
  return {
    maxNgram,
    primes,
    multipliers: [7919, 104729, 1299709].map(BigInt), // small odd multipliers keep the course's numbers readable
    padId,
    table: hf.tensor(fill(rows * dh, 1), [rows, dh]),
    keyW: hf.tensor(fill(d * memory, 2, 0.5), [d, memory]),
    keyB: hf.zeros([d]),
    valueW: hf.tensor(fill(d * memory, 3, 0.5), [d, memory]),
    valueB: hf.zeros([d]),
    norm1: hf.ones([d]),
    norm2: hf.ones([d]),
    convNorm: hf.ones([d]),
    conv: hf.tensor(fill(d * kernel, 4, convScale), [d, 1, kernel]),
  };
}

/** A hidden vector per word from its letters (stand-in for the residual stream). */
export function embedWords(words: string[], width = DEMO.width): Tensor {
  const data = new Float32Array(words.length * width);
  words.forEach((word, p) => {
    const seed = wordId(word) + p * 0.37; // the position nudges it, like a real residual
    for (let i = 0; i < width; i++) data[p * width + i] = wave(i, seed);
  });
  return hf.tensor(data, [1, words.length, width]);
}
