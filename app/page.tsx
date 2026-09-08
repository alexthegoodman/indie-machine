import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionDivider } from "@/components/SectionDivider";
import { TitleBlock } from "@/components/TitleBlock";
import { PostRow } from "@/components/PostRow";
import { ChevronRight } from "@/components/icons";
import { getAllPosts, getSeriesByName } from "@/lib/posts";

export default function Home() {
  const posts = getAllPosts();
  const [featured, ...rest] = posts;
  const oceanPipeline = getSeriesByName("Entropy").filter((p) =>
    ["fft-ocean-water", "fft-water-interactive-ripples"].includes(p.slug),
  );
  const editorChrome = getSeriesByName("Entropy").filter((p) => p.slug.includes("egui"));

  return (
    <div className="relative z-10">
      <SiteHeader active="home" />

      {/* masthead */}
      <div className="px-6 pt-16 pb-10 md:px-24 md:pt-24 md:pb-14">
        <div className="text-[13px] tracking-[0.14em] text-accent">// ENGINEERING JOURNAL</div>
        <h1 className="mt-3 font-display text-[15vw] leading-[0.96] font-bold tracking-tight text-ink-100 sm:text-7xl md:text-8xl lg:text-[100px]">
          Indie Machine
        </h1>
        <div className="mt-4 text-[13px] tracking-[0.2em] text-accent uppercase md:text-[15px]">
          Rust — Native — Complex Applications
        </div>
        <p className="mt-6 max-w-2xl font-display text-base leading-relaxed text-ink-300 md:text-lg">
          Indie Machine documents Entropy — a native engine built from scratch in Rust — as it&apos;s
          built: its own GPU compute pipelines, its own immediate-mode GUI kit, its own docking
          system. Every post ships with the commit it was measured against, the exact command
          that produced the numbers, and a screenshot pulled from the session that ran it. Nothing
          here is a mockup.
        </p>

        <div className="mt-9">
          <TitleBlock
            cells={[
              { label: "SHEET", value: `001 / ${String(posts.length).padStart(3, "0")}` },
              { label: "REV", value: "A" },
              { label: "DATE", value: posts[0]?.date ?? "" },
              { label: "DISCIPLINE", value: "RUST / WGPU" },
              { label: "STATUS", value: "ACTIVE BUILD", accent: true },
            ]}
          />
        </div>
      </div>

      <SectionDivider label={`${posts.length} POSTS LOGGED`} />

      {/* featured post */}
      {featured && (
        <div className="px-6 md:px-24">
          <Link
            href={`/posts/${featured.slug}`}
            className="group flex flex-col gap-8 border border-line/32 p-6 md:flex-row md:p-12"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="border border-accent px-2 py-1 text-[11px] tracking-[0.1em] text-accent">
                  FIG. 01 — FEATURED
                </span>
                <span className="border border-line/28 px-2 py-1 text-[11px] tracking-[0.1em] text-ink-300">
                  {(featured.series ?? "").toUpperCase()} SERIES
                </span>
                <span className="ml-auto text-xs text-ink-500">{featured.date}</span>
              </div>
              <h2 className="mt-5 font-display text-2xl font-bold text-ink-100 group-hover:text-accent md:text-4xl">
                {featured.title}
              </h2>
              <p className="mt-4 max-w-xl font-display text-base leading-relaxed text-ink-300">
                {featured.excerpt}
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm tracking-wide text-accent">
                READ FIG. 01 <ChevronRight />
              </div>
            </div>

            <div className="flex w-full shrink-0 flex-col items-center border border-dashed border-line/32 p-5 md:w-[340px]">
              <svg width="100%" viewBox="0 0 300 200" fill="none" className="max-w-[300px]">
                <line x1="0" y1="0" x2="0" y2="200" stroke="rgba(219,234,254,0.18)" strokeWidth="1" />
                <line x1="0" y1="199" x2="300" y2="199" stroke="rgba(219,234,254,0.18)" strokeWidth="1" />
                <path
                  d="M0,150 C23,135 47,165 70,150 C93,135 117,165 140,150 C163,135 187,165 210,150 C233,135 257,165 280,150"
                  stroke="rgba(219,234,254,0.35)"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  fill="none"
                />
                <path
                  d="M0,120 C23,60 47,180 70,120 C93,60 117,180 140,120 C163,60 187,180 210,120 C233,60 257,180 280,120"
                  stroke="rgba(219,234,254,0.55)"
                  strokeWidth="1.2"
                  fill="none"
                />
                <path
                  d="M0,100 C23,65 47,135 70,100 C93,65 117,135 140,100 C163,65 187,135 210,100 C233,65 257,135 280,100"
                  stroke="var(--color-accent)"
                  strokeWidth="1.6"
                  fill="none"
                />
                <text x="6" y="18" fontFamily="var(--font-mono)" fontSize="10" fill="#6f93b8">
                  H(k, t)
                </text>
                <text x="252" y="192" fontFamily="var(--font-mono)" fontSize="10" fill="#6f93b8">
                  k →
                </text>
              </svg>
              <div className="mt-3 text-center text-[10px] tracking-[0.1em] text-ink-500">
                FIG. 01 — SPECTRUM → DISPLACEMENT
              </div>
            </div>
          </Link>
        </div>
      )}

      <SectionDivider label="ENTROPY — BUILD SEQUENCE" />

      {/* series diagram */}
      <div className="px-6 md:px-24">
        <div className="border border-line/32 p-6 md:p-10">
          <div className="text-xs tracking-[0.14em] text-ink-500">OCEAN PIPELINE</div>
          <div className="mt-3 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
            {oceanPipeline.map((post, i) => (
              <div key={post.slug} className="contents">
                <Link
                  href={`/posts/${post.slug}`}
                  className="flex-1 border border-line/28 p-4 hover:border-accent/60"
                >
                  <span className="text-[11px] text-accent">FIG. {String(i + 1).padStart(2, "0")}</span>
                  <div className="mt-1.5 font-display text-[15px] font-medium text-ink-100">
                    {post.title.split(":")[0]}
                  </div>
                  <div className="mt-1 text-xs text-ink-500">{post.excerpt.slice(0, 46)}…</div>
                </Link>
                {i < oceanPipeline.length - 1 && (
                  <div className="flex w-full items-center gap-2 sm:w-28 sm:flex-col">
                    <span className="text-[10px] whitespace-nowrap text-ink-500 sm:order-1">
                      adds ripples
                    </span>
                    <div className="flex w-full items-center sm:order-2">
                      <div
                        className="h-px flex-1 opacity-70"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(90deg, var(--color-accent) 0, var(--color-accent) 4px, transparent 4px, transparent 9px)",
                        }}
                      />
                      <ChevronRight className="shrink-0 text-accent" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 text-xs tracking-[0.14em] text-ink-500">EDITOR CHROME</div>
          <div className="mt-3 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            {editorChrome.map((post) => (
              <Link
                key={post.slug}
                href={`/posts/${post.slug}`}
                className="w-full border border-line/28 p-4 hover:border-accent/60 sm:max-w-xs"
              >
                <span className="text-[11px] text-accent">FIG. 03</span>
                <div className="mt-1.5 font-display text-[15px] font-medium text-ink-100">entropy_gui</div>
                <div className="mt-1 text-xs text-ink-500">Slate theme · docking tree</div>
              </Link>
            ))}
            <div className="text-[11px] text-ink-500 italic">— independent of the ocean pipeline</div>
          </div>
        </div>
      </div>

      <SectionDivider label="FULL INDEX" />

      {/* post index */}
      <div className="px-6 pb-6 md:px-24">
        {posts.map((post, i) => (
          <PostRow
            key={post.slug}
            post={post}
            figNumber={i + 1}
            border={i === posts.length - 1 ? "both" : "top"}
          />
        ))}
      </div>

      <SiteFooter />
    </div>
  );
}
