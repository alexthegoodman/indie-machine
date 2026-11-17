"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { bucketLabel, exact } from "@/lib/analytics/format";

type Point = { t: string; v: number };

const H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 48 };

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s * 4 >= v) ?? 10 * mag;
  return step * 4;
}

// One measure over time, this period as a solid line with an area, the previous period of the
// same length as a dashed line for comparison. Hover (or arrow keys) moves a crosshair readout.
export function TimeChart({
  label,
  points,
  prev,
  grain,
}: {
  label: string;
  points: Point[];
  prev: Point[];
  grain: "hour" | "day" | "week";
}) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  const max = useMemo(() => niceMax(Math.max(1, ...points.map((p) => p.v), ...prev.map((p) => p.v))), [points, prev]);
  const iw = w - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const line = (ps: Point[]) => ps.slice(0, n).map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const area = n ? `${line(points)}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z` : "";
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 80))));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left - PAD.left;
    setHover(Math.max(0, Math.min(n - 1, Math.round((px / iw) * (n - 1)))));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
    else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
    else return;
    e.preventDefault();
  };

  const hp = hover !== null ? points[hover] : null;
  const hprev = hover !== null ? prev[hover] : undefined;

  return (
    // Clipped: before hydration the chart renders at the default width, whatever the screen.
    <div ref={box} className="relative overflow-hidden">
      <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-ink-400">
        <span className="flex items-center gap-2">
          <svg width="18" height="4" aria-hidden>
            <line x1="0" y1="2" x2="18" y2="2" stroke="var(--color-accent)" strokeWidth="2" />
          </svg>
          {label}, this period
        </span>
        <span className="flex items-center gap-2">
          <svg width="18" height="4" aria-hidden>
            <line x1="0" y1="2" x2="18" y2="2" stroke="var(--color-ink-500)" strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          previous period
        </span>
      </div>
      <svg
        width={w}
        height={H}
        role="img"
        aria-label={`${label} over time. Use left and right arrow keys to read values.`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
        className="block touch-none outline-none focus-visible:outline-2 focus-visible:outline-accent"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeOpacity={t ? 0.08 : 0.25} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--color-ink-500)">
              {exact(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={p.t} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--color-ink-500)">
              {bucketLabel(p.t, grain)}
            </text>
          ) : null,
        )}
        <path d={area} fill="var(--color-accent)" fillOpacity={0.08} />
        {prev.length > 0 && <path d={line(prev)} fill="none" stroke="var(--color-ink-500)" strokeWidth={2} strokeDasharray="4 3" />}
        <path d={line(points)} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" />
        {hp && hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + ih} stroke="var(--color-ink-300)" strokeOpacity={0.5} />
            <circle cx={x(hover)} cy={y(hp.v)} r={4} fill="var(--color-accent)" stroke="var(--color-ink)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hp && hover !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-8 z-10 min-w-40 border border-line/28 bg-ink px-3 py-2 text-[11px] shadow-lg"
          style={{ left: Math.min(Math.max(0, x(hover) + 12), w - 180) }}
        >
          <div className="text-ink-500">{bucketLabel(hp.t, grain, true)}</div>
          <div className="mt-1 flex items-center gap-2">
            <svg width="12" height="4" aria-hidden>
              <line x1="0" y1="2" x2="12" y2="2" stroke="var(--color-accent)" strokeWidth="2" />
            </svg>
            <strong className="text-sm text-ink-100">{exact(hp.v)}</strong>
            <span className="text-ink-400">{label.toLowerCase()}</span>
          </div>
          {hprev && (
            <div className="mt-0.5 flex items-center gap-2">
              <svg width="12" height="4" aria-hidden>
                <line x1="0" y1="2" x2="12" y2="2" stroke="var(--color-ink-500)" strokeWidth="2" strokeDasharray="3 2" />
              </svg>
              <strong className="text-ink-300">{exact(hprev.v)}</strong>
              <span className="text-ink-500">{bucketLabel(hprev.t, grain, true)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
