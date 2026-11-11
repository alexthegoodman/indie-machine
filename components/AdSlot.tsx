import Link from "next/link";
import { ChevronRight } from "./icons";
import { type AdCreative, type AdPlacement, activeAd, houseAd } from "@/lib/ads";

// One monthly sponsor slot. Booked slots are labelled SPONSOR and link out
// with rel="sponsored"; unbooked slots show one of our own products.
export function AdSlot({
  placement,
  seed = placement,
  layout = "banner",
  className = "",
}: {
  placement: AdPlacement;
  seed?: string;
  layout?: "banner" | "rail";
  className?: string;
}) {
  const booked = activeAd(placement);
  const ad: AdCreative = booked ?? houseAd(seed);
  const label = booked ? "SPONSOR" : "INDIE MACHINE";
  const external = /^https?:\/\//.test(ad.href);

  const body = (
    <>
      <div className="min-w-0">
        <div className="font-display text-lg font-bold text-ink-100 group-hover:text-accent">{ad.name}</div>
        <p className="mt-1 font-display text-sm leading-relaxed text-ink-300">{ad.tagline}</p>
      </div>
      <span className="flex shrink-0 items-center gap-2 text-[11px] tracking-[0.12em] text-accent group-hover:text-ink-100">
        {ad.cta} <ChevronRight />
      </span>
    </>
  );
  const linkClass =
    layout === "banner"
      ? "group flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
      : "group flex flex-col gap-3 p-5";

  return (
    <aside aria-label={booked ? "Sponsor" : "Indie Machine product"} className={`border border-line/32 ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line/28 px-5 py-2 text-[10px] tracking-[0.14em] whitespace-nowrap">
        <span className={booked ? "text-accent" : "text-ink-500"}>{label}</span>
        <Link href="/promote#advertise" className="text-ink-500 hover:text-accent">
          ADVERTISE HERE
        </Link>
      </div>
      {external ? (
        <a href={ad.href} target="_blank" rel="sponsored noopener" className={linkClass}>
          {body}
        </a>
      ) : (
        <Link href={ad.href} className={linkClass}>
          {body}
        </Link>
      )}
    </aside>
  );
}
