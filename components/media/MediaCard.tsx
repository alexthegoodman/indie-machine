"use client";

import Link from "next/link";
import { channelOf, relativeAge, shortDate, type MediaItem } from "@/lib/media";
import { toggleSaved, useLibrary } from "@/lib/library";
import { useShell } from "@/components/shell/ShellContext";
import { BookmarkIcon } from "@/components/shell/icons";
import { Thumb } from "./Thumb";
import { useNow } from "./useNow";

export function SaveButton({ slug, className = "" }: { slug: string; className?: string }) {
  const { toast } = useShell();
  const saved = useLibrary().saved.includes(slug);
  return (
    <button
      type="button"
      onClick={() => toast(toggleSaved(slug) ? "Saved to your library" : "Removed from Saved")}
      aria-label={saved ? "Remove from saved" : "Save for later"}
      aria-pressed={saved}
      className={`flex h-9 w-9 cursor-pointer items-center justify-center border border-line/28 bg-ink/90 hover:border-accent ${
        saved ? "text-accent opacity-100" : "text-ink-100"
      } ${className}`}
    >
      <BookmarkIcon size={16} filled={saved} />
    </button>
  );
}

export function MetaLine({ item }: { item: MediaItem }) {
  const now = useNow();
  return (
    <>
      <time dateTime={item.date}>{shortDate(item.date)}</time>
      {now !== null && <span> · {relativeAge(item.date, now)}</span>}
    </>
  );
}

// Grid tile: cover with score / badge / read time overlays, a hover peek of
// the blurb, a save toggle, and a progress bar if the reader started it.
export function MediaCard({ item, priority }: { item: MediaItem; priority?: boolean }) {
  const progress = useLibrary().progress[item.slug];
  const channel = channelOf(item);
  return (
    <article className="group relative flex min-w-0 flex-col gap-2.5">
      <Thumb item={item} progress={progress} className="group-hover:border-accent/60">
        {item.score !== undefined && (
          <span className="pointer-events-none absolute top-2 left-2 border border-accent/55 bg-ink px-1.5 py-0.5 text-xs font-semibold text-accent">
            {item.score.toFixed(1)}
          </span>
        )}
        {item.kind === "game" && item.badges?.[0] && (
          <span className="pointer-events-none absolute top-2 left-2 max-w-[70%] truncate border border-badge/60 bg-ink px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.06em] text-badge uppercase">
            ◆ {item.badges[0]}
          </span>
        )}
        <span className="pointer-events-none absolute right-2 bottom-2 bg-ink/88 px-1.5 py-0.5 text-[11px] text-ink-100">
          {item.minutes} MIN
        </span>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 border-t border-accent/40 bg-ink/92 px-3 py-2.5 font-display text-[13px] leading-snug text-ink-100 opacity-0 transition duration-200 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100">
          <span className="line-clamp-3">{item.blurb}</span>
        </span>
      </Thumb>
      <SaveButton
        slug={item.slug}
        className="absolute top-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 aria-pressed:opacity-100 [@media(hover:none)]:opacity-100"
      />
      <div className="flex flex-col gap-1">
        <h3 className="line-clamp-2 font-display text-[16px] leading-snug font-semibold text-ink-100 group-hover:text-accent">
          <Link
            href={`/posts/${item.slug}`}
            prefetch={priority ? true : undefined}
            className="text-inherit! after:absolute after:inset-0 after:content-['']"
          >
            {item.title}
          </Link>
        </h3>
        <div
          className={`text-[11px] tracking-[0.04em] uppercase ${
            item.kind === "game" ? "text-badge" : item.kind === "product" ? "text-accent" : "text-ink-300"
          }`}
        >
          {channel.label}
          {item.sponsored && <span className="ml-2 border border-accent/60 px-1 text-accent">SPONSORED</span>}
        </div>
        <div className="text-[11px] text-ink-500">
          <MetaLine item={item} />
        </div>
      </div>
    </article>
  );
}

export function MediaGrid({
  items,
  dense,
  className = "",
}: {
  items: MediaItem[];
  dense?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`grid gap-x-5 gap-y-8 ${
        dense
          ? "grid-cols-[repeat(auto-fill,minmax(220px,1fr))]"
          : "grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]"
      } ${className}`}
    >
      {items.map((item) => (
        <MediaCard key={item.slug} item={item} />
      ))}
    </div>
  );
}

// Compact horizontal row used by the "Up next" queue, library and search.
export function MediaRow({ item, thumbClass = "w-40" }: { item: MediaItem; thumbClass?: string }) {
  const progress = useLibrary().progress[item.slug];
  const channel = channelOf(item);
  return (
    <article className="group relative flex gap-3 p-1.5 hover:bg-panel/55">
      <Thumb item={item} progress={progress} size="sm" className={`shrink-0 ${thumbClass}`}>
        <span className="absolute right-1 bottom-1 bg-ink/88 px-1 text-[10px] text-ink-100">{item.minutes} MIN</span>
      </Thumb>
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
        <h3 className="line-clamp-2 font-display text-sm leading-snug font-semibold text-ink-100 group-hover:text-accent">
          <Link href={`/posts/${item.slug}`} className="text-inherit! after:absolute after:inset-0 after:content-['']">
            {item.title}
          </Link>
        </h3>
        <div className={`truncate text-[11px] ${item.kind === "game" ? "text-badge" : item.kind === "product" ? "text-accent" : "text-ink-300"}`}>
          {channel.label}
        </div>
        <div className="text-[11px] text-ink-500">
          {item.score !== undefined && <span className="text-ink-300">{item.score.toFixed(1)} · </span>}
          {progress ? `${progress}% read` : `${item.minutes} min`}
        </div>
      </div>
    </article>
  );
}
