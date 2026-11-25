import Link from "next/link";
import { BannerMascot } from "./BannerMascot";

// Top-of-home strip for visitors who came for the free in-browser AI. The link's overlay
// covers the whole strip so it is easy to hit on a phone; the mascot sits above the
// overlay so clicking it waves instead of navigating.
export function FreeAiBanner() {
  return (
    <section
      aria-label="Free AI banner"
      className="group relative mb-6 flex items-stretch md:min-h-36 border border-badge bg-badge/12 hover:bg-badge/18"
    >
      {/* <BannerMascot className="relative z-10 hidden w-40 shrink-0 border-r border-badge/40 md:block" /> */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 sm:px-6">
        <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-badge">
          <span aria-hidden="true" className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-ping rounded-full bg-badge/70 motion-reduce:animate-none" />
            <span className="relative h-2 w-2 rounded-full bg-badge" />
          </span>
          FREE AI
        </span>
        <span className="flex min-w-0 flex-[1_1_320px] flex-col gap-0.5">
          <Link
            href="/free-ai"
            aria-label="Free AI: chat with Yumon in your browser, no account needed"
            className="font-display text-[17px] leading-snug font-bold text-ink-100! after:absolute after:inset-0 after:content-[''] sm:text-lg"
          >
            Try our Free AI named Yumon! Chat with Yumon right in your browser.
          </Link>
          <span className="font-display text-[13px] leading-relaxed text-ink-300">
            No account, no sign-up, no API key. It runs on your device and your chats stay there.
          </span>
        </span>
        <span
          aria-hidden="true"
          className="inline-flex h-10 shrink-0 items-center bg-badge px-5 font-display text-[13px] font-semibold tracking-[0.08em] text-ink group-hover:bg-ink-100"
        >
          OPEN FREE AI →
        </span>
      </div>
    </section>
  );
}
