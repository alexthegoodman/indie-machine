"use client";

import { useMemo, useState } from "react";
import { DEMO, engramHash, normalize, pickPrimes, wordId } from "@/lib/courses/engram-hash";
import { HUES, VizButton, VizFrame } from "./VizFrame";

const PRIMES = pickPrimes(DEMO.tableSizes, DEMO.heads); // [[31, 37], [41, 43]]
const MULTIPLIERS = [7919, 104729, 1299709].map(BigInt);
const START = "the cat sat on the mat and the cat sat on the hat";

interface Gram {
  pos: number;
  words: string[];
  ids: number[];
  rows: number[]; // one per head of this order
}

export function HashBuckets() {
  const [text, setText] = useState(START);
  const [order, setOrder] = useState(2);
  const [pick, setPick] = useState(1);

  const words = useMemo(() => text.split(/\s+/).filter(Boolean).slice(0, 32), [text]);
  const grams = useMemo<Gram[]>(() => {
    const ids = words.map((w) => wordId(w));
    const rows = engramHash(ids, 1, ids.length, { maxNgram: DEMO.maxNgram, primes: PRIMES, multipliers: MULTIPLIERS, padId: DEMO.padId });
    const heads = PRIMES.flat().length;
    const first = (order - 2) * DEMO.heads;
    return words.map((_, t) => {
      const span = Array.from({ length: order }, (_, k) => t - (order - 1) + k);
      return {
        pos: t,
        words: span.map((i) => (i >= 0 ? normalize(words[i]) : "PAD")),
        ids: span.map((i) => (i >= 0 ? ids[i] : DEMO.padId)),
        rows: Array.from({ length: DEMO.heads }, (_, j) => rows[t * heads + first + j]),
      };
    });
  }, [words, order]);

  const key = (g: Gram) => g.words.join(" ");
  const primes = PRIMES[order - 2];
  // Who else lands in the same row, per head.
  const occupants = primes.map((p, j) => {
    const cells: Map<string, number>[] = Array.from({ length: p }, () => new Map());
    for (const g of grams) cells[g.rows[j]].set(key(g), (cells[g.rows[j]].get(key(g)) ?? 0) + 1);
    return cells;
  });
  const sel = grams[Math.min(pick, grams.length - 1)];
  const both = grams.filter((g, i) => grams.some((h, k) => k < i && key(h) !== key(g) && h.rows.every((r, j) => r === g.rows[j])));

  return (
    <VizFrame
      label="MULTI-HEAD HASHING"
      caption={
        <>
          Two hash heads per order with tiny prime tables ({PRIMES.map((p) => p.join(" and ")).join(" rows for bigrams, ")} rows for trigrams), so collisions are easy to
          see. A cell with two different n-grams is a collision in that head; the layer still reads the other head&apos;s row, so an n-gram only loses its memory
          completely when every head collides.
        </>
      }
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Words to hash"
        className="mb-3 h-10 w-full border border-line/22 bg-panel/40 px-3 text-sm text-ink-100 outline-none focus:border-accent"
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[2, 3].map((n) => (
          <VizButton key={n} onClick={() => setOrder(n)} primary={order === n}>
            {n === 2 ? "BIGRAMS" : "TRIGRAMS"}
          </VizButton>
        ))}
        <span className="text-[11px] text-ink-500">Click an n-gram below to see its hash.</span>
      </div>

      {primes.map((p, j) => (
        <div key={j} className="mb-3">
          <div className="mb-1 text-[10px] tracking-[0.16em]" style={{ color: HUES[j] }}>
            HEAD {j} · {p} ROWS
          </div>
          <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${p}, minmax(0, 1fr))` }} data-hash-head={j}>
            {occupants[j].map((cell, r) => {
              const distinct = cell.size;
              const mine = sel && sel.rows[j] === r;
              return (
                <div
                  key={r}
                  title={`row ${r}: ${[...cell.keys()].join(" / ") || "empty"}`}
                  data-collision={distinct > 1 || undefined}
                  className={`h-6 ${mine ? "outline outline-2 outline-accent" : ""}`}
                  style={{ background: distinct === 0 ? "rgba(255,255,255,0.04)" : distinct > 1 ? "#ff7aa8" : HUES[j], opacity: distinct === 0 ? 1 : 0.85 }}
                />
              );
            })}
          </div>
        </div>
      ))}

      {sel && (
        <div className="my-4 border-l-2 border-badge bg-panel/30 px-4 py-3 font-mono text-xs leading-relaxed text-ink-300" data-hash-detail>
          <div className="mb-1 text-ink-100">“{sel.words.join(" ")}” at position {sel.pos}</div>
          <div>
            mix = {sel.ids.map((id, k) => `${id}·${MULTIPLIERS[order - 1 - k]}`).reverse().join(" ⊕ ")}
          </div>
          {(() => {
            let mix = BigInt(0);
            sel.ids.forEach((id, k) => (mix ^= BigInt(id) * MULTIPLIERS[order - 1 - k]));
            return (
              <>
                <div>&nbsp;&nbsp;&nbsp;&nbsp;= {mix.toString()}</div>
                {primes.map((p, j) => (
                  <div key={j} style={{ color: HUES[j] }}>
                    head {j}: {mix.toString()} mod {p} = row {sel.rows[j]}
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5" aria-label="N-grams">
        {grams.map((g, i) => {
          const again = grams.findIndex((h) => key(h) === key(g)) < i;
          const clash = primes.map((_, j) => occupants[j][g.rows[j]].size > 1);
          return (
            <button
              key={i}
              type="button"
              onClick={() => setPick(i)}
              className={`border px-2 py-1 text-left text-[11px] ${i === pick ? "border-accent bg-accent/15 text-accent" : "border-line/18 text-ink-300 hover:border-accent/60"}`}
            >
              {g.words.join(" ")}{" "}
              {g.rows.map((r, j) => (
                <span key={j} style={{ color: clash[j] ? "#ff7aa8" : HUES[j] }}>
                  #{r}{" "}
                </span>
              ))}
              {again && <span className="text-badge">↺</span>}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-ink-500" data-both-collide={both.length}>
        {both.length === 0
          ? "No two different n-grams here collide in both heads."
          : `${both.length} n-gram${both.length > 1 ? "s" : ""} collide${both.length > 1 ? "" : "s"} with another in both heads: ${both.map(key).join(", ")}.`}
      </p>
    </VizFrame>
  );
}
