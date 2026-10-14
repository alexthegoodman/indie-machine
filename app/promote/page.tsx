import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionDivider } from "@/components/SectionDivider";
import { TitleBlock } from "@/components/TitleBlock";
import { ProductCard } from "@/components/ProductCard";
import { ChevronRight } from "@/components/icons";
import { getProductPosts } from "@/lib/posts";
import { toListing } from "@/lib/listing";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

const DESCRIPTION =
  "Submit your developer tool or AI agent for an independent Indie Machine review: source audit, reproducible test harness, and a published scorecard.";

export const metadata: Metadata = {
  title: "Get Your Product Reviewed | Indie Machine",
  description: DESCRIPTION,
  alternates: { canonical: "/promote" },
  openGraph: {
    title: "Get Your Product Reviewed",
    description: DESCRIPTION,
    url: "/promote",
    siteName: SITE_NAME,
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image", title: "Get Your Product Reviewed", description: DESCRIPTION, images: ["/opengraph-image"] },
};

const INCLUDED = [
  {
    title: "Source-level audit",
    body: "I clone the repository at a pinned commit, build it, and read the code paths behind the product's main claims.",
  },
  {
    title: "Reproducible test harness",
    body: "A BDD scenario suite that exercises those claims directly, with commands a reader can rerun.",
  },
  {
    title: "Standard scorecard",
    body: "Usability, accessibility, security, performance and setup time, each scored 1-10 with a written rationale.",
  },
  {
    title: "A place in the index",
    body: "The review is tagged and listed in the product index, and appears under similar products on related reviews.",
  },
];

const STEPS = [
  { label: "01", title: "Email the details", body: "Use the button below. The template lists what to include." },
  { label: "02", title: "Fit check", body: "I reply to confirm scope and timing, or to say it isn't a fit." },
  { label: "03", title: "Testing", body: "The product is built and tested from source. I may send questions." },
  { label: "04", title: "Publication", body: "The review goes live with its findings, scorecard and test harness." },
];

const TERMS = [
  "The verdict is independent. Makers don't see or approve the review before it's published, and findings aren't removed on request.",
  "Factual corrections are welcome after publication and are noted in the post.",
  "Paid or requested reviews carry a visible sponsored disclosure.",
  "Open-source or source-available products are strongly preferred, since the review is built on the code.",
  "I may decline a submission, or stop a review if the product can't be built or run.",
];

const EMAIL_BODY = `Product name:
Website:
Repository (and commit or tag to review):
Product Hunt or launch link (if any):
One-line description:
Platforms it runs on:
License and pricing:
What you'd most like tested:
Anything a reviewer needs to get it running (test accounts, API keys, hardware):
Timing constraints (e.g. launch date):
`;

function mailtoHref() {
  const params = new URLSearchParams({ subject: "Product review request", body: EMAIL_BODY });
  // URLSearchParams encodes spaces as "+", which mail clients show literally.
  return `mailto:${CONTACT_EMAIL}?${params.toString().replace(/\+/g, "%20")}`;
}

export default function PromotePage() {
  const examples = getProductPosts()
    .map(toListing)
    .filter((p) => p.score !== undefined)
    .slice(0, 3);

  return (
    <div className="relative z-10">
      <SiteHeader active="promote" />

      <div className="px-6 pt-16 pb-10 md:px-24 md:pt-20">
        <div className="text-[13px] tracking-[0.14em] text-accent">// FOR MAKERS</div>
        <h1 className="mt-3 max-w-4xl font-display text-5xl font-bold text-ink-100 md:text-6xl">
          Get your product reviewed
        </h1>
        <p className="mt-6 max-w-2xl font-display text-base leading-relaxed text-ink-300 md:text-lg">
          Indie Machine reviews developer tools and AI agents by building and testing them, not by
          rewriting the launch post. If you&apos;ve built something developers should know about,
          send it over. You get a careful, public review that readers trust because it isn&apos;t
          for sale.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href={mailtoHref()}
            className="inline-flex items-center gap-2 border border-accent px-5 py-3 text-sm tracking-[0.1em] text-accent hover:bg-accent/10 hover:text-ink-100"
          >
            SUBMIT BY EMAIL <ChevronRight />
          </a>
          <span className="text-xs text-ink-500">
            or write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </span>
        </div>
        <div className="mt-10">
          <TitleBlock
            cells={[
              { label: "INTAKE", value: "EMAIL" },
              { label: "FORMAT", value: "SOURCE + TESTS" },
              { label: "VERDICT", value: "INDEPENDENT", accent: true },
            ]}
          />
        </div>
      </div>

      <SectionDivider label="WHAT A REVIEW INCLUDES" />

      <div className="px-6 md:px-24">
        <div className="grid gap-px border border-line/28 bg-line/28 sm:grid-cols-2">
          {INCLUDED.map((item, i) => (
            <div key={item.title} className="bg-ink p-6">
              <div className="text-[11px] text-accent">SPEC {String(i + 1).padStart(2, "0")}</div>
              <div className="mt-1.5 font-display text-lg font-semibold text-ink-100">{item.title}</div>
              <p className="mt-2 font-display text-[15px] leading-relaxed text-ink-300">{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      <SectionDivider label="PROCESS" />

      <div className="px-6 md:px-24">
        <ol className="grid gap-4 md:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.label} className="border-t border-accent/60 pt-4">
              <div className="font-display text-[28px] font-semibold text-accent">{step.label}</div>
              <div className="mt-1 font-display text-[17px] font-semibold text-ink-100">{step.title}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>

      <SectionDivider label="GROUND RULES" />

      <div className="px-6 md:px-24">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <ul className="space-y-3">
            {TERMS.map((term) => (
              <li key={term} className="flex gap-3 font-display text-[15px] leading-relaxed text-ink-300">
                <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 bg-accent" />
                {term}
              </li>
            ))}
          </ul>
          <div className="border border-dashed border-line/32 p-5">
            <div className="text-[10px] tracking-[0.12em] text-ink-500">EMAIL TEMPLATE</div>
            <pre className="mt-3 overflow-x-auto bg-transparent! font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink-300">
              {EMAIL_BODY}
            </pre>
          </div>
        </div>
      </div>

      {examples.length > 0 && (
        <>
          <SectionDivider label="RECENT REVIEWS" />
          <div className="px-6 md:px-24">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {examples.map((item) => (
                <ProductCard key={item.slug} item={item} />
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <Link href="/products" className="flex items-center gap-2 text-sm tracking-wide text-accent">
                BROWSE ALL PRODUCTS <ChevronRight />
              </Link>
            </div>
          </div>
        </>
      )}

      <div className="px-6 py-16 md:px-24">
        <a
          href={mailtoHref()}
          className="group flex flex-col gap-4 border border-accent/50 p-6 md:flex-row md:items-center md:justify-between md:p-10"
        >
          <div className="font-display text-2xl font-bold text-ink-100 md:text-3xl">Ready to send it over?</div>
          <span className="flex items-center gap-2 text-sm tracking-wide text-accent group-hover:text-ink-100">
            SUBMIT BY EMAIL <ChevronRight />
          </span>
        </a>
      </div>

      <SiteFooter />
    </div>
  );
}
