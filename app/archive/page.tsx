import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionDivider } from "@/components/SectionDivider";
import { PostRow } from "@/components/PostRow";
import { getAllPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Archive — Indie Machine",
  description: "Every post published on Indie Machine, in build order.",
};

export default function ArchivePage() {
  const posts = getAllPosts();

  return (
    <div className="relative z-10">
      <SiteHeader active="archive" />

      <div className="px-6 pt-16 pb-8 md:px-24 md:pt-20">
        <div className="text-[13px] tracking-[0.14em] text-accent">// FULL RECORD</div>
        <h1 className="mt-3 font-display text-5xl font-bold text-ink-100 md:text-6xl">Archive</h1>
        <p className="mt-4 max-w-xl font-display text-base text-ink-300">
          Every sheet logged so far, oldest to newest.
        </p>
      </div>

      <SectionDivider label={`${posts.length} POSTS`} />

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
