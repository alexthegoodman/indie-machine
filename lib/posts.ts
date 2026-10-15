import fs from "fs";
import path from "path";
import matter from "gray-matter";

const POSTS_DIR = path.join(process.cwd(), "app/posts");

// Filenames are "YYYY-MM-DD-slug.mdx" - the date prefix keeps posts sorted
// on disk; the slug (everything after it) is what's used in the URL.
const FILENAME_RE = /^\d{4}-\d{2}-\d{2}-(.+)\.mdx$/;

// "product" posts are reviews of other people's tools; "dev" posts are the
// engineering log. Posts that don't set `kind` get it from their series.
export type PostKind = "product" | "dev";

export type Pricing = "free" | "freemium" | "paid";

export type ProductInfo = {
  name: string;
  url?: string;
  tagline?: string;
  category: string;
  tags: string[];
  license?: string;
  pricing?: Pricing;
  platforms: string[];
};

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  kind: PostKind;
  series?: string;
  repo_link?: string;
  crate_versions?: Record<string, unknown>;
  product?: ProductInfo;
  // Scorecard values (1-10) keyed by concern, e.g. { usability: 7 }.
  scores?: Record<string, number>;
  // Slugs to show as "similar" ahead of the tag-based matches.
  related?: string[];
  // Set when the review was paid for or requested through /promote.
  sponsored?: boolean;
  // Cover image for cards: frontmatter `image`, else the first image in the body.
  image?: string;
};

export type Post = PostMeta & {
  content: string;
  excerpt: string;
};

// What an index row needs - no MDX body, so it's cheap to pass to the client.
export type PostSummary = Pick<
  Post,
  "slug" | "title" | "date" | "series" | "excerpt" | "crate_versions" | "image"
>;

export function toSummary(post: Post): PostSummary {
  const { slug, title, date, series, excerpt, crate_versions, image } = post;
  return {
    slug,
    title,
    date,
    series,
    excerpt,
    ...(crate_versions ? { crate_versions } : {}),
    ...(image ? { image } : {}),
  };
}

const EXCERPT_LENGTH = 220;

// Takes the post's first real paragraph, strips inline markdown syntax,
// and truncates at a word boundary - a plain, generic dek that works for
// any post without hand-written marketing copy.
function deriveExcerpt(content: string): string {
  const firstParagraph = content
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .find((block) => block && !block.startsWith("#") && !block.startsWith("```"));

  if (!firstParagraph) return "";

  const plain = firstParagraph
    .replace(/`{1,3}[^`]*`{1,3}/g, (m) => m.replace(/`/g, ""))
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length <= EXCERPT_LENGTH) return plain;
  const truncated = plain.slice(0, EXCERPT_LENGTH);
  return truncated.slice(0, truncated.lastIndexOf(" ")) + "…";
}

function deriveImage(data: Record<string, unknown>, content: string): string | undefined {
  if (typeof data.image === "string" && data.image) return data.image;
  const match = /!\[[^\]]*\]\(\s*(\/[^\s)]+|https?:\/\/[^\s)]+)/.exec(content);
  return match?.[1];
}

function filenameToSlug(filename: string): string {
  const match = FILENAME_RE.exec(filename);
  return match ? match[1] : filename.replace(/\.mdx$/, "");
}

const PRODUCT_SERIES = new Set(["Product Hunt"]);

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : [];
}

function parseProduct(value: unknown): ProductInfo | undefined {
  if (!value || typeof value !== "object") return undefined;
  const p = value as Record<string, unknown>;
  if (!p.name) return undefined;
  const pricing = String(p.pricing ?? "");
  return {
    name: String(p.name),
    url: p.url ? String(p.url) : undefined,
    tagline: p.tagline ? String(p.tagline) : undefined,
    category: String(p.category ?? "other"),
    tags: stringList(p.tags).map((t) => t.toLowerCase()),
    license: p.license ? String(p.license) : undefined,
    pricing: pricing === "free" || pricing === "freemium" || pricing === "paid" ? pricing : undefined,
    platforms: stringList(p.platforms).map((t) => t.toLowerCase()),
  };
}

function parseScores(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const scores: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    const n = Number(raw);
    if (Number.isFinite(n)) scores[key] = n;
  }
  return Object.keys(scores).length ? scores : undefined;
}

function readPost(filename: string): Post {
  const raw = fs.readFileSync(path.join(POSTS_DIR, filename), "utf8");
  const { data, content } = matter(raw);
  return {
    slug: filenameToSlug(filename),
    title: data.title,
    date: data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date),
    kind:
      data.kind === "product" || data.kind === "dev"
        ? data.kind
        : PRODUCT_SERIES.has(data.series) || data.product
          ? "product"
          : "dev",
    series: data.series,
    repo_link: data.repo_link,
    crate_versions: data.crate_versions,
    product: parseProduct(data.product),
    scores: parseScores(data.scores),
    related: stringList(data.related),
    sponsored: data.sponsored === true,
    content,
    excerpt: deriveExcerpt(content),
    image: deriveImage(data, content),
  };
}

// Newest date first; ties (same-day posts) keep filename order, which is
// also each post's narrative/build order within that day.
function comparePosts(a: PostMeta, b: PostMeta): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.slug.localeCompare(b.slug);
}

export function getAllPosts(): Post[] {
  const filenames = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".mdx"));
  return filenames.map(readPost).sort(comparePosts);
}

export function getPostBySlug(slug: string): Post | undefined {
  return getAllPosts().find((p) => p.slug === slug);
}

export function getAllSlugs(): string[] {
  return getAllPosts().map((p) => p.slug);
}

export function getAllSeries(): { name: string; posts: Post[] }[] {
  const posts = getAllPosts();
  const bySeries = new Map<string, Post[]>();
  for (const post of posts) {
    const key = post.series ?? "Uncategorized";
    if (!bySeries.has(key)) bySeries.set(key, []);
    bySeries.get(key)!.push(post);
  }
  return Array.from(bySeries.entries()).map(([name, seriesPosts]) => ({ name, posts: seriesPosts }));
}

export function getSeriesByName(name: string): Post[] {
  return getAllPosts().filter((p) => (p.series ?? "Uncategorized") === name);
}

export function getProductPosts(): Post[] {
  return getAllPosts().filter((p) => p.kind === "product");
}

export function getDevPosts(): Post[] {
  return getAllPosts().filter((p) => p.kind === "dev");
}

// Mean of a post's scorecard, rounded to one decimal, or undefined if it
// has none.
export function averageScore(post: PostMeta): number | undefined {
  const values = Object.values(post.scores ?? {});
  if (!values.length) return undefined;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

// Ranks other posts of the same kind by overlap with this one. Products
// match on shared tags (plus a bump for the same category); dev posts
// match on series. Manually listed `related` slugs always come first.
export function getSimilarPosts(post: Post, limit = 3): Post[] {
  const candidates = getAllPosts().filter((p) => p.slug !== post.slug && p.kind === post.kind);
  const bySlug = new Map(candidates.map((p) => [p.slug, p]));
  const pinned = (post.related ?? []).map((slug) => bySlug.get(slug)).filter((p): p is Post => !!p);

  const tags = new Set(post.product?.tags ?? []);
  const scored = candidates
    .filter((p) => !pinned.includes(p))
    .map((p) => {
      let score = 0;
      if (post.product && p.product) {
        score += p.product.tags.filter((t) => tags.has(t)).length * 2;
        if (p.product.category === post.product.category) score += 5;
      } else if (post.series && p.series === post.series) {
        score += 1;
      }
      return { p, score };
    })
    .filter(({ score }) => score > 0)
    // Stable sort keeps newest-first among equal scores.
    .sort((a, b) => b.score - a.score);

  return [...pinned, ...scored.map(({ p }) => p)].slice(0, limit);
}
