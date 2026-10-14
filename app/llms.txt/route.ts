import { getAllPosts, getAllSeries, getProductPosts } from "@/lib/posts";
import { categoryLabel } from "@/lib/taxonomy";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { seriesDescription } from "@/lib/series";

export function GET() {
  const series = getAllSeries()
    .map(({ name }) => `- [${name}](${absoluteUrl(`/series/${encodeURIComponent(name)}`)}): ${seriesDescription(name)}`)
    .join("\n");

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

  const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

Indie Machine reviews developer tools and keeps an engineering journal. Build posts record tested implementations, source revisions, commands, measurements, and limitations. Product reviews distinguish direct tests from documentation and vendor claims.

## Start here

- [About](${absoluteUrl("/about")}): Scope, editorial approach, and evidence standards.
- [Product reviews](${absoluteUrl("/products")}): Searchable index of reviewed developer tools.
- [Dev posts](${absoluteUrl("/dev")}): Rust and native engineering build log.
- [Get reviewed](${absoluteUrl("/promote")}): How to submit a product for review, including the paid priority review.
- [Article archive](${absoluteUrl("/archive")}): All articles, newest first.
- [RSS feed](${absoluteUrl("/rss.xml")}): New articles.

## Product reviews

${products}

## Series

${series}

## Articles

${posts}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
