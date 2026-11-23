import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "@/components/mdx-components";
import { PageBody } from "@/components/media/ChannelHeader";
import { LinkRow, TopicChip } from "@/components/links/LinkList";
import { ExternalIcon } from "@/components/shell/icons";
import { AdSlot } from "@/components/AdSlot";
import { getAllLinks, getLink, outboundRel, relatedLinks } from "@/lib/links";
import { shortDate } from "@/lib/media";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllLinks().map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const link = getLink((await params).slug);
  if (!link) return {};
  const url = `/links/${link.slug}`;
  return {
    title: `${link.title} | Indie Machine`,
    description: link.excerpt,
    alternates: { canonical: url },
    openGraph: {
      title: link.title,
      description: link.excerpt,
      url,
      siteName: SITE_NAME,
      type: "article",
      publishedTime: new Date(link.date).toISOString(),
      images: ["/opengraph-image"],
    },
    twitter: { card: "summary_large_image", title: link.title, description: link.excerpt, images: ["/opengraph-image"] },
  };
}

export default async function TrendingLinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const link = getLink((await params).slug);
  if (!link) notFound();
  const related = relatedLinks(link);
  const rel = outboundRel(link);

  const { content } = await compileMDX({
    source: link.content,
    components: mdxComponents,
    options: { mdxOptions: { remarkPlugins: [remarkGfm] } },
  });

  const pageUrl = absoluteUrl(`/links/${link.slug}`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${pageUrl}#article`,
    headline: link.title,
    description: link.excerpt,
    datePublished: new Date(link.date).toISOString(),
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    author: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/about") },
    publisher: { "@id": absoluteUrl("/#organization") },
    articleSection: "Trending Links",
    keywords: link.tags.join(", "),
    isBasedOn: {
      "@type": "CreativeWork",
      url: link.url,
      publisher: { "@type": "Organization", name: link.source },
      ...(link.author ? { author: { "@type": "Person", name: link.author } } : {}),
      ...(link.published ? { datePublished: link.published } : {}),
    },
    citation: link.also.map((a) => a.url),
  };

  return (
    <PageBody>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="mx-auto max-w-[780px] pb-16">
        <nav aria-label="Breadcrumb" className="text-[11px] tracking-[0.14em] text-ink-500">
          <Link href="/links">TRENDING LINKS</Link> <span aria-hidden>/</span>{" "}
          <Link href={`/links/topic/${link.topic}`}>{link.topic.toUpperCase()}</Link>
        </nav>

        <header className="mt-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] tracking-[0.06em] text-ink-500">
            <TopicChip topic={link.topic} />
            <span>
              Posted <time dateTime={link.date}>{shortDate(link.date)}</time>
            </span>
          </div>
          <h1 className="mt-4 font-display text-3xl leading-[1.1] font-bold text-ink-100 md:text-4xl">{link.title}</h1>
          <p className="mt-3 text-[13px] text-ink-400">
            Source: <span className="text-ink-100">{link.source}</span>
            {link.author && <> · {link.author}</>}
            {link.published && <> · {shortDate(link.published)}</>}
          </p>
        </header>

        <article className="mt-8 min-w-0 break-words" data-track-area="Link take">
          {content}
        </article>

        <section aria-label="Source" className="mt-8 border border-line/28 bg-panel/25 p-5">
          <a
            href={link.url}
            target="_blank"
            rel={rel}
            className="inline-flex h-11 items-center gap-2 bg-accent px-5 font-display text-[13px] font-semibold tracking-[0.08em] text-ink! hover:bg-ink-100"
          >
            READ THE FULL STORY AT {link.source.toUpperCase()} <ExternalIcon size={16} />
          </a>
          <div className="mt-3 text-xs text-ink-500">{link.host}</div>
          {link.also.length > 0 && (
            <div className="mt-5">
              <div className="text-[10px] tracking-[0.16em] text-ink-500">ALSO SEE</div>
              <ul className="mt-2 flex flex-col gap-1.5 text-[13px]">
                {link.also.map((a) => (
                  <li key={a.url}>
                    <a href={a.url} target="_blank" rel={rel}>
                      {a.title}
                    </a>{" "}
                    <span className="text-ink-500">({new URL(a.url).hostname.replace(/^www\./, "")})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="mt-10">
          <AdSlot placement="sidebar" seed={link.slug} />
        </div>

        {related.length > 0 && (
          <section aria-label="More trending links" className="mt-10">
            <h2 className="border-b border-dashed border-line/22 pb-2 text-[11px] tracking-[0.14em] text-accent">MORE TRENDING</h2>
            <ul>
              {related.map((l) => (
                <LinkRow key={l.slug} link={l} />
              ))}
            </ul>
          </section>
        )}

        <div className="mt-8 text-[11px] tracking-[0.14em]">
          <Link href="/links">ALL TRENDING LINKS -&gt;</Link>
        </div>
      </div>
    </PageBody>
  );
}
