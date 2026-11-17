import Link from "next/link";
import type { Links } from "@/lib/analytics/links";
import type { Dim } from "@/lib/analytics/query";
import type { Row } from "@/lib/analytics/reports";
import { delta, num, pct } from "@/lib/analytics/format";

export function Card({
  title,
  note,
  action,
  children,
  className = "",
}: {
  title: string;
  note?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-label={title} className={`min-w-0 border border-line/22 bg-ink ${className}`}>
      <header className="flex items-baseline justify-between gap-3 border-b border-line/14 px-4 py-2.5">
        <h2 className="text-[11px] font-medium tracking-[0.14em] text-ink-100 uppercase">{title}</h2>
        {action && <div className="text-[11px]">{action}</div>}
      </header>
      {note && <p className="px-4 pt-3 text-[11px] leading-relaxed text-ink-500">{note}</p>}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Kpi({
  label,
  value,
  now,
  prev,
  invert = false,
  hint,
}: {
  label: string;
  value: string;
  now: number;
  prev: number;
  /** Lower is better (bounce rate). */
  invert?: boolean;
  hint?: string;
}) {
  const d = delta(now, prev);
  const good = d === null || Math.abs(d) < 0.005 ? null : invert ? d < 0 : d > 0;
  return (
    <div className="min-w-0 border border-line/22 px-4 py-3" title={hint}>
      <div className="text-[10px] tracking-[0.14em] text-ink-500 uppercase">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold text-ink-100 tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] text-ink-500">
        {d === null ? (
          "no previous data"
        ) : (
          <>
            <span className={good === null ? "text-ink-400" : good ? "text-accent" : "text-badge"}>
              {good === null ? "=" : d > 0 ? "▲" : "▼"} {pct(Math.abs(d))}
            </span>{" "}
            vs previous
          </>
        )}
      </div>
    </div>
  );
}

const METRIC_LABEL = { visitors: "visitors", sessions: "sessions", events: "events" } as const;

/**
 * Top values of a dimension as a ranked list with share bars. Each value links to the same view
 * filtered to it; the side links narrow to sessions that did it, or exclude it.
 */
export function BarList({
  rows,
  dim,
  links,
  metric = "visitors",
  total,
  empty = "No data in this range.",
  step,
  display,
  limit,
}: {
  rows: Row[];
  dim: Dim;
  links: Links;
  metric?: keyof typeof METRIC_LABEL;
  total?: number;
  empty?: string;
  /** The `did` step for a value, when "sessions that did this" makes sense. */
  step?: (key: string) => string;
  display?: (key: string) => React.ReactNode;
  limit?: number;
}) {
  const shown = limit ? rows.slice(0, limit) : rows;
  if (!shown.length) return <p className="text-[12px] text-ink-500">{empty}</p>;
  const max = Math.max(1, ...shown.map((r) => r[metric]));
  const denom = total ?? max;
  return (
    <table className="w-full table-fixed text-[12px]">
      <thead className="sr-only">
        <tr>
          <th>Value</th>
          <th>{METRIC_LABEL[metric]}</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((r) => {
          const key = r.key ?? "(none)";
          return (
            <tr key={key} className="group">
              <td className="relative py-0.5 pr-2">
                <div
                  aria-hidden
                  className="absolute inset-y-0.5 left-0 rounded-r-[3px] bg-accent/14 group-hover:bg-accent/24"
                  style={{ width: `${(r[metric] / max) * 100}%` }}
                />
                <div className="relative flex min-w-0 items-center gap-2 px-2 py-1">
                  <Link href={links.filter(dim, r.key)} className="truncate text-ink-100! hover:text-accent!" title={`Filter: ${key}`}>
                    {display ? display(key) : key}
                  </Link>
                  <span className="ml-auto hidden shrink-0 gap-2 text-[10px] group-hover:flex group-focus-within:flex">
                    {step && r.key !== null && (
                      <Link href={links.segment(step(r.key))} className="text-ink-400! hover:text-accent!" title="Only sessions that did this">
                        did
                      </Link>
                    )}
                    <Link href={links.filter(dim, r.key, true)} className="text-ink-400! hover:text-accent!" title="Exclude this value">
                      not
                    </Link>
                  </span>
                </div>
              </td>
              <td className="w-24 py-0.5 text-right tabular-nums">
                <span className="text-ink-100">{num(r[metric])}</span>
                <span className="ml-1.5 inline-block w-9 text-[10px] text-ink-500">{pct(r[metric] / denom)}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function Th({ children, right = false }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th scope="col" className={`border-b border-line/14 px-2 py-2 text-[10px] font-normal tracking-[0.1em] whitespace-nowrap text-ink-500 uppercase ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

export function Td({ children, right = false, className = "" }: { children?: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={`border-b border-line/8 px-2 py-1.5 ${right ? "text-right tabular-nums" : ""} ${className}`}>{children}</td>;
}

/** A tiny inline meter for a 0..1 rate in a table cell. */
export function Rate({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="text-ink-100">{pct(value)}</span>
      <span aria-hidden className="inline-block h-1.5 w-12 bg-line/10">
        <span className="block h-full rounded-r-[2px] bg-accent" style={{ width: `${Math.min(1, value) * 100}%` }} />
      </span>
    </span>
  );
}

