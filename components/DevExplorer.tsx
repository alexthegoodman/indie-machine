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

export function DevExplorer({ items }: { items: MediaItem[] }) {
  const [query, setQuery] = useState("");
  const [series, setSeries] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = readParams();
    setQuery(params.get("q") ?? "");
    setSeries(params.get("series") ?? "");
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) writeParams({ q: query, series });
  }, [ready, query, series]);

  const seriesCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of items) counts.set(p.series ?? "Uncategorized", (counts.get(p.series ?? "Uncategorized") ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const results = useMemo(
    () => items.filter((p) => (!series || (p.series ?? "Uncategorized") === series) && matches(p, query)),
    [items, series, query],
  );

  return (
    <div>
      <SearchField value={query} onChange={setQuery} placeholder="wgpu, DAW, physical modelling, xLSTM…" />
      <div role="toolbar" aria-label="Filter by series" className="shelf mt-4 flex gap-2 overflow-x-auto pb-1">
        <Chip active={!series} onClick={() => setSeries("")}>
          ALL <span className="text-ink-500">{items.length}</span>
        </Chip>
        {seriesCounts.map(([name, count]) => (
          <Chip key={name} active={series === name} onClick={() => setSeries(series === name ? "" : name)}>
            {name.toUpperCase()} <span className="text-ink-500">{count}</span>
          </Chip>
        ))}
      </div>

      <div className="mt-4 text-[11px] tracking-[0.12em] text-ink-500" aria-live="polite">
        SHOWING <span className="text-ink-100">{results.length}</span> / {items.length} POSTS
      </div>

      {results.length > 0 ? (
        <MediaGrid items={results} className="mt-5" />
      ) : (
        <div className="mt-5 border border-dashed border-line/28 p-10 text-center text-[11px] tracking-[0.14em] text-ink-500">
          NO MATCHING POSTS
        </div>
      )}
    </div>
  );
}
