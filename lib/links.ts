import fs from "fs";
import path from "path";
import matter from "gray-matter";

// Trending Links: short write-ups that point at someone else's story. Each one is an MDX file
// in content/links named "YYYY-MM-DD-slug.mdx", like posts. The body is our paragraph or two;
// the frontmatter carries the outbound link and where it came from.
const LINKS_DIR = path.join(process.cwd(), "content/links");
const FILENAME_RE = /^\d{4}-\d{2}-\d{2}-(.+)\.mdx$/;

export const LINK_TOPICS = {
  tech: { label: "Tech", blurb: "AI, hardware, software and the companies that make them." },
  gaming: { label: "Gaming", blurb: "Releases, guides and the stories around games people are playing right now." },
  business: { label: "Business", blurb: "Markets, money and the people moving them." },
  deals: { label: "Deals", blurb: "Sales worth knowing about, with the fine print." },
  science: { label: "Science", blurb: "Space, sky and the natural world." },
} as const;

export type LinkTopic = keyof typeof LINK_TOPICS;

export type TrendingLink = {
  slug: string;
  title: string;
  // The day we posted it.
  date: string;
  url: string;
  host: string;
  // Publisher name as they write it, e.g. "The Verge".
  source: string;
  author?: string;
  // When the source published, if it says. Reference pages often don't.
  published?: string;
  topic: LinkTopic;
  tags: string[];
  // Other coverage we leaned on, shown under the take.
  also: { title: string; url: string }[];
  // Order within a day, lowest first; unranked links follow, by slug.
  rank?: number;
  // Who sent it in. Empty for our own picks; set once submissions open, and those links go
  // out with rel="ugc".
  submittedBy?: string;
  content: string;
  excerpt: string;
};

export type LinkSummary = Omit<TrendingLink, "content">;

const EXCERPT_LENGTH = 200;

function deriveExcerpt(content: string): string {
  const first = content
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .find((b) => b && !b.startsWith("#"));
  if (!first) return "";
  const plain = first
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= EXCERPT_LENGTH) return plain;
  const cut = plain.slice(0, EXCERPT_LENGTH);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

function isoDate(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value ? String(value) : undefined;
}

function readLink(filename: string): TrendingLink {
  const raw = fs.readFileSync(path.join(LINKS_DIR, filename), "utf8");
  const { data, content } = matter(raw);
  const slug = FILENAME_RE.exec(filename)?.[1] ?? filename.replace(/\.mdx$/, "");
  if (!data.url) throw new Error(`content/links/${filename}: missing url`);
  if (!(data.topic in LINK_TOPICS)) throw new Error(`content/links/${filename}: unknown topic "${data.topic}"`);
  const url = new URL(String(data.url));
  return {
    slug,
    title: String(data.title),
    date: isoDate(data.date)!,
    url: url.href,
    host: url.hostname.replace(/^www\./, ""),
    source: String(data.source ?? url.hostname),
    author: data.author ? String(data.author) : undefined,
    published: isoDate(data.published),
    topic: data.topic as LinkTopic,
    tags: Array.isArray(data.tags) ? data.tags.map((t: unknown) => String(t).toLowerCase()) : [],
    also: Array.isArray(data.also)
      ? data.also.filter((a: { url?: string }) => a?.url).map((a: { title?: string; url: string }) => ({ title: String(a.title ?? a.url), url: String(a.url) }))
      : [],
    rank: Number.isFinite(Number(data.rank)) && data.rank !== undefined ? Number(data.rank) : undefined,
    submittedBy: data.submitted_by ? String(data.submitted_by) : undefined,
    content,
    excerpt: deriveExcerpt(content),
  };
}

let cache: TrendingLink[] | undefined;

// Newest day first; within a day, by `rank`, then slug.
export function getAllLinks(): TrendingLink[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const files = fs.existsSync(LINKS_DIR) ? fs.readdirSync(LINKS_DIR).filter((f) => f.endsWith(".mdx")) : [];
  const links = files.map(readLink);
  const slugs = new Set<string>();
  for (const l of links) {
    if (slugs.has(l.slug)) throw new Error(`content/links: duplicate slug "${l.slug}"`);
    slugs.add(l.slug);
  }
  const rank = (l: TrendingLink) => l.rank ?? Number.POSITIVE_INFINITY;
  cache = links.sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : rank(a) - rank(b) || a.slug.localeCompare(b.slug),
  );
  return cache;
}

export function getLink(slug: string): TrendingLink | undefined {
  return getAllLinks().find((l) => l.slug === slug);
}

export function toLinkSummary({ content: _content, ...rest }: TrendingLink): LinkSummary {
  return rest;
}

export function linksByDay(links: LinkSummary[]): { date: string; links: LinkSummary[] }[] {
  const days = new Map<string, LinkSummary[]>();
  for (const l of links) {
    if (!days.has(l.date)) days.set(l.date, []);
    days.get(l.date)!.push(l);
  }
  return [...days].map(([date, links]) => ({ date, links }));
}

// Same topic first, then shared tags; never the link itself.
export function relatedLinks(link: TrendingLink, count = 4): LinkSummary[] {
  const score = (o: TrendingLink) =>
    (o.topic === link.topic ? 2 : 0) + o.tags.filter((t) => link.tags.includes(t)).length * 3;
  return getAllLinks()
    .filter((o) => o.slug !== link.slug)
    .map((o) => ({ o, s: score(o) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, count)
    .map(({ o }) => toLinkSummary(o));
}

// Outbound rel for a link we relay. Our own picks pass referral (we want sources to see the
// traffic); visitor submissions will be ugc + nofollow.
export function outboundRel(link: Pick<TrendingLink, "submittedBy">): string {
  return link.submittedBy ? "ugc nofollow noopener" : "noopener";
}
