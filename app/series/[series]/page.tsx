import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionDivider } from "@/components/SectionDivider";
import { PostRow } from "@/components/PostRow";
import { getAllSeries, getSeriesByName } from "@/lib/posts";

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
    title: `${name} — Indie Machine`,
    description: `Posts in the ${name} series on Indie Machine.`,
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
          {posts.length} {posts.length === 1 ? "post" : "posts"} in build order.
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
