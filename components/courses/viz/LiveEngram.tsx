"use client";

import { useEffect, useState } from "react";
import { HUES, Slider, VizFrame } from "./VizFrame";

interface Out {
  backend: string;
  ms: number;
  words: string[];
  ids: number[];
  rows: number[][]; // [pos][4]: bigram heads 0-1, trigram heads 0-1
  gate: number[];
  delta: number[]; // |y| per position
  conv: number[]; // |y - value|: what the short conv adds
}

const HEADS = 4;

// Runs lib/courses/tiny-engram.ts with Hyperfield in the page (whatever backend is active:
// CPU unless the Yumon chat already started WebGPU in this tab).
export function LiveEngram({ showConv = false, initial = "The cat sat on the mat and the Cat sat on the hat" }: { showConv?: boolean; initial?: string }) {
  const [text, setText] = useState(initial);
  const [convScale, setConvScale] = useState(showConv ? 0 : 0.5);
  const [out, setOut] = useState<Out | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const words = text.split(/\s+/).filter(Boolean).slice(0, 24);
    if (!words.length) return;
    (async () => {
      try {
        const [hf, lib] = await Promise.all([import("hyperfield"), import("@/lib/courses/tiny-engram")]);
        const t0 = performance.now();
        const ids = words.map((w) => lib.wordId(w));
        const result = await hf.scope(async () => {
          const w = lib.demoWeights({ convScale });
          const x = lib.embedWords(words);
          const t = lib.engramLayer(x, ids, w);
          return { rows: t.rows, gate: await t.gate.data(), d: await t.y.square().sum(-1).sqrt().data(), conv: await t.y.sub(t.value).square().sum(-1).sqrt().data() };
        });
        if (!live) return;
        setOut({
          backend: hf.getBackend().name,
          ms: performance.now() - t0,
          words,
          ids,
          rows: words.map((_, p) => Array.from(result.rows.slice(p * HEADS, (p + 1) * HEADS))),
          gate: Array.from(result.gate),
          delta: Array.from(result.d),
          conv: Array.from(result.conv),
        });
        setError(null);
      } catch (e) {
        if (live) setError(String(e));
      }
    })();
    return () => {
      live = false;
    };
  }, [text, convScale]);

  const seen2 = new Map<string, number>();
  const seen3 = new Map<string, number>();

  return (
    <VizFrame
      label="LIVE ENGRAM (HYPERFIELD, IN THIS PAGE)"
      caption={
        <>
          The function from the code step, running in your browser: width 8, orders 2 and 3, two heads each with 31-43 rows, fixed weights. Words are normalized
          before they get an id, so “The” and “the” are the same token. ↺ marks an n-gram the sentence already read: the same rows, the same memory. The gate
          still differs, because it also looks at the hidden state.
        </>
      }
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Words to run through the layer"
        className="mb-4 h-10 w-full border border-line/22 bg-panel/40 px-3 text-sm text-ink-100 outline-none focus:border-accent"
      />
      {showConv && (
        <div className="mb-4 max-w-md">
          <Slider label="CONV WEIGHT SCALE" value={convScale} min={0} max={1} step={0.05} onChange={setConvScale} format={(v) => (v === 0 ? "0 (paper's init)" : v.toFixed(2))} />
        </div>
      )}
      {error && <p className="text-sm text-rose-300">Could not run Hyperfield here: {error}</p>}
      {out && (
        <div className="overflow-x-auto" data-live-engram data-backend={out.backend}>
          <table className="w-full min-w-[520px] border-collapse text-left text-xs">
            <thead>
              <tr className="text-ink-500">
                <th className="pb-1.5 font-normal">pos</th>
                <th className="pb-1.5 font-normal">word</th>
                <th className="pb-1.5 font-normal">id</th>
                <th className="pb-1.5 font-normal">2-gram rows</th>
                <th className="pb-1.5 font-normal">3-gram rows</th>
                <th className="pb-1.5 font-normal">gate</th>
                <th className="pb-1.5 font-normal">|y|</th>
                {showConv && <th className="pb-1.5 font-normal">|y − value|</th>}
              </tr>
            </thead>
            <tbody>
              {out.words.map((w, p) => {
                const k2 = out.ids.slice(Math.max(0, p - 1), p + 1).join(",") + (p < 1 ? ",pad" : "");
                const k3 = out.ids.slice(Math.max(0, p - 2), p + 1).join(",") + (p < 2 ? ",pad" : "");
                const again2 = seen2.has(k2);
                const again3 = seen3.has(k3);
                if (!again2) seen2.set(k2, p);
                if (!again3) seen3.set(k3, p);
                return (
                  <tr key={p} className="border-t border-line/10" data-bigram-repeat={again2 || undefined} data-trigram-repeat={again3 || undefined}>
                    <td className="py-1.5 text-ink-500">{p}</td>
                    <td className="py-1.5 text-ink-100">{w}</td>
                    <td className="py-1.5 text-ink-300">{out.ids[p]}</td>
                    {[0, 2].map((h0) => (
                      <td key={h0} className="py-1.5">
                        {out.rows[p].slice(h0, h0 + 2).map((v, h) => (
                          <span key={h} className="mr-1.5" style={{ color: HUES[h] }}>
                            #{v}
                          </span>
                        ))}
                        {(h0 === 0 ? again2 : again3) && <span className="text-badge">↺ {(h0 === 0 ? seen2 : seen3).get(h0 === 0 ? k2 : k3)}</span>}
                      </td>
                    ))}
                    <td className="py-1.5">
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block h-2 w-14 bg-line/10">
                          <span className="block h-2 bg-accent" style={{ width: `${out.gate[p] * 100}%` }} />
                        </span>
                        <span className="text-ink-300" data-gate={out.gate[p].toFixed(3)}>
                          {out.gate[p].toFixed(3)}
                        </span>
                      </span>
                    </td>
                    <td className="py-1.5 text-ink-300" data-y={out.delta[p].toFixed(4)}>
                      {out.delta[p].toFixed(4)}
                    </td>
                    {showConv && (
                      <td className="py-1.5 text-ink-300" data-conv={out.conv[p].toFixed(4)}>
                        {out.conv[p].toFixed(4)}
                      </td>
                    )}
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
