import { getAllLinks } from "@/lib/links";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET() {
  const items = getAllLinks()
    .map((link) => {
      const url = absoluteUrl(`/links/${link.slug}`);
      return `
    <item>
      <title>${escapeXml(link.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${new Date(link.date).toUTCString()}</pubDate>
      <category>${escapeXml(link.topic)}</category>
      <source url="${escapeXml(link.url)}">${escapeXml(link.source)}</source>
      <description>${escapeXml(link.excerpt)}</description>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(`${SITE_NAME} - Trending Links`)}</title>
    <link>${absoluteUrl("/links")}</link>
    <description>Trending tech, gaming and business stories with a short take on each.</description>${items}
  </channel>
</rss>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
