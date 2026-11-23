import type { Metadata } from "next";
import { ChannelHeader, PageBody } from "@/components/media/ChannelHeader";
import { LinkFeed, TopicNav } from "@/components/links/LinkList";
import { getAllLinks, toLinkSummary } from "@/lib/links";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

const DESCRIPTION =
  "Trending tech, gaming and business stories, each with a short take on what's actually in it, and a link straight to the source.";

export const metadata: Metadata = {
  title: "Trending Links | Indie Machine",
  description: DESCRIPTION,
  alternates: { canonical: "/links", types: { "application/rss+xml": "/links/rss.xml" } },
  openGraph: {
    title: "Trending Links",
    description: DESCRIPTION,
    url: "/links",
    siteName: SITE_NAME,
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image", title: "Trending Links", description: DESCRIPTION, images: ["/opengraph-image"] },
};

export default function LinksPage() {
  const links = getAllLinks();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Trending Links",
    description: DESCRIPTION,
    url: absoluteUrl("/links"),
    isPartOf: { "@id": absoluteUrl("/#website") },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: links.slice(0, 50).map((l, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absoluteUrl(`/links/${l.slug}`),
        name: l.title,
      })),
    },
  };

  return (
    <PageBody>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ChannelHeader
        kicker="// CHANNEL /links - TRENDING NOW"
        title="Trending Links"
        blurb={
          <>
            What people are reading in tech, gaming and business, with a paragraph or two on what each story actually
            says. Every link goes straight to the source.
          </>
        }
        stats={[`${links.length} LINKS`]}
      >
        <div className="mt-2">
          <TopicNav />
        </div>
      </ChannelHeader>
      <div className="mt-8 max-w-4xl pb-16">
        <LinkFeed links={links.map(toLinkSummary)} />
      </div>
    </PageBody>
  );
}
