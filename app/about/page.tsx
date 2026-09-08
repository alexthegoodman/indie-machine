import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionDivider } from "@/components/SectionDivider";
import { TitleBlock } from "@/components/TitleBlock";

export const metadata: Metadata = {
  title: "About — Indie Machine",
  description: "What Indie Machine is and how it's written.",
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
            Every post follows the same discipline: it ships with the commit it was measured
            against, the exact command that produced any numbers in it, and — where there&apos;s
            something to see — a screenshot pulled from the session that ran it, not a mockup or a
            render from a script. Where a run failed or a shortcut got taken, that goes in a
            Failure Notes section instead of getting quietly smoothed over.
          </p>
          <p>
            Posts are grouped into series when they build on each other directly. The Entropy
            series so far covers a GPU-driven FFT ocean, the interactive ripple layer added on top
            of it, and the in-house GUI kit that replaced egui across the whole editor.
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
