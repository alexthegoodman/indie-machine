import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChannelHeader, PageBody } from "@/components/media/ChannelHeader";
import { MediaGrid } from "@/components/media/MediaCard";
import { toMediaItem } from "@/lib/media";
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

  const items = posts.map(toMediaItem);
  const minutes = items.reduce((sum, i) => sum + i.minutes, 0);

  return (
    <PageBody>
      <ChannelHeader
        kicker={`// SERIES /series/${name}`}
        title={name}
        blurb={seriesDescription(name)}
        image={posts.find((p) => p.image)?.image}
        stats={[`${posts.length} ${posts.length === 1 ? "POST" : "POSTS"}`, `${minutes} MIN TOTAL`]}
        accent={posts[0].kind === "game" ? "badge" : "accent"}
      />
      <MediaGrid items={items} className="mt-8" />
    </PageBody>
  );
}
