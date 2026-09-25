import { getAllPosts, getAllSeries } from "@/lib/posts";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { seriesDescription } from "@/lib/series";

export function GET() {
  const series = getAllSeries()
    .map(({ name }) => `- [${name}](${absoluteUrl(`/series/${encodeURIComponent(name)}`)}): ${seriesDescription(name)}`)
    .join("\n");

  const posts = getAllPosts()
    .map((post) => `- [${post.title}](${absoluteUrl(`/posts/${post.slug}`)}) (${post.date})`)
    .join("\n");

  const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

Indie Machine is an engineering journal. Build posts record tested implementations, source revisions, commands, measurements, and limitations. Product reviews distinguish direct tests from documentation and vendor claims.

## Start here

- [About](${absoluteUrl("/about")}): Scope, editorial approach, and evidence standards.
- [Article archive](${absoluteUrl("/archive")}): All articles, newest first.
- [RSS feed](${absoluteUrl("/rss.xml")}): New articles.

## Series

${series}

## Articles

${posts}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
