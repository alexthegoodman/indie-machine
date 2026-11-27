"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { YumonMascot } from "@/components/mascot/YumonMascot";
import { WEIGHTS_MB, wakeYumon, wantsAutoLoad, yumonStore, type YumonState } from "@/lib/yumon/session";
import {
  DEFAULT_SETTINGS,
  SETTING_LIMITS,
  UNTITLED,
  activeThread,
  deleteAllThreads,
  deleteThread,
  exportThread,
  hydrateThreads,
  newThread,
  regenerate,
  renameThread,
  selectThread,
  sendInThread,
  serverThreads,
  sortedThreads,
  stopReply,
  threadMemories,
  threadsStore,
  togglePin,
  updateSettings,
  type Thread,
  type ThreadMessage,
} from "@/lib/yumon/threads";

const SUGGESTIONS = ["Hi Yumon!", "What do you like to do?", "Tell me a story", "How are you feeling?"];

const STATUS_TEXT: Record<YumonState["status"], string> = {
  idle: "ASLEEP",
  loading: "WAKING UP",
  ready: "AWAKE",
  thinking: "AWAKE",
  error: "ERROR",
};

/** Abilities Yumon has today, and the ones this page will grow into. */
const ABILITIES: { label: string; on: boolean }[] = [
  { label: "Chat", on: true },
  { label: "Remembers this thread", on: true },
  { label: "Runs offline after loading", on: true },
  { label: "Tools and actions", on: false },
  { label: "Reads files and pages", on: false },
];

const btn =
  "inline-flex h-9 cursor-pointer items-center border border-line/28 px-3 text-[11px] tracking-[0.1em] text-ink-300 hover:border-accent hover:text-ink-100 disabled:cursor-default disabled:opacity-40";

function ago(t: number, now: number) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// /free-ai: Yumon (the Hyperfield port of the yumon-pet decoder) in the browser, with saved
// threads. Threads, titles and settings stay in localStorage; nothing is downloaded until the
// visitor wakes Yumon, or until a later visit from a browser that already did.
export function YumonThreads() {
  const y = useSyncExternalStore(yumonStore.subscribe, yumonStore.get, yumonStore.get);
  const s = useSyncExternalStore(threadsStore.subscribe, threadsStore.get, serverThreads);
  const [listOpen, setListOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => hydrateThreads(), []);
  useEffect(() => {
    if (y.status === "idle" && wantsAutoLoad()) void wakeYumon(true);
  }, [y.status]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const thread = activeThread(s);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = sortedThreads(s.threads);
    return q ? all.filter((t) => t.title.toLowerCase().includes(q) || t.messages.some((m) => m.text.toLowerCase().includes(q))) : all;
  }, [s.threads, query]);

  const dot =
    y.status === "ready" || y.status === "thinking"
      ? s.generating
        ? "animate-pulse bg-accent"
        : "bg-accent"
      : y.status === "error"
        ? "bg-red-400"
        : y.status === "loading"
          ? "animate-pulse bg-accent"
          : "bg-ink-500";

  return (
    <section
      aria-label="Yumon threads"
      data-track-area="Yumon threads"
      className="flex flex-col border border-line/22 bg-panel/30 lg:h-[calc(90dvh-7.5rem)] lg:min-h-[500px] lg:flex-row"
    >
      {/* Threads */}
      <nav
        aria-label="Threads"
        className="flex shrink-0 flex-col border-b border-line/18 lg:w-72 lg:border-r lg:border-b-0"
      >
        <p className="block p-4 max-w-xl font-display text-[15px] leading-relaxed text-ink-300">
          <strong>Yumon:</strong> Free, private, instant.
        </p>
        <div className="flex items-center gap-2 p-3">
          <button
            type="button"
            onClick={() => {
              newThread();
              setListOpen(false);
            }}
            disabled={!!s.generating}
            className="inline-flex h-10 flex-1 cursor-pointer items-center justify-center bg-accent px-3 font-display text-xs font-semibold tracking-[0.08em] text-ink hover:bg-ink-100 disabled:cursor-default disabled:opacity-40"
          >
            + NEW THREAD
          </button>
          <button
            type="button"
            onClick={() => setListOpen(!listOpen)}
            aria-expanded={listOpen}
            aria-controls="yumon-thread-list"
            className={`${btn} h-10 lg:hidden`}
          >
            THREADS · {s.threads.length}
          </button>
        </div>
        <div id="yumon-thread-list" className={`${listOpen ? "flex" : "hidden"} min-h-0 flex-1 flex-col lg:flex`}>
          <div className="px-3 pb-2">
            <label htmlFor="yumon-thread-search" className="sr-only">
              Search threads
            </label>
            <input
              id="yumon-thread-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search threads"
              autoComplete="off"
              className="h-9 w-full border border-line/28 bg-ink px-3 font-display text-[13px] text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
            />
          </div>
          <ul className="flex max-h-72 min-h-0 flex-col overflow-y-auto px-2 pb-2 [scrollbar-width:thin] lg:max-h-none lg:flex-1">
            {list.map((t) => (
              <ThreadRow
                key={t.id}
                t={t}
                active={t.id === s.activeId}
                writing={s.generating === t.id}
                now={now}
                onPick={() => {
                  selectThread(t.id);
                  setListOpen(false);
                }}
              />
            ))}
            {s.hydrated && list.length === 0 && <li className="px-2 py-3 text-[12px] text-ink-500">No thread matches.</li>}
          </ul>
          <ListFooter count={s.threads.length} storageOk={s.storageOk} busy={!!s.generating} />
        </div>
      </nav>

      {/* The open thread */}
      <div className="flex min-h-[70dvh] min-w-0 flex-1 flex-col lg:min-h-0">
        {thread ? (
          <ThreadView key={thread.id} thread={thread} y={y} writing={s.generating === thread.id} otherWriting={!!s.generating && s.generating !== thread.id} dot={dot} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-[13px] text-ink-500">Loading your threads...</div>
        )}
      </div>

      {/* Agent + thread settings */}
      <aside aria-label="Agent" className="shrink-0 overflow-y-auto border-t border-line/18 [scrollbar-width:thin] lg:w-72 lg:border-t-0 lg:border-l">
        <AgentPanel y={y} thread={thread} dot={dot} busy={!!s.generating} />
      </aside>
    </section>
  );
}

function ThreadRow({ t, active, writing, now, onPick }: { t: Thread; active: boolean; writing: boolean; now: number; onPick: () => void }) {
  const turns = t.messages.filter((m) => m.who === "you").length;
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        aria-current={active ? "true" : undefined}
        className={`flex w-full cursor-pointer flex-col gap-0.5 border-l-2 px-3 py-2 text-left hover:bg-ink/60 ${
          active ? "border-accent bg-ink/70" : "border-transparent"
        }`}
      >
        <span className="flex items-center gap-1.5">
          {t.pinned && (
            <span className="text-[10px] text-accent" aria-label="Pinned">
              ●
            </span>
          )}
          <span className={`truncate font-display text-[13px] ${active ? "text-ink-100" : "text-ink-300"}`}>{t.title}</span>
        </span>
        <span className="flex items-center gap-2 text-[10px] tracking-[0.08em] text-ink-500">
          {writing ? <span className="animate-pulse text-accent">WRITING...</span> : <span>{ago(t.updatedAt, now)}</span>}
          <span>
            {turns} {turns === 1 ? "turn" : "turns"}
          </span>
        </span>
      </button>
    </li>
  );
}

function ListFooter({ count, storageOk, busy }: { count: number; storageOk: boolean; busy: boolean }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="border-t border-line/18 p-3 text-[10px] leading-relaxed text-ink-500">
      {storageOk ? (
        <p>Threads are saved in this browser only. Clearing site data removes them.</p>
      ) : (
        <p className="text-red-400">This browser blocks storage, so threads last only until you leave the page.</p>
      )}
      {count > 1 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (!confirm) return setConfirm(true);
            deleteAllThreads();
            setConfirm(false);
          }}
          onBlur={() => setConfirm(false)}
          className="mt-2 cursor-pointer tracking-[0.1em] text-ink-400 underline-offset-2 hover:text-red-400 hover:underline disabled:opacity-40"
        >
          {confirm ? `CONFIRM: DELETE ALL ${count} THREADS` : "DELETE ALL THREADS"}
        </button>
      )}
    </div>
  );
}

function ThreadView({
  thread,
  y,
  writing,
  otherWriting,
  dot,
}: {
  thread: Thread;
  y: YumonState;
  writing: boolean;
  otherWriting: boolean;
  dot: string;
}) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(thread.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const loading = y.status === "loading";
  const busy = writing || otherWriting || loading;
  const msgs = thread.messages;
  const last = msgs[msgs.length - 1];
  const canRegenerate = !busy && y.status !== "idle" && !!last && last.who !== "you";

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, y.status]);

  function send() {
    const text = draft;
    if (!text.trim() || busy) return;
    setDraft("");
    void sendInThread(text, "input");
    inputRef.current?.focus();
  }

  function saveTitle() {
    renameThread(thread.id, title);
    setEditing(false);
  }

  return (
    <>
      <header className="flex min-h-14 flex-wrap items-center gap-2 border-b border-line/18 px-4 py-2">
        {editing ? (
          <form
            className="flex min-w-0 flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveTitle();
            }}
          >
            <label htmlFor="yumon-thread-title" className="sr-only">
              Thread title
            </label>
            <input
              id="yumon-thread-title"
              autoFocus
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
              className="h-9 min-w-0 flex-1 border border-accent/60 bg-ink px-3 font-display text-sm text-ink-100 focus:outline-none"
            />
            <button type="submit" className={btn}>
              SAVE
            </button>
          </form>
        ) : (
          <h2 className="min-w-0 flex-1 truncate font-display text-base font-semibold text-ink-100">{thread.title}</h2>
        )}
        {!editing && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btn}
              onClick={() => {
                setTitle(thread.title === UNTITLED ? "" : thread.title);
                setEditing(true);
              }}
            >
              RENAME
            </button>
            <button type="button" className={btn} aria-pressed={!!thread.pinned} onClick={() => togglePin(thread.id)}>
              {thread.pinned ? "UNPIN" : "PIN"}
            </button>
            <button type="button" className={btn} disabled={msgs.length === 0} onClick={() => exportThread(thread.id)}>
              EXPORT .MD
            </button>
            <button
              type="button"
              className={`${btn} ${confirmDelete ? "border-red-400/70 text-red-400" : ""}`}
              disabled={writing}
              onClick={() => (confirmDelete ? deleteThread(thread.id) : setConfirmDelete(true))}
              onBlur={() => setConfirmDelete(false)}
            >
              {confirmDelete ? "CONFIRM DELETE" : "DELETE"}
            </button>
          </div>
        )}
      </header>

      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 [scrollbar-width:thin]">
        {msgs.length === 0 && <EmptyThread y={y} />}
        <WakeStatus y={y} />
        {msgs.map((m, i) => (
          <Bubble key={m.id} m={m} live={writing && i === msgs.length - 1} />
        ))}
        {y.status === "ready" && msgs.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={busy}
                onClick={() => void sendInThread(q, "suggestion")}
                className="min-h-9 cursor-pointer border border-line/28 px-3 font-display text-[13px] text-ink-300 hover:border-accent hover:text-ink-100 disabled:opacity-40"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {canRegenerate && (
          <div className="self-start">
            <button type="button" className={btn} onClick={() => void regenerate()}>
              ↻ REGENERATE
            </button>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="border-t border-line/18 p-3"
      >
        <div className="flex items-end gap-2">
          <label htmlFor="yumon-thread-input" className="sr-only">
            Message Yumon
          </label>
          <textarea
            id="yumon-thread-input"
            ref={inputRef}
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => y.status === "idle" && void wakeYumon()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={y.status === "ready" || y.status === "thinking" ? "Message Yumon (Enter to send, Shift+Enter for a new line)" : "Wake Yumon to chat"}
            autoComplete="off"
            maxLength={2000}
            className="min-h-11 min-w-0 flex-1 resize-none border border-line/28 bg-ink px-3 py-2.5 font-display text-sm text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
          />
          {writing ? (
            <button
              type="button"
              onClick={stopReply}
              className="h-11 cursor-pointer border border-accent px-4 font-display text-xs font-semibold tracking-[0.08em] text-accent hover:bg-accent/10"
            >
              STOP
            </button>
          ) : (
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="h-11 cursor-pointer bg-accent px-4 font-display text-xs font-semibold tracking-[0.08em] text-ink hover:bg-ink-100 disabled:cursor-default disabled:opacity-40"
            >
              SEND
            </button>
          )}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[10px] tracking-[0.08em] text-ink-500" aria-live="polite">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
          {otherWriting ? "YUMON IS WRITING IN ANOTHER THREAD" : writing ? "YUMON IS WRITING" : `YUMON IS ${STATUS_TEXT[y.status]}`}
          <span className="ml-auto normal-case tracking-normal">Runs on your device. Nothing you type leaves this browser.</span>
        </p>
      </form>
    </>
  );
}

function EmptyThread({ y }: { y: YumonState }) {
  return (
    <div className="max-w-xl border border-accent/30 bg-accent/5 p-4">
      <div className="text-[10px] tracking-[0.14em] text-accent">YUMON</div>
      <p className="mt-1 font-display text-sm leading-relaxed text-ink-100">
        Hi, I&apos;m Yumon. I&apos;m a tiny language model (21M parameters) running right here in your browser, not on a
        server. I&apos;m still learning, so I say strange things. Start a thread with me anyway?
      </p>
      {y.status === "idle" && (
        <>
          <p className="mt-3 font-display text-[13px] leading-relaxed text-ink-300">
            Waking Yumon downloads {WEIGHTS_MB} MB of weights once. It runs on your GPU with WebGPU, or on the CPU if your
            browser has no WebGPU.
          </p>
          <button
            type="button"
            onClick={() => void wakeYumon()}
            className="mt-3 inline-flex h-11 cursor-pointer items-center bg-accent px-4 font-display text-xs font-semibold tracking-[0.08em] text-ink hover:bg-ink-100"
          >
            WAKE YUMON · {WEIGHTS_MB} MB
          </button>
        </>
      )}
    </div>
  );
}

function WakeStatus({ y }: { y: YumonState }) {
  if (y.status === "loading")
    return (
      <div className="max-w-xl border border-line/22 p-3.5" role="status">
        <div className="flex justify-between text-[11px] tracking-[0.12em] text-ink-400">
          <span>DOWNLOADING YUMON</span>
          <span>{Math.round(y.progress * 100)}%</span>
        </div>
        <div className="mt-2 h-1 bg-line/12">
          <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round(y.progress * 100)}%` }} />
        </div>
      </div>
    );
  if (y.status === "error")
    return (
      <div className="max-w-xl border border-red-400/50 p-3.5 text-[13px] text-ink-300" role="alert">
        Yumon could not wake up: {y.error}
        <button type="button" onClick={() => void wakeYumon()} className={`${btn} mt-3 flex`}>
          TRY AGAIN
        </button>
      </div>
    );
  if (y.fellBack)
    return <p className="text-[11px] leading-relaxed text-ink-500">No WebGPU adapter here, so Yumon runs on the CPU. Replies take a little longer.</p>;
  return null;
}

function Bubble({ m, live }: { m: ThreadMessage; live: boolean }) {
  const you = m.who === "you";
  const [copied, setCopied] = useState(false);
  return (
    <div className={`group flex max-w-[85%] flex-col gap-1 ${you ? "items-end self-end" : "self-start"}`}>
      <span className={`text-[10px] tracking-[0.14em] ${m.who === "error" ? "text-red-400" : you ? "text-ink-400" : "text-accent"}`}>
        {you ? "YOU" : m.who === "error" ? "ERROR" : "YUMON"}
      </span>
      <div
        className={`border px-3 py-2 font-display text-sm leading-relaxed break-words whitespace-pre-wrap ${
          you ? "border-line/28 bg-ink text-ink-100" : m.who === "error" ? "border-red-400/50 text-ink-300" : "border-accent/30 bg-accent/5 text-ink-100"
        }`}
      >
        {m.text || <span className="animate-pulse text-ink-500">...</span>}
      </div>
      {!live && (m.meta || m.who === "yumon") && (
        <span className="flex items-center gap-3 text-[10px] text-ink-500">
          {m.meta}
          {m.who === "yumon" && m.text && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(m.text).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                });
              }}
              className="cursor-pointer tracking-[0.1em] text-ink-400 hover:text-accent"
            >
              {copied ? "COPIED" : "COPY"}
            </button>
          )}
        </span>
      )}
    </div>
  );
}

function AgentPanel({ y, thread, dot, busy }: { y: YumonState; thread?: Thread; dot: string; busy: boolean }) {
  const st = thread?.settings ?? DEFAULT_SETTINGS;
  const replies = thread?.messages.filter((m) => m.who === "yumon" && m.tokens) ?? [];
  const tokens = replies.reduce((a, m) => a + (m.tokens ?? 0), 0);
  const avg = replies.length ? replies.reduce((a, m) => a + (m.msPerToken ?? 0), 0) / replies.length : 0;
  const memories = thread ? threadMemories(thread.messages).length : 0;
  const last = thread?.messages[thread.messages.length - 1];
  const set = (patch: Partial<typeof st>) => thread && updateSettings(thread.id, patch);

  return (
    <div className="flex flex-col gap-5 p-4">
      <YumonMascot status={y.status} writing={busy} hasText={!!last && last.who === "yumon" && !!last.text} className="h-56 shrink-0 border border-line/18 bg-ink/40" />
      <div>
        <div className="text-[10px] tracking-[0.14em] text-accent">// AGENT</div>
        <div className="mt-2 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-accent/50 font-display text-lg font-bold text-accent" aria-hidden="true">
            Y
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-display text-sm font-semibold text-ink-100">Yumon</span>
            <span className="flex items-center gap-1.5 text-[10px] tracking-[0.14em] text-ink-400" data-testid="agent-status">
              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
              {busy ? "WRITING" : STATUS_TEXT[y.status]}
              {y.backend && <span className="text-ink-500">· {y.backend.toUpperCase()}</span>}
            </span>
          </span>
        </div>
        <dl className="mt-3 divide-y divide-line/15 font-mono text-[11px]">
          <Row k="CHECKPOINT" v="loop1 · int4" />
          <Row k="PARAMETERS" v="21.1M" />
          <Row k="WEIGHTS" v={`${WEIGHTS_MB} MB`} />
          <Row k="CONTEXT" v={y.context ? `${y.context} tokens` : "-"} />
          <Row k="RUNTIME" v="Hyperfield (WebGPU / CPU)" />
        </dl>
        {y.status === "idle" && (
          <button type="button" onClick={() => void wakeYumon()} className={`${btn} mt-3 w-full justify-center border-accent/50 text-accent`}>
            WAKE YUMON · {WEIGHTS_MB} MB
          </button>
        )}
      </div>

      <div>
        <div className="text-[10px] tracking-[0.14em] text-accent">// ABILITIES</div>
        <ul className="mt-2 space-y-1.5 text-[12px]">
          {ABILITIES.map((a) => (
            <li key={a.label} className={`flex items-center gap-2 ${a.on ? "text-ink-200" : "text-ink-500"}`}>
              <span className={`text-[10px] ${a.on ? "text-accent" : "text-ink-500"}`} aria-hidden="true">
                {a.on ? "■" : "□"}
              </span>
              {a.label}
              {!a.on && <span className="ml-auto text-[9px] tracking-[0.12em]">NOT YET</span>}
            </li>
          ))}
        </ul>
      </div>

      <fieldset disabled={!thread || busy} className="disabled:opacity-60">
        <legend className="text-[10px] tracking-[0.14em] text-accent">// THIS THREAD</legend>
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 text-[12px] text-ink-200">
          Memory of earlier turns
          <input type="checkbox" checked={st.memory} onChange={(e) => set({ memory: e.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />
        </label>
        <Slider label="Temperature" value={st.temperature} limits={SETTING_LIMITS.temperature} fmt={(v) => (v === 0 ? "0 (greedy)" : v.toFixed(2))} onChange={(v) => set({ temperature: v })} />
        <Slider label="Top-k" value={st.topK} limits={SETTING_LIMITS.topK} fmt={String} onChange={(v) => set({ topK: v })} />
        <Slider label="Max reply tokens" value={st.maxTokens} limits={SETTING_LIMITS.maxTokens} fmt={String} onChange={(v) => set({ maxTokens: v })} />
        <button type="button" onClick={() => set({ ...DEFAULT_SETTINGS })} className="mt-3 cursor-pointer text-[10px] tracking-[0.1em] text-ink-400 hover:text-accent">
          RESET TO DEFAULTS
        </button>
      </fieldset>

      <div>
        <div className="text-[10px] tracking-[0.14em] text-accent">// STATS</div>
        <dl className="mt-2 divide-y divide-line/15 font-mono text-[11px]">
          <Row k="REPLIES" v={String(replies.length)} />
          <Row k="TOKENS OUT" v={String(tokens)} />
          <Row k="AVG SPEED" v={avg ? `${avg.toFixed(0)} ms/token` : "-"} />
          <Row k="TURNS REMEMBERED" v={st.memory ? `up to ${memories}` : "off"} />
        </dl>
        <p className="mt-2 text-[10px] leading-relaxed text-ink-500">Older turns drop out first when a thread outgrows Yumon&apos;s context.</p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <dt className="text-ink-500">{k}</dt>
      <dd className="text-right text-ink-100">{v}</dd>
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
      />
    </label>
  );
}
