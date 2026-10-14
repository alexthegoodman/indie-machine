import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionDivider } from "@/components/SectionDivider";
import { TitleBlock } from "@/components/TitleBlock";
import { ProductExplorer } from "@/components/ProductExplorer";
import { getProductPosts } from "@/lib/posts";
import { toListing } from "@/lib/listing";
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
  const items = getProductPosts().map(toListing);
  const scored = items.filter((i) => i.score !== undefined).length;
  const categories = new Set(items.map((i) => i.product?.category)).size;

  return (
    <div className="relative z-10">
      <SiteHeader active="products" />

      <div className="px-6 pt-16 pb-8 md:px-24 md:pt-20">
        <div className="text-[13px] tracking-[0.14em] text-accent">// PRODUCT INDEX</div>
        <h1 className="mt-3 font-display text-5xl font-bold text-ink-100 md:text-6xl">Products</h1>
        <p className="mt-4 max-w-2xl font-display text-base leading-relaxed text-ink-300 md:text-lg">
          Developer tools and AI agents, reviewed from the source. Each review records what was built
          and run locally, separately from what the product claims.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <TitleBlock
            cells={[
              { label: "REVIEWED", value: String(items.length) },
              { label: "CATEGORIES", value: String(categories) },
              { label: "SCORECARDS", value: String(scored), accent: true },
            ]}
          />
          <Link href="/promote" className="text-xs tracking-[0.1em] text-ink-500 hover:text-accent">
            SUBMIT A PRODUCT →
          </Link>
        </div>
      </div>

      <SectionDivider label="SEARCH + FILTER" />

      <div className="px-6 pb-16 md:px-24">
        <ProductExplorer items={items} />
      </div>

      <SiteFooter />
    </div>
  );
}
