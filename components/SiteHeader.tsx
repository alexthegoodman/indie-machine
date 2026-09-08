import Link from "next/link";
import { CrosshairIcon } from "./icons";

const NAV = [
  { href: "/", label: "Latest", key: "home" },
  { href: "/archive", label: "Archive", key: "archive" },
  { href: "/series", label: "Series", key: "series" },
  { href: "/about", label: "About", key: "about" },
] as const;

export function SiteHeader({ active }: { active?: (typeof NAV)[number]["key"] }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-line/25 px-6 py-5 md:px-24">
      <Link href="/" className="flex items-center gap-2.5 text-ink-100">
        <CrosshairIcon className="text-accent" />
        <span className="text-[13px] font-medium tracking-[0.12em]">INDIE&nbsp;/&nbsp;MACHINE</span>
      </Link>
      <nav className="flex items-center gap-5 text-[11px] tracking-[0.14em] md:gap-9 md:text-xs">
        {NAV.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={
              item.key === active
                ? "border-b border-accent pb-1.5 text-accent"
                : "text-ink-500 hover:text-ink-100"
            }
          >
            {item.label.toUpperCase()}
          </Link>
        ))}
      </nav>
    </div>
  );
}
