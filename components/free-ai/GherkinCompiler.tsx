"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics/client";
import type { CompileReport } from "@/lib/gherkin-ts/compile";

/**
 * Gherkin -> Playwright Test TypeScript for /free-ai/gherkin. `source` is what GherkinWriter's
 * Compile button filled in (Yumon's feature, display form); the reader can edit it and compile
 * again. The compiler (lib/gherkin-ts, ~60 KB with its templates) loads on the first compile.
 */
export function GherkinCompiler({ source, stamp }: { source: string; stamp: number }) {
  const [gherkin, setGherkin] = useState(source);
  const [out, setOut] = useState<{ code: string; report: CompileReport } | null>(null);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  async function compile(src: string, edited: boolean) {
    try {
      const { compileGherkin } = await import("@/lib/gherkin-ts/compile");
      const result = compileGherkin(src);
      setOut(result);
      setError(undefined);
      const r = result.report;
      track("gherkin_compile", { features: r.features, scenarios: r.scenarios, steps: r.steps, matched: r.matched, implemented: r.implemented, stubs: r.stubs, edited });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Each press of Compile on the writer (new stamp) replaces the Gherkin here and compiles it.
  useEffect(() => {
    setGherkin(source);
    void compile(source, false);
    panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [source, stamp]);

  async function copy() {
    if (!out) return;
    try {
      await navigator.clipboard.writeText(out.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the code is still selectable.
    }
  }

  function download() {
    if (!out) return;
    const first = /^\s*feature:\s*(.+)$/im.exec(gherkin)?.[1] ?? "feature";
    const name = first.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "feature";
    const url = URL.createObjectURL(new Blob([out.code], { type: "text/typescript" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.spec.ts`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const r = out?.report;
  const btn =
    "inline-flex h-9 cursor-pointer items-center border border-line/28 px-3 text-[11px] tracking-[0.1em] text-ink-300 hover:border-accent hover:text-ink-100 disabled:cursor-default disabled:opacity-40";

  return (
    <div ref={panel} className="scroll-mt-6 border border-line/25 bg-panel/10 p-4" data-testid="gherkin-compiler">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] tracking-[0.14em] text-accent">// COMPILE TO TYPESCRIPT</div>
        <span className="text-[10px] text-ink-500">Playwright Test · runs here, nothing is sent</span>
      </div>
      <div className="mt-3 grid gap-4 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col">
          <label htmlFor="gherkin-compile-src" className="text-[11px] text-ink-400">
            Gherkin (edit it, then compile again)
          </label>
          <textarea
            id="gherkin-compile-src"
            value={gherkin}
            onChange={(e) => setGherkin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void compile(gherkin, gherkin !== source);
              }
            }}
            spellCheck={false}
            rows={18}
            className="mt-2 min-h-[18rem] w-full flex-1 resize-y border border-line/28 bg-ink px-3 py-2.5 font-mono text-[12px] leading-relaxed text-ink-100 focus:border-accent focus:outline-none"
            data-testid="gherkin-compile-src"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void compile(gherkin, gherkin !== source)}
              disabled={!gherkin.trim()}
              className="h-10 cursor-pointer border border-accent px-4 font-display text-xs font-semibold tracking-[0.08em] text-accent hover:bg-accent/10 disabled:cursor-default disabled:opacity-40"
            >
              COMPILE
            </button>
            <span className="text-[10px] text-ink-500">Ctrl+Enter</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-ink-400">TypeScript</span>
            <div className="flex gap-2">
              <button type="button" className={btn} disabled={!out} onClick={copy}>
                {copied ? "COPIED" : "COPY"}
              </button>
              <button type="button" className={btn} disabled={!out} onClick={download}>
                DOWNLOAD .SPEC.TS
              </button>
            </div>
          </div>
          <pre
            className="mt-2 max-h-[70vh] min-h-[18rem] flex-1 overflow-auto border border-line/18 bg-ink/60 p-4 font-mono text-[12px] leading-relaxed text-ink-100"
            data-testid="gherkin-ts"
          >
            {error ? "" : (out?.code ?? "Compiling...")}
          </pre>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-[12px] text-red-400" role="alert">
          Could not compile: {error}
        </p>
      )}
      {r && (
        <div className="mt-3 text-[11px] leading-relaxed text-ink-400">
          <p className="font-mono" data-testid="gherkin-compile-report">
            {r.scenarios} scenario{r.scenarios === 1 ? "" : "s"} · {r.steps} steps · {r.matched} matched a template · {r.implemented} with Playwright code ·{" "}
            {r.stubs} pending method{r.stubs === 1 ? "" : "s"}
          </p>
          <p className="mt-1">
            Every step Yumon learned is one of 316 templates, so matched steps become typed methods on a steps class. Pending ones (seeding records,
            signing a role in, game or canvas state) need your app and run as fixme until you fill them in. Text checks ignore case, because Yumon
            writes lowercase.
          </p>
          {r.notes.length > 0 && (
            <ul className="mt-2 space-y-0.5 font-mono text-[11px]" data-testid="gherkin-compile-notes">
              {r.notes.slice(0, 8).map((n, i) => (
                <li key={i}>
                  <span className="text-ink-500">line {n.line}</span> {n.message}
                  {n.text && <span className="text-ink-300"> {n.text}</span>}
                </li>
              ))}
              {r.notes.length > 8 && <li className="text-ink-500">and {r.notes.length - 8} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
