import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypePrettyCode from "rehype-pretty-code";
import { SpecSheet } from "@/components/SpecSheet";
import { mdxComponents } from "@/components/mdx-components";
import { ProductPanel } from "@/components/ProductPanel";
import { BadgeList } from "@/components/GameBadge";
import { AdSlot } from "@/components/AdSlot";
import { Thumb } from "@/components/media/Thumb";
import { CodeIcon, ExternalIcon } from "@/components/shell/icons";
import { ARTICLE_ID, ReaderTracker } from "@/components/reader/ReaderTracker";
import { Chapters } from "@/components/reader/Chapters";
import { ReaderActions } from "@/components/reader/ReaderActions";
import { EndCard, UpNextList } from "@/components/reader/UpNext";
import { YumonChat } from "@/components/reader/YumonChat";
import { averageScore, getAllPosts, getSimilarPosts, type Post } from "@/lib/posts";
import { channelOf, shortDate, toMediaItem } from "@/lib/media";
import { rehypeFixImagePaths } from "@/lib/rehype-fix-image-paths";
import { rehypeDropCover } from "@/lib/rehype-drop-cover";
import { resolveRepoLink } from "@/lib/repoLink";
import { SITE_NAME, absoluteUrl } from "@/lib/site";
import { SupportStrip } from "@/components/SiteFooter";

const QUEUE_LENGTH = 10;

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getAllPosts().find((p) => p.slug === slug);
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

// The "up next" queue: the next part of a dev series first (read in order),
// then similar posts, then the rest of the same kind, newest first.
function buildQueue(post: Post, posts: Post[]): Post[] {
  const queue: Post[] = [];
  if (post.kind === "dev" && post.series) {
    const inSeries = posts.filter((p) => p.series === post.series).reverse();
    const nextPart = inSeries[inSeries.indexOf(post) + 1];
    if (nextPart) queue.push(nextPart);
  }
  queue.push(...getSimilarPosts(post, 6));
  queue.push(...posts.filter((p) => p.kind === post.kind));
  const seen = new Set([post.slug]);
  return queue.filter((p) => !seen.has(p.slug) && seen.add(p.slug)).slice(0, QUEUE_LENGTH);
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const posts = getAllPosts();
  const post = posts.find((p) => p.slug === slug);

  if (!post) notFound();

  const item = toMediaItem(post);
  const channel = channelOf(post);
  const score = averageScore(post);
  const queue = buildQueue(post, posts).map(toMediaItem);
  const repo = resolveRepoLink(post.repo_link);
  const isGame = post.kind === "game";

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
          [rehypePrettyCode, { theme: "poimandres" }],
        ],
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
    <div className="px-4 ">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      
      <ReaderTracker slug={post.slug} />

      {/* chat with Yumon (40%), then the article (60%); the chat collapses above the article below xl */}
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:gap-6">
        <aside className="mt-5 w-full shrink-0 xl:sticky xl:top-[5.25rem] xl:h-[calc(100dvh-9.5rem)] xl:w-3/10">
          <YumonChat />
        </aside>

        <div className="min-w-0 flex-1 xl:w-7/10">
          <SupportStrip />
          
          {/* stage */}
          <div className="relative mx-auto max-w-[1100px] pt-5 sm:px-6 lg:px-8 lg:pt-6">
            
            <Thumb item={item} size="lg" className="max-h-[620px] border-line/28" />
            {score !== undefined && (
              <div className="absolute top-3.5 left-3.5 border border-accent/55 bg-ink px-3 py-2">
                <div className="text-[9px] tracking-[0.16em] text-ink-400">SCORE</div>
                <div className="font-display text-[26px] leading-none font-bold text-accent">{score.toFixed(1)}</div>
              </div>
            )}
          </div>

          <div className="mx-auto max-w-[1100px]">
            <h1 className="mt-5 font-display text-2xl leading-tight font-bold text-ink-100 md:text-[28px]">{post.title}</h1>

            {isGame && post.badges && post.badges.length > 0 && (
              <BadgeList badges={post.badges} size="lg" className="mt-4" />
            )}

            {/* channel + actions */}
            <div className="mt-4 flex flex-wrap items-center gap-3 border-b border-dashed border-line/22 pb-4">
              <div className="mr-auto flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center border font-display font-bold ${
                    isGame ? "border-badge/60 text-badge" : "border-accent/50 text-accent"
                  }`}
                  aria-hidden="true"
                >
                  {channel.label[0]}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <Link href={channel.href} className="truncate text-[13px] text-ink-100! hover:text-accent!">
                    {channel.label}
                  </Link>
                  <span className="text-[11px] text-ink-500">
                    <time dateTime={post.date}>{shortDate(post.date)}</time> · {item.minutes} min read
                  </span>
                </span>
              </div>
              <ReaderActions slug={post.slug} title={post.title} />
              {repo && (
                <a
                  href={repo.href}
                  target="_blank"
                  rel="noreferrer"
                  title={repo.label}
                  className="inline-flex h-11 items-center gap-2 border border-line/28 px-3.5 text-xs tracking-[0.08em] text-ink-100! hover:border-accent hover:bg-accent/10"
                >
                  <CodeIcon size={16} /> SOURCE
                </a>
              )}
              {post.product?.url && (
                <a
                  href={post.product.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center gap-2 bg-accent px-4 font-display text-xs font-semibold tracking-[0.08em] text-ink! hover:bg-ink-100"
                >
                  VISIT {post.product.name.toUpperCase()} <ExternalIcon size={14} />
                </a>
              )}
            </div>

            {/* description box */}
            {(post.product?.tagline || post.crate_versions || post.sponsored || post.series) && (
              <div className="mt-4 border border-line/16 bg-panel/45 px-4 py-3.5">
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-400">
                  {post.series && (
                    <Link href={`/series/${encodeURIComponent(post.series)}`} className="text-ink-300!">
                      {post.series} series
                    </Link>
                  )}
                  {post.product?.tags.slice(0, 6).map((tag) => (
                    <Link key={tag} href={`/products?tag=${encodeURIComponent(tag)}`} className="text-ink-400! hover:text-accent!">
                      #{tag}
                    </Link>
                  ))}
                </div>
                {post.product?.tagline && (
                  <p className="mt-2 font-display text-base leading-relaxed text-ink-100">{post.product.tagline}</p>
                )}
                {post.sponsored && (
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-300">
                    <span className="mr-2 text-[11px] tracking-[0.12em] text-accent">SPONSORED REVIEW</span>
                    The maker paid for a <Link href="/promote">review</Link>, which buys a guaranteed slot and a faster
                    turnaround, not a better verdict. They had no control over the findings, scores or conclusions.
                  </p>
                )}
                {post.crate_versions && (
                  <details className="mt-2">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center text-xs font-semibold tracking-[0.08em] text-ink-100 hover:text-accent">
                      ...MORE: VERSIONS &amp; ENVIRONMENT
                    </summary>
                    <div className="max-w-2xl pb-1">
                      <SpecSheet data={post.crate_versions} />
                    </div>
                  </details>
                )}
              </div>
            )}

            {post.product && (
              <div className="mt-5">
                <ProductPanel product={post.product} scores={post.scores} score={score} />
              </div>
            )}

            <div className="mt-5">
              <Chapters variant="collapsible" />
            </div>

            <article id={ARTICLE_ID} className="mt-8 max-w-[780px] min-w-0 break-words">
              {content}
            </article>

            {queue[0] && <EndCard next={queue[0]} />}

            <div className="mt-12 flex flex-col gap-6 pb-6">
              <UpNextList items={queue} columns={2} />
              <AdSlot placement="sidebar" seed={post.slug} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
