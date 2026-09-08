import fs from "fs";
import path from "path";
import matter from "gray-matter";

const POSTS_DIR = path.join(process.cwd(), "app/posts");

// Filenames are "YYYY-MM-DD-slug.mdx" - the date prefix keeps posts sorted
// on disk; the slug (everything after it) is what's used in the URL.
const FILENAME_RE = /^\d{4}-\d{2}-\d{2}-(.+)\.mdx$/;

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  series?: string;
  repo_link?: string;
  crate_versions?: Record<string, unknown>;
};

export type Post = PostMeta & {
  content: string;
  excerpt: string;
};

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

function filenameToSlug(filename: string): string {
  const match = FILENAME_RE.exec(filename);
  return match ? match[1] : filename.replace(/\.mdx$/, "");
}

function readPost(filename: string): Post {
  const raw = fs.readFileSync(path.join(POSTS_DIR, filename), "utf8");
  const { data, content } = matter(raw);
  return {
    slug: filenameToSlug(filename),
    title: data.title,
    date: data.date instanceof Date ? data.date.toISOString().slice(0, 10) : String(data.date),
    series: data.series,
    repo_link: data.repo_link,
    crate_versions: data.crate_versions,
    content,
    excerpt: deriveExcerpt(content),
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
