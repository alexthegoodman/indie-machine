"use client";

import { useEffect, useState } from "react";
import { HUES, VizButton, VizFrame } from "./VizFrame";

// Values from the course's tiny layer (lib/courses/tiny-ngrammer.ts: width 8, 2 heads, K = 4)
// on "the cat sat", as printed by tests/courses-parity.mjs and matched by PyTorch.
const WORDS = ["the", "cat", "sat"];
const IDS = [[1, 3], [0, 2], [3, 0]];
const PREV = [[4, 4], [1, 3], [0, 2]];
const ROWS = [[17, 39], [4, 34], [3, 28]];
const K = 4;

const STAGES = [
  { name: "x", title: "Residual in", text: "One vector per token, shape [batch, seq, width]. Here width = 8." },
  { name: "split", title: "Split + normalize", text: "Cut each vector into 2 heads of 4 numbers and scale each slice to unit RMS." },
  { name: "ids", title: "Snap to a centroid", text: "Each head picks its nearest of K = 4 centroids. The vector becomes two small integers." },
  { name: "prev", title: "Look one back", text: "Pair each id with the id at the previous position. Position 0 has no previous token, so it uses the extra id K = 4." },
  { name: "rows", title: "Bigram row", text: "row = (head·(K+1) + prev)·K + id. Each head owns its own block of rows in one table." },
  { name: "add", title: "Look up, add back", text: "Fetch the rows, RMS-normalize them, project back to width 8 and add to x. Output shape = input shape." },
];

function Chip({ v, hue, dim }: { v: string | number; hue?: string; dim?: boolean }) {
  return (
    <span
      className="inline-flex min-w-8 justify-center border px-1.5 py-0.5 text-xs transition-opacity"
      style={{ borderColor: hue ?? "rgba(219,234,254,0.25)", color: hue ?? "#f3f8fc", opacity: dim ? 0.25 : 1 }}
    >
      {v}
    </span>
  );
}

export function PipelineStepper() {
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setStage((s) => (s + 1) % STAGES.length), 1600);
    return () => clearInterval(t);
  }, [playing]);

  const cell = (row: number, t: number) => {
    const dim = row > stage;
    switch (STAGES[row].name) {
      case "x":
        return <Chip v="x ∈ ℝ⁸" dim={dim} />;
      case "split":
        return (
          <span className="flex gap-1">
            <Chip v="ℝ⁴" hue={HUES[0]} dim={dim} />
            <Chip v="ℝ⁴" hue={HUES[1]} dim={dim} />
          </span>
        );
      case "ids":
        return (
          <span className="flex gap-1">
            {IDS[t].map((v, h) => <Chip key={h} v={v} hue={HUES[h]} dim={dim} />)}
          </span>
        );
      case "prev":
        return (
          <span className="flex gap-1">
            {PREV[t].map((v, h) => <Chip key={h} v={v === K ? "∅" : v} hue={HUES[h]} dim={dim} />)}
          </span>
        );
      case "rows":
        return (
          <span className="flex gap-1">
            {ROWS[t].map((v, h) => <Chip key={h} v={`#${v}`} hue={HUES[h]} dim={dim} />)}
          </span>
        );
      default:
        return <Chip v="x + Δ" dim={dim} />;
    }
  };

  return (
    <VizFrame
      label="ONE PASS THROUGH THE LAYER"
      caption="Real values from a tiny layer (width 8, 2 heads, 4 centroids) - the same numbers PyTorch produces for these weights. ∅ is the “no previous token” id."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <VizButton onClick={() => setStage((s) => Math.max(0, s - 1))}>← STEP</VizButton>
        <VizButton primary onClick={() => setStage((s) => Math.min(STAGES.length - 1, s + 1))}>
          STEP →
        </VizButton>
        <VizButton onClick={() => setPlaying((p) => !p)}>{playing ? "PAUSE" : "PLAY"}</VizButton>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] border-collapse text-left text-xs">
          <thead>
            <tr>
              <th className="w-40 pb-2 font-normal text-ink-500">STAGE</th>
              {WORDS.map((w) => (
                <th key={w} className="pb-2 font-display text-sm font-semibold text-ink-100">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STAGES.map((s, row) => (
              <tr
                key={s.name}
                onClick={() => setStage(row)}
                className={`cursor-pointer border-t border-line/10 ${row === stage ? "bg-accent/10" : ""}`}
                data-stage={row === stage ? "current" : undefined}
              >
                <td className={`py-2 pr-3 ${row === stage ? "text-accent" : row < stage ? "text-ink-300" : "text-ink-500"}`}>
                  {row + 1}. {s.title}
                </td>
                {WORDS.map((w, t) => (
                  <td key={w} className="py-2 pr-2">
                    {cell(row, t)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 min-h-12 border-l-2 border-accent pl-3 text-sm leading-relaxed text-ink-300" aria-live="polite">
        <span className="text-ink-100">{STAGES[stage].title}.</span> {STAGES[stage].text}
      </p>
    </VizFrame>
  );
}
