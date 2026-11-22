"use client";

import { useState } from "react";
import { HUES, Slider, VizButton, VizFrame } from "./VizFrame";

export function BigramTable() {
  const [k, setK] = useState(4);
  const [heads, setHeads] = useState(2);
  const [head, setHead] = useState(1);
  const [prev, setPrev] = useState(2);
  const [id, setId] = useState(3);

  const h = Math.min(head, heads - 1);
  const p = Math.min(prev, k);
  const i = Math.min(id, k - 1);
  const block = (k + 1) * k;
  const row = (h * (k + 1) + p) * k + i;

  return (
    <VizFrame
      label="BIGRAM ROW FINDER"
      caption="Each head owns a block of (K+1)·K rows: one per (previous id, id) pair, plus K rows for “no previous token” (∅). The highlighted cell is the row this head reads."
    >
      <div className="mb-4 flex flex-wrap gap-4">
        <Slider label="K (CENTROIDS)" value={k} min={2} max={8} onChange={setK} />
        <Slider label="HEADS" value={heads} min={1} max={4} onChange={setHeads} />
        <Slider label="HEAD h" value={h} min={0} max={heads - 1} onChange={setHead} />
        <Slider label="PREV" value={p} min={0} max={k} onChange={setPrev} format={(v) => (v === k ? "∅ (= K)" : String(v))} />
        <Slider label="ID" value={i} min={0} max={k - 1} onChange={setId} />
      </div>
      <p className="mb-4 font-mono text-sm text-ink-100" data-row={row}>
        row = (h·(K+1) + prev)·K + id = ({h}·{k + 1} + {p})·{k} + {i} = <span className="text-badge">{row}</span>
      </p>
      <div className="flex flex-wrap gap-3 overflow-x-auto pb-1">
        {Array.from({ length: heads }, (_, hh) => (
          <div key={hh} className={`border p-2 ${hh === h ? "" : "opacity-40"}`} style={{ borderColor: HUES[hh] }}>
            <div className="mb-1.5 text-[10px] tracking-[0.14em]" style={{ color: HUES[hh] }}>
              HEAD {hh} · ROWS {hh * block}-{(hh + 1) * block - 1}
            </div>
            <div className="grid gap-px" style={{ gridTemplateColumns: `auto repeat(${k}, minmax(24px, 1fr))` }}>
              <span />
              {Array.from({ length: k }, (_, c) => (
                <span key={c} className="text-center text-[9px] text-ink-500">
                  id {c}
                </span>
              ))}
              {Array.from({ length: k + 1 }, (_, r) => (
                <Row key={r} r={r} k={k} base={(hh * (k + 1) + r) * k} hit={hh === h && r === p ? i : -1} hue={HUES[hh]} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-400">
        Total: {heads} × {k + 1} × {k} = <span className="text-ink-100">{heads * block}</span> rows.
      </p>
    </VizFrame>
  );
}

function Row({ r, k, base, hit, hue }: { r: number; k: number; base: number; hit: number; hue: string }) {
  return (
    <>
      <span className="pr-1.5 text-right text-[9px] leading-6 text-ink-500">{r === k ? "prev ∅" : `prev ${r}`}</span>
      {Array.from({ length: k }, (_, c) => (
        <span
          key={c}
          className="h-6 text-center text-[10px] leading-6"
          style={c === hit ? { background: hue, color: "#0a0a0a", fontWeight: 600 } : { background: "rgba(15,40,71,0.7)", color: "#93b3d1" }}
        >
          {base + c}
        </span>
      ))}
    </>
  );
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function ParamCalculator() {
  const [k, setK] = useState(256);
  const [heads, setHeads] = useState(16);
  const [width, setWidth] = useState(256);
  const vocab = 8192;
  const dh = width / heads;
  const ok = Number.isInteger(dh);
  const params = heads * (k + 1) * k * dh;
  const naive = vocab * vocab * width;

  return (
    <VizFrame
      label="TABLE SIZE"
      caption="The preset is Yumon cp1's real config (8 layers, width 256, vocab 8192, one N-Grammer layer with K = 256 and 16 heads). The whole model is 27.2M parameters."
    >
      <div className="mb-4 flex flex-wrap gap-4">
        <Slider label="K" value={k} min={16} max={512} step={16} onChange={setK} />
        <Slider label="HEADS" value={heads} min={1} max={32} onChange={setHeads} />
        <Slider label="WIDTH w" value={width} min={64} max={1024} step={64} onChange={setWidth} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <VizButton
          onClick={() => {
            setK(256);
            setHeads(16);
            setWidth(256);
          }}
        >
          YUMON CP1 PRESET
        </VizButton>
      </div>
      {ok ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="ROWS = heads·(K+1)·K" value={fmt(heads * (k + 1) * k)} />
          <Stat label="ROW WIDTH = w / heads" value={fmt(dh)} />
          <Stat label="PARAMETERS = (K+1)·K·w" value={fmt(params)} accent data-params={params} />
        </div>
      ) : (
        <p className="text-sm text-rose-300">Width {width} does not split into {heads} equal heads.</p>
      )}
      <p className="mt-4 text-xs leading-relaxed text-ink-400">
        A plain token-bigram table at the same width would need vocab² · w = 8192² · {width} ={" "}
        <span className="text-ink-100">{fmt(naive)}</span> parameters
        {ok && <> - about {fmt(Math.round(naive / params))}× more</>}. Notice the head count cancels out: more heads means more, narrower rows.
      </p>
    </VizFrame>
  );
}

function Stat({ label, value, accent, ...rest }: { label: string; value: string; accent?: boolean; [k: `data-${string}`]: unknown }) {
  return (
    <div className="border border-line/18 p-3" {...rest}>
      <div className="text-[10px] tracking-[0.12em] text-ink-500">{label}</div>
      <div className={`mt-1 font-display text-xl font-semibold ${accent ? "text-badge" : "text-ink-100"}`}>{value}</div>
    </div>
  );
}
