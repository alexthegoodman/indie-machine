"use client";

import { useState } from "react";
import { Slider, VizFrame } from "./VizFrame";

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
// After RMSNorm both vectors have length √d, so <k, q> / √d = cos · √d.
const raw = (cos: number, d: number) => cos * Math.sqrt(d);
const signedSqrt = (z: number) => Math.sign(z) * Math.sqrt(Math.max(Math.abs(z), 1e-6));

const W = 520;
const H = 200;
const PAD = 28;

export function GateCurve() {
  const [logD, setLogD] = useState(10);
  const [cos, setCos] = useState(0.2);
  const d = 2 ** logD;

  const xs = Array.from({ length: 201 }, (_, i) => -1 + i / 100);
  const px = (c: number) => PAD + ((c + 1) / 2) * (W - 2 * PAD);
  const py = (g: number) => H - PAD - g * (H - 2 * PAD);
  const path = (f: (c: number) => number) => xs.map((c, i) => `${i ? "L" : "M"}${px(c).toFixed(1)},${py(f(c)).toFixed(1)}`).join(" ");
  const withSqrt = (c: number) => sigmoid(signedSqrt(raw(c, d)));
  const without = (c: number) => sigmoid(raw(c, d));

  return (
    <VizFrame
      label="THE GATE"
      caption={
        <>
          The gate for one position as a function of the cosine between the normalized key and the normalized hidden state. Solid: Engram&apos;s
          sigmoid(signed √(·)). Dashed: the same without the square root. At the demo&apos;s width (1,024 per stream) the dashed gate is close to a hard
          on/off switch; the square root keeps it graded.
        </>
      }
    >
      <div className="mb-4 flex flex-wrap gap-4">
        <Slider label="WIDTH d" value={logD} min={2} max={13} onChange={setLogD} format={(v) => (2 ** v).toLocaleString()} />
        <Slider label="COSINE(key, hidden)" value={cos} min={-1} max={1} step={0.01} onChange={setCos} format={(v) => v.toFixed(2)} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl" role="img" aria-label="Gate value against cosine similarity">
        <line x1={PAD} x2={W - PAD} y1={py(0.5)} y2={py(0.5)} stroke="currentColor" className="text-line/20" />
        <line x1={px(0)} x2={px(0)} y1={PAD} y2={H - PAD} stroke="currentColor" className="text-line/20" />
        <path d={path(without)} fill="none" stroke="#ffc857" strokeWidth={1.5} strokeDasharray="5 4" />
        <path d={path(withSqrt)} fill="none" stroke="var(--color-accent)" strokeWidth={2.5} />
        <circle cx={px(cos)} cy={py(withSqrt(cos))} r={5} fill="var(--color-accent)" />
        <circle cx={px(cos)} cy={py(without(cos))} r={4} fill="#ffc857" />
        {[-1, 0, 1].map((c) => (
          <text key={c} x={px(c)} y={H - 8} textAnchor="middle" className="fill-ink-500 text-[10px]">
            {c}
          </text>
        ))}
        {[0, 0.5, 1].map((g) => (
          <text key={g} x={6} y={py(g) + 3} className="fill-ink-500 text-[10px]">
            {g}
          </text>
        ))}
      </svg>
      <div className="mt-3 grid gap-1 font-mono text-xs text-ink-300 sm:grid-cols-2" data-gate>
        <div>&lt;k, q&gt; / √d = {raw(cos, d).toFixed(3)}</div>
        <div>signed √ = {signedSqrt(raw(cos, d)).toFixed(3)}</div>
        <div className="text-accent" data-gate-value>
          gate = {withSqrt(cos).toFixed(4)}
        </div>
        <div className="text-badge">without √: {without(cos).toFixed(4)}</div>
      </div>
    </VizFrame>
  );
}
