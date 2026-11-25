"use client";

import { useState } from "react";
import { HUES, Slider, VizFrame } from "./VizFrame";

const N = 16;

export function ConvTaps() {
  const [kernel, setKernel] = useState(4);
  const [dilation, setDilation] = useState(3);
  const [t, setT] = useState(12);
  const taps = Array.from({ length: kernel }, (_, j) => t - (kernel - 1 - j) * dilation);

  return (
    <VizFrame
      label="SHORT CONV: WHICH POSITIONS A TOKEN READS"
      caption={
        <>
          Tap j of a depthwise causal conv reads position t − (k − 1 − j)·dilation. Engram uses k = 4 and dilation = the largest n-gram order (3), so one output
          mixes the gated memory of four positions spread over ten tokens. Taps before the start read zeros.
        </>
      }
    >
      <div className="mb-4 flex flex-wrap gap-4">
        <Slider label="KERNEL k" value={kernel} min={2} max={6} onChange={setKernel} />
        <Slider label="DILATION" value={dilation} min={1} max={4} onChange={setDilation} />
        <Slider label="OUTPUT POSITION t" value={t} min={0} max={N - 1} onChange={setT} />
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))` }} data-conv-taps={taps.filter((p) => p >= 0).join(",")}>
        {Array.from({ length: N }, (_, p) => {
          const j = taps.indexOf(p);
          return (
            <div
              key={p}
              className={`flex h-10 items-center justify-center border text-[11px] ${p === t ? "border-accent" : "border-line/14"}`}
              style={{ background: j >= 0 ? `${HUES[j % HUES.length]}33` : undefined, color: j >= 0 ? HUES[j % HUES.length] : undefined }}
            >
              {p}
            </div>
          );
        })}
      </div>
      <p className="mt-3 font-mono text-xs text-ink-300">
        y[{t}] = {taps.map((p, j) => (p >= 0 ? `w${j}·v[${p}]` : `w${j}·0`)).join(" + ")} → SiLU
      </p>
      <p className="mt-1 text-[11px] text-ink-500">Receptive field: {(kernel - 1) * dilation + 1} tokens.</p>
    </VizFrame>
  );
}
