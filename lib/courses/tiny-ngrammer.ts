// A tiny N-Grammer layer in Hyperfield, the one the N-Grammer course runs in the browser and
// shows in its coding lesson. Same math as yumon-pet python-train/dec_model.py `Ngram.forward`
// (and lib/yumon/model.ts), written as plain functions over explicit weights so every step can
// be inspected. tests/courses-parity.mjs checks it against the PyTorch layer.
import * as hf from "hyperfield";
import type { Tensor } from "hyperfield";

const EPS = 1e-6;

export interface NgramWeights {
  heads: number;
  k: number; // centroids per head
  centroids: Tensor; // [heads, k, dh]
  bigrams: Tensor; // [heads * (k + 1) * k, dh]
  out: Tensor; // [width, width], used as x @ out^T like nn.Linear
}

export interface NgramTrace {
  ids: Tensor; // [b, s, heads] nearest centroid per head
  prev: Tensor; // [b, s, heads] the id one position back, k at position 0
  rows: Tensor; // [b, s, heads] bigram table row per head
  y: Tensor; // [b, s, width] x + out(norm(bigram embeddings))
}

/** Scale each vector along the last axis to unit RMS. */
const rmsNorm = (t: Tensor) => t.mul(t.square().mean(-1, true).add(EPS).rsqrt());

export function ngramLayer(x: Tensor, { heads, k, centroids, bigrams, out }: NgramWeights): NgramTrace {
  const [b, s, width] = x.shape;
  const dh = width / heads;

  // 1. Split the residual into heads and RMS-normalize each slice.
  const h = rmsNorm(x.reshape([b, s, heads, dh]))
    .reshape([b * s, heads, dh])
    .transpose(0, 1); // [heads, rows, dh]

  // 2. Nearest centroid. |h - c|² = |h|² - 2 h·c + |c|², and |h|² is the same for every c.
  const dist = centroids.square().sum(-1).unsqueeze(1).sub(h.matmul(centroids.transpose(1, 2)).mul(2));
  const ids = dist.neg().argmax(-1).transpose(0, 1).reshape([b, s, heads]); // argmin

  // 3. Previous id: shift right by one, with k (the "no previous" row) at position 0.
  const start = hf.full([b, 1, heads], k);
  const prev = s === 1 ? start : hf.cat([start, ids.indexSelect(1, hf.arange(s - 1))], 1);

  // 4. One exact bigram row per head: head h owns rows [h (k+1) k, (h+1) (k+1) k).
  const rows = prev.mul(k).add(ids).add(hf.arange(heads).mul((k + 1) * k));

  // 5. Look up, normalize, project back to full width and add to the residual.
  const emb = rmsNorm(bigrams.indexSelect(0, rows.reshape([b * s * heads])).reshape([b, s, heads, dh]));
  const y = x.add(hf.linear(emb.reshape([b, s, width]), out));
  return { ids, prev, rows, y };
}

/** Deterministic values in [-1, 1] so PyTorch and Hyperfield can build the same weights. */
export const wave = (i: number, seed: number) => Math.sin(seed * 12.9898 + i * 78.233);

export function demoWeights({ width = 8, heads = 2, k = 4, outScale = 0.5 } = {}): NgramWeights {
  const dh = width / heads;
  const fill = (n: number, seed: number, scale = 1) => Float32Array.from({ length: n }, (_, i) => wave(i, seed) * scale);
  return {
    heads,
    k,
    centroids: hf.tensor(fill(heads * k * dh, 1), [heads, k, dh]),
    bigrams: hf.tensor(fill(heads * (k + 1) * k * dh, 2, 0.02), [heads * (k + 1) * k, dh]),
    out: hf.tensor(fill(width * width, 3, outScale), [width, width]),
  };
}

/** One vector per word, from its characters, so the same word always lands on the same ids. */
export function embedWords(words: string[], width = 8): Tensor {
  const data = new Float32Array(words.length * width);
  words.forEach((word, p) => {
    let seed = 7;
    for (const ch of word) seed = (seed * 31 + ch.charCodeAt(0)) % 10007;
    for (let i = 0; i < width; i++) data[p * width + i] = wave(i, seed);
  });
  return hf.tensor(data, [1, words.length, width]);
}
