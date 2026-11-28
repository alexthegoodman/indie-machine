"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics/client";
import type { CompileReport } from "@/lib/gherkin-ts/compile";

type Built = {
  title: string;
  app: string;
  html: string;
  tests: string;
  functions: number;
  scenarios: number;
  facts: number;
  notes: string[];
  report: CompileReport;
};

type Tab = "preview" | "app" | "tests";

/**
 * Gherkin -> a small TypeScript app plus its Playwright tests, for /free-ai/gherkin. `source` is
 * what GherkinWriter's Compile button filled in (Yumon's feature, display form); the reader can
 * edit it and compile again. The compiler (lib/gherkin-app + lib/gherkin-ts) loads on the first
 * compile. The preview runs the app in a sandboxed iframe: scripts only, opaque origin, and a
 * CSP that blocks every network request.
 */
export function GherkinCompiler({ source, stamp }: { source: string; stamp: number }) {
  const [gherkin, setGherkin] = useState(source);
  const [out, setOut] = useState<Built | null>(null);
  const [tab, setTab] = useState<Tab>("preview");
  const [run, setRun] = useState(0);
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  async function compile(src: string, edited: boolean) {
    try {
      const [{ buildApp }, { compileGherkin }] = await Promise.all([import("@/lib/gherkin-app/emit"), import("@/lib/gherkin-ts/compile")]);
      // Yumon writes lowercase and the templates match any case; the app is built from the same text the tests read.
      const text = src.toLowerCase();
      const app = buildApp(text);
      if (!app) throw new Error("no Feature: line to build an app from");
      const spec = compileGherkin(text, { checks: app.plan.checks, actions: app.plan.actions });
      setOut({
        title: app.feature.title,
        app: app.ts,
        html: app.html,
        tests: spec.code,
        functions: app.functions.length,
        scenarios: app.plan.scenarios.length,
        facts: [...app.plan.checks.values()].filter((c) => c.startsWith("hasFact(")).length,
        notes: app.notes,
        report: spec.report,
      });
      setRun((n) => n + 1);
      setError(undefined);
      const r = spec.report;
      track("gherkin_compile", {
        features: r.features,
        scenarios: r.scenarios,
        steps: r.steps,
        matched: r.matched,
        implemented: r.implemented,
        stubs: r.stubs,
        functions: app.functions.length,
        edited,
      });
    } catch (e) {
      setOut(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Each press of Compile on the writer (new stamp) replaces the Gherkin here and compiles it.
  useEffect(() => {
    setGherkin(source);
    void compile(source, false);
    panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [source, stamp]);

  const slug = (out?.title ?? "app").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "app";
  const code = out ? (tab === "tests" ? out.tests : out.app) : "";

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the code is still selectable.
    }
  }

  function save(text: string, name: string, type: string) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const r = out?.report;
  const btn =
    "inline-flex h-9 cursor-pointer items-center border border-line/28 px-3 text-[11px] tracking-[0.1em] text-ink-300 hover:border-accent hover:text-ink-100 disabled:cursor-default disabled:opacity-40";
  const tabs: { id: Tab; label: string }[] = [
    { id: "preview", label: "PREVIEW" },
    { id: "app", label: "APP.TS" },
    { id: "tests", label: "APP.SPEC.TS" },
  ];

  return (
    <div ref={panel} className="scroll-mt-6 border border-line/25 bg-panel/10 p-4" data-testid="gherkin-compiler">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] tracking-[0.14em] text-accent">// COMPILE TO TYPESCRIPT</div>
        <span className="text-[10px] text-ink-500">An app + Playwright tests · built here, nothing is sent</span>
      </div>
      <div className="mt-3 grid gap-4 xl:grid-cols-[2fr_3fr]">
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
            <div className="flex" role="tablist" aria-label="Compiled output">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`h-9 cursor-pointer border-b px-3 text-[11px] tracking-[0.1em] ${tab === t.id ? "border-accent text-accent" : "border-line/20 text-ink-400 hover:text-ink-100"}`}
                  data-testid={`gherkin-tab-${t.id}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {tab === "preview" ? (
                <>
                  <button type="button" className={btn} disabled={!out} onClick={() => setRun((n) => n + 1)}>
                    RESTART
                  </button>
                  <button type="button" className={btn} disabled={!out} onClick={() => out && save(out.html, `${slug}.html`, "text/html")}>
                    DOWNLOAD .HTML
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className={btn} disabled={!out} onClick={copy}>
                    {copied ? "COPIED" : "COPY"}
                  </button>
                  <button
                    type="button"
                    className={btn}
                    disabled={!out}
                    onClick={() => out && save(code, tab === "tests" ? "app.spec.ts" : "app.ts", "text/typescript")}
                  >
                    DOWNLOAD {tab === "tests" ? ".SPEC.TS" : ".TS"}
                  </button>
                </>
              )}
            </div>
          </div>
          {tab === "preview" ? (
            out ? (
              <iframe
                key={run}
                title={`Preview: ${out.title}`}
                srcDoc={out.html}
                sandbox="allow-scripts"
                referrerPolicy="no-referrer"
                className="mt-2 h-[70vh] min-h-[24rem] w-full flex-1 border border-line/18 bg-white"
                data-testid="gherkin-preview"
              />
            ) : (
              <div className="mt-2 min-h-[24rem] flex-1 border border-line/18 p-4 text-[12px] text-ink-500">{error ? "" : "Compiling..."}</div>
            )
          ) : (
            <pre
              className="mt-2 max-h-[70vh] min-h-[24rem] flex-1 overflow-auto border border-line/18 bg-ink/60 p-4 font-mono text-[12px] leading-relaxed text-ink-100"
              data-testid="gherkin-ts"
            >
              {error ? "" : code || "Compiling..."}
            </pre>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 text-[12px] text-red-400" role="alert">
          Could not compile: {error}
        </p>
      )}
      {out && r && (
        <div className="mt-3 text-[11px] leading-relaxed text-ink-400">
          <p className="font-mono" data-testid="gherkin-compile-report">
            {out.scenarios} scenario{out.scenarios === 1 ? "" : "s"} · {r.steps} steps · {r.matched} matched a template · {out.functions} library
            functions · {r.implemented} steps tested · {r.pending} pending
          </p>
          <p className="mt-1">
            Every step Yumon learned is one of 316 templates. The compiler reads each one as a page, an element, an action or an expected result,
            copies in only the boilerplate functions those need (getElementById helpers for fields, lists, dialogs, accounts, counters) and writes
            the handlers that tie them together. Pick a scenario in the bar at the top of the preview to load its Given state, then do what its
            When steps say. The tests drive the same app with Playwright, one test per scenario.
          </p>
          <p className="mt-1">
            It is a sketch, not a backend: data lives in memory, HTTP requests are buttons, and outcomes the compiler can&apos;t model ({out.facts} here,
            common in games and studio apps) are replayed from the scenario&apos;s own Then steps and shown as messages.
          </p>
          {(out.notes.length > 0 || r.notes.length > 0) && (
            <ul className="mt-2 space-y-0.5 font-mono text-[11px]" data-testid="gherkin-compile-notes">
              {out.notes.slice(0, 4).map((n, i) => (
                <li key={`a${i}`}>{n}</li>
              ))}
              {r.notes.slice(0, 6).map((n, i) => (
                <li key={i}>
                  <span className="text-ink-500">line {n.line}</span> {n.message}
                  {n.text && <span className="text-ink-300"> {n.text}</span>}
                </li>
              ))}
              {r.notes.length > 6 && <li className="text-ink-500">and {r.notes.length - 6} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
