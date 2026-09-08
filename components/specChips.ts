import type { Post } from "@/lib/posts";

// Pulls 1-2 crate names out of the post's frontmatter (preferring newly
// "added" dependencies, since those are usually what the post is about)
// plus the series name, to use as small tag chips on index rows.
export function specChips(post: Post): string[] {
  const versions = post.crate_versions ?? {};
  const source = (versions.added ?? versions.unchanged) as unknown;
  const crateNames: string[] = [];

  if (Array.isArray(source)) {
    for (const entry of source) {
      if (typeof entry !== "string") continue;
      const name = entry.split(/\s*=\s*/)[0]?.trim();
      if (name && !crateNames.includes(name)) crateNames.push(name);
      if (crateNames.length >= 2) break;
    }
  }

  const chips = crateNames.map((c) => c.toUpperCase());
  if (post.series) chips.push(post.series.toUpperCase());
  return chips;
}
