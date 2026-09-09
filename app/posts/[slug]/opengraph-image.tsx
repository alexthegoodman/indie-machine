import { ImageResponse } from "next/og";
import { OgCard, OG_SIZE, OG_CONTENT_TYPE, truncateForOg } from "@/lib/og-card";
import { loadOgFonts } from "@/lib/og-fonts";
import { getAllPosts, getPostBySlug } from "@/lib/posts";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  const fonts = await loadOgFonts();

  if (!post) {
    return new ImageResponse(
      (
        <OgCard
          kicker="Not Found"
          title="Post not found"
          footerLeft="Indie Machine"
          footerRight="indiemachine"
        />
      ),
      { ...OG_SIZE, fonts },
    );
  }

  const index = getAllPosts().findIndex((p) => p.slug === post.slug);

  return new ImageResponse(
    (
      <OgCard
        kicker={post.series ? `${post.series} Series` : "Standalone"}
        title={post.title}
        dek={truncateForOg(post.excerpt)}
        footerLeft={`Fig. ${String(index + 1).padStart(2, "0")} — ${post.date}`}
        footerRight="Indie Machine"
      />
    ),
    { ...OG_SIZE, fonts },
  );
}
