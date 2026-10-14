"use client";

import { useEffect, useMemo, useState } from "react";
import type { PostSummary } from "@/lib/posts";
import { readParams, writeParams } from "@/lib/search";
import { PostRow } from "./PostRow";
import { Chip, SearchField } from "./FilterControls";

function matches(post: PostSummary, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${post.title} ${post.excerpt} ${post.series ?? ""}`.toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}

export function DevExplorer({ posts }: { posts: PostSummary[] }) {
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
    for (const p of posts) counts.set(p.series ?? "Uncategorized", (counts.get(p.series ?? "Uncategorized") ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [posts]);

  const results = useMemo(
    () => posts.filter((p) => (!series || (p.series ?? "Uncategorized") === series) && matches(p, query)),
    [posts, series, query],
  );

  return (
    <div>
      <SearchField value={query} onChange={setQuery} placeholder="wgpu, DAW, physical modelling, xLSTM…" />
      <div className="mt-5 flex flex-wrap gap-2">
        <Chip active={!series} onClick={() => setSeries("")}>
          ALL <span className="text-ink-500">{posts.length}</span>
        </Chip>
        {seriesCounts.map(([name, count]) => (
          <Chip key={name} active={series === name} onClick={() => setSeries(series === name ? "" : name)}>
            {name.toUpperCase()} <span className="text-ink-500">{count}</span>
          </Chip>
        ))}
      </div>

      <div className="mt-6 pb-2 text-[11px] tracking-[0.12em] text-ink-500" aria-live="polite">
        SHOWING <span className="text-ink-100">{results.length}</span> / {posts.length} POSTS
      </div>

      {results.length > 0 ? (
        <div className="mt-2">
          {results.map((post, i) => (
            <PostRow
              key={post.slug}
              post={post}
              figNumber={i + 1}
              border={i === results.length - 1 ? "both" : "top"}
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 border border-dashed border-line/28 p-10 text-center text-[11px] tracking-[0.14em] text-ink-500">
          NO MATCHING POSTS
        </div>
      )}
    </div>
  );
}
