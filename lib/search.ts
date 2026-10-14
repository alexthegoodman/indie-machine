import type { Listing } from "./listing";
import { categoryLabel, platformLabel } from "./taxonomy";

// Plain token match: every word in the query has to appear somewhere in the
// listing's text. Small enough data that nothing fancier is needed.
export function matchesQuery(item: Listing, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const p = item.product;
  const haystack = [
    item.title,
    item.excerpt,
    item.series,
    p?.name,
    p?.tagline,
    p?.license,
    p && categoryLabel(p.category),
    ...(p?.tags ?? []),
    ...(p?.platforms ?? []).map(platformLabel),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}

// Reads/writes filter state in the query string without a navigation, so a
// filtered view can be shared or bookmarked while the page stays static.
export function readParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export function writeParams(values: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  const qs = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
}
