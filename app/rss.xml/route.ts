import { getAllPosts } from "@/lib/posts";

const SITE_NAME = "Indie Machine";
const SITE_DESCRIPTION = "Rust. Native. Complex applications. A build log for Entropy.";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(request: Request) {
  const siteUrl = new URL(request.url).origin;
  const posts = getAllPosts();

  const items = posts
    .map((post) => {
      const url = `${siteUrl}/posts/${post.slug}`;
      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description>${escapeXml(post.excerpt)}</description>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
