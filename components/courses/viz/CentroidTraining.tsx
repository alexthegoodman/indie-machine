"use client";

import { useEffect, useMemo, useState } from "react";
import { HUES, Slider, VizButton, VizFrame } from "./VizFrame";

type P = [number, number];
const R = 2.4;
const SIZE = 320;
const LOSS_WEIGHT = 0.25; // Yumon's default ngram.loss_weight
const toPx = ([x, y]: P): P => [((x + R) / (2 * R)) * SIZE, ((R - y) / (2 * R)) * SIZE];

/** Small deterministic PRNG so the scene is the same on every load. */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function makePoints(): P[] {
  const r = rng(42);
  const blobs: P[] = [
    [-1.1, 0.9],
    [1.2, 0.6],
    [0.1, -1.2],
  ];
  return blobs.flatMap(([cx, cy]) =>
    Array.from({ length: 30 }, () => {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 0.55;
      return [cx + Math.cos(a) * d, cy + Math.sin(a) * d] as P;
    }),
  );
}

const START: P[] = [
  [-0.3, 0.2],
  [0.4, 0.1],
  [0.2, -0.4],
  [-2.1, -2.1], // far from every point: never the nearest, so it never moves
];

function assign(points: P[], cents: P[]) {
  return points.map(([x, y]) => {
    let best = 0;
    let bd = Infinity;
    cents.forEach(([cx, cy], i) => {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < bd) [bd, best] = [d, i];
    });
    return best;
  });
}

/** loss_weight · mean over every element of (c_id − h)², as dec_model.py computes it. */
function loss(points: P[], cents: P[], ids: number[]) {
  let s = 0;
  points.forEach(([x, y], n) => {
    const [cx, cy] = cents[ids[n]];
    s += (cx - x) ** 2 + (cy - y) ** 2;
  });
  return (LOSS_WEIGHT * s) / (points.length * 2);
}

export function CentroidTraining() {
  const points = useMemo(makePoints, []);
  const [cents, setCents] = useState<P[]>(START);
  const [lr, setLr] = useState(3);
  const [playing, setPlaying] = useState(false);
  const [history, setHistory] = useState<number[]>([]);

  const ids = assign(points, cents);
  const counts = cents.map((_, i) => ids.filter((v) => v === i).length);
  const current = loss(points, cents, ids);

  const step = () => {
    // d loss / d c_j = loss_weight · 2 Σ_{h assigned to j} (c_j − h) / (N · D). h is detached:
    // the points never move, only the centroids do.
    const scale = (LOSS_WEIGHT * 2) / (points.length * 2);
    const grads = cents.map(() => [0, 0] as P);
    points.forEach(([x, y], n) => {
      const g = grads[ids[n]];
      g[0] += (cents[ids[n]][0] - x) * scale;
      g[1] += (cents[ids[n]][1] - y) * scale;
    });
    setHistory((h) => [...h.slice(-59), current]);
    setCents(cents.map(([cx, cy], i) => [cx - lr * grads[i][0], cy - lr * grads[i][1]]));
  };

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(step, 220);
    return () => clearTimeout(t);
  });

  const hist = [...history, current];
  const maxL = Math.max(...hist, 1e-6);

  return (
    <VizFrame
      label="TRAINING THE CENTROIDS"
      caption="Each step is plain gradient descent on the centroid loss (loss_weight 0.25). A centroid moves toward the points currently assigned to it, faster when it has more of them. Centroid 3 starts where no point is nearest, so its gradient is zero forever: a dead centroid."
    >
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,340px)_1fr]">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="aspect-square w-full max-w-[340px] border border-line/20" role="img" aria-label="Points and centroids">
          {points.map((p, n) => {
            const [x, y] = toPx(p);
            const [cx, cy] = toPx(cents[ids[n]]);
            return (
              <g key={n}>
                <line x1={x} y1={y} x2={cx} y2={cy} stroke={HUES[ids[n]]} strokeOpacity={0.12} />
                <circle cx={x} cy={y} r={3} fill={HUES[ids[n]]} fillOpacity={0.75} />
              </g>
            );
          })}
          {cents.map((c, i) => {
            const [x, y] = toPx(c);
            const dead = counts[i] === 0;
            return (
              <g key={i}>
                <rect
                  x={x - 8}
                  y={y - 8}
                  width={16}
                  height={16}
                  fill={dead ? "none" : HUES[i]}
                  stroke={dead ? HUES[i] : "#0a0a0a"}
                  strokeWidth={2}
                  strokeDasharray={dead ? "3 2" : undefined}
                />
                <text x={x > SIZE - 70 ? x - 11 : x + 11} y={y - 10} fontSize={11} fill={HUES[i]} textAnchor={x > SIZE - 70 ? "end" : "start"}>
                  {i}
                  {dead ? " dead" : ""}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <VizButton primary onClick={step}>
              ONE STEP
            </VizButton>
            <VizButton onClick={() => setPlaying((p) => !p)}>{playing ? "PAUSE" : "TRAIN"}</VizButton>
            <VizButton
              onClick={() => {
                setPlaying(false);
                setCents(START);
                setHistory([]);
              }}
            >
              RESET
            </VizButton>
          </div>
          <Slider label="LEARNING RATE" value={lr} min={1} max={20} onChange={setLr} />
          <div>
            <div className="mb-1 flex justify-between text-[10px] tracking-[0.14em] text-ink-500">
              <span>CENTROID LOSS</span>
              <span className="text-ink-100" data-loss={current.toFixed(4)}>
                {current.toFixed(4)}
              </span>
            </div>
            <svg viewBox="0 0 240 48" className="h-12 w-full border border-line/12" preserveAspectRatio="none" aria-hidden="true">
              <polyline
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth={1.5}
                points={hist.map((v, i) => `${(i / Math.max(1, hist.length - 1)) * 240},${46 - (v / maxL) * 42}`).join(" ")}
              />
            </svg>
          </div>
          <ul className="grid grid-cols-2 gap-1.5 text-xs">
            {cents.map((_, i) => (
              <li key={i} className="flex justify-between border border-line/12 px-2 py-1" style={{ color: HUES[i] }}>
                <span>centroid {i}</span>
                <span>{counts[i]} pts</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </VizFrame>
  );
}
