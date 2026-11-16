import type { Metadata } from "next";
import { ChannelHeader, PageBody } from "@/components/media/ChannelHeader";
import { MediaGrid } from "@/components/media/MediaCard";
import { toMediaItem } from "@/lib/media";
import { getAllPosts } from "@/lib/posts";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Rust Engineering Article Archive | Indie Machine",
  description: "Browse every Indie Machine article on Rust, wgpu, native UI, audio, machine learning, and developer tools, newest first.",
  alternates: { canonical: "/archive" },
  openGraph: {
    title: "Rust Engineering Article Archive",
    description: "Browse Indie Machine's Rust and native software build notes, newest first.",
    url: "/archive",
    siteName: SITE_NAME,
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rust Engineering Article Archive",
    description: "Browse Indie Machine's Rust and native software build notes, newest first.",
    images: ["/opengraph-image"],
  },
};

export default function ArchivePage() {
  const posts = getAllPosts();

  return (
    <PageBody>
      <ChannelHeader
        kicker="// FULL RECORD /archive"
        title="Archive"
        blurb="Every post logged so far, newest first: reviews, dev posts and game announcements."
        stats={[`${posts.length} POSTS`]}
      />
      <MediaGrid items={posts.map(toMediaItem)} dense className="mt-8" />
    </PageBody>
  );
}
