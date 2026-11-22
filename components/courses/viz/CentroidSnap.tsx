"use client";

import { useEffect, useRef, useState } from "react";
import { HUES, Slider, VizFrame } from "./VizFrame";

type P = [number, number];
const R = 2.2; // the plane spans [-R, R] on both axes
const SIZE = 320;

const toPx = ([x, y]: P): P => [((x + R) / (2 * R)) * SIZE, ((R - y) / (2 * R)) * SIZE];
const fromPx = (px: number, py: number): P => [(px / SIZE) * 2 * R - R, R - (py / SIZE) * 2 * R];

function seedCentroids(k: number): P[] {
  return Array.from({ length: k }, (_, i) => {
    const a = (i / k) * Math.PI * 2 + 0.4;
    const r = 1.1 + 0.45 * Math.sin(i * 2.7);
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}

/** Unit RMS in 2D: |v| = sqrt(2). */
const rms = ([x, y]: P): P => {
  const s = 1 / Math.sqrt((x * x + y * y) / 2 + 1e-6);
  return [x * s, y * s];
};

export function CentroidSnap() {
  const [k, setK] = useState(5);
  const [cents, setCents] = useState<P[]>(() => seedCentroids(5));
  const [h, setH] = useState<P>([0.5, 0.35]);
  const [normalize, setNormalize] = useState(true);
  const drag = useRef<number | "h" | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  const q = normalize ? rms(h) : h;
  const rowsOf = cents.map((c, i) => {
    const d = (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2;
    const trick = c[0] ** 2 + c[1] ** 2 - 2 * (q[0] * c[0] + q[1] * c[1]);
    return { i, d, trick };
  });
  const best = rowsOf.reduce((a, b) => (b.d < a.d ? b : a)).i;

  // Voronoi regions: every pixel takes its nearest centroid's color.
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const n = 160;
    const img = ctx.createImageData(n, n);
    const rgb = HUES.map((c) => [1, 3, 5].map((o) => parseInt(c.slice(o, o + 2), 16)));
    for (let py = 0; py < n; py++)
      for (let px = 0; px < n; px++) {
        const [x, y] = fromPx((px / n) * SIZE, (py / n) * SIZE);
        let bi = 0;
        let bd = Infinity;
        cents.forEach((c, i) => {
          const d = (x - c[0]) ** 2 + (y - c[1]) ** 2;
          if (d < bd) [bd, bi] = [d, i];
        });
        const o = (py * n + px) * 4;
        const [r, g, b] = rgb[bi % rgb.length];
        img.data.set([r, g, b, 38], o);
      }
    ctx.putImageData(img, 0, 0);
  }, [cents]);

  const onMove = (e: React.PointerEvent) => {
    if (drag.current === null || !svg.current) return;
    const box = svg.current.getBoundingClientRect();
    const p = fromPx(((e.clientX - box.left) / box.width) * SIZE, ((e.clientY - box.top) / box.height) * SIZE).map((v) =>
      Math.max(-R, Math.min(R, v)),
    ) as P;
    if (drag.current === "h") setH(p);
    else {
      const i = drag.current;
      setCents((cs) => cs.map((c, j) => (j === i ? p : c)));
    }
  };

  const [hx, hy] = toPx(h);
  const [qx, qy] = toPx(q);
  const [bx, by] = toPx(cents[best]);

  return (
    <VizFrame
      label="NEAREST CENTROID"
      caption="Drag the white point (one head's slice of the residual) or any centroid. The id is the region the point lands in. With normalization on, the point is first pulled onto the unit-RMS circle, so only its direction matters."
    >
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,340px)_1fr]">
        <div className="relative aspect-square w-full max-w-[340px] touch-none select-none">
          <canvas ref={canvas} width={160} height={160} className="absolute inset-0 h-full w-full" aria-hidden="true" />
          <svg
            ref={svg}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="absolute inset-0 h-full w-full border border-line/20"
            onPointerMove={onMove}
            onPointerUp={() => (drag.current = null)}
            onPointerLeave={() => (drag.current = null)}
            role="img"
            aria-label={`Query point snaps to centroid ${best}`}
          >
            <line x1={SIZE / 2} y1={0} x2={SIZE / 2} y2={SIZE} stroke="rgba(219,234,254,0.12)" />
            <line x1={0} y1={SIZE / 2} x2={SIZE} y2={SIZE / 2} stroke="rgba(219,234,254,0.12)" />
            {normalize && (
              <circle cx={SIZE / 2} cy={SIZE / 2} r={(Math.SQRT2 / (2 * R)) * SIZE} fill="none" stroke="rgba(219,234,254,0.35)" strokeDasharray="4 4" />
            )}
            {normalize && <line x1={hx} y1={hy} x2={qx} y2={qy} stroke="rgba(243,248,252,0.5)" strokeDasharray="2 3" />}
            <line x1={qx} y1={qy} x2={bx} y2={by} stroke={HUES[best % HUES.length]} strokeWidth={2} />
            {cents.map((c, i) => {
              const [x, y] = toPx(c);
              return (
                <g key={i} onPointerDown={(e) => ((drag.current = i), (e.target as Element).setPointerCapture?.(e.pointerId))} className="cursor-grab">
                  <circle cx={x} cy={y} r={14} fill="transparent" />
                  <rect x={x - 7} y={y - 7} width={14} height={14} fill={HUES[i % HUES.length]} stroke="#0a0a0a" strokeWidth={2} />
                  <text x={x + 10} y={y - 9} fontSize={11} fill={HUES[i % HUES.length]}>
                    {i}
                  </text>
                </g>
              );
            })}
            {normalize && <circle cx={qx} cy={qy} r={5} fill="#f3f8fc" />}
            <g onPointerDown={(e) => ((drag.current = "h"), (e.target as Element).setPointerCapture?.(e.pointerId))} className="cursor-grab">
              <circle cx={hx} cy={hy} r={16} fill="transparent" />
              <circle cx={hx} cy={hy} r={8} fill={normalize ? "none" : "#f3f8fc"} stroke="#f3f8fc" strokeWidth={2} />
            </g>
          </svg>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-4">
            <Slider
              label="CENTROIDS K"
              value={k}
              min={2}
              max={8}
              onChange={(v) => {
                setK(v);
                setCents(seedCentroids(v));
              }}
            />
            <label className="flex h-9 items-center gap-2 text-[11px] tracking-[0.08em] text-ink-300">
              <input type="checkbox" checked={normalize} onChange={(e) => setNormalize(e.target.checked)} className="accent-[var(--color-accent)]" />
              RMS-NORMALIZE FIRST
            </label>
          </div>
          <table className="w-full border-collapse text-xs" data-snap-id={best}>
            <thead>
              <tr className="text-left text-ink-500">
                <th className="pb-1.5 font-normal">id</th>
                <th className="pb-1.5 font-normal">|h − c|²</th>
                <th className="pb-1.5 font-normal">|c|² − 2 h·c</th>
              </tr>
            </thead>
            <tbody>
              {rowsOf.map((r) => (
                <tr key={r.i} className={`border-t border-line/10 ${r.i === best ? "bg-accent/10 text-ink-100" : "text-ink-400"}`}>
                  <td className="py-1" style={{ color: HUES[r.i % HUES.length] }}>
                    {r.i}
                    {r.i === best ? "  ← id" : ""}
                  </td>
                  <td className="py-1">{r.d.toFixed(3)}</td>
                  <td className="py-1">{r.trick.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs leading-relaxed text-ink-400">
            The two columns differ by exactly |h|² = {(q[0] ** 2 + q[1] ** 2).toFixed(3)} on every row, so they always pick the same winner. The second
            column never needs |h|², and for all centroids at once it is one matrix multiply.
          </p>
        </div>
      </div>
    </VizFrame>
  );
}
