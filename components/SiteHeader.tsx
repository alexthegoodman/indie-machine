import Link from "next/link";
import { CrosshairIcon } from "./icons";

const NAV = [
  { href: "/products", label: "Products", key: "products" },
  { href: "/dev", label: "Dev", key: "dev" },
  { href: "/promote", label: "Get Reviewed", key: "promote" },
  { href: "/about", label: "About", key: "about" },
] as const;

// Pages outside the main nav (home, archive, series) pass their own key and
// simply leave every nav item inactive.
export function SiteHeader({ active }: { active?: (typeof NAV)[number]["key"] | "home" | "archive" | "series" }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-dashed border-line/25 px-6 py-5 md:px-24">
      <Link href="/" className="flex items-center gap-2.5 text-white!">
        {/* <CrosshairIcon className="text-accent" /> */}
        <img src="/icon.png" alt="Indie Machine logo" className="w-4" />
        <span className="text-[13px] font-medium tracking-[0.12em]">INDIE&nbsp;/&nbsp;MACHINE</span>
      </Link>
      <nav aria-label="Main navigation" className="flex items-center gap-4 text-[11px] tracking-[0.14em] sm:gap-5 md:gap-9 md:text-xs">
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
    </header>
  );
}
