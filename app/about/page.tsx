import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionDivider } from "@/components/SectionDivider";
import { TitleBlock } from "@/components/TitleBlock";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "About Indie Machine | Rust Engineering Build Log",
  description: "How Indie Machine documents Rust native software, tests claims, and links each build note to its source and evidence.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: `About ${SITE_NAME}`,
    description: "How Indie Machine documents Rust native software and verifies its build notes.",
    url: "/about",
    siteName: SITE_NAME,
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: `About ${SITE_NAME}`,
    description: "How Indie Machine documents Rust native software and verifies its build notes.",
    images: ["/opengraph-image"],
  },
};

export default function AboutPage() {
  return (
    <div className="relative z-10">
      <SiteHeader active="about" />

      <div className="px-6 pt-16 pb-8 md:px-24 md:pt-20">
        <div className="text-[13px] tracking-[0.14em] text-accent">// ABOUT THIS LOG</div>
        <h1 className="mt-3 font-display text-5xl font-bold text-ink-100 md:text-6xl">
          Rust. Native. Complex.
        </h1>
        <div className="mt-8 max-w-2xl space-y-5 font-display text-base leading-relaxed text-ink-300 md:text-lg">
          <p>
            Indie Machine is a build log for Entropy, a native engine written from scratch in
            Rust — its own GPU compute pipelines, its own immediate-mode GUI kit, its own docking
            system. It exists because most of that work is invisible unless someone writes down
            how it actually got built.
          </p>
          <p>
            Build posts identify the code revision and commands behind their results. When a test
            produces a useful screenshot or measurement, the post says how it was made. Product
            reviews distinguish what was run locally from what the product and its documentation
            claim. Limitations and failed approaches belong in the record too.
          </p>
          <p>
            The Entropy series follows graphics, UI, audio, and application tooling in Rust.
            Yumon follows model and world experiments. Product Hunt coverage examines developer
            tools with the same attention to source code and observable behavior.
          </p>
        </div>

        <div className="mt-10">
          <TitleBlock
            cells={[
              { label: "STACK", value: "Rust / wgpu / winit" },
              { label: "FORMAT", value: "Build log" },
              { label: "STANDARD", value: "Evidence, not claims", accent: true },
            ]}
          />
        </div>
      </div>

      <SectionDivider label="END OF SHEET" />

      <SiteFooter />
    </div>
  );
}
