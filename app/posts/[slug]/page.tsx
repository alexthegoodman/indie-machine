import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypePrettyCode from "rehype-pretty-code";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TitleBlock } from "@/components/TitleBlock";
import { SpecSheet } from "@/components/SpecSheet";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { mdxComponents } from "@/components/mdx-components";
import { getAllPosts, getPostBySlug } from "@/lib/posts";
import { rehypeFixImagePaths } from "@/lib/rehype-fix-image-paths";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  const url = `/posts/${post.slug}`;
  const title = `${post.title} — Indie Machine`;
  return {
    title,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url,
      siteName: SITE_NAME,
      type: "article",
      publishedTime: new Date(post.date).toISOString(),
      tags: post.series ? [post.series] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const posts = getAllPosts();
  const index = posts.findIndex((p) => p.slug === slug);
  const post = posts[index];

  if (!post) notFound();

  const prev = index > 0 ? posts[index - 1] : undefined;
  const next = index < posts.length - 1 ? posts[index + 1] : undefined;

  const { content } = await compileMDX({
    source: post.content,
    components: mdxComponents,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, rehypeFixImagePaths, [rehypePrettyCode, { theme: "poimandres" }]],
      },
    },
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: new Date(post.date).toISOString(),
    description: post.excerpt,
    url: `${SITE_URL}/posts/${post.slug}`,
    publisher: { "@type": "Organization", name: SITE_NAME },
    ...(post.series ? { about: post.series } : {}),
  };

  return (
    <div className="relative z-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />

      <div className="px-6 pt-10 pb-8 md:px-24 md:pt-14">
        <Link href="/archive" className="inline-flex items-center gap-2 text-xs tracking-[0.1em] text-ink-500 hover:text-accent">
          <ChevronLeft /> BACK TO ARCHIVE
        </Link>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="border border-accent px-2 py-1 text-[11px] tracking-[0.1em] text-accent">
            FIG. {String(index + 1).padStart(2, "0")}
          </span>
          {post.series && (
            <Link
              href={`/series/${encodeURIComponent(post.series)}`}
              className="border border-line/28 px-2 py-1 text-[11px] tracking-[0.1em] text-ink-300 hover:border-accent/60"
            >
              {post.series.toUpperCase()} SERIES
            </Link>
          )}
          <span className="text-xs text-ink-500">{post.date}</span>
        </div>

        <h1 className="mt-5 max-w-3xl font-display text-3xl font-bold text-ink-100 md:text-5xl">
          {post.title}
        </h1>

        <div className="mt-8">
          <TitleBlock
            cells={[
              { label: "DATE", value: post.date },
              { label: "SERIES", value: post.series ?? "—" },
              ...(post.repo_link ? [{ label: "REPO", value: post.repo_link }] : []),
            ]}
          />
        </div>

        {post.crate_versions && (
          <div className="mt-6 max-w-2xl">
            <SpecSheet data={post.crate_versions} />
          </div>
        )}
      </div>

      <article className="mx-auto max-w-4xl px-6 pb-16 md:px-24">{content}</article>

      <div className="flex flex-col gap-4 border-t border-dashed border-line/25 px-6 py-10 sm:flex-row sm:justify-between md:px-24">
        {prev ? (
          <Link href={`/posts/${prev.slug}`} className="group flex max-w-xs items-center gap-3 text-left">
            <ChevronLeft className="shrink-0 text-accent" />
            <div>
              <div className="text-[10px] tracking-[0.1em] text-ink-500">PREV</div>
              <div className="text-sm text-ink-300 group-hover:text-accent">{prev.title}</div>
            </div>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link
            href={`/posts/${next.slug}`}
            className="group flex max-w-xs items-center gap-3 text-right sm:flex-row-reverse"
          >
            <ChevronRight className="shrink-0 text-accent" />
            <div>
              <div className="text-[10px] tracking-[0.1em] text-ink-500">NEXT</div>
              <div className="text-sm text-ink-300 group-hover:text-accent">{next.title}</div>
            </div>
          </Link>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
