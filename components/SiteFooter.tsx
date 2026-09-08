import Link from "next/link";
import { CrosshairIcon } from "./icons";

export function SiteFooter() {
  return (
    <div className="flex flex-col gap-6 border-t border-line/25 px-6 py-10 md:flex-row md:items-center md:justify-between md:px-24 md:py-14">
      <div>
        <div className="flex items-center gap-2.5 text-ink-100">
          <CrosshairIcon className="text-accent" />
          <span className="text-xs font-medium tracking-[0.1em]">INDIE MACHINE</span>
          <span className="text-[11px] text-ink-500">© 2026</span>
        </div>
        <div className="mt-2 text-[11px] tracking-[0.02em] text-ink-500">
          A RUST BUILD LOG. NO MOCKUPS, NO ASSUMED NUMBERS.
        </div>
      </div>
      <div className="flex gap-6 text-xs tracking-[0.1em] text-ink-500">
        <a href="/rss.xml">RSS</a>
        <Link href="/archive" className="hover:text-ink-100">
          ARCHIVE
        </Link>
        <Link href="/series" className="hover:text-ink-100">
          SERIES
        </Link>
        <Link href="/about" className="hover:text-ink-100">
          ABOUT
        </Link>
      </div>
    </div>
  );
}
