"use client";

import { useMemo, useState } from "react";
import { VizFrame } from "./VizFrame";

const START = "the cat sat on the mat . the cat ran to the mat . the dog sat on the cat";

export function BigramCounter() {
  const [text, setText] = useState(START);
  const [focus, setFocus] = useState<string | null>("the");

  const words = useMemo(() => text.toLowerCase().split(/\s+/).filter(Boolean), [text]);
  const pairs = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 1; i < words.length; i++) {
      const k = `${words[i - 1]} ${words[i]}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [words]);

  const following = focus ? pairs.filter(([k]) => k.split(" ")[0] === focus) : [];
  const total = following.reduce((n, [, c]) => n + c, 0);
  const max = pairs[0]?.[1] ?? 1;

  return (
    <VizFrame
      label="BIGRAM COUNTER"
      caption="Edit the text. Every adjacent pair of words is one bigram. Click a word to see what tends to follow it - a bigram table is a tiny next-word predictor."
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        aria-label="Text to count bigrams in"
        className="mb-4 w-full resize-y border border-line/22 bg-panel/40 p-3 text-sm text-ink-100 outline-none focus:border-accent"
      />
      <div className="mb-5 flex flex-wrap gap-1.5" aria-label="Words">
        {words.map((w, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setFocus(w)}
            className={`border px-2 py-1 text-xs ${w === focus ? "border-accent bg-accent/15 text-accent" : "border-line/18 text-ink-300 hover:border-accent/60"}`}
          >
            {w}
          </button>
        ))}
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <div className="mb-2 text-[10px] tracking-[0.16em] text-ink-500">ALL BIGRAMS ({pairs.length} DISTINCT)</div>
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto pr-1">
            {pairs.map(([k, c]) => (
              <li key={k} className="flex items-center gap-2 text-xs">
                <span className="w-28 shrink-0 truncate text-ink-100">{k}</span>
                <span className="h-2 bg-accent/70" style={{ width: `${(c / max) * 60}%` }} />
                <span className="text-ink-400">{c}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-2 text-[10px] tracking-[0.16em] text-ink-500">AFTER “{focus ?? "?"}” COMES…</div>
          {following.length === 0 ? (
            <p className="text-xs text-ink-500">Nothing follows this word yet.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {following.map(([k, c]) => (
                <li key={k} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 text-ink-100">{k.split(" ")[1]}</span>
                  <span className="h-2 bg-badge/80" style={{ width: `${(c / total) * 60}%` }} />
                  <span className="text-ink-400">{Math.round((c / total) * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </VizFrame>
  );
}
