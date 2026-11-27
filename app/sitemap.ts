import type { MetadataRoute } from "next";
import { getAllPosts, getAllSeries } from "@/lib/posts";
import { SITE_URL } from "@/lib/site";
import { COURSES } from "@/lib/courses";
import { LINK_TOPICS, getAllLinks } from "@/lib/links";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const series = getAllSeries();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/free-ai`, changeFrequency: "weekly", priority: 0.95 },
    { url: `${SITE_URL}/free-ai/gherkin`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/dev`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/announcements`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/links`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/games`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/promote`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/archive`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/series`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/courses`, changeFrequency: "weekly", priority: 0.8 },
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

  const courseRoutes: MetadataRoute.Sitemap = COURSES.flatMap((c) => [
    { url: `${SITE_URL}/courses/${c.slug}`, lastModified: c.updated, changeFrequency: "monthly" as const, priority: 0.8 },
    ...c.lessons.map((l) => ({
      url: `${SITE_URL}/courses/${c.slug}/${l.slug}`,
      lastModified: c.updated,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ]);

  const linkRoutes: MetadataRoute.Sitemap = [
    ...Object.keys(LINK_TOPICS).map((topic) => ({
      url: `${SITE_URL}/links/topic/${topic}`,
      changeFrequency: "daily" as const,
      priority: 0.5,
    })),
    ...getAllLinks().map((link) => ({
      url: `${SITE_URL}/links/${link.slug}`,
      lastModified: link.date,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];

  return [...staticRoutes, ...courseRoutes, ...postRoutes, ...linkRoutes, ...seriesRoutes];
}
