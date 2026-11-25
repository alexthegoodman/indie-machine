// Engram's addressing for the Engram course, without Hyperfield (so the widgets that only
// hash and normalize stay out of the Hyperfield chunk). Same math as deepseek-ai/Engram
// engram_demo_v1.py: CompressedTokenizer's normalizer, NgramHashMapping and its prime search.

// ---- 1. Tokenizer compression ----------------------------------------------------------

const SENTINEL = "";

/** The demo's normalizer: NFKC, NFD, strip combining marks, lowercase, collapse whitespace, strip. */
export function normalize(text: string): string {
  let s = text.normalize("NFKC").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  s = s.replace(/[ \t\r\n]+/g, " ");
  if (s === " ") s = SENTINEL; // a lone space stays a token
  return s.replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "").replaceAll(SENTINEL, " ");
}

// ---- 2. Multi-head hashing -------------------------------------------------------------

export interface HashConfig {
  maxNgram: number; // orders 2..maxNgram
  primes: number[][]; // [order - 2][head] table size per head
  multipliers: bigint[]; // one odd multiplier per shift 0..maxNgram-1
  padId: number; // the token before the start
}

/**
 * Head-local rows [b, s, heads] for token ids [b, s]: for each order n,
 * mix = t[0]*m0 XOR t[-1]*m1 XOR ... (int64), and head j reads row mix mod p_j.
 */
export function engramHash(ids: ArrayLike<number>, batch: number, seq: number, { maxNgram, primes, multipliers, padId }: HashConfig): Int32Array {
  const heads = primes.flat().length;
  const out = new Int32Array(batch * seq * heads);
  for (let b = 0; b < batch; b++) {
    const tok = (t: number) => BigInt(t >= 0 ? ids[b * seq + t] : padId);
    for (let t = 0; t < seq; t++) {
      let mix = tok(t) * multipliers[0];
      let o = (b * seq + t) * heads;
      for (let n = 2; n <= maxNgram; n++) {
        mix ^= tok(t - (n - 1)) * multipliers[n - 1];
        for (const p of primes[n - 2]) out[o++] = Number(mix % BigInt(p));
      }
    }
  }
  return out;
}

// ---- Primes and demo token ids --------------------------------------------------------

const isPrime = (n: number) => n > 1 && Array.from({ length: Math.floor(Math.sqrt(n)) - 1 }, (_, i) => i + 2).every((q) => n % q);

/** Distinct primes above each order's table size, as the demo picks them. */
export function pickPrimes(tableSizes: number[], heads: number): number[][] {
  const seen = new Set<number>();
  return tableSizes.map((size) => {
    let p = size - 1;
    return Array.from({ length: heads }, () => {
      do p++;
      while (!isPrime(p) || seen.has(p));
      seen.add(p);
      return p;
    });
  });
}

export const DEMO = { width: 8, heads: 2, dh: 4, kernel: 4, maxNgram: 3, tableSizes: [31, 37], vocab: 1000, padId: 0 };

/** A stable id per normalized word (FNV-1a), so "The" and "the" get the same token id. */
export function wordId(word: string, vocab = DEMO.vocab): number {
  let h = 0x811c9dc5;
  for (const ch of normalize(word)) h = Math.imul(h ^ ch.codePointAt(0)!, 0x01000193);
  return 1 + ((h >>> 0) % (vocab - 1)); // 0 is PAD
}
