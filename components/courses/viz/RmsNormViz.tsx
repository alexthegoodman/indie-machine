"use client";

import { useState } from "react";
import { HUES, Slider, VizButton, VizFrame } from "./VizFrame";

export function RmsNormViz() {
  const [v, setV] = useState([1.2, -0.4, 0.8, 0.2]);
  const rms = Math.sqrt(v.reduce((s, x) => s + x * x, 0) / v.length + 1e-6);
  const n = v.map((x) => x / rms);
  const bar = (x: number, max: number) => `${Math.min(50, (Math.abs(x) / max) * 50)}%`;

  return (
    <VizFrame
      label="RMS NORM"
      caption="RMSNorm divides a vector by the square root of its mean square. Scale the raw vector up or down: the normalized bars do not move. That is why the cluster id depends on a slice's direction, not its size."
    >
      <div className="mb-4 flex flex-wrap gap-4">
        {v.map((x, i) => (
          <Slider key={i} label={`h[${i}]`} value={x} min={-2} max={2} step={0.05} format={(y) => y.toFixed(2)} onChange={(y) => setV(v.map((o, j) => (j === i ? y : o)))} />
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {/* Grows by up to 2x but stops at the slider range, so the direction never changes. */}
        <VizButton onClick={() => setV(v.map((x) => x * Math.min(2, 2 / Math.max(...v.map(Math.abs), 1e-6))))}>× 2</VizButton>
        <VizButton onClick={() => setV(v.map((x) => x / 2))}>÷ 2</VizButton>
        <span className="self-center text-xs text-ink-400">
          rms = √(mean(h²)) = <span className="text-ink-100">{rms.toFixed(3)}</span>
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["RAW h", v, 2],
          ["h / rms(h)", n, 2],
        ].map(([label, vals, max]) => (
          <div key={label as string}>
            <div className="mb-2 text-[10px] tracking-[0.16em] text-ink-500">{label as string}</div>
            <div className="flex flex-col gap-1.5">
              {(vals as number[]).map((x, i) => (
                <div key={i} className="relative h-5 border-x border-line/10 bg-panel/30">
                  <span className="absolute top-0 left-1/2 h-full w-px bg-line/30" />
                  <span
                    className="absolute top-0.5 bottom-0.5"
                    style={{
                      background: HUES[i],
                      width: bar(x, max as number),
                      left: x >= 0 ? "50%" : undefined,
                      right: x < 0 ? "50%" : undefined,
                    }}
                  />
                  <span className="absolute right-1 text-[10px] leading-5 text-ink-100">{x.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </VizFrame>
  );
}
