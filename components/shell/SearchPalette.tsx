"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { channelOf, type MediaItem } from "@/lib/media";
import { useLibrary } from "@/lib/library";
import { useShell } from "./ShellContext";
import { Thumb } from "@/components/media/Thumb";
import { SearchIcon } from "./icons";

const LIMIT = 8;

function search(items: MediaItem[], query: string): MediaItem[] {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored: { item: MediaItem; rank: number }[] = [];
  for (const item of items) {
    if (!tokens.every((t) => item.keywords.includes(t))) continue;
    const title = item.title.toLowerCase();
    // Title hits first, then keyword-only hits; newest-first within each.
    scored.push({ item, rank: tokens.every((t) => title.includes(t)) ? 0 : 1 });
  }
  return scored.sort((a, b) => a.rank - b.rank).map((s) => s.item);
}

export function SearchPalette({ onClose }: { onClose: () => void }) {
  const { items, bySlug } = useShell();
  const library = useLibrary();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, total, label } = useMemo(() => {
    if (query.trim()) {
      const all = search(items, query);
      return { results: all.slice(0, LIMIT), total: all.length, label: `${all.length} RESULTS` };
    }
    const recent = library.history.map((s) => bySlug.get(s)).filter((i): i is MediaItem => !!i);
    const top = items.filter((i) => i.score !== undefined).sort((a, b) => b.score! - a.score!);
    const merged = [...new Set([...recent.slice(0, 3), ...top])].slice(0, LIMIT);
    return { results: merged, total: merged.length, label: recent.length ? "RECENT & TOP SCORED" : "TOP SCORED" };
  }, [query, items, bySlug, library.history]);

  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const go = (item: MediaItem | undefined) => {
    if (!item) return;
    onClose();
    router.push(`/posts/${item.slug}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Search Indie Machine" onKeyDown={onKeyDown}>
      <button type="button" aria-label="Close search" onClick={onClose} className="absolute inset-0 cursor-default bg-black/65" />
      <div className="relative mx-auto mt-[8vh] w-[680px] max-w-[calc(100%-32px)] border border-accent/55 bg-ink">
        <div className="flex items-center gap-3 border-b border-line/22 px-4">
          <SearchIcon className="shrink-0 text-accent" size={18} />
          <label htmlFor="palette-q" className="sr-only">
            Search Indie Machine
          </label>
          <input
            ref={inputRef}
            id="palette-q"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Try: rust, mcp, kiri, stealth..."
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={results[active] ? `palette-${results[active].slug}` : undefined}
            className="h-14 min-w-0 flex-1 bg-transparent font-display text-lg text-ink-100 placeholder:text-ink-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border border-line/22 px-2 py-1 text-[10px] tracking-[0.1em] text-ink-400 hover:text-ink-100"
          >
            ESC
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2">
          <div className="px-4 py-1.5 text-[10px] tracking-[0.16em] text-ink-500" aria-live="polite">
            {label}
          </div>
          <ul id="palette-results" role="listbox" aria-label="Results">
            {results.map((item, i) => (
              <li
                key={item.slug}
                id={`palette-${item.slug}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2 ${i === active ? "bg-panel/70" : ""}`}
              >
                <Thumb item={item} size="sm" className="w-[72px] shrink-0" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={`truncate font-display text-[15px] font-semibold ${i === active ? "text-accent" : "text-ink-100"}`}>
                    {item.title}
                  </span>
                  <span className={`text-[11px] ${item.kind === "game" ? "text-badge" : item.kind === "product" ? "text-accent" : "text-ink-300"}`}>
                    {channelOf(item).label}
                  </span>
                </span>
                {item.score !== undefined && <span className="text-[13px] text-accent">{item.score.toFixed(1)}</span>}
              </li>
            ))}
          </ul>
          {query.trim() && total === 0 && (
            <div className="px-4 py-5 text-[13px] text-ink-300">No posts match &ldquo;{query}&rdquo;.</div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-line/18 px-4 py-2.5 text-[10px] tracking-[0.1em] text-ink-500">
          <span>ENTER OPEN</span>
          <span>UP/DOWN MOVE</span>
          <span>ESC CLOSE</span>
          {query.trim() && (
            <Link href={`/products?q=${encodeURIComponent(query.trim())}`} onClick={onClose} className="ml-auto">
              FILTER ALL REVIEWS -&gt;
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
