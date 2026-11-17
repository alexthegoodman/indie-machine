"use client";

import { useEffect, useRef, useState } from "react";
import { setPreference, useLibrary } from "@/lib/library";
import type { LaunchView } from "@/lib/launches/store";
import { useShell } from "./ShellContext";
import { ChevronRightIcon, CloseIcon, PlusIcon, RocketIcon } from "./icons";
import { track } from "@/lib/analytics/client";

// Visitor Launches: a one-row strip under the header where anyone can list their product by
// pasting its URL. The server fills in the name, tagline and icon from the page itself.

function age(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function Icon({ launch }: { launch: LaunchView }) {
  const [broken, setBroken] = useState(false);
  if (!launch.iconUrl || broken)
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-accent/40 font-display text-[12px] font-bold text-accent uppercase">
        {launch.title[0]}
      </span>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={launch.iconUrl}
      alt=""
      width={28}
      height={28}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className="h-7 w-7 shrink-0 bg-line/6 object-contain"
    />
  );
}

function Chip({ launch, fresh }: { launch: LaunchView; fresh: boolean }) {
  return (
    <a
      href={launch.url}
      target="_blank"
      rel="noopener nofollow ugc"
      title={launch.tagline ? `${launch.title} - ${launch.tagline}` : launch.title}
      data-launch={launch.host}
      className={`flex h-11 max-w-[240px] shrink-0 snap-start items-center gap-2.5 border px-2.5 text-left hover:border-accent/60 hover:bg-accent/6 ${
        fresh ? "border-accent bg-accent/10" : "border-line/16"
      }`}
    >
      <Icon launch={launch} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-display text-[13px] leading-tight font-medium text-ink-100">{launch.title}</span>
        <span className="truncate text-[10px] leading-tight tracking-[0.04em] text-ink-500">
          {fresh ? <span className="text-accent">JUST LAUNCHED</span> : launch.tagline ?? launch.host}
          {!fresh && <> · {age(launch.createdAt)}</>}
        </span>
      </span>
    </a>
  );
}

function LaunchForm({ onLaunched, onCancel }: { onLaunched: (l: LaunchView) => void; onCancel: () => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const honeypot = useRef<HTMLInputElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/launches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, website: honeypot.current?.value ?? "" }),
      });
      const data = await res.json().catch(() => null);
      track("launch_submit", { ok: res.ok && !!data?.launch, code: data?.error?.code ?? String(res.status) });
      if (!res.ok || !data?.launch) throw new Error(data?.error?.message ?? "Launch failed. Try again.");
      onLaunched(data.launch);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex min-w-0 flex-1 flex-wrap items-center gap-2" aria-label="Launch your product">
      <label htmlFor="launch-url" className="sr-only">
        Your product&apos;s URL
      </label>
      <input
        ref={input}
        id="launch-url"
        type="text"
        inputMode="url"
        autoComplete="url"
        required
        maxLength={500}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://your-product.com"
        disabled={busy}
        className="h-11 min-w-0 flex-1 basis-56 border border-line/28 bg-ink px-3 font-display text-[14px] text-ink-100 placeholder:text-ink-500 focus:border-accent/70 focus:outline-none disabled:opacity-60"
      />
      {/* Honeypot: hidden from people and screen readers, filled in by form bots. */}
      <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <button
        type="submit"
        disabled={busy}
        className="h-11 shrink-0 cursor-pointer bg-accent px-4 text-[11px] font-semibold tracking-[0.14em] text-ink hover:bg-ink-100 disabled:cursor-wait disabled:opacity-70"
      >
        {busy ? "FETCHING..." : "LAUNCH"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel launch"
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center text-ink-400 hover:bg-line/6 hover:text-ink-100"
      >
        <CloseIcon size={18} />
      </button>
      <p role="status" className={`w-full text-[11px] ${error ? "text-badge" : "text-ink-500"}`}>
        {error || (busy ? "Reading your page for its name, tagline and icon..." : "Free, no account. We pull the name, tagline and icon from your page. One listing per product.")}
      </p>
    </form>
  );
}

export function LaunchBar() {
  const { toast } = useShell();
  const hidden = !!useLibrary().launchesHidden;
  const [launches, setLaunches] = useState<LaunchView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [form, setForm] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/launches")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { launches: LaunchView[] }) => live && setLaunches(d.launches))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const launched = (l: LaunchView) => {
    setLaunches((prev) => [l, ...(prev ?? []).filter((p) => p.id !== l.id)]);
    setFreshId(l.id);
    setForm(false);
    toast(`${l.title} is live.`);
    strip.current?.scrollTo({ left: 0, behavior: "smooth" });
  };

  const openForm = () => {
    setPreference("launchesHidden", false);
    setForm(true);
  };

  const count = launches?.length ?? 0;

  return (
    <section aria-label="Visitor launches" className="border-b border-dashed border-line/18" data-launch-bar={hidden ? "hidden" : "open"}>
      <div className={`flex items-center gap-2 px-2 sm:gap-3 sm:px-4 ${hidden ? "h-9" : "py-2"}`}>
        <div className="flex shrink-0 items-center gap-2 text-[10px] tracking-[0.16em] text-ink-500">
          <RocketIcon size={16} className="text-accent" />
          <span className={hidden ? "" : "hidden xl:inline"}>VISITOR LAUNCHES</span>
          {hidden && count > 0 && <span className="text-accent">{count}</span>}
        </div>

        {!hidden &&
          (form ? (
            <LaunchForm onLaunched={launched} onCancel={() => setForm(false)} />
          ) : (
            <>
              <div
                ref={strip}
                className="flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto [scrollbar-width:none] [mask-image:linear-gradient(to_right,black_calc(100%-40px),transparent)] [&::-webkit-scrollbar]:hidden"
              >
                {launches === null && !failed &&
                  [0, 1, 2, 3].map((i) => <div key={i} className="h-11 w-44 shrink-0 animate-pulse border border-line/10 bg-line/4" />)}
                {launches?.map((l) => <Chip key={l.id} launch={l} fresh={l.id === freshId} />)}
                {(failed || launches?.length === 0) && (
                  <button
                    type="button"
                    onClick={openForm}
                    className="flex h-11 shrink-0 cursor-pointer items-center px-1 text-left text-[12px] text-ink-400 hover:text-ink-100"
                  >
                    {failed ? "Launches are offline right now." : "Nothing launched yet. Paste your product's URL and be first."}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={openForm}
                className="flex h-11 shrink-0 cursor-pointer items-center gap-1.5 border border-accent/50 px-3 text-[11px] tracking-[0.14em] text-accent hover:bg-accent/10"
              >
                <PlusIcon size={14} />
                <span className="hidden sm:inline">LAUNCH YOURS</span>
                <span className="sm:hidden">LAUNCH</span>
              </button>
            </>
          ))}

        {hidden && <div className="flex-1" />}
        <button
          type="button"
          onClick={() => {
            setForm(false);
            setPreference("launchesHidden", !hidden);
          }}
          aria-expanded={!hidden}
          aria-label={hidden ? "Show visitor launches" : "Hide visitor launches"}
          className="flex h-9 shrink-0 cursor-pointer items-center gap-1 px-2 text-[10px] tracking-[0.14em] text-ink-500 hover:text-ink-100"
        >
          {hidden && <span>SHOW</span>}
          <ChevronRightIcon size={16} className={hidden ? "rotate-90" : "-rotate-90"} />
        </button>
      </div>
    </section>
  );
}
