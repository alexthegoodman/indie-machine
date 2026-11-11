import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionDivider } from "@/components/SectionDivider";
import { TitleBlock } from "@/components/TitleBlock";
import { ProductCard } from "@/components/ProductCard";
import { ChevronRight } from "@/components/icons";
import { getAllPosts, getProductPosts } from "@/lib/posts";
import { toListing } from "@/lib/listing";
import { AD_PLACEMENTS, AD_PRICES } from "@/lib/ads";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

const DESCRIPTION =
  "Advertise your developer tool or AI product on Indie Machine: monthly ad slots on the home page and beside every article, or a paid review tested from source and published within 48 hours.";

export const metadata: Metadata = {
  title: "Advertise | Indie Machine",
  description: DESCRIPTION,
  alternates: { canonical: "/promote" },
  openGraph: {
    title: "Advertise on Indie Machine",
    description: DESCRIPTION,
    url: "/promote",
    siteName: SITE_NAME,
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: { card: "summary_large_image", title: "Advertise on Indie Machine", description: DESCRIPTION, images: ["/opengraph-image"] },
};

// Filled in by hand from the site's analytics. Shown as-is.
const AUDIENCE = {
  yearlyVisitors: 10_000,
  monthlyGrowth: 200,
  monthlyVisitors: 0,
  monthlyPageViews: 0,
  period: "last 30 days",
};

const READERS = [
  { title: "Founders", body: "People building and launching their own products, watching what else is shipping." },
  {
    title: "Technical developers",
    body: "Rust, TypeScript and systems engineers who read the code paths and test results, not just the summary.",
  },
  { title: "Designers", body: "Product and interface designers following new tools, editors and creative software." },
  { title: "And more", body: "Indie makers, tool builders and early adopters deciding what to try next." },
];

const REVIEW_TURNAROUND = "48 hours";

const OPTIONS = [
  {
    key: "ads",
    name: "Monthly ad slot",
    price: `from ${AD_PRICES.sidebar}`,
    unit: "per month / front-and-center",
    points: [
      `${AD_PLACEMENTS.home.name}, ${AD_PRICES.home} / month: ${AD_PLACEMENTS.home.where}`,
      `${AD_PLACEMENTS.sidebar.name}, ${AD_PRICES.sidebar} / month: ${AD_PLACEMENTS.sidebar.where}`,
      "Your product name, a one-line pitch and a link, in the site's own style",
      "Image or visual is optional, can be custom-fit",
      "One advertiser per slot per month, labelled sponsor",
    ],
    cta: "BOOK AN AD SLOT",
  },
  {
    key: "review",
    name: "Paid review",
    price: AD_PRICES.review,
    unit: "one time / everlasting",
    points: [
      `Tested and published within ${REVIEW_TURNAROUND}, once I have what's needed to run it`,
      "Comes with a genuine backlink everytime",
      "Source audit at a pinned commit, a reproducible test harness and the standard scorecard",
      "Listed in the product index and shown under similar products on related reviews",
      "Labelled sponsored, but serves as a long-term lead generator for your business",
    ],
    cta: "REQUEST A REVIEW",
  },
] as const;

const AD_EMAIL = `Product name:
Website (where the ad should link):
Slot (home page or article sidebar):
Month(s) you'd like:
Ad text (product name and a one-line pitch):
Anything else I should know:
`;

const REVIEW_EMAIL = `Product name:
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

const SELECTION = [
  "Unsponsored reviews are picked by me, mostly from the day's Product Hunt leaderboard, with open-source products first because the review is built on the code.",
  "There is no free submission queue. A good fit may be picked anyway, but the only way to be sure of a review is to pay for one.",
];

const TERMS = [
  "Ads and reviews are kept apart. Buying an ad slot doesn't get a product reviewed, and doesn't change the score of one that already has been.",
  "Review verdicts are independent. Makers don't see or approve the review before it's published, and findings aren't removed on request.",
  "Factual corrections are welcome after publication and are noted in the post.",
  "I may decline an ad or a review, or stop a review if the product can't be built or run. You don't pay for work I can't do.",
];

function mailtoHref(subject: string, body: string) {
  const params = new URLSearchParams({ subject, body });
  // URLSearchParams encodes spaces as "+", which mail clients show literally.
  return `mailto:${CONTACT_EMAIL}?${params.toString().replace(/\+/g, "%20")}`;
}

const AD_HREF = mailtoHref("Ad slot booking", AD_EMAIL);
const REVIEW_HREF = mailtoHref("Paid review request", REVIEW_EMAIL);

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

export default function PromotePage() {
  const products = getProductPosts().map(toListing);
  const examples = products.filter((p) => p.score !== undefined).slice(0, 3);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const reviewsLastMonth = products.filter((p) => p.date >= monthAgo).length;
  const articles = getAllPosts().length;

  return (
    <div className="relative z-10">
      <SiteHeader active="promote" />

      <div className="px-6 pt-16 pb-10 md:px-24 md:pt-20">
        <div className="text-[13px] tracking-[0.14em] text-accent">// FOR MAKERS</div>
        <h1 className="mt-3 max-w-4xl font-display text-5xl font-bold text-ink-100 md:text-6xl">
          Advertise on Indie Machine
        </h1>
        <p className="mt-6 max-w-2xl font-display text-base leading-relaxed text-ink-300 md:text-lg">
          Indie Machine reviews developer tools and AI products by building and testing them. The
          people who read it are deciding what to build with. Put your product in front of them with
          a monthly ad slot, or have it reviewed from source within {REVIEW_TURNAROUND}.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href={AD_HREF}
            className="inline-flex items-center gap-2 border border-accent px-5 py-3 text-sm tracking-[0.1em] text-accent hover:bg-accent/10 hover:text-ink-100"
          >
            BOOK AN AD SLOT <ChevronRight />
          </a>
          <a
            href={REVIEW_HREF}
            className="inline-flex items-center gap-2 border border-line/28 px-5 py-3 text-sm tracking-[0.1em] text-ink-300 hover:border-accent/60 hover:text-accent"
          >
            PAID REVIEW · {AD_PRICES.review}
          </a>
          <span className="text-xs text-ink-500">
            or write to <a href={`mailto:${CONTACT_EMAIL}`} className="text-yellow-400!">{CONTACT_EMAIL}</a>
          </span>
        </div>
        <div className="mt-10">
          <TitleBlock
            cells={[
              { label: "AD SLOTS", value: `FROM ${AD_PRICES.sidebar} / MO` },
              { label: "PAID REVIEW", value: `${AD_PRICES.review} / 48H` },
              { label: "BOOKING", value: "BY EMAIL" },
              { label: "VERDICTS", value: "INDEPENDENT", accent: true },
            ]}
          />
        </div>
      </div>

      <SectionDivider label="AUDIENCE" />

      <div className="px-6 md:px-24">
        <TitleBlock
          cells={[
            { label: `ANNUAL VISITORS`, value: fmt(AUDIENCE.yearlyVisitors) + "+" },
            { label: `MONTHLY GROWTH RATE`, value: fmt(AUDIENCE.monthlyGrowth) + "%+" },
            { label: "REVIEWS PUBLISHED", value: fmt(products.length) },
            { label: "REVIEWS, LAST 30 DAYS", value: fmt(reviewsLastMonth) },
            { label: "ARTICLES", value: fmt(articles), accent: true },
          ]}
        />
        <p className="mt-6 max-w-3xl font-display text-[15px] leading-relaxed text-ink-300">
          Readers come for long, technical reviews and stay to read them. It&apos;s a high-quality
          audience: people who build software and choose the tools it&apos;s built with.
        </p>
        <div className="mt-6 grid gap-px border border-purple-400 border-line/28 bg-line/28 sm:grid-cols-2 lg:grid-cols-4">
          {READERS.map((reader) => (
            <div key={reader.title} className="bg-ink p-6">
              <div className="font-display text-lg font-semibold text-ink-100">{reader.title}</div>
              <p className="mt-2 font-display text-[15px] leading-relaxed text-ink-300">{reader.body}</p>
            </div>
          ))}
        </div>
      </div>

      <SectionDivider label="OPTIONS" />

      <div id="advertise" className="scroll-mt-8 px-6 md:px-24">
        <div className="grid gap-4 lg:grid-cols-2">
          {OPTIONS.map((option) => {
            const ads = option.key === "ads";
            return (
              <div
                key={option.key}
                className={`relative flex flex-col border p-6 md:p-8 ${ads ? "border-accent/70 bg-accent/[0.04]" : "border-line/28"}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="font-display text-2xl font-bold text-ink-100">{option.name}</div>
                  <div className={`font-display text-3xl font-bold ${ads ? "text-accent" : "text-ink-300"}`}>
                    {option.price}
                  </div>
                </div>
                <div className="mt-1 text-[11px] tracking-[0.12em] text-ink-500">{option.unit.toUpperCase()}</div>
                <ul className="mt-5 space-y-2.5">
                  {option.points.map((point) => (
                    <li key={point} className="flex gap-3 font-display text-[15px] leading-relaxed text-ink-300">
                      <span className={`mt-[0.55em] h-1.5 w-1.5 shrink-0 ${ads ? "bg-accent" : "bg-ink-500"}`} />
                      {point}
                    </li>
                  ))}
                </ul>
                <div className="min-h-6 flex-1" />
                <a
                  href={ads ? AD_HREF : REVIEW_HREF}
                  className={`inline-flex items-center gap-2 self-start border px-5 py-3 text-sm tracking-[0.1em] ${
                    ads
                      ? "border-accent text-accent hover:bg-accent/10 hover:text-ink-100"
                      : "border-line/28 text-ink-300 hover:border-accent/60 hover:text-accent"
                  }`}
                >
                  {option.cta} <ChevronRight />
                </a>
              </div>
            );
          })}
        </div>
      </div>

      <SectionDivider label="WHY EMAIL" />

      <div className="px-6 md:px-24">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-12">
          <p className="font-display text-[15px] leading-relaxed text-ink-300">
            There&apos;s no checkout here on purpose. Every ad and review is arranged by email, so I can
            work one on one with each advertiser: confirm the product is a fit, agree on dates and
            wording, and answer questions before anything is paid. Payment is arranged in the same
            thread once we&apos;ve agreed.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "AD SLOT EMAIL", body: AD_EMAIL },
              { label: "REVIEW EMAIL", body: REVIEW_EMAIL },
            ].map((t) => (
              <div key={t.label} className="border border-dashed border-line/32 p-5">
                <div className="text-[10px] tracking-[0.12em] text-ink-500">{t.label}</div>
                <pre className="mt-3 overflow-x-auto bg-transparent! font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink-300">
                  {t.body}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>

      <SectionDivider label="GROUND RULES" />

      <div className="px-6 md:px-24">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <div className="text-[11px] tracking-[0.14em] text-accent">HOW UNSPONSORED REVIEWS ARE PICKED</div>
            <ul className="mt-4 space-y-3">
              {SELECTION.map((item) => (
                <li key={item} className="flex gap-3 font-display text-[15px] leading-relaxed text-ink-300">
                  <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 bg-ink-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[11px] tracking-[0.14em] text-accent">TERMS</div>
            <ul className="mt-4 space-y-3">
              {TERMS.map((term) => (
                <li key={term} className="flex gap-3 font-display text-[15px] leading-relaxed text-ink-300">
                  <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 bg-accent" />
                  {term}
                </li>
              ))}
            </ul>
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
          href={AD_HREF}
          className="group flex flex-col gap-4 border border-accent/50 p-6 md:flex-row md:items-center md:justify-between md:p-10"
        >
          <div>
            <div className="font-display text-2xl font-bold text-ink-100 md:text-3xl">Ready to book a month?</div>
            <p className="mt-2 font-display text-[15px] text-ink-300">
              Home page {AD_PRICES.home} / month, article sidebar {AD_PRICES.sidebar} / month. Or ask for a
              paid review: {AD_PRICES.review}, published within {REVIEW_TURNAROUND}.
            </p>
          </div>
          <span className="flex items-center gap-2 text-sm tracking-wide text-accent group-hover:text-ink-100">
            EMAIL ME <ChevronRight />
          </span>
        </a>
      </div>

      <SiteFooter />
    </div>
  );
}
