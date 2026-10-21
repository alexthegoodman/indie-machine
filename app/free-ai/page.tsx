import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SectionDivider } from "@/components/SectionDivider";
import { TitleBlock } from "@/components/TitleBlock";
import { ChevronRight } from "@/components/icons";
import { SITE_NAME } from "@/lib/site";

const RELEASE_URL = "https://github.com/alexthegoodman/yumon-pet/releases/tag/v0.1.0";
const DOWNLOAD_ZIP_URL = "https://github.com/alexthegoodman/yumon-pet/releases/download/v0.1.0/YumonPortal-v0.1.0-windows.zip";
const SOURCE_REPO_URL = "https://github.com/alexthegoodman/yumon-pet";

export const metadata: Metadata = {
  title: "Free AI Desktop Pet | Yumon Pet v0.1.0 | Indie Machine",
  description: "Download Yumon Pet: free, near instant, private AI that runs on iGPU. An AI pet designed to keep you company at your desk with an interactive 3D aquarium simulation.",
  alternates: { canonical: "/free-ai" },
  openGraph: {
    title: `Free AI Desktop Pet | Yumon Pet v0.1.0 | ${SITE_NAME}`,
    description: "Free, near instant, private AI that runs on iGPU. An AI companion that keeps you company at your desk with an aquarium simulation.",
    url: "/free-ai",
    siteName: SITE_NAME,
    type: "website",
    images: ["/images/yumon-pet-1.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: `Free AI Desktop Pet | Yumon Pet v0.1.0 | ${SITE_NAME}`,
    description: "Free, near instant, private AI that runs on iGPU. An AI companion with an aquarium simulation.",
    images: ["/images/yumon-pet-1.png"],
  },
};

export default function FreeAiPage() {
  return (
    <div className="relative z-10">
      <SiteHeader active="free-ai" />

      {/* Hero Section */}
      <div className="px-6 pt-16 pb-10 md:px-24 md:pt-20">
        <section className="flex flex-col md:flex-row">
          <div className="pr-8">
            <div className="flex items-center gap-2.5 text-[13px] tracking-[0.14em] text-accent">
              <span className="inline-block h-2 w-2 rounded-full bg-accent" />
              // DESKTOP COMPANION RELEASE
            </div>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-ink-100 sm:text-5xl md:text-6xl">
              Free AI That Runs On Your iGPU
            </h1>
            <p className="mt-4 font-display text-xl text-accent font-semibold md:text-2xl">
              Yumon Pet v0.1.0 - Near instant, 100% private desktop AI companion with an aquarium simulation
            </p>
            <p className="mt-6 max-w-3xl font-display text-base leading-relaxed text-ink-300 md:text-lg">
              Designed to be an AI pet that keeps you company when you are at your desk. Yumon runs completely
              offline on your local integrated graphics (iGPU) using WGPU, meaning zero monthly fees, zero latency,
              and zero telemetry. Watch living Yumon swim across a living 3D aquarium while Yumon explores daily tech launches
              and chats with you locally.
            </p>

            {/* Primary Download & Action Bar */}
            <div className="mt-8 flex flex-wrap items-center gap-4 text-xs tracking-wider">
              <a
                href={DOWNLOAD_ZIP_URL}
                className="inline-flex items-center gap-2.5 bg-accent px-6 py-3 font-display font-semibold !text-ink transition hover:bg-ink-100"
              >
                DOWNLOAD FOR WINDOWS (.ZIP) <ChevronRight className="h-4 w-4" />
              </a>
              <a
                href={RELEASE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-line/35 px-5 py-3 text-ink-100 transition hover:border-accent hover:text-accent"
              >
                VIEW GITHUB RELEASE (V0.1.0)
              </a>
              <a
                href={SOURCE_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-line/25 px-5 py-3 text-ink-300 transition hover:border-line/60 hover:text-ink-100"
              >
                INSPECT SOURCE CODE
              </a>
            </div>

            <div className="mt-10">
              <TitleBlock
                cells={[
                  { label: "VERSION", value: "v0.1.0" },
                  { label: "TARGET", value: "WINDOWS 10 / 11" },
                  { label: "ENGINE", value: "LOCAL iGPU (WGPU)" },
                  { label: "PRIVACY", value: "100% OFFLINE" },
                  { label: "LICENSE", value: "OPEN SOURCE (MIT)", accent: true },
                ]}
              />
            </div>
          </div>
          <figure className="border border-line/28 bg-panel/20 p-3 md:p-6">
            <img
              src="/images/yumon-pet-1.png"
              alt="Yumon Pet running on desktop with a 3D tropical aquarium simulation on the left and local AI chat on the right"
              width={867}
              height={509}
              className="mx-auto max-w-full border border-line/25 shadow-2xl"
            />
            <figcaption className="mt-4 text-center text-xs text-ink-400">
              Yumon Portal v0.1.0 running on desktop: interactive 3D aquarium simulation with living fish and ambient plants on the left, and local offline AI chat and Product Hunt radar on the right.
            </figcaption>
          </figure>
        </section>
        
      </div>

      {/* Windows SmartScreen Notice */}
      <SectionDivider label="INSTALLATION &amp; WINDOWS SMARTSCREEN" />

      <div className="px-6 pb-12 md:px-24">
        <div className="border border-accent/40 bg-panel/30 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-accent/60 bg-accent/10 font-bold text-accent">
              !
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-bold text-ink-100 md:text-xl">
                Notice: Windows Defender SmartScreen Popups
              </h2>
              <p className="mt-2 font-display text-sm leading-relaxed text-ink-300 md:text-base">
                Because we are an independent indie software team and this is a brand new release, Windows Defender
                SmartScreen may show a blue prompt stating <span className="text-ink-100 font-semibold">&quot;Windows protected your PC - Microsoft Defender SmartScreen prevented an unrecognized app from starting&quot;</span>.
              </p>
              <div className="mt-4 grid gap-4 rounded border border-line/15 bg-ink/70 p-4 font-mono text-xs text-ink-300 sm:grid-cols-2">
                <div>
                  <div className="font-semibold text-accent">// WHY DOES THIS HAPPEN?</div>
                  <p className="mt-1 leading-relaxed text-ink-400">
                    SmartScreen relies on cryptographic reputation that builds up over time across millions of downloads.
                    As an indie company releasing free software without an expensive corporate enterprise certificate, new version hashes trigger this warning until reputation is established.
                  </p>
                </div>
                <div>
                  <div className="font-semibold text-accent">// HOW TO RUN YUMON PORTAL:</div>
                  <ol className="mt-1 list-decimal pl-4 leading-relaxed text-ink-400">
                    <li>Click <strong className="text-ink-100">More info</strong> in the blue SmartScreen window.</li>
                    <li>Click the <strong className="text-ink-100">Run anyway</strong> button that appears.</li>
                    <li>Yumon Portal will start instantly and stay resident on your desktop.</li>
                  </ol>
                </div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-ink-400">
                Prefer to verify the build yourself? Yumon Pet is completely open source under the MIT license. You can inspect every line of Rust code in our repository, verify the dependencies, and compile it yourself with a single command:
              </p>
              <div className="mt-2 rounded bg-ink p-3 font-mono text-xs text-accent">
                git clone https://github.com/alexthegoodman/yumon-pet.git &amp;&amp; cd yumon-pet &amp;&amp; cargo run --release --bin yumon_portal
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Deep Dive */}
      <SectionDivider label="WHAT IS YUMON PET?" />

      <div className="px-6 pb-12 md:px-24">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Card 1 */}
          <div className="border border-line/25 bg-panel/15 p-6">
            <div className="text-[11px] tracking-[0.14em] text-accent">// LOCAL iGPU INFERENCE</div>
            <h3 className="mt-2 font-display text-xl font-bold text-ink-100">Near Instant, Zero GPU Burn</h3>
            <p className="mt-3 text-xs leading-relaxed text-ink-400">
              Traditional LLMs require multi-gigabyte models and dedicated graphics cards that spin up fans and drain battery.
              Yumon Pet uses our novel <strong className="text-ink-200">Kilo Talk</strong> architecture (4,096 tokens) paired with a
              CPU N-gram statistical decompressor that executes in microseconds. It runs effortlessly on standard integrated GPUs (Intel UHD 770, Iris Xe, AMD Radeon, Apple Silicon) with minimal memory footprint.
            </p>
            <div className="mt-4">
              <Link href="/posts/kilo-framework-compressed-tokens-moe" className="text-xs text-accent hover:underline">
                Read the Kilo Framework build log -&gt;
              </Link>
            </div>
          </div>

          {/* Card 2 */}
          <div className="border border-line/25 bg-panel/15 p-6">
            <div className="text-[11px] tracking-[0.14em] text-accent">// LIVING DESKTOP HABITAT</div>
            <h3 className="mt-2 font-display text-xl font-bold text-ink-100">3D Aquarium Simulation</h3>
            <p className="mt-3 text-xs leading-relaxed text-ink-400">
              Yumon is not just another boring chat window. As shown in the preview screenshot above, the desktop companion includes a living 3D aquarium
              simulation built right beside your daily workspace. Watch tropical species - including Neon Tetras, Flame Gobies,
              Golden Guppies, and Emerald Cories - swim around natural slate rock caves, air stone bubblers, and swaying anubias plants.
            </p>
            <div className="mt-4 text-xs text-ink-500">
              Interactive 3D viewport with OrbitControls and ambient lighting.
            </div>
          </div>

          {/* Card 3 */}
          <div className="border border-line/25 bg-panel/15 p-6">
            <div className="text-[11px] tracking-[0.14em] text-accent">// DAILY PULSE</div>
            <h3 className="mt-2 font-display text-xl font-bold text-ink-100">Daily Product Hunt Radar</h3>
            <p className="mt-3 text-xs leading-relaxed text-ink-400">
              Curious about what the tech world is shipping? Yumon Pet continuously aggregates top daily product releases
              from Product Hunt and shares autonomous thoughts, observations, and feedback every few minutes. You can also open the chat tab to discuss any launch or bounce your own ideas off Yumon.
            </p>
            <div className="mt-4 text-xs text-ink-500">
              Cached locally for offline reading whenever you are disconnected.
            </div>
          </div>

          {/* Card 4 */}
          <div className="border border-line/25 bg-panel/15 p-6">
            <div className="text-[11px] tracking-[0.14em] text-accent">// COMPLETE PRIVACY</div>
            <h3 className="mt-2 font-display text-xl font-bold text-ink-100">100% Private By Design</h3>
            <p className="mt-3 text-xs leading-relaxed text-ink-400">
              No account creation, no sign in, no telemetry, and no remote model endpoints. Your messages, questions, and
              conversations remain on your physical hardware. When you close the app, nothing is leaked to third-party cloud servers.
            </p>
            <div className="mt-4 text-xs text-ink-500">
              Zero cloud lock-in. Zero API tokens needed.
            </div>
          </div>

          {/* Card 5 */}
          <div className="border border-line/25 bg-panel/15 p-6">
            <div className="text-[11px] tracking-[0.14em] text-accent">// TRANSPARENT CODE</div>
            <h3 className="mt-2 font-display text-xl font-bold text-ink-100">Open Source (MIT)</h3>
            <p className="mt-3 text-xs leading-relaxed text-ink-400">
              We build in the open. The model architectures, tokenizer vocabularies, training pipelines, and native Tao/Wry
              desktop frontend are published in full on GitHub. Anyone can inspect, fork, or build their own custom pets.
            </p>
            <div className="mt-4">
              <a href={SOURCE_REPO_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">
                alexthegoodman/yumon-pet on GitHub -&gt;
              </a>
            </div>
          </div>

          {/* Card 6 */}
          <div className="border border-line/25 bg-panel/15 p-6">
            <div className="text-[11px] tracking-[0.14em] text-accent">// COMPANION CULTURE</div>
            <h3 className="mt-2 font-display text-xl font-bold text-ink-100">Company At Your Desk</h3>
            <p className="mt-3 text-xs leading-relaxed text-ink-400">
              Whether you are working through a long coding sprint, writing documentation, or studying, having a lightweight,
              animated companion on your secondary monitor makes the workspace feel alive without consuming 50% of your CPU.
            </p>
            <div className="mt-4 text-xs text-ink-500">
              Compact borderless shell with drag-and-drop window positioning.
            </div>
          </div>
        </div>
      </div>

      {/* Package Contents & Technical Specifications */}
      <SectionDivider label="RELEASE SPECIFICATIONS" />

      <div className="px-6 pb-12 md:px-24">
        <div className="border border-line/30 p-6 md:p-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <div className="text-[11px] tracking-[0.14em] text-accent">// BUNDLE CONTENTS</div>
              <h3 className="mt-2 font-display text-2xl font-bold text-ink-100">
                YumonPortal-v0.1.0-windows.zip
              </h3>
              <p className="mt-3 text-xs leading-relaxed text-ink-400">
                The release archive contains everything required to run Yumon Portal on Windows out of the box without installing Python, PyTorch, or CUDA toolchains:
              </p>
              <ul className="mt-4 space-y-2.5 font-mono text-xs text-ink-300">
                <li className="flex items-start gap-2">
                  <span className="text-accent font-bold">1.</span>
                  <div>
                    <strong className="text-ink-100">yumon_portal.exe (~25 MB):</strong> Standalone Windows executable with embedded Kilo Talk neural weights, BPE tokenizer, and 3D aquarium webview.
                  </div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent font-bold">2.</span>
                  <div>
                    <strong className="text-ink-100">ngram_decompressor.bin (~345 MB):</strong> High-accuracy statistical N-gram language decompressor table providing instantaneous microsecond vocabulary expansion.
                  </div>
                </li>
              </ul>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={DOWNLOAD_ZIP_URL}
                  className="inline-flex items-center gap-2 bg-accent px-4 py-2 text-xs font-semibold text-ink hover:bg-ink-100"
                >
                  DOWNLOAD ZIP (~345 MB) <ChevronRight />
                </a>
                <a
                  href={RELEASE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-line/30 px-4 py-2 text-xs text-ink-300 hover:text-ink-100 hover:border-accent"
                >
                  RELEASE NOTES ON GITHUB -&gt;
                </a>
              </div>
            </div>

            <div>
              <div className="text-[11px] tracking-[0.14em] text-accent">// SYSTEM REQUIREMENTS</div>
              <div className="mt-3 divide-y divide-line/15 font-mono text-xs text-ink-300">
                <div className="flex justify-between py-2.5">
                  <span className="text-ink-500">OPERATING SYSTEM</span>
                  <span className="text-ink-100">Windows 10 / 11 (64-bit)</span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-ink-500">GRAPHICS / GPU</span>
                  <span className="text-ink-100">Intel UHD 630+, Iris Xe, AMD Vega/RDNA, or NVIDIA</span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-ink-500">BACKEND API</span>
                  <span className="text-ink-100">Vulkan / DirectX 12 via WGPU</span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-ink-500">RAM REQUIRED</span>
                  <span className="text-ink-100">4 GB minimum (runs in ~600 MB)</span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-ink-500">DISK SPACE</span>
                  <span className="text-ink-100">~400 MB extracted</span>
                </div>
                <div className="flex justify-between py-2.5">
                  <span className="text-ink-500">NETWORK</span>
                  <span className="text-ink-100">Offline inference (internet only for RSS feed refresh)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust & Source Verification */}
      <SectionDivider label="VERIFY AND BUILD FROM SOURCE" />

      <div className="px-6 pb-16 md:px-24">
        <div className="border border-line/25 bg-panel/10 p-6 md:p-8">
          <div className="text-[11px] tracking-[0.14em] text-accent">// OPEN AUDIT &amp; SOURCE REPRODUCIBILITY</div>
          <h3 className="mt-2 font-display text-2xl font-bold text-ink-100">
            Audit the Source Code on GitHub
          </h3>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-300">
            Trust in modern desktop software starts with full source visibility. Every component of Yumon Pet is available for review in the public GitHub repository. You can verify that there is no hidden telemetry, no tracking pixels, and no private data harvesting.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs">
            <a
              href={SOURCE_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-accent px-4 py-2.5 text-accent hover:bg-accent hover:text-ink font-semibold"
            >
              BROWSE GITHUB REPOSITORY -&gt;
            </a>
            <a
              href={`${SOURCE_REPO_URL}/blob/main/src/bin/yumon_portal.rs`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-line/30 px-4 py-2.5 text-ink-300 hover:text-ink-100 hover:border-line/60"
            >
              VIEW YUMON_PORTAL.RS SOURCE -&gt;
            </a>
            <Link
              href="/posts/kilo-framework-compressed-tokens-moe"
              className="text-ink-500 hover:text-ink-300"
            >
              TECHNICAL DEEP DIVE ON INDIE MACHINE -&gt;
            </Link>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
