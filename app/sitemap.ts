import type { MetadataRoute } from "next";
import { getAllPosts, getAllSeries } from "@/lib/posts";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const series = getAllSeries();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/archive`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/series`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}/posts/${post.slug}`,
    lastModified: post.date,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const seriesRoutes: MetadataRoute.Sitemap = series.map(({ name }) => ({
    url: `${SITE_URL}/series/${encodeURIComponent(name)}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticRoutes, ...postRoutes, ...seriesRoutes];
}
