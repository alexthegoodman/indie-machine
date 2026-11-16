"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MediaItem } from "@/lib/media";
import { useLibrary } from "@/lib/library";
import { useShell } from "@/components/shell/ShellContext";
import { MediaGrid } from "./MediaCard";
import { Thumb } from "./Thumb";

type ChipKey = "all" | "new" | "reviews" | "dev" | "games" | "top" | "rust" | "mcp" | "agents";

const WEEK_MS = 7 * 86_400_000;
const PAGE = 24;

const CHIPS: { key: ChipKey; label: string; test: (i: MediaItem, latest: number) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "new", label: "This week", test: (i, latest) => latest - Date.parse(i.date) < WEEK_MS },
  { key: "reviews", label: "Reviews", test: (i) => i.kind === "product" },
  { key: "dev", label: "Dev Log", test: (i) => i.kind === "dev" },
  { key: "games", label: "Game drops", test: (i) => i.kind === "game" },
  { key: "top", label: "Top scored", test: (i) => (i.score ?? 0) >= 8.5 },
  { key: "rust", label: "Rust", test: (i) => /\b(rust|wgpu|entropy|egui|tauri)\b/.test(i.keywords) },
  { key: "mcp", label: "MCP", test: (i) => /\bmcp\b/.test(i.keywords) },
  { key: "agents", label: "AI agents", test: (i) => /\bagents?\b|ai-agents|claude-code|codex/.test(i.keywords) },
];

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-9 shrink-0 cursor-pointer border px-3.5 text-xs tracking-[0.04em] whitespace-nowrap transition-colors ${
        active ? "border-ink-100 bg-ink-100 text-ink" : "border-line/28 text-ink-300 hover:border-accent/60 hover:text-ink-100"
      }`}
    >
      {children}
    </button>
  );
}

export function ChipBar({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div role="toolbar" aria-label={label} className="shelf -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {children}
    </div>
  );
}

// The main home feed: chip filters over every post, newest first, paged.
export function HomeFeed({ items }: { items: MediaItem[] }) {
  const [chip, setChip] = useState<ChipKey>("all");
  const [shown, setShown] = useState(PAGE);
  // "This week" is relative to the newest post, so a static build never goes stale.
  const latest = items.length ? Date.parse(items[0].date) : 0;
  const filtered = useMemo(() => {
    const test = CHIPS.find((c) => c.key === chip)!.test;
    return items.filter((i) => test(i, latest));
  }, [items, chip, latest]);

  return (
    <section aria-label="All posts">
      <ChipBar label="Filter posts">
        {CHIPS.map((c) => (
          <Chip
            key={c.key}
            active={chip === c.key}
            onClick={() => {
              setChip(c.key);
              setShown(PAGE);
            }}
          >
            {c.label}
          </Chip>
        ))}
      </ChipBar>
      <div className="mt-2 text-[11px] tracking-[0.12em] text-ink-500" aria-live="polite">
        {filtered.length} POSTS
      </div>
      <MediaGrid items={filtered.slice(0, shown)} className="mt-4" />
      {shown < filtered.length && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setShown((s) => s + PAGE)}
            className="h-11 cursor-pointer border border-line/32 px-6 text-xs tracking-[0.12em] text-ink-100 hover:border-accent hover:bg-accent/10"
          >
            SHOW MORE ({filtered.length - shown})
          </button>
        </div>
      )}
    </section>
  );
}

// "Continue reading" row from this browser's history. Renders nothing until
// there is something unfinished to resume.
export function ContinueShelf() {
  const { bySlug } = useShell();
  const library = useLibrary();
  const rows = library.history
    .filter((s) => {
      const p = library.progress[s] ?? 0;
      return p >= 3 && p < 95;
    })
    .map((s) => bySlug.get(s))
    .filter((i): i is MediaItem => !!i)
    .slice(0, 6);
  if (!rows.length) return null;

  return (
    <section aria-label="Continue reading" className="mt-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ink-100">Continue reading</h2>
        <Link href="/library" className="py-3 text-[11px] tracking-[0.14em]">
          HISTORY -&gt;
        </Link>
      </div>
      <div className="shelf flex gap-4 overflow-x-auto pb-2">
        {rows.map((item) => {
          const pct = library.progress[item.slug] ?? 0;
          const left = Math.max(1, Math.round((item.minutes * (100 - pct)) / 100));
          return (
            <article key={item.slug} className="group relative flex w-[340px] shrink-0 gap-3 border border-line/22 p-2.5 hover:bg-panel/55">
              <Thumb item={item} progress={pct} size="sm" className="w-36 shrink-0" />
              <div className="flex min-w-0 flex-col gap-1.5">
                <Link
                  href={`/posts/${item.slug}`}
                  className="line-clamp-2 font-display text-sm leading-snug font-semibold text-ink-100! after:absolute after:inset-0 after:content-[''] group-hover:text-accent!"
                >
                  {item.title}
                </Link>
                <span className="text-[11px] text-ink-400">
                  {pct}% read · {left} min left
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
