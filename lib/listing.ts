import { averageScore, type Post, type ProductInfo } from "./posts";

// The slice of a post that index pages and the client-side filters need.
// Kept small and serializable: it's what gets shipped to the browser.
export type Listing = {
  slug: string;
  title: string;
  date: string;
  series?: string;
  excerpt: string;
  product?: ProductInfo;
  scores?: Record<string, number>;
  score?: number;
  sponsored?: boolean;
};

export function toListing(post: Post): Listing {
  return {
    slug: post.slug,
    title: post.title,
    date: post.date,
    series: post.series,
    excerpt: post.excerpt,
    product: post.product,
    scores: post.scores,
    score: averageScore(post),
    sponsored: post.sponsored || undefined,
  };
}
