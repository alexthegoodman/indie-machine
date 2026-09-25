import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionDivider } from "@/components/SectionDivider";
import { PostRow } from "@/components/PostRow";
import { getAllSeries, getSeriesByName } from "@/lib/posts";
import { SITE_NAME } from "@/lib/site";
import { seriesDescription } from "@/lib/series";

export function generateStaticParams() {
  return getAllSeries().map(({ name }) => ({ series: name }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ series: string }>;
}): Promise<Metadata> {
  const { series } = await params;
  const name = decodeURIComponent(series);
  return {
    title: `${name} Engineering Articles | Indie Machine`,
    description: seriesDescription(name),
    alternates: { canonical: `/series/${encodeURIComponent(name)}` },
    openGraph: {
      title: `${name} Engineering Articles | Indie Machine`,
      description: seriesDescription(name),
      url: `/series/${encodeURIComponent(name)}`,
      siteName: SITE_NAME,
      type: "website",
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} Engineering Articles | Indie Machine`,
      description: seriesDescription(name),
      images: ["/opengraph-image"],
    },
  };
}

export default async function SeriesPage({ params }: { params: Promise<{ series: string }> }) {
  const { series } = await params;
  const name = decodeURIComponent(series);
  const posts = getSeriesByName(name);

  if (posts.length === 0) notFound();

  return (
    <div className="relative z-10">
      <SiteHeader active="series" />

      <div className="px-6 pt-16 pb-8 md:px-24 md:pt-20">
        <div className="text-[13px] tracking-[0.14em] text-accent">// SERIES</div>
        <h1 className="mt-3 font-display text-5xl font-bold text-ink-100 md:text-6xl">{name}</h1>
        <p className="mt-4 max-w-xl font-display text-base text-ink-300">
          {seriesDescription(name)} {posts.length} {posts.length === 1 ? "post" : "posts"}.
        </p>
      </div>

      <SectionDivider label={name.toUpperCase()} />

      <div className="px-6 pb-6 md:px-24">
        {posts.map((post, i) => (
          <PostRow
            key={post.slug}
            post={post}
            figNumber={i + 1}
            border={i === posts.length - 1 ? "both" : "top"}
          />
        ))}
      </div>

      <SiteFooter />
    </div>
  );
}
