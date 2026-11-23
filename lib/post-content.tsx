// Compiles a post's MDX body for the post page: the whole body, or the intro and the rest
// separately while the reader survey is on (the rest is sent by app/posts/[slug]/actions.ts).
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypePrettyCode from "rehype-pretty-code";
import { mdxComponents } from "@/components/mdx-components";
import type { Post } from "@/lib/posts";
import { rehypeFixImagePaths } from "@/lib/rehype-fix-image-paths";
import { rehypeDropCover } from "@/lib/rehype-drop-cover";
import { rehypeExperience } from "@/lib/rehype-experience";
import { rehypeSplitIntro } from "@/lib/rehype-split-intro";

export async function compilePost(post: Post, part: "all" | "intro" | "rest") {
  const { content } = await compileMDX({
    source: post.content,
    components: mdxComponents,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [
          rehypeSlug,
          rehypeFixImagePaths,
          [rehypeDropCover, { src: post.image }],
          rehypeExperience,
          [rehypeSplitIntro, { part }],
          [rehypePrettyCode, { theme: "poimandres" }],
        ],
      },
    },
  });
  return content;
}
