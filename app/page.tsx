import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionDivider } from "@/components/SectionDivider";
import { TitleBlock } from "@/components/TitleBlock";
import { PostRow } from "@/components/PostRow";
import { ProductCard } from "@/components/ProductCard";
import { ScoreMeter } from "@/components/ScoreMeter";
import { ChevronRight } from "@/components/icons";
import { getDevPosts, getProductPosts } from "@/lib/posts";
import { toListing } from "@/lib/listing";
import { CATEGORIES, categoryLabel } from "@/lib/taxonomy";

const LATEST_COUNT = 6;

export default function Home() {
  const products = getProductPosts().map(toListing);
  const devPosts = getDevPosts();
  const topScored = products
    .filter((p) => p.score !== undefined)
    .sort((a, b) => b.score! - a.score!)
    .slice(0, 5);

  const categoryCounts = new Map<string, number>();
  for (const p of products) {
    const key = p.product?.category ?? "other";
    categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
  }
  const categories = Object.keys(CATEGORIES).filter((k) => categoryCounts.has(k));

  return (
    <div className="relative z-10">
      <SiteHeader active="home" />

      {/* masthead */}
      <div className="px-6 pt-16 pb-10 md:px-24 md:pt-24 md:pb-14">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-14">
          <div className="min-w-0">
            <div className="text-[13px] tracking-[0.14em] text-accent">// INDEPENDENT SOFTWARE REVIEWS</div>
            <h1 className="mt-3 font-display text-[15vw] leading-[0.96] font-bold tracking-tight text-ink-100 sm:text-7xl md:text-8xl lg:text-[clamp(3.5rem,5vw,6.25rem)]">
              Indie Machine
            </h1>
            <div className="mt-4 text-[13px] tracking-[0.2em] text-accent uppercase md:text-[15px]">
              Developer Tools - Tested From Source
            </div>
            <p className="mt-6 max-w-2xl font-display text-base leading-relaxed text-ink-300 md:text-lg">
              Hands-on reviews of new developer tools and AI agents. Each one is cloned, built and
              tested, and the review separates what was run from what the product claims. Alongside
              them is the build log for Entropy, a native engine written in Rust.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs">
              <span className="border border-accent/40 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold tracking-wider text-accent">
                NEW
              </span>
              <span className="text-ink-300">
                Yumon Pet v0.1.0: Free, private AI that runs on iGPU with an aquarium simulation.
              </span>
              <Link href="/free-ai" className="font-semibold text-accent hover:underline">
                Get Free AI -&gt;
              </Link>
            </div>

            <form action="/products" className="mt-8 flex max-w-xl border border-line/28 focus-within:border-accent/70">
              <label htmlFor="home-search" className="sr-only">
                Search products
              </label>
              <input
                id="home-search"
                type="search"
                name="q"
                placeholder="Search tools: mcp, worktrees, rust..."
                className="min-w-0 flex-1 bg-transparent px-4 py-3 font-display text-base text-ink-100 placeholder:text-ink-500 focus:outline-none"
              />
              <button
                type="submit"
                className="cursor-pointer border-l border-line/28 px-4 text-[11px] tracking-[0.14em] text-accent hover:bg-accent/10"
              >
                SEARCH
              </button>
            </form>
          </div>

          {topScored.length > 0 && (
            <div className="min-w-0 border border-line/32">
              <div className="flex items-center justify-between border-b border-line/28 px-5 py-3 text-[11px] tracking-[0.14em]">
                <span className="text-accent">TOP SCORED</span>
                <Link href="/products?sort=score" className="text-ink-500 hover:text-accent">
                  ALL -&gt;
                </Link>
              </div>
              <ol>
                {topScored.map((item, i) => (
                  <li key={item.slug} className={i ? "border-t border-dashed border-line/22" : ""}>
                    <Link href={`/posts/${item.slug}`} className="group flex items-center gap-4 px-5 py-4">
                      <span className="w-6 shrink-0 font-display text-lg font-semibold text-accent">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate font-display font-semibold text-ink-100 group-hover:text-accent">
                            {item.product?.name ?? item.title}
                          </span>
                          <span className="shrink-0 text-sm text-ink-100">{item.score!.toFixed(1)}</span>
                        </div>
                        <div className="mt-0.5 text-[10px] tracking-[0.1em] text-ink-500">
                          {item.product ? categoryLabel(item.product.category).toUpperCase() : ""}
                        </div>
                        <ScoreMeter value={item.score!} className="mt-2" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className="mt-10">
          <TitleBlock
            cells={[
              { label: "PRODUCTS", value: String(products.length).padStart(3, "0") },
              { label: "CATEGORIES", value: String(categories.length).padStart(2, "0") },
              { label: "DEV POSTS", value: String(devPosts.length).padStart(3, "0") },
              { label: "UPDATED", value: products[0]?.date ?? "" },
              { label: "METHOD", value: "BUILT + TESTED", accent: true },
            ]}
          />
        </div>
      </div>

      <SectionDivider label="BROWSE BY CATEGORY" />

      <div className="px-6 md:px-24">
        <div className="grid gap-px border border-line/28 bg-line/28 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((key) => (
            <Link
              key={key}
              href={`/products?category=${key}`}
              className="group flex flex-col bg-ink p-5 hover:bg-panel/40"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-display text-[17px] font-semibold text-ink-100 group-hover:text-accent">
                  {CATEGORIES[key].label}
                </span>
                <span className="text-xs text-accent">{String(categoryCounts.get(key)).padStart(2, "0")}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{CATEGORIES[key].blurb}</p>
            </Link>
          ))}
        </div>
      </div>

      <SectionDivider label="LATEST REVIEWS" />

      <div className="px-6 md:px-24">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.slice(0, LATEST_COUNT).map((item, i) => (
            <ProductCard key={item.slug} item={item} figNumber={i + 1} />
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <Link href="/products" className="flex items-center gap-2 text-sm tracking-wide text-accent">
            ALL {products.length} PRODUCTS <ChevronRight />
          </Link>
        </div>
      </div>

      <SectionDivider label="FREE AI COMPANION" />

      <div className="px-6 md:px-24">
        <div className="relative overflow-hidden border border-accent/40 bg-panel/20 p-6 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)] lg:items-center lg:gap-12">
            <div>
              <div className="flex items-center gap-2.5 text-[11px] tracking-[0.14em] text-accent">
                <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                // FREE PRODUCT RELEASE - V0.1.0
              </div>
              <h2 className="mt-3 font-display text-2xl font-bold text-ink-100 sm:text-3xl md:text-4xl">
                Free, near instant, private AI that runs on iGPU
              </h2>
              <p className="mt-4 font-display text-[15px] leading-relaxed text-ink-300 md:text-base">
                Designed to be an AI pet that keeps you company when you are at your desk. Powered by our
                Kilo Talk architecture, Yumon runs 100% locally on your machine with zero cloud costs and
                includes an aquarium simulation with living fish and ambient tank animation.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-xs tracking-wider">
                <Link
                  href="/free-ai"
                  className="inline-flex items-center gap-2 bg-accent px-5 py-2.5 font-display font-semibold !text-ink transition hover:bg-ink-100"
                >
                  GET FREE AI <ChevronRight />
                </Link>
                <a
                  href="https://github.com/alexthegoodman/yumon-pet/releases/tag/v0.1.0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-line/32 px-4 py-2.5 text-ink-100 transition hover:border-accent hover:text-accent"
                >
                  GITHUB RELEASE V0.1.0
                </a>
                <a
                  href="https://github.com/alexthegoodman/yumon-pet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-500 hover:text-ink-300"
                >
                  SOURCE CODE
                </a>
              </div>
            </div>

            <div className="border border-line/24 bg-ink/80 p-5 font-mono text-xs">
              <div className="text-[10px] tracking-[0.14em] text-accent">// COMPANION SPECS</div>
              <div className="mt-3 divide-y divide-line/12 text-ink-300">
                <div className="flex justify-between py-2">
                  <span className="text-ink-500">INFERENCE</span>
                  <span className="text-ink-100 font-medium">Local iGPU (WGPU)</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-ink-500">SPEED</span>
                  <span className="text-ink-100 font-medium">Near instant (microsecond N-gram)</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-ink-500">HABITAT</span>
                  <span className="text-ink-100 font-medium">3D Aquarium Simulation</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-ink-500">PRIVACY</span>
                  <span className="text-ink-100 font-medium">100% Offline / Zero Telemetry</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-ink-500">LICENSE &amp; COST</span>
                  <span className="text-accent font-medium">Free &amp; Open Source (MIT)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SectionDivider label="FROM THE WORKSHOP" />

      <div className="px-6 md:px-24">
        <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-12">
          <div>
            <div className="text-xs tracking-[0.14em] text-ink-500">DEV POSTS</div>
            <h2 className="mt-2 font-display text-2xl font-bold text-ink-100">The Rust build log</h2>
            <p className="mt-3 font-display text-[15px] leading-relaxed text-ink-300">
              Entropy&apos;s engine, GUI, DAW and creative tools, plus Yumon Pet&apos;s model work, with
              the commits and measurements behind each result.
            </p>
            <Link href="/dev" className="mt-5 inline-flex items-center gap-2 text-sm tracking-wide text-accent">
              ALL {devPosts.length} DEV POSTS <ChevronRight />
            </Link>
          </div>
          <div>
            {devPosts.slice(0, 3).map((post, i) => (
              <PostRow key={post.slug} post={post} figNumber={i + 1} border={i === 2 ? "both" : "top"} />
            ))}
          </div>
        </div>
      </div>

      <SectionDivider label="PLAY" />

      <div className="px-6 md:px-24">
        <Link
          href="/games"
          className="group flex flex-col gap-6 border border-line/32 p-6 hover:border-accent/50 md:flex-row md:items-center md:justify-between md:p-10"
        >
          <div>
            <div className="text-[11px] tracking-[0.14em] text-accent">// NOW LIVE</div>
            <div className="mt-2 font-display text-2xl font-bold text-ink-100 md:text-3xl">
              Allegiance, our online conquest MMO
            </div>
            <p className="mt-2 max-w-2xl font-display text-[15px] leading-relaxed text-ink-300">
              Found a nation and contest territory in a shared world, right in the browser. Built
              with Babylon.js and Cloudflare Durable Objects.
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-2 text-sm tracking-wide text-accent group-hover:text-ink-100">
            PLAY GAMES <ChevronRight />
          </span>
        </Link>
      </div>

      <SectionDivider label="SUBMISSIONS OPEN" />

      <div className="px-6 pb-16 md:px-24">
        <Link
          href="/promote"
          className="group flex flex-col gap-6 border border-accent/50 p-6 md:flex-row md:items-center md:justify-between md:p-10"
        >
          <div>
            <div className="text-[11px] tracking-[0.14em] text-accent">// FOR MAKERS</div>
            <div className="mt-2 font-display text-2xl font-bold text-ink-100 md:text-3xl">
              Built a developer tool? Get it reviewed.
            </div>
            <p className="mt-2 max-w-2xl font-display text-[15px] leading-relaxed text-ink-300">
              Source-level review, a reproducible test harness and a scorecard, with the verdict left
              independent.
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-2 text-sm tracking-wide text-accent group-hover:text-ink-100">
            SUBMIT A PRODUCT <ChevronRight />
          </span>
        </Link>
      </div>

      <SiteFooter />
    </div>
  );
}
