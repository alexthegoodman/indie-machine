"use client";

import { useEffect, useState } from "react";
import { HUES, Slider, VizFrame } from "./VizFrame";

interface Out {
  backend: string;
  ms: number;
  words: string[];
  ids: number[][];
  prev: number[][];
  rows: number[][];
  delta: number[];
}

const K = 4;
const HEADS = 2;
const WIDTH = 8;

const chunk = (a: Float32Array, n: number) => Array.from({ length: a.length / n }, (_, i) => Array.from(a.slice(i * n, i * n + n)));

// Runs lib/courses/tiny-ngrammer.ts with Hyperfield in the page (whatever backend is active:
// CPU unless the Yumon chat already started WebGPU in this tab).
export function LiveNgram({ showScale = false, initial = "the cat sat on the mat and the cat ran" }: { showScale?: boolean; initial?: string }) {
  const [text, setText] = useState(initial);
  const [scale, setScale] = useState(showScale ? 0 : 0.5);
  const [out, setOut] = useState<Out | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const words = text.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 24);
    if (!words.length) return;
    (async () => {
      try {
        const [hf, lib] = await Promise.all([import("hyperfield"), import("@/lib/courses/tiny-ngrammer")]);
        const t0 = performance.now();
        const result = await hf.scope(async () => {
          const w = lib.demoWeights({ width: WIDTH, heads: HEADS, k: K, outScale: scale });
          const x = lib.embedWords(words, WIDTH);
          const t = lib.ngramLayer(x, w);
          const d = await t.y.sub(x).square().sum(-1).sqrt().data();
          return { ids: await t.ids.data(), prev: await t.prev.data(), rows: await t.rows.data(), d };
        });
        if (!live) return;
        setOut({
          backend: hf.getBackend().name,
          ms: performance.now() - t0,
          words,
          ids: chunk(result.ids, HEADS),
          prev: chunk(result.prev, HEADS),
          rows: chunk(result.rows, HEADS),
          delta: Array.from(result.d),
        });
        setError(null);
      } catch (e) {
        if (live) setError(String(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [text, scale]);

  const seen = new Map<string, number>();

  return (
    <VizFrame
      label="LIVE N-GRAMMER (HYPERFIELD, IN THIS PAGE)"
      caption={
        <>
          This is the exact function from the code step above, running in your browser: width 8, 2 heads, K = 4, fixed weights. A word&apos;s vector comes from its
          letters, so a repeated word gets the same ids. Rows marked ↺ were already read earlier in the sentence - the same bigram, the same memory.
        </>
      }
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Words to run through the layer"
        className="mb-4 h-10 w-full border border-line/22 bg-panel/40 px-3 text-sm text-ink-100 outline-none focus:border-accent"
      />
      {showScale && (
        <div className="mb-4 max-w-md">
          <Slider label="OUT PROJECTION SCALE" value={scale} min={0} max={1} step={0.05} onChange={setScale} format={(v) => (v === 0 ? "0 (fresh init)" : v.toFixed(2))} />
        </div>
      )}
      {error && <p className="text-sm text-rose-300">Could not run Hyperfield here: {error}</p>}
      {out && (
        <div className="overflow-x-auto" data-live-ngram data-backend={out.backend}>
          <table className="w-full min-w-[480px] border-collapse text-left text-xs">
            <thead>
              <tr className="text-ink-500">
                <th className="pb-1.5 font-normal">pos</th>
                <th className="pb-1.5 font-normal">word</th>
                <th className="pb-1.5 font-normal">ids</th>
                <th className="pb-1.5 font-normal">prev</th>
                <th className="pb-1.5 font-normal">rows</th>
                <th className="pb-1.5 font-normal">|y − x|</th>
              </tr>
            </thead>
            <tbody>
              {out.words.map((w, p) => {
                const key = out.rows[p].join(",");
                const again = seen.has(key);
                if (!again) seen.set(key, p);
                return (
                  <tr key={p} className="border-t border-line/10" data-row-repeat={again || undefined}>
                    <td className="py-1.5 text-ink-500">{p}</td>
                    <td className="py-1.5 text-ink-100">{w}</td>
                    {[out.ids[p], out.prev[p]].map((vals, c) => (
                      <td key={c} className="py-1.5">
                        {vals.map((v, h) => (
                          <span key={h} className="mr-1" style={{ color: HUES[h] }}>
                            {c === 1 && v === K ? "∅" : v}{" "}
                          </span>
                        ))}
                      </td>
                    ))}
                    <td className="py-1.5">
                      {out.rows[p].map((v, h) => (
                        <span key={h} className="mr-1.5" style={{ color: HUES[h] }}>
                          #{v}{" "}
                        </span>
                      ))}
                      {again && <span className="text-badge">↺ pos {seen.get(key)}</span>}
                    </td>
                    <td className="py-1.5 text-ink-300">{out.delta[p].toFixed(4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-ink-500">
            Backend: {out.backend} · {out.words.length} tokens · {out.ms.toFixed(1)} ms including weight setup
          </p>
        </div>
      )}
    </VizFrame>
  );
}
