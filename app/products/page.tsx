import type { Metadata } from "next";
import { ChannelHeader, PageBody } from "@/components/media/ChannelHeader";
import { ProductExplorer } from "@/components/ProductExplorer";
import { getProductPosts } from "@/lib/posts";
import { toListing } from "@/lib/listing";
import { toMediaItem } from "@/lib/media";
import { SITE_NAME } from "@/lib/site";

const DESCRIPTION =
  "Search and filter Indie Machine's hands-on reviews of developer tools and AI agents, by category, tag, pricing, platform and score.";

export const metadata: Metadata = {
  title: "Product Reviews | Indie Machine",
  description: DESCRIPTION,
  alternates: { canonical: "/products" },
  openGraph: {
    title: "Product Reviews",
    description: DESCRIPTION,
    url: "/products",
    siteName: SITE_NAME,
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image", title: "Product Reviews", description: DESCRIPTION, images: ["/opengraph-image"] },
};

export default function ProductsPage() {
  const posts = getProductPosts();
  const items = posts.map(toListing);
  const media = posts.map(toMediaItem);
  const scored = items.filter((i) => i.score !== undefined).length;
  const categories = new Set(items.map((i) => i.product?.category)).size;

  return (
    <PageBody>
      <ChannelHeader
        kicker="// CHANNEL /products"
        title="Product Reviews"
        blurb="Developer tools and AI agents, reviewed from the source. Each review records what was built and run locally, separately from what the product claims, and scores usability, accessibility, security, performance and setup time."
        stats={[`${items.length} REVIEWS`, `${categories} CATEGORIES`, `${scored} SCORECARDS`]}
        cta={{ href: "/promote", label: "GET YOUR TOOL REVIEWED" }}
      />
      <div className="mt-8">
        <ProductExplorer items={items} media={media} />
      </div>
    </PageBody>
  );
}
