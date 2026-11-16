"use client";

import { useEffect, useMemo, useState } from "react";
import type { MediaItem } from "@/lib/media";
import { readParams, writeParams } from "@/lib/search";
import { MediaGrid } from "./media/MediaCard";
import { Chip, SearchField } from "./FilterControls";

function matches(item: MediaItem, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${item.keywords} ${item.blurb.toLowerCase()}`;
  return tokens.every((t) => haystack.includes(t));
}

export function GameExplorer({ items }: { items: MediaItem[] }) {
  const [query, setQuery] = useState("");
  const [badge, setBadge] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = readParams();
    setQuery(params.get("q") ?? "");
    setBadge(params.get("badge") ?? "");
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) writeParams({ q: query, badge });
  }, [ready, query, badge]);

  const badgeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of items) for (const b of p.badges ?? []) counts.set(b, (counts.get(b) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [items]);

  const results = useMemo(
    () => items.filter((p) => (!badge || (p.badges ?? []).includes(badge)) && matches(p, query)),
    [items, badge, query],
  );

  return (
    <div>
      <SearchField value={query} onChange={setQuery} placeholder="idle, roguelike, pixel art, cozy…" />
      {badgeCounts.length > 0 && (
        <div role="toolbar" aria-label="Filter by badge" className="shelf mt-4 flex gap-2 overflow-x-auto pb-1">
          <Chip active={!badge} onClick={() => setBadge("")}>
            ALL <span className="text-ink-500">{items.length}</span>
          </Chip>
          {badgeCounts.map(([name, count]) => (
            <Chip key={name} active={badge === name} onClick={() => setBadge(badge === name ? "" : name)}>
              {name.toUpperCase()} <span className="text-ink-500">{count}</span>
            </Chip>
          ))}
        </div>
      )}

      <div className="mt-4 text-[11px] tracking-[0.12em] text-ink-500" aria-live="polite">
        SHOWING <span className="text-ink-100">{results.length}</span> / {items.length} ANNOUNCEMENTS
      </div>

      {results.length > 0 ? (
        <MediaGrid items={results} className="mt-5" />
      ) : (
        <div className="mt-5 border border-dashed border-line/28 p-10 text-center text-[11px] tracking-[0.14em] text-ink-500">
          NO MATCHING ANNOUNCEMENTS
        </div>
      )}
    </div>
  );
}
