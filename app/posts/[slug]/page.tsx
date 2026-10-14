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
import { ChevronLeft, ChevronRight, GithubIcon } from "@/components/icons";
import { mdxComponents } from "@/components/mdx-components";
import { ProductPanel } from "@/components/ProductPanel";
import { ProductCard } from "@/components/ProductCard";
import { PostRow } from "@/components/PostRow";
import { averageScore, getAllPosts, getPostBySlug, getSimilarPosts } from "@/lib/posts";
import { toListing } from "@/lib/listing";
import { rehypeFixImagePaths } from "@/lib/rehype-fix-image-paths";
import { resolveRepoLink } from "@/lib/repoLink";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

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
      tags: post.product ? [post.product.name, ...post.product.tags] : post.series ? [post.series] : undefined,
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

  // Prev/next stay within the same area (product reviews or dev posts).
  const sameKind = posts.filter((p) => p.kind === post.kind);
  const kindIndex = sameKind.indexOf(post);
  const prev = kindIndex > 0 ? sameKind[kindIndex - 1] : undefined;
  const next = kindIndex < sameKind.length - 1 ? sameKind[kindIndex + 1] : undefined;
  const similar = getSimilarPosts(post, 3);
  const isProduct = post.kind === "product";
  const repo = resolveRepoLink(post.repo_link);

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
    "@id": `${absoluteUrl(`/posts/${post.slug}`)}#article`,
    headline: post.title,
    datePublished: new Date(post.date).toISOString(),
    description: post.excerpt,
    url: absoluteUrl(`/posts/${post.slug}`),
    mainEntityOfPage: absoluteUrl(`/posts/${post.slug}`),
    image: absoluteUrl(`/posts/${post.slug}/opengraph-image`),
    author: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/about") },
    publisher: { "@id": absoluteUrl("/#organization") },
    ...(post.series ? { about: post.series } : {}),
  };

  return (
    <div className="relative z-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <SiteHeader />

      <div className="px-6 pt-10 pb-8 md:px-24 md:pt-14">
        <Link
          href={isProduct ? "/products" : "/dev"}
          className="inline-flex items-center gap-2 text-xs tracking-[0.1em] text-ink-500 hover:text-accent"
        >
          <ChevronLeft /> {isProduct ? "BACK TO PRODUCTS" : "BACK TO DEV POSTS"}
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
          <time dateTime={post.date} className="text-xs text-ink-500">{post.date}</time>
        </div>

        <h1 className="mt-5 max-w-3xl font-display text-3xl font-bold text-ink-100 md:text-5xl">
          {post.title}
        </h1>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <TitleBlock
            cells={[
              { label: "DATE", value: post.date },
              { label: "SERIES", value: post.series ?? "—" },
              // ...(post.repo_link ? [{ label: "REPO", value: post.repo_link }] : []),
            ]}
          />
          {repo && (
            <a
              href={repo.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 self-stretch border border-line/28 px-4 py-3 text-[11px] tracking-[0.08em] text-ink-300 hover:border-accent/60 hover:text-accent"
            >
              <GithubIcon /> <span>View on GitHub <br />{repo.label}</span>
            </a>
          )}
        </div>

        {post.sponsored && (
          <div className="mt-6 max-w-4xl border border-accent/60 bg-accent/5 px-4 py-3 text-[13px] leading-relaxed text-ink-300">
            <span className="mr-2 text-[11px] tracking-[0.12em] text-accent">SPONSORED REVIEW</span>
            The maker requested and paid for this review through{" "}
            <Link href="/promote">Indie Machine promotions</Link>. They had no control over the
            findings, scores or verdict.
          </div>
        )}

        {post.product && (
          <div className="mt-6">
            <ProductPanel product={post.product} scores={post.scores} score={averageScore(post)} />
          </div>
        )}

        {post.crate_versions && (
          <div className="mt-6 max-w-2xl">
            <SpecSheet data={post.crate_versions} />
          </div>
        )}
      </div>

      <article className="mx-auto max-w-4xl px-6 pb-16 md:px-24">{content}</article>

      {similar.length > 0 && (
        <section className="border-t border-dashed border-line/25 px-6 py-10 md:px-24" aria-labelledby="similar-heading">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="similar-heading" className="text-xs tracking-[0.14em] text-accent">
              {isProduct ? "SIMILAR PRODUCTS" : `MORE FROM ${(post.series ?? "THE WORKSHOP").toUpperCase()}`}
            </h2>
            <Link href={isProduct ? "/products" : "/dev"} className="text-[11px] tracking-[0.1em] text-ink-500 hover:text-accent">
              {isProduct ? "ALL PRODUCTS →" : "ALL DEV POSTS →"}
            </Link>
          </div>
          {isProduct ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {similar.map((p) => (
                <ProductCard key={p.slug} item={toListing(p)} />
              ))}
            </div>
          ) : (
            <div className="mt-2">
              {similar.map((p, i) => (
                <PostRow key={p.slug} post={p} figNumber={i + 1} border={i === similar.length - 1 ? "both" : "top"} />
              ))}
            </div>
          )}
        </section>
      )}

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
