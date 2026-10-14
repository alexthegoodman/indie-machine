"use client";

import { useEffect, useMemo, useState } from "react";
import type { Listing } from "@/lib/listing";
import { matchesQuery, readParams, writeParams } from "@/lib/search";
import { CATEGORIES, categoryLabel, platformLabel, PRICING } from "@/lib/taxonomy";
import { ProductCard } from "./ProductCard";
import { Chip, SearchField, SelectField } from "./FilterControls";

type Sort = "newest" | "score" | "name";

const SORTS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "score", label: "Top scored" },
  { value: "name", label: "A-Z" },
];

function countBy(values: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function ProductExplorer({ items }: { items: Listing[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [pricing, setPricing] = useState("");
  const [platform, setPlatform] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [ready, setReady] = useState(false);

  // Restore filters from the URL once on mount (the page itself is static).
  useEffect(() => {
    const params = readParams();
    setQuery(params.get("q") ?? "");
    setCategory(params.get("category") ?? "");
    setTag(params.get("tag") ?? "");
    setPricing(params.get("pricing") ?? "");
    setPlatform(params.get("platform") ?? "");
    const s = params.get("sort");
    if (s === "score" || s === "name") setSort(s);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeParams({ q: query, category, tag, pricing, platform, sort: sort === "newest" ? "" : sort });
  }, [ready, query, category, tag, pricing, platform, sort]);

  const categories = useMemo(() => {
    const counts = new Map(countBy(items.map((i) => i.product?.category ?? "other")));
    // Fixed order from the taxonomy first, then anything unlisted.
    const keys = [...Object.keys(CATEGORIES).filter((k) => counts.has(k)), ...[...counts.keys()].filter((k) => !CATEGORIES[k])];
    return keys.map((k) => [k, counts.get(k)!] as const);
  }, [items]);
  const topTags = useMemo(() => countBy(items.flatMap((i) => i.product?.tags ?? [])).filter(([, n]) => n > 1).slice(0, 16), [items]);
  const platforms = useMemo(() => countBy(items.flatMap((i) => i.product?.platforms ?? [])), [items]);

  const results = useMemo(() => {
    const filtered = items.filter((item) => {
      const p = item.product;
      if (category && p?.category !== category) return false;
      if (tag && !p?.tags.includes(tag)) return false;
      if (pricing && p?.pricing !== pricing) return false;
      if (platform && !p?.platforms.includes(platform)) return false;
      return matchesQuery(item, query);
    });
    if (sort === "score") {
      return [...filtered].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    }
    if (sort === "name") {
      return [...filtered].sort((a, b) => (a.product?.name ?? a.title).localeCompare(b.product?.name ?? b.title));
    }
    return filtered;
  }, [items, query, category, tag, pricing, platform, sort]);

  const filtering = !!(query || category || tag || pricing || platform);
  const reset = () => {
    setQuery("");
    setCategory("");
    setTag("");
    setPricing("");
    setPlatform("");
  };

  return (
    <div>
      <SearchField value={query} onChange={setQuery} placeholder="Name, tag, license, platform…" />

      <div className="mt-5 flex flex-wrap gap-2">
        <Chip active={!category} onClick={() => setCategory("")}>
          ALL <span className="text-ink-500">{items.length}</span>
        </Chip>
        {categories.map(([key, count]) => (
          <Chip key={key} active={category === key} onClick={() => setCategory(category === key ? "" : key)}>
            {categoryLabel(key).toUpperCase()} <span className="text-ink-500">{count}</span>
          </Chip>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SelectField
          label="PRICING"
          value={pricing}
          onChange={setPricing}
          options={[{ value: "", label: "Any" }, ...Object.entries(PRICING).map(([value, label]) => ({ value, label }))]}
        />
        <SelectField
          label="PLATFORM"
          value={platform}
          onChange={setPlatform}
          options={[{ value: "", label: "Any" }, ...platforms.map(([value]) => ({ value, label: platformLabel(value) }))]}
        />
        <SelectField label="SORT" value={sort} onChange={(v) => setSort(v as Sort)} options={SORTS} />
      </div>

      {topTags.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[10px] tracking-[0.12em] text-ink-500">TAGS</span>
          {topTags.map(([t]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTag(tag === t ? "" : t)}
              aria-pressed={tag === t}
              className={`cursor-pointer px-1.5 py-0.5 text-[11px] ${tag === t ? "bg-accent/10 text-accent" : "text-ink-400 hover:text-ink-100"}`}
            >
              #{t}
            </button>
          ))}
          {tag && !topTags.some(([t]) => t === tag) && (
            <button type="button" onClick={() => setTag("")} className="cursor-pointer bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent">
              #{tag} ×
            </button>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-dashed border-line/22 pt-4 text-[11px] tracking-[0.12em]">
        <span className="text-ink-500" aria-live="polite">
          SHOWING <span className="text-ink-100">{results.length}</span> / {items.length} PRODUCTS
        </span>
        {filtering && (
          <button type="button" onClick={reset} className="cursor-pointer text-accent hover:text-ink-100">
            RESET FILTERS
          </button>
        )}
      </div>

      {results.length > 0 ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((item) => (
            <ProductCard key={item.slug} item={item} />
          ))}
        </div>
      ) : (
        <div className="mt-5 border border-dashed border-line/28 p-10 text-center">
          <div className="text-[11px] tracking-[0.14em] text-ink-500">NO MATCHING PRODUCTS</div>
          <button type="button" onClick={reset} className="mt-3 cursor-pointer text-sm text-accent hover:text-ink-100">
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
