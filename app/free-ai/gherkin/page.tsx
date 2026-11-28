import type { Metadata } from "next";
import Link from "next/link";
import { SectionDivider } from "@/components/SectionDivider";
import { GherkinWriter } from "@/components/free-ai/GherkinWriter";
import { SITE_NAME } from "@/lib/site";

const HYPERFIELD_REPO_URL = "https://github.com/alexthegoodman/hyperfield";
const YUMON_REPO_URL = "https://github.com/alexthegoodman/yumon-pet";
const IMAGE = "/images/free-ai-gherkin.png";

const TITLE = "Free Gherkin Writer AI In Your Browser | Yumon | Indie Machine";
const DESCRIPTION =
  "Start a Gherkin feature file and Yumon, a 21M-parameter model fine-tuned on Given/When/Then scenarios, writes the rest in your browser on WebGPU. No account, no server.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/free-ai/gherkin" },
  openGraph: {
    title: `Free Gherkin Writer AI | Yumon | ${SITE_NAME}`,
    description: DESCRIPTION,
    url: "/free-ai/gherkin",
    siteName: SITE_NAME,
    type: "website",
    images: [IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `Free Gherkin Writer AI | Yumon | ${SITE_NAME}`,
    description: DESCRIPTION,
    images: [IMAGE],
  },
};

const FACTS: { label: string; title: string; body: React.ReactNode }[] = [
  {
    label: "// THE MODEL",
    title: "The chat Yumon, retrained on Gherkin",
    body: (
      <>
        This is the loop1 model from the <Link href="/free-ai" className="text-accent hover:underline">/free-ai</Link>{" "}
        chat, extended to a 1,024-token context and fine-tuned on 12,000 generated feature files (7.5M tokens, mostly
        300 to 950 tokens each): forms, lists, toolbars, sign-in, settings and CRUD APIs, plus creative apps and games,
        over 36 domains. Recipes, vehicles, playlists and courses were left out of training, and the app and game
        examples use names it never saw, so the examples test whether it generalizes. It is not a chat model: it only
        continues text.
      </>
    ),
  },
  {
    label: "// HOW GOOD",
    title: "Fluent, not reliable",
    body: (
      <>
        On 240 held-out features it predicts the next token right 88.9% of the time at full precision.
        That is mostly the format: the steps read like Gherkin, but domains bleed together, values repeat and
        scenarios can contradict each other. Treat it as a demo, not a test author.
      </>
    ),
  },
  {
    label: "// TO TYPESCRIPT",
    title: "Compile it to an app",
    body: (
      <>
        Every step Yumon learned comes from 316 templates, so its lines can be matched back to them. Compile to
        TypeScript reads each step as a page, a field, an action or an expected result, copies in only the reusable
        functions those need, and writes the handlers that tie them together: a small working app you can try in a
        sandboxed preview, plus a Playwright test per scenario that drives it. Edit the Gherkin and compile again.
      </>
    ),
  },
  {
    label: "// IN YOUR BROWSER",
    title: "Nothing leaves this tab",
    body: (
      <>
        The 12.1 MB of int4 weights download once and run on WebGPU, or on the CPU without an adapter. Yumon&apos;s
        tokenizer lowercases everything, so the page capitalizes keywords for display; tick &quot;as written&quot; to
        see the raw output. Usage stats are counts and timings only.
      </>
    ),
  },
];

export default function GherkinPage() {
  return (
    <div className="relative z-10">
      <div className="px-3 pt-8 sm:px-6 lg:px-8">
        <div className="text-[11px] tracking-[0.14em] text-accent">
          <Link href="/free-ai" className="hover:underline">
            FREE AI
          </Link>{" "}
          / GHERKIN
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink-100 md:text-4xl">Yumon writes Gherkin</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-300">
          Write the start of a feature file (a title, a user story, a scenario, the first Given) and a 21M-parameter
          Yumon continues it in your browser, then compile the result to a small TypeScript app with Playwright tests and try it in a sandboxed preview. Expect it to be wrong in
          interesting ways.
        </p>
      </div>

      <div className="mt-6 px-3 pb-10 sm:px-6 lg:px-8">
        <GherkinWriter />
      </div>

      <SectionDivider label="HOW IT WORKS" />

      <div className="px-6 pb-12 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
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
          <h2 className="mt-2 font-display text-2xl font-bold text-ink-100">Same runtime, different weights</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-300">
            Hyperfield runs this checkpoint with the same code as the chat: Engram and N-Grammer layers, a looped core and
            int4 weights dequantized inside the WebGPU kernels. The procedural Gherkin generator and the fine-tune config
            are in the yumon-pet repository.
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
              href={YUMON_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-line/30 px-4 py-2.5 text-ink-300 hover:border-line/60 hover:text-ink-100"
            >
              YUMON-PET ON GITHUB -&gt;
            </a>
            <Link
              href="/free-ai"
              className="inline-flex items-center gap-2 border border-line/30 px-4 py-2.5 text-ink-300 hover:border-line/60 hover:text-ink-100"
            >
              CHAT WITH YUMON -&gt;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
