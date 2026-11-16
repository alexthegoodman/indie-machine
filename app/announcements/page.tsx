import type { Metadata } from "next";
import { ChannelHeader, PageBody } from "@/components/media/ChannelHeader";
import { GameExplorer } from "@/components/GameExplorer";
import { getGamePosts } from "@/lib/posts";
import { toMediaItem } from "@/lib/media";
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
    <PageBody>
      <ChannelHeader
        kicker="// CHANNEL /announcements - CURATED INDIE GAMES"
        accent="badge"
        title="Game Announcements"
        blurb={
          <>
            Short write-ups of new and upcoming indie games worth a look, usually free to play or with a free demo.
            We don&apos;t score them. Each one earns impression badges for its genre, look and feel instead.
          </>
        }
        image={posts.find((p) => p.image)?.image}
        stats={[`${posts.length} GAMES ANNOUNCED`]}
      />
      <div className="mt-8">
        <GameExplorer items={posts.map(toMediaItem)} />
      </div>
    </PageBody>
  );
}
