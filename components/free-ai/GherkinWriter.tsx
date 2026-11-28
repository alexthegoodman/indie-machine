"use client";

import { useState, useSyncExternalStore } from "react";
import {
  GHERKIN_DEFAULTS,
  GHERKIN_LIMITS,
  GHERKIN_WEIGHTS_MB,
  displayGherkin,
  gherkinStore,
  stopGherkin,
  wakeGherkin,
  writeGherkin,
  type GherkinSettings,
  type GherkinState,
} from "@/lib/yumon/gherkin";

/**
 * Typical openings on recipe / vehicle (domains the procedural training set left out), creative-app
 * and game openings phrased like the training set but with app and game names it never saw (some
 * from yumon-pet gherkin_proc_eval_prompts), and a short sign-in one.
 */
const EXAMPLES: { label: string; text: string }[] = [
  {
    label: "Recipe form",
    text: "Feature: Recipe form\n  As a cook\n  I want to save my recipes\n  So that I can cook them again\n\n  Scenario:",
  },
  {
    label: "Vehicles API",
    text: "Feature: Vehicles API\n  As an API client\n  I want to create, read, update and delete vehicles over HTTP\n  So that other systems can work with vehicles\n\n  Background:\n    Given",
  },
  {
    label: "Comic panels",
    text: "Feature: Comic editor\n  As a comic artist\n  I want to split my comic into panels\n  So that I can change one part without touching the rest\n\n  Scenario:",
  },
  {
    label: "Photo touch-up",
    text: 'Feature: Darkroom tools\n  As a photographer\n  I want to touch up my photos\n  So that they look their best\n\n  Background:\n    Given I have a photo "Lighthouse at dusk" open\n\n  Scenario:',
  },
  {
    label: "Mute a track",
    text: 'Feature: Song editor\n\n  Scenario: Mute a track\n    Given I have a song "Night drive" open\n    And the song has the tracks "Drums" and "Synth"\n    When',
  },
  {
    label: "Platformer",
    text: "Feature: Platforming in Moon Diver\n\n  Scenario: Collect a moon rock\n    Given I am playing the Crater Rim\n    And",
  },
  {
    label: "Match three",
    text: "Feature: Crystal Crush board\n  As a player\n  I want to clear every board\n  So that I can unlock new worlds\n\n  Background:\n    Given I am playing level 7\n\n  Scenario: Match three red gems\n    Given",
  },
  {
    label: "Crafting",
    text: "Feature: Crafting in Driftwood Isle\n  As a player\n  I want to survive on the island\n  So that I can build a raft\n\n  Scenario: Craft a stone axe\n    Given",
  },
  { label: "Sign in", text: "Feature: Sign in\n\n  Scenario: Wrong password\n    Given" },
];

const STATUS_TEXT: Record<GherkinState["status"], string> = {
  idle: "ASLEEP",
  loading: "WAKING UP",
  ready: "AWAKE",
  writing: "WRITING",
  error: "ERROR",
};

const END_TEXT = {
  eos: "ended the feature",
  context: "used the whole 1,024-token context",
  max: "hit the token limit",
  stopped: "stopped",
};

const btn =
  "inline-flex h-9 cursor-pointer items-center border border-line/28 px-3 text-[11px] tracking-[0.1em] text-ink-300 hover:border-accent hover:text-ink-100 disabled:cursor-default disabled:opacity-40";

export function GherkinWriter() {
  const g = useSyncExternalStore(gherkinStore.subscribe, gherkinStore.get, gherkinStore.get);
  const [opening, setOpening] = useState(EXAMPLES[0].text);
  const [fromExample, setFromExample] = useState(true);
  const [settings, setSettings] = useState<GherkinSettings>({ ...GHERKIN_DEFAULTS });
  const [asWritten, setAsWritten] = useState(false);
  const [copied, setCopied] = useState(false);

  const writing = g.status === "writing";
  const draft = g.draft;
  const shown = (t: string) => (asWritten ? t : displayGherkin(t));
  const full = draft ? draft.prompt + draft.text : "";
  const dot = g.status === "error" ? "bg-red-400" : g.status === "idle" ? "bg-ink-500" : g.status === "loading" ? "animate-pulse bg-accent" : "bg-accent";

  const write = () => void writeGherkin(opening, settings, fromExample ? "example" : "input");
  const set = (patch: Partial<GherkinSettings>) => setSettings((s) => ({ ...s, ...patch }));

  async function copy() {
    try {
      await navigator.clipboard.writeText(displayGherkin(full));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the text is still selectable.
    }
  }

  return (
    <div role="region" aria-label="Gherkin writer" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]" data-testid="gherkin-writer">
      <section className="flex min-w-0 flex-col gap-4">
        <div className="border border-line/25 bg-panel/15 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="gherkin-opening" className="text-[10px] tracking-[0.14em] text-accent">
              // YOUR OPENING
            </label>
            <span className="text-[10px] text-ink-500">Yumon continues from the last character</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" data-testid="gherkin-examples">
            {EXAMPLES.map((e) => (
              <button
                key={e.label}
                type="button"
                disabled={writing}
                onClick={() => {
                  setOpening(e.text);
                  setFromExample(true);
                }}
                className={`${btn} h-8 font-display text-[12px] tracking-normal ${opening === e.text ? "border-accent/60 text-ink-100" : ""}`}
              >
                {e.label}
              </button>
            ))}
          </div>
          <textarea
            id="gherkin-opening"
            value={opening}
            onChange={(e) => {
              setOpening(e.target.value);
              setFromExample(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (!writing) write();
              }
            }}
            spellCheck={false}
            rows={9}
            className="mt-3 w-full resize-y border border-line/28 bg-ink px-3 py-2.5 font-mono text-[13px] leading-relaxed text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
            placeholder={"Feature: ...\n\n  Scenario: ...\n    Given"}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {writing ? (
              <button type="button" onClick={stopGherkin} className="h-10 cursor-pointer border border-accent px-4 font-display text-xs font-semibold tracking-[0.08em] text-accent hover:bg-accent/10">
                STOP
              </button>
            ) : (
              <button
                type="button"
                onClick={write}
                disabled={!opening.trim() || g.status === "loading"}
                className="h-10 cursor-pointer border border-accent px-4 font-display text-xs font-semibold tracking-[0.08em] text-accent hover:bg-accent/10 disabled:cursor-default disabled:opacity-40"
              >
                {g.status === "idle" ? `WAKE YUMON AND CONTINUE · ${GHERKIN_WEIGHTS_MB} MB` : g.status === "loading" ? `DOWNLOADING ${Math.round(g.progress * 100)}%` : "CONTINUE"}
              </button>
            )}
            <span className="text-[10px] text-ink-500">Ctrl+Enter</span>
          </div>
        </div>

        <div className="border border-line/25 bg-panel/10 p-4" data-testid="gherkin-output-panel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10px] tracking-[0.14em] text-accent">// YUMON&apos;S FEATURE</div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-ink-400">
                <input type="checkbox" checked={asWritten} onChange={(e) => setAsWritten(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--color-accent)]" />
                as written (lowercase)
              </label>
              <button type="button" className={btn} disabled={!draft?.text || writing} onClick={copy}>
                {copied ? "COPIED" : "COPY"}
              </button>
              <button
                type="button"
                className={btn}
                disabled={!draft?.text || writing}
                onClick={() => {
                  setOpening(displayGherkin(full));
                  setFromExample(false);
                }}
              >
                USE AS OPENING
              </button>
            </div>
          </div>
          {draft ? (
            <>
              <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap break-words border border-line/18 bg-ink/60 p-4 font-mono text-[13px] leading-relaxed" data-testid="gherkin-output">
                <span className="text-ink-400">{shown(draft.prompt)}</span>
                <span className="text-ink-100" data-testid="gherkin-continuation">
                  {shown(draft.text)}
                </span>
                {writing && <span className="animate-pulse text-accent">▌</span>}
              </pre>
              {draft.error ? (
                <p className="mt-2 text-[12px] text-red-400" role="alert">
                  {draft.error}
                </p>
              ) : (
                <p className="mt-2 font-mono text-[11px] text-ink-500" data-testid="gherkin-meta">
                  {draft.promptTokens} prompt tokens · {draft.tokens} written
                  {draft.end && ` · ${draft.msPerToken.toFixed(0)} ms/token · ${END_TEXT[draft.end]}`}
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-[13px] leading-relaxed text-ink-400">
              Pick an example or write the start of a feature, then press continue. Grey is your text, white is Yumon&apos;s.
            </p>
          )}
        </div>
      </section>

      <aside aria-label="Model" className="flex flex-col gap-5 border border-line/25 bg-panel/15 p-4">
        <div>
          <div className="text-[10px] tracking-[0.14em] text-accent">// MODEL</div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] tracking-[0.14em] text-ink-400" data-testid="gherkin-status">
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
            {STATUS_TEXT[g.status]}
            {g.backend && <span className="text-ink-500">· {g.backend.toUpperCase()}</span>}
          </div>
          {g.fellBack && <p className="mt-2 text-[11px] text-ink-400">No WebGPU adapter: running on the CPU backend, which is slower.</p>}
          {g.status === "error" && (
            <p className="mt-2 text-[11px] text-red-400" role="alert">
              Could not load Yumon: {g.error}
            </p>
          )}
          <dl className="mt-3 divide-y divide-line/15 font-mono text-[11px]">
            <Row k="CHECKPOINT" v="gherkin-proc-1024-extended · int4" />
            <Row k="BASE" v="loop-extended (loop1 at 1,024 tokens)" />
            <Row k="PARAMETERS" v="21.1M" />
            <Row k="WEIGHTS" v={`${GHERKIN_WEIGHTS_MB} MB`} />
            <Row k="CONTEXT" v="1,024 tokens" />
            <Row k="RUNTIME" v="Hyperfield (WebGPU / CPU)" />
          </dl>
          {g.status === "idle" && (
            <button type="button" onClick={() => void wakeGherkin()} className={`${btn} mt-3 w-full justify-center border-accent/50 text-accent`}>
              WAKE YUMON · {GHERKIN_WEIGHTS_MB} MB
            </button>
          )}
        </div>

        <fieldset disabled={writing} className="disabled:opacity-60">
          <legend className="text-[10px] tracking-[0.14em] text-accent">// SAMPLING</legend>
          <Slider label="Temperature" value={settings.temperature} limits={GHERKIN_LIMITS.temperature} fmt={(v) => (v === 0 ? "0 (greedy)" : v.toFixed(2))} onChange={(v) => set({ temperature: v })} />
          <Slider label="Top-k" value={settings.topK} limits={GHERKIN_LIMITS.topK} fmt={String} onChange={(v) => set({ topK: v })} />
          <Slider label="Max new tokens" value={settings.maxTokens} limits={GHERKIN_LIMITS.maxTokens} fmt={String} onChange={(v) => set({ maxTokens: v })} />
          <button type="button" onClick={() => setSettings({ ...GHERKIN_DEFAULTS })} className="mt-3 cursor-pointer text-[10px] tracking-[0.1em] text-ink-400 hover:text-accent">
            RESET TO DEFAULTS
          </button>
        </fieldset>

        <div className="text-[11px] leading-relaxed text-ink-400">
          <div className="text-[10px] tracking-[0.14em] text-accent">// SESSION</div>
          <p className="mt-2">
            {g.writes} feature{g.writes === 1 ? "" : "s"} written. Nothing you type leaves this tab.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <dt className="text-ink-500">{k}</dt>
      <dd className="text-right text-ink-200">{v}</dd>
    </div>
  );
}

function Slider({
  label,
  value,
  limits,
  fmt,
  onChange,
}: {
  label: string;
  value: number;
  limits: { min: number; max: number; step: number };
  fmt: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mt-3 block text-[12px] text-ink-200">
      <span className="flex justify-between">
        {label}
        <span className="font-mono text-[11px] text-ink-400">{fmt(value)}</span>
      </span>
      <input
        type="range"
        min={limits.min}
        max={limits.max}
        step={limits.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--color-accent)]"
        aria-label={label}
      />
    </label>
  );
}
