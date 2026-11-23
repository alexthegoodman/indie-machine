"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { YumonMascot } from "@/components/mascot/YumonMascot";
import { track } from "@/lib/analytics/client";
import { WEIGHTS_MB, clearYumon, sendToYumon, wakeYumon, wantsAutoLoad, yumonStore, type YumonState } from "@/lib/yumon/session";

const SUGGESTIONS = ["Hi Yumon!", "What do you like to do?", "Tell me a story", "How are you feeling?"];
/** Tailwind's xl breakpoint: the chat is a full-height column from here up, collapsed below. */
const WIDE = "(min-width: 80rem)";

const STATUS_TEXT: Record<YumonState["status"], string> = {
  idle: "ASLEEP",
  loading: "WAKING UP",
  ready: "AWAKE",
  thinking: "THINKING",
  error: "ERROR",
};

// The post page's chat with Yumon, the Hyperfield port of the yumon-pet decoder (27M params,
// int4). It runs in the reader's browser; nothing is downloaded until they wake it, or until a
// later visit from a browser that already did.
export function YumonChat() {
  const s = useSyncExternalStore(yumonStore.subscribe, yumonStore.get, yumonStore.get);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = s.status === "loading" || s.status === "thinking";
  const last = s.messages[s.messages.length - 1];

  useEffect(() => {
    if (s.status === "idle" && wantsAutoLoad() && (open || window.matchMedia(WIDE).matches)) void wakeYumon(true);
  }, [open, s.status]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [s.messages, s.status]);

  function toggle() {
    if (!open) track("yumon_open", { status: s.status });
    setOpen(!open);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft;
    setDraft("");
    void sendToYumon(text, "input");
    inputRef.current?.focus();
  }

  const dot =
    s.status === "ready" ? "bg-accent" : s.status === "error" ? "bg-red-400" : busy ? "animate-pulse bg-accent" : "bg-ink-500";

  return (
    <section
      aria-label="Chat with Yumon"
      data-track-area="Yumon chat"
      className="flex flex-col border border-line/22 bg-panel/30 xl:h-full xl:min-h-0"
    >
      <header className="flex min-h-12 items-center gap-3 border-b border-line/18 px-3.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center border border-accent/50 font-display font-bold text-accent"
          aria-hidden="true"
        >
          Y
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-display text-sm font-semibold text-ink-100">Chat with Yumon</span>
          <span className="flex items-center gap-1.5 text-[10px] tracking-[0.14em] text-ink-400" aria-live="polite">
            <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
            {STATUS_TEXT[s.status]}
            {s.backend && <span className="text-ink-500">· {s.backend.toUpperCase()}</span>}
          </span>
        </span>
        {s.messages.length > 0 && (
          <button
            type="button"
            onClick={clearYumon}
            disabled={s.status === "thinking"}
            className={`h-9 cursor-pointer border border-line/28 px-3 text-[11px] tracking-[0.1em] text-ink-300 hover:border-accent hover:text-ink-100 disabled:opacity-40 ${open ? "" : "hidden xl:block"}`}
          >
            CLEAR
          </button>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="h-9 cursor-pointer border border-accent/50 px-3 text-[11px] tracking-[0.1em] text-accent hover:bg-accent/10 xl:hidden"
        >
          {open ? "HIDE" : "OPEN"}
        </button>
      </header>

      <div className={`${open ? "flex" : "hidden"} h-[min(70dvh,560px)] min-h-0 flex-col xl:flex xl:h-auto xl:flex-1`}>
        <YumonMascot
          status={s.status}
          writing={s.status === "thinking"}
          hasText={last?.who === "yumon" && !!last.text}
          className="h-44 shrink-0 border-b border-line/18"
        />
        <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3.5 [scrollbar-width:thin]">
          <Bubble who="yumon">
            Hi, I&apos;m Yumon. I&apos;m a tiny language model (27M parameters) running right here in your browser, not on a
            server. I&apos;m still learning, so I say strange things. Talk to me anyway?
          </Bubble>

          {s.status === "idle" && (
            <div className="border border-dashed border-accent/40 p-3.5">
              <p className="font-display text-[13px] leading-relaxed text-ink-300">
                Waking Yumon downloads {WEIGHTS_MB} MB of weights once. It runs on your GPU with WebGPU, or on the CPU if
                your browser has no WebGPU.
              </p>
              <button
                type="button"
                onClick={() => void wakeYumon()}
                className="mt-3 inline-flex h-11 cursor-pointer items-center bg-accent px-4 font-display text-xs font-semibold tracking-[0.08em] text-ink hover:bg-ink-100"
              >
                WAKE YUMON · {WEIGHTS_MB} MB
              </button>
            </div>
          )}

          {s.status === "loading" && (
            <div className="border border-line/22 p-3.5" role="status">
              <div className="flex justify-between text-[11px] tracking-[0.12em] text-ink-400">
                <span>DOWNLOADING YUMON</span>
                <span>{Math.round(s.progress * 100)}%</span>
              </div>
              <div className="mt-2 h-1 bg-line/12">
                <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round(s.progress * 100)}%` }} />
              </div>
            </div>
          )}

          {s.status === "error" && (
            <div className="border border-red-400/50 p-3.5 text-[13px] text-ink-300" role="alert">
              Yumon could not wake up: {s.error}
              <button
                type="button"
                onClick={() => void wakeYumon()}
                className="mt-3 block h-10 cursor-pointer border border-line/32 px-3 text-[11px] tracking-[0.1em] text-ink-100 hover:border-accent"
              >
                TRY AGAIN
              </button>
            </div>
          )}

          {s.fellBack && s.status !== "loading" && (
            <p className="text-[11px] leading-relaxed text-ink-500">
              No WebGPU adapter here, so Yumon runs on the CPU. Replies take a little longer.
            </p>
          )}

          {s.messages.map((m) => (
            <Bubble key={m.id} who={m.who} meta={m.meta}>
              {m.text || <span className="animate-pulse text-ink-500">...</span>}
            </Bubble>
          ))}

          {s.status === "ready" && s.messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void sendToYumon(q, "suggestion")}
                  className="min-h-9 cursor-pointer border border-line/28 px-3 font-display text-[13px] text-ink-300 hover:border-accent hover:text-ink-100"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={submit} className="flex gap-2 border-t border-line/18 p-3">
          <label htmlFor="yumon-input" className="sr-only">
            Message Yumon
          </label>
          <input
            id="yumon-input"
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => s.status === "idle" && void wakeYumon()}
            placeholder={s.status === "ready" ? "Say something to Yumon" : "Wake Yumon to chat"}
            autoComplete="off"
            maxLength={500}
            className="h-11 min-w-0 flex-1 border border-line/28 bg-ink px-3 font-display text-sm text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="h-11 cursor-pointer bg-accent px-4 font-display text-xs font-semibold tracking-[0.08em] text-ink hover:bg-ink-100 disabled:cursor-default disabled:opacity-40"
          >
            SEND
          </button>
        </form>
        <p className="px-3 pb-3 text-[10px] leading-relaxed text-ink-500">
          Yumon runs on your device. What you type stays in this tab.
        </p>
      </div>
    </section>
  );
}

function Bubble({ who, meta, children }: { who: "you" | "yumon" | "error"; meta?: string; children: React.ReactNode }) {
  const you = who === "you";
  return (
    <div className={`flex max-w-[88%] flex-col gap-1 ${you ? "self-end items-end" : "self-start"}`}>
      <span className={`text-[10px] tracking-[0.14em] ${who === "error" ? "text-red-400" : you ? "text-ink-400" : "text-accent"}`}>
        {you ? "YOU" : who === "error" ? "ERROR" : "YUMON"}
      </span>
      <div
        className={`border px-3 py-2 font-display text-sm leading-relaxed break-words whitespace-pre-wrap ${
          you ? "border-line/28 bg-ink text-ink-100" : who === "error" ? "border-red-400/50 text-ink-300" : "border-accent/30 bg-accent/5 text-ink-100"
        }`}
      >
        {children}
      </div>
      {meta && <span className="text-[10px] text-ink-500">{meta}</span>}
    </div>
  );
}
