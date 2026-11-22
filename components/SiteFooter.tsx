import Link from "next/link";
import { CrosshairIcon } from "./icons";

const BMC_URL = "https://www.buymeacoffee.com/alexthegoodman";

export function SupportStrip({ className = "mx-4 mt-4 mb-4 sm:mx-6 lg:mx-8" }: { className?: string }) {
  return (
    <section
      aria-label="Support Indie Machine"
      className={`${className} flex flex-col gap-5 border border-line/20 bg-panel/30 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6`}
    >
      <div className="max-w-xl">
        <div className="text-[11px] tracking-[0.1em] text-badge">SUPPORT THE WORKBENCH</div>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">
          Indie Machine is written by <span className="text-ink-100">AlexTheGoodman</span>. Long nights and deep work
          to bring the good parts directly to you. Please consider supporting me, and 
          {" "}<a
            href={BMC_URL}
            target="_blank"
            rel="noopener noreferrer">
              Buy Me a Coffee.
          </a>{" "}
          Thank you.
        </p>
      </div>
      <a
        href={BMC_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 self-start opacity-90 transition hover:-translate-y-0.5 hover:opacity-100 sm:self-center"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
          alt="Buy Me a Coffee for AlexTheGoodman"
          width={174}
          height={48}
          loading="lazy"
          className="h-12 w-[174px]"
        />
      </a>
    </section>
  );
}

export function SiteFooter() {
  return (
    <>
      {/* <SupportStrip /> */}
      <footer className="flex flex-col gap-6 border-t border-line/25 mt-10 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div>
          <div className="flex items-center gap-2.5 text-ink-100">
            <CrosshairIcon className="text-accent" />
            <span className="text-xs font-medium tracking-[0.1em]">INDIE MACHINE</span>
            <span className="text-[11px] text-ink-500">© 2026</span>
          </div>
          <div className="mt-2 text-[11px] tracking-[0.02em] text-ink-500">
            TOOLS REVIEWED FROM SOURCE. A RUST BUILD LOG. NO ASSUMED NUMBERS.
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs tracking-[0.1em] text-ink-500">
          <Link href="/products" className="hover:text-ink-100">
            PRODUCTS
          </Link>
          <Link href="/free-ai" className="hover:text-ink-100">
            FREE AI
          </Link>
          <Link href="/dev" className="hover:text-ink-100">
            DEV
          </Link>
          <Link href="/games" className="hover:text-ink-100">
            GAMES
          </Link>
          <Link href="/archive" className="hover:text-ink-100">
            ARCHIVE
          </Link>
          <Link href="/series" className="hover:text-ink-100">
            SERIES
          </Link>
          <Link href="/promote" className="hover:text-ink-100">
            ADVERTISE
          </Link>
          <a href="/rss.xml">RSS</a>
        </div>
      </footer>
    </>
  );
}
