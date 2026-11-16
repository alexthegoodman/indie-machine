import Link from "next/link";
import { RssIcon } from "@/components/shell/icons";

// YouTube-style channel banner at the top of every index page.
export function ChannelHeader({
  kicker,
  title,
  blurb,
  stats,
  image,
  imageAlt = "",
  cta,
  accent = "accent",
  children,
}: {
  kicker: string;
  title: string;
  blurb: React.ReactNode;
  stats?: string[];
  image?: string;
  imageAlt?: string;
  cta?: { href: string; label: string; external?: boolean };
  accent?: "accent" | "badge";
  children?: React.ReactNode;
}) {
  return (
    <section className="flex flex-wrap border border-line/28 bg-panel/25">
      {image && (
        <div className="max-h-72 min-w-0 flex-[1_1_360px] overflow-hidden bg-panel">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={imageAlt} className="h-full w-full object-cover object-top" />
        </div>
      )}
      <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-3 p-6 md:p-8">
        <div className={`text-[11px] tracking-[0.14em] ${accent === "badge" ? "text-badge" : "text-accent"}`}>{kicker}</div>
        <h1 className="font-display text-4xl leading-[1.05] font-bold text-ink-100 md:text-5xl">{title}</h1>
        <div className="max-w-3xl font-display text-base leading-relaxed text-ink-300">{blurb}</div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {cta &&
            (cta.external ? (
              <a
                href={cta.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center bg-accent px-5 font-display text-[13px] font-semibold tracking-[0.08em] text-ink! hover:bg-ink-100"
              >
                {cta.label}
              </a>
            ) : (
              <Link
                href={cta.href}
                className="inline-flex h-11 items-center bg-accent px-5 font-display text-[13px] font-semibold tracking-[0.08em] text-ink! hover:bg-ink-100"
              >
                {cta.label}
              </Link>
            ))}
          <a
            href="/rss.xml"
            className="inline-flex h-11 items-center gap-2 border border-line/32 px-4 text-xs tracking-[0.1em] text-ink-100! hover:border-accent hover:bg-accent/10"
          >
            <RssIcon size={16} /> FOLLOW VIA RSS
          </a>
          {stats?.map((s) => (
            <span key={s} className="text-xs tracking-[0.06em] text-ink-400">
              {s}
            </span>
          ))}
        </div>
        {children}
      </div>
    </section>
  );
}

export function PageBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-4 pt-5 sm:px-6 lg:px-8 lg:pt-6 ${className}`}>{children}</div>;
}

export function ShelfHeader({
  kicker,
  title,
  href,
  linkLabel,
  accent = "accent",
}: {
  kicker: string;
  title: string;
  href?: string;
  linkLabel?: string;
  accent?: "accent" | "badge";
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-t border-dashed border-line/22 pt-5">
      <div>
        <div className={`text-[11px] tracking-[0.14em] ${accent === "badge" ? "text-badge" : "text-accent"}`}>{kicker}</div>
        <h2 className="mt-1.5 font-display text-[22px] font-bold text-ink-100">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="shrink-0 py-3 text-[11px] tracking-[0.14em]">
          {linkLabel ?? "ALL"} -&gt;
        </Link>
      )}
    </div>
  );
}
