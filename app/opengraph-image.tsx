import { ImageResponse } from "next/og";
import { OgCard, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og-card";
import { loadOgFonts } from "@/lib/og-fonts";
import { getAllPosts } from "@/lib/posts";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  const fonts = await loadOgFonts();
  const posts = getAllPosts();

  return new ImageResponse(
    (
      <OgCard
        kicker="Engineering Journal"
        title="Indie Machine"
        dek="A build log for Entropy — a native engine written from scratch in Rust. GPU compute pipelines, an in-house GUI kit, everything measured against a real commit."
        footerLeft={`${posts.length} posts logged`}
        footerRight="Rust — Native — Complex Applications"
      />
    ),
    { ...OG_SIZE, fonts },
  );
}
