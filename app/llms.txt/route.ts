import { getAllPosts, getAllSeries, getProductPosts } from "@/lib/posts";
import { categoryLabel } from "@/lib/taxonomy";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { seriesDescription } from "@/lib/series";
import { COURSES } from "@/lib/courses";
import { getAllLinks } from "@/lib/links";

export function GET() {
  const series = getAllSeries()
    .map(({ name }) => `- [${name}](${absoluteUrl(`/series/${encodeURIComponent(name)}`)}): ${seriesDescription(name)}`)
    .join("\n");

  const courses = COURSES.map(
    (c) =>
      `- [${c.title}](${absoluteUrl(`/courses/${c.slug}`)}): ${c.description}\n` +
      c.lessons.map((l, i) => `  - [Lesson ${i + 1}: ${l.title}](${absoluteUrl(`/courses/${c.slug}/${l.slug}`)}): ${l.summary}`).join("\n"),
  ).join("\n");

  const posts = getAllPosts()
    .map((post) => `- [${post.title}](${absoluteUrl(`/posts/${post.slug}`)}) (${post.date})`)
    .join("\n");

  const products = getProductPosts()
    .map((post) => {
      const p = post.product;
      const label = p ? `${p.name} (${categoryLabel(p.category)})` : post.title;
      return `- [${label}](${absoluteUrl(`/posts/${post.slug}`)}): ${p?.tagline ?? post.title}`;
    })
    .join("\n");

  const links = getAllLinks()
    .map((l) => `- [${l.title}](${absoluteUrl(`/links/${l.slug}`)}) (${l.date}, ${l.topic}, via ${l.source})`)
    .join("\n");

  const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

Indie Machine reviews developer tools and keeps an engineering journal. Build posts record tested implementations, source revisions, commands, measurements, and limitations. Product reviews distinguish direct tests from documentation and vendor claims.

## Start here

- [About](${absoluteUrl("/about")}): Scope, editorial approach, and evidence standards.
- [Product reviews](${absoluteUrl("/products")}): Searchable index of reviewed developer tools.
- [Game announcements](${absoluteUrl("/announcements")}): Curated indie game announcements with impression badges.
- [Trending links](${absoluteUrl("/links")}): Trending tech, gaming and business stories with a short take on each and a link to the source.
- [Courses](${absoluteUrl("/courses")}): Free interactive courses, step by step with quizzes.
- [Dev posts](${absoluteUrl("/dev")}): Rust and native engineering build log.
- [Advertise](${absoluteUrl("/promote")}): Advertising for makers: monthly ad slots and paid reviews.
- [Article archive](${absoluteUrl("/archive")}): All articles, newest first.
- [RSS feed](${absoluteUrl("/rss.xml")}): New articles.

## Product reviews

${products}

## Courses

${courses}

## Trending links

${links}

## Series

${series}

## Articles

${posts}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
