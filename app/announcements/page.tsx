import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionDivider } from "@/components/SectionDivider";
import { GameExplorer } from "@/components/GameExplorer";
import { getGamePosts, toSummary } from "@/lib/posts";
import { SITE_NAME } from "@/lib/site";

const DESCRIPTION =
  "Curated announcements for new and upcoming indie games, usually free to play or with a free demo, each tagged with impression badges for genre, look and feel.";

export const metadata: Metadata = {
  title: "Indie Game Announcements | Indie Machine",
  description: DESCRIPTION,
  alternates: { canonical: "/announcements" },
  openGraph: {
    title: "Indie Game Announcements",
    description: DESCRIPTION,
    url: "/announcements",
    siteName: SITE_NAME,
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Indie Game Announcements",
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default function AnnouncementsPage() {
  const posts = getGamePosts();

  return (
    <div className="relative z-10">
      <SiteHeader active="announcements" />

      <div className="px-6 pt-16 pb-10 md:px-24 md:pt-20">
        <div className="text-[13px] tracking-[0.14em] text-badge">// CURATED INDIE GAMES</div>
        <h1 className="mt-3 font-display text-5xl font-bold text-ink-100 md:text-6xl">Game announcements</h1>
        <div className="mt-4 text-[13px] tracking-[0.2em] text-accent uppercase">
          New - Upcoming - Free To Play Or Demo
        </div>
        <p className="mt-6 max-w-2xl font-display text-base leading-relaxed text-ink-300 md:text-lg">
          Short write-ups of indie games worth a look. We don&apos;t score them. Each one earns impression
          badges for its genre, look and feel instead.
        </p>
      </div>

      <SectionDivider label={`${posts.length} GAMES ANNOUNCED`} />

      <div className="px-6 pb-6 md:px-24">
        <GameExplorer posts={posts.map(toSummary)} />
      </div>

      <SiteFooter />
    </div>
  );
}
