import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionDivider } from "@/components/SectionDivider";
import { ChevronRight } from "@/components/icons";
import { getAllSeries } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Series — Indie Machine",
  description: "Posts on Indie Machine, grouped by series.",
};

export default function SeriesIndexPage() {
  const series = getAllSeries();

  return (
    <div className="relative z-10">
      <SiteHeader active="series" />

      <div className="px-6 pt-16 pb-8 md:px-24 md:pt-20">
        <div className="text-[13px] tracking-[0.14em] text-accent">// GROUPED BY THREAD</div>
        <h1 className="mt-3 font-display text-5xl font-bold text-ink-100 md:text-6xl">Series</h1>
        <p className="mt-4 max-w-xl font-display text-base text-ink-300">
          Multi-post threads that build on each other, in order.
        </p>
      </div>

      <SectionDivider label={`${series.length} SERIES`} />

      <div className="flex flex-col gap-4 px-6 pb-16 md:px-24">
        {series.map(({ name, posts }) => (
          <Link
            key={name}
            href={`/series/${encodeURIComponent(name)}`}
            className="group flex items-center justify-between border border-line/28 p-6 hover:border-accent/60 md:p-8"
          >
            <div>
              <div className="font-display text-2xl font-semibold text-ink-100 group-hover:text-accent">
                {name}
              </div>
              <div className="mt-1 text-xs text-ink-500">
                {posts.length} {posts.length === 1 ? "post" : "posts"}
              </div>
            </div>
            <ChevronRight className="shrink-0 text-accent" />
          </Link>
        ))}
      </div>

      <SiteFooter />
    </div>
  );
}
