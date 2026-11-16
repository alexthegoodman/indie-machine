import type { Metadata } from "next";
import Link from "next/link";
import { ChannelHeader, PageBody } from "@/components/media/ChannelHeader";
import { DevExplorer } from "@/components/DevExplorer";
import { getDevPosts } from "@/lib/posts";
import { toMediaItem } from "@/lib/media";
import { SITE_NAME } from "@/lib/site";

const DESCRIPTION =
  "Indie Machine's engineering log: building Entropy, a native Rust engine, and Yumon Pet's models, with the commits and measurements behind each result.";

export const metadata: Metadata = {
  title: "Dev Posts: Rust Engineering Log | Indie Machine",
  description: DESCRIPTION,
  alternates: { canonical: "/dev" },
  openGraph: {
    title: "Dev Posts: Rust Engineering Log",
    description: DESCRIPTION,
    url: "/dev",
    siteName: SITE_NAME,
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dev Posts: Rust Engineering Log",
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default function DevPage() {
  const posts = getDevPosts();
  const series = Array.from(new Set(posts.map((p) => p.series ?? "Uncategorized")));

  return (
    <PageBody>
      <ChannelHeader
        kicker="// CHANNEL /dev"
        title="Dev Log"
        blurb={
          <>
            Native software as it gets built: Entropy&apos;s engine, GUI, creative tools and experiments, and Yumon
            Pet&apos;s model work. Build posts carry the commit, command and session evidence behind their claims.
          </>
        }
        stats={[`${posts.length} POSTS`, `${series.length} SERIES`]}
      >
        <div className="mt-3 flex flex-wrap gap-2">
          {series.map((name) => (
            <Link
              key={name}
              href={`/series/${encodeURIComponent(name)}`}
              className="border border-line/28 px-3 py-2 text-[11px] tracking-[0.08em] text-ink-300! hover:border-accent/60 hover:text-ink-100!"
            >
              {name.toUpperCase()} <span className="text-ink-500">{posts.filter((p) => (p.series ?? "Uncategorized") === name).length}</span>
            </Link>
          ))}
        </div>
      </ChannelHeader>

      <figure className="mt-6 grid items-center gap-5 border border-line/22 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <video
          className="block aspect-video w-full bg-black object-contain"
          autoPlay
          muted
          playsInline
          loop
          controls
          preload="metadata"
          aria-label="Entropy DAW demo"
        >
          <source src="/videos/entropy-daw-reel-min.mp4" type="video/mp4" />
          Your browser does not support embedded video.
        </video>
        <figcaption className="font-display text-sm leading-relaxed text-ink-300">
          <span className="block text-[11px] tracking-[0.14em] text-accent">// NOW SHOWING</span>
          <span className="mt-2 block text-lg font-semibold text-ink-100">Entropy DAW</span>A native digital audio
          workstation built with Entropy Engine, with MIDI sequencing, synthesis, and audio mixing.
        </figcaption>
      </figure>

      <div className="mt-8">
        <DevExplorer items={posts.map(toMediaItem)} />
      </div>
    </PageBody>
  );
}
