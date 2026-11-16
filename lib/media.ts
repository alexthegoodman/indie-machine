import type { Post, PostKind } from "./posts";
import { averageScore } from "./score";

// Everything a card, shelf, search result or mini player needs about a post.
// Small and serializable: the full list is handed to the client app shell.
export type MediaItem = {
  slug: string;
  title: string;
  kind: PostKind;
  series?: string;
  date: string;
  image?: string;
  score?: number;
  minutes: number;
  blurb: string;
  badges?: string[];
  // Lowercased words the home chips and search match against.
  keywords: string;
  sponsored?: boolean;
};

const WORDS_PER_MINUTE = 230;

export function readMinutes(content: string): number {
  const words = content
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function toMediaItem(post: Post): MediaItem {
  const p = post.product;
  return {
    slug: post.slug,
    title: post.title,
    kind: post.kind,
    series: post.series,
    date: post.date,
    image: post.image,
    score: averageScore(post),
    minutes: readMinutes(post.content),
    blurb: p?.tagline ?? post.excerpt,
    ...(post.badges?.length ? { badges: post.badges } : {}),
    keywords: [post.title, post.series, p?.name, p?.tagline, p?.category, ...(p?.tags ?? []), ...(post.badges ?? [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    ...(post.sponsored ? { sponsored: true } : {}),
  };
}

// The "channel" a post belongs to, shown under card titles like a YouTube
// channel name. Each one maps to an existing index route.
export function channelOf(item: Pick<MediaItem, "kind" | "series">): { label: string; href: string } {
  if (item.kind === "product") return { label: "Product Reviews", href: "/products" };
  if (item.kind === "game") return { label: "Game Announcements", href: "/announcements" };
  return item.series
    ? { label: `Dev Log · ${item.series}`, href: `/series/${encodeURIComponent(item.series)}` }
    : { label: "Dev Log", href: "/dev" };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

// Relative age against a given "now" (ms). Callers on the client pass
// Date.now(); the server renders the absolute date instead so the HTML
// never disagrees with hydration.
export function relativeAge(date: string, now: number): string {
  const days = Math.floor((now - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return w === 1 ? "1 week ago" : `${w} weeks ago`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return m === 1 ? "1 month ago" : `${m} months ago`;
  }
  const y = Math.floor(days / 365);
  return y === 1 ? "1 year ago" : `${y} years ago`;
}
