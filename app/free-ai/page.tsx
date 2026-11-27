import type { Metadata } from "next";
import Link from "next/link";
import { SectionDivider } from "@/components/SectionDivider";
import { YumonThreads } from "@/components/free-ai/YumonThreads";
import { SITE_NAME } from "@/lib/site";

const HYPERFIELD_REPO_URL = "https://github.com/alexthegoodman/hyperfield";
const HYPERFIELD_NPM_URL = "https://www.npmjs.com/package/hyperfield";
const YUMON_REPO_URL = "https://github.com/alexthegoodman/yumon-pet";
const IMAGE = "/images/free-ai-yumon-threads.png";

const TITLE = "Free AI In Your Browser | Yumon | Indie Machine";
const DESCRIPTION =
  "Chat with Yumon, a free 21M-parameter AI that runs in your browser on WebGPU. No account, no server, no API key. Threads are saved on your device.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/free-ai" },
  openGraph: {
    title: `Free AI In Your Browser | Yumon | ${SITE_NAME}`,
    description: DESCRIPTION,
    url: "/free-ai",
    siteName: SITE_NAME,
    type: "website",
    images: [IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `Free AI In Your Browser | Yumon | ${SITE_NAME}`,
    description: DESCRIPTION,
    images: [IMAGE],
  },
};

const FACTS: { label: string; title: string; body: React.ReactNode }[] = [
  {
    label: "// IN YOUR BROWSER",
    title: "No server in the loop",
    body: (
      <>
        Yumon&apos;s weights (12.1 MB, int4) download once, then every reply is computed on your machine with WebGPU, or on
        the CPU when the browser has no WebGPU adapter. There is no inference endpoint to send your messages to.
      </>
    ),
  },
  {
    label: "// THREADS",
    title: "Saved on your device",
    body: (
      <>
        Threads, titles and sampling settings live in this browser&apos;s localStorage. Export any thread as Markdown.
        Clearing site data deletes them; we never see them. Usage stats we collect are counts and timings only, never
        what you type.
      </>
    ),
  },
  {
    label: "// THE MODEL",
    title: "Small, and honest about it",
    body: (
      <>
        Yumon is a 21.1M-parameter decoder trained in the yumon-pet project. It chats, it remembers the
        thread it is in, and it often says odd things. It does not use tools or browse yet. This page grows as Yumon
        does.
      </>
    ),
  },
];

export default function FreeAiPage() {
  return (
    <div className="relative z-10">
      <div className="mt-8 px-3 pb-10 sm:px-6 lg:px-8">
        <YumonThreads />
      </div>

      <div className="px-3 pb-10 sm:px-6 lg:px-8">
        <Link
          href="/free-ai/gherkin"
          className="group flex flex-wrap items-center justify-between gap-3 border border-accent/30 bg-accent/5 p-5 hover:border-accent/60"
          data-testid="gherkin-link"
        >
          <span>
            <span className="block text-[11px] tracking-[0.14em] text-accent">// NEW · FINE-TUNE</span>
            <span className="mt-1 block font-display text-lg font-bold text-ink-100">Yumon writes Gherkin</span>
            <span className="mt-1 block text-xs text-ink-400">
              The same model fine-tuned on Given/When/Then feature files. Start a feature and it writes the scenarios.
            </span>
          </span>
          <span className="text-xs font-semibold text-accent group-hover:underline">TRY IT -&gt;</span>
        </Link>
      </div>

      <SectionDivider label="HOW IT WORKS" />

      <div className="px-6 pb-12 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {FACTS.map((f) => (
            <div key={f.title} className="border border-line/25 bg-panel/15 p-6">
              <div className="text-[11px] tracking-[0.14em] text-accent">{f.label}</div>
              <h2 className="mt-2 font-display text-xl font-bold text-ink-100">{f.title}</h2>
              <p className="mt-3 text-xs leading-relaxed text-ink-400">{f.body}</p>
            </div>
          ))}
        </div>
      </div>

      <SectionDivider label="OPEN SOURCE" />

      <div className="px-6 pb-16 lg:px-8">
        <div className="border border-line/25 bg-panel/10 p-6 md:p-8">
          <div className="text-[11px] tracking-[0.14em] text-accent">// MIT LICENSED</div>
          <h2 className="mt-2 font-display text-2xl font-bold text-ink-100">Read every line that runs here</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-300">
            The runtime is Hyperfield, our TypeScript ML library with WebGPU and CPU backends. It reads Yumon&apos;s
            quantized safetensors and BPE tokenizer directly and runs the decoder with a KV cache. The model and its
            training code are in the yumon-pet repository.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs">
            <a
              href={HYPERFIELD_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-accent px-4 py-2.5 font-semibold text-accent hover:bg-accent hover:text-ink"
            >
              HYPERFIELD ON GITHUB -&gt;
            </a>
            <a
              href={HYPERFIELD_NPM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-line/30 px-4 py-2.5 text-ink-300 hover:border-line/60 hover:text-ink-100"
            >
              HYPERFIELD ON NPM -&gt;
            </a>
            <a
              href={YUMON_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-line/30 px-4 py-2.5 text-ink-300 hover:border-line/60 hover:text-ink-100"
            >
              YUMON-PET ON GITHUB -&gt;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
