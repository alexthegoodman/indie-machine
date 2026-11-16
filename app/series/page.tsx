import type { Metadata } from "next";
import Link from "next/link";
import { ChannelHeader, PageBody } from "@/components/media/ChannelHeader";
import { Thumb } from "@/components/media/Thumb";
import { ChevronRight } from "@/components/icons";
import { getAllSeries } from "@/lib/posts";
import { SITE_NAME } from "@/lib/site";
import { seriesDescription } from "@/lib/series";

export const metadata: Metadata = {
  title: "Rust, Yumon, and Developer Tool Series | Indie Machine",
  description: "Explore Indie Machine's Rust engine build log, Yumon model experiments, and technical developer tool reviews by series.",
  alternates: { canonical: "/series" },
  openGraph: {
    title: "Engineering Series | Indie Machine",
    description: "Follow Entropy, Yumon, and developer tool reviews by series.",
    url: "/series",
    siteName: SITE_NAME,
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Engineering Series | Indie Machine",
    description: "Follow Entropy, Yumon, and developer tool reviews by series.",
    images: ["/opengraph-image"],
  },
};

export default function SeriesIndexPage() {
  const series = getAllSeries();

  return (
    <PageBody>
      <ChannelHeader
        kicker="// GROUPED BY THREAD /series"
        title="Series"
        blurb="Multi-post threads that build on each other, in order."
        stats={[`${series.length} SERIES`]}
      />
      <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-5">
        {series.map(({ name, posts }) => {
          const cover = posts.find((p) => p.image);
          return (
            <article key={name} className="group relative flex flex-col gap-3 border border-line/22 p-3 hover:border-accent/60">
              <Thumb item={{ image: cover?.image, title: name, series: name, kind: posts[0].kind }} />
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  href={`/series/${encodeURIComponent(name)}`}
                  className="font-display text-xl font-semibold text-ink-100! after:absolute after:inset-0 after:content-[''] group-hover:text-accent!"
                >
                  {name}
                </Link>
                <span className="flex shrink-0 items-center gap-2 text-[11px] text-ink-400">
                  {posts.length} {posts.length === 1 ? "POST" : "POSTS"} <ChevronRight className="text-accent" />
                </span>
              </div>
              <p className="text-xs leading-relaxed text-ink-400">{seriesDescription(name)}</p>
            </article>
          );
        })}
      </div>
    </PageBody>
  );
}
