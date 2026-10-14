import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionDivider } from "@/components/SectionDivider";
import { DevExplorer } from "@/components/DevExplorer";
import { getDevPosts, toSummary } from "@/lib/posts";
import { seriesDescription } from "@/lib/series";
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
    <div className="relative z-10">
      <SiteHeader active="dev" />

      <div className="px-6 pt-16 pb-10 md:px-24 md:pt-20">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="min-w-0">
            <div className="text-[13px] tracking-[0.14em] text-accent">// ENGINEERING JOURNAL</div>
            <h1 className="mt-3 font-display text-5xl font-bold text-ink-100 md:text-6xl">Dev posts</h1>
            <div className="mt-4 text-[13px] tracking-[0.2em] text-accent uppercase">Rust - Native - Complex Applications</div>
            <p className="mt-6 max-w-2xl font-display text-base leading-relaxed text-ink-300 md:text-lg">
              Native software as it gets built: Entropy&apos;s engine, GUI, creative tools and
              experiments, and Yumon Pet&apos;s model work. Build posts carry the commit, command and
              session evidence behind their claims.
            </p>
          </div>
          <figure className="min-w-0">
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
            <figcaption className="mt-3 font-display text-sm leading-relaxed text-ink-300">
              <span className="font-semibold text-ink-100">Entropy DAW</span> - a native digital audio
              workstation built with Entropy Engine, with MIDI sequencing, synthesis, and audio mixing.
            </figcaption>
          </figure>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {series.map((name, i) => (
            <Link
              key={name}
              href={`/series/${encodeURIComponent(name)}`}
              className="border border-line/28 p-5 hover:border-accent/60"
            >
              <span className="text-[11px] text-accent">LINE {String(i + 1).padStart(2, "0")}</span>
              <div className="mt-1.5 font-display text-lg font-medium text-ink-100">{name}</div>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">{seriesDescription(name)}</p>
              <div className="mt-3 text-[11px] text-ink-400">
                {posts.filter((p) => (p.series ?? "Uncategorized") === name).length} POSTS →
              </div>
            </Link>
          ))}
        </div>
      </div>

      <SectionDivider label={`${posts.length} POSTS LOGGED`} />

      <div className="px-6 pb-6 md:px-24">
        <DevExplorer posts={posts.map(toSummary)} />
      </div>

      <SiteFooter />
    </div>
  );
}
