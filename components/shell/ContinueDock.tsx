"use client";

import Link from "next/link";
import { dismissDock, useLibrary } from "@/lib/library";
import { Thumb } from "@/components/media/Thumb";
import { useShell } from "./ShellContext";
import { CloseIcon } from "./icons";

// Mini "continue reading" card, docked bottom-right like a mini player.
// Shows the most recent unfinished post anywhere outside the reader.
export function ContinueDock({ pathname }: { pathname: string }) {
  const { bySlug } = useShell();
  const library = useLibrary();
  if (pathname.startsWith("/posts/")) return null;

  const slug = library.history[0];
  const item = slug ? bySlug.get(slug) : undefined;
  const pct = slug ? (library.progress[slug] ?? 0) : 0;
  if (!item || pct < 3 || pct >= 95 || library.dismissed === slug) return null;
  const left = Math.max(1, Math.round((item.minutes * (100 - pct)) / 100));

  return (
    <div className="pointer-events-auto w-[360px] max-w-full border border-accent/55 bg-ink shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
      <div className="group relative flex items-center gap-2.5 p-2.5">
        <Thumb item={item} size="sm" className="w-[104px] shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[10px] tracking-[0.14em] text-accent">CONTINUE READING</span>
          <Link
            href={`/posts/${item.slug}`}
            className="line-clamp-2 font-display text-[13px] leading-snug font-semibold text-ink-100! after:absolute after:inset-0 after:content-[''] group-hover:text-accent!"
          >
            {item.title}
          </Link>
          <span className="text-[11px] text-ink-400">
            {pct}% · {left} min left
          </span>
        </div>
        <button
          type="button"
          onClick={() => dismissDock(item.slug)}
          aria-label="Dismiss continue reading"
          className="relative z-10 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center self-start text-ink-400 hover:bg-accent/10 hover:text-ink-100"
        >
          <CloseIcon size={16} />
        </button>
      </div>
      <div className="h-[3px] bg-line/10">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
