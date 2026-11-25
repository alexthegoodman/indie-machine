"use client";

import { useMemo, useState } from "react";
import { normalize } from "@/lib/courses/engram-hash";
import { HUES, VizFrame } from "./VizFrame";

// Tokens are separated by "|" so leading spaces (as BPE vocabularies have them) survive.
const START = "Apple| apple|APPLE| Äpple|pear| Pear| PEAR|ﬁle| file|\\n|  | |\\t";

const show = (t: string) => t.replace(/\n/g, "↵").replace(/\t/g, "⇥").replace(/ /g, "␣");

export function CompressionViz() {
  const [text, setText] = useState(START);
  const tokens = useMemo(() => text.split("|").map((t) => t.replace(/\\n/g, "\n").replace(/\\t/g, "\t")).filter((t) => t.length), [text]);
  const groups = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const t of tokens) {
      const key = normalize(t) || t;
      m.set(key, [...(m.get(key) ?? []), t]);
    }
    return [...m.entries()];
  }, [tokens]);

  return (
    <VizFrame
      label="TOKENIZER COMPRESSION"
      caption={
        <>
          Each vocabulary entry is decoded, then normalized the way DeepSeek&apos;s demo does it: NFKC, NFD, drop accents, lowercase, collapse whitespace, strip.
          Entries with the same result share one id before hashing. Separate tokens with |, and type \n or \t for a newline or tab.
        </>
      }
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Tokens separated by |"
        className="mb-4 h-10 w-full border border-line/22 bg-panel/40 px-3 font-mono text-sm text-ink-100 outline-none focus:border-accent"
      />
      <p className="mb-3 text-sm text-ink-300" data-compression-summary>
        <strong className="text-ink-100">{tokens.length}</strong> raw tokens → <strong className="text-accent">{groups.length}</strong> compressed ids
        {tokens.length > 0 && <> ({Math.round((1 - groups.length / tokens.length) * 100)}% fewer)</>}
      </p>
      <ul className="flex flex-col gap-1.5">
        {groups.map(([key, members], i) => (
          <li key={key} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="w-16 shrink-0 text-ink-500">id {i}</span>
            <span className="w-20 shrink-0 font-mono" style={{ color: HUES[i % HUES.length] }}>
              “{show(key)}”
            </span>
            <span className="text-ink-500">←</span>
            {members.map((m, j) => (
              <span key={j} className="border border-line/18 px-1.5 py-0.5 font-mono text-ink-300">
                {show(m)}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </VizFrame>
  );
}
