import Link from "next/link";
import { Card, Td, Th } from "@/components/insights/ui";
import { sessionEvents, sessions, visitorSummary, type EventRow, type SessionRow } from "@/lib/analytics/reports";
import { duration, exact, when } from "@/lib/analytics/format";
import { one, parseQuery } from "@/lib/analytics/query";
import type { ViewProps } from "./types";

const PER_PAGE = 50;

function SessionTable({ rows, tz, links }: { rows: SessionRow[]; tz: string; links: ViewProps["links"] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] text-[12px]">
        <thead>
          <tr>
            <Th>Started</Th>
            <Th>Visitor</Th>
            <Th>Source</Th>
            <Th>Landing → exit</Th>
            <Th>Where</Th>
            <Th>Device</Th>
            <Th right>Pages</Th>
            <Th right>Events</Th>
            <Th right>Engaged</Th>
            <Th>Did</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-line/4">
              <Td className="whitespace-nowrap">
                <Link href={links.view("session", { id: s.id })} className="text-ink-100! hover:text-accent!">
                  {when(s.start, tz)}
                </Link>
              </Td>
              <Td>
                <Link href={links.view("visitor", { id: s.visitorId })} className="font-mono text-ink-400! hover:text-accent!" title="All sessions of this visitor">
                  {s.visitorId.slice(0, 8)}
                </Link>
              </Td>
              <Td>
                <Link href={links.filter("source", s.source)} className="text-ink-100! hover:text-accent!">
                  {s.source}
                </Link>
                {s.utmCampaign && <span className="ml-1 text-ink-500">({s.utmCampaign})</span>}
              </Td>
              <Td className="max-w-[320px] truncate" >
                <span title={`${s.entry} → ${s.exit ?? ""}`}>
                  {s.entry}
                  {s.exit && s.exit !== s.entry && <span className="text-ink-500"> → {s.exit}</span>}
                </span>
              </Td>
              <Td className="whitespace-nowrap">{[s.city, s.country].filter(Boolean).join(", ") || "-"}</Td>
              <Td className="whitespace-nowrap">
                {s.device}
                <span className="text-ink-500"> · {[s.browser, s.os].filter(Boolean).join(" / ")}</span>
              </Td>
              <Td right>{exact(s.pageviews)}</Td>
              <Td right>{exact(s.events)}</Td>
              <Td right>{duration(s.engagedMs)}</Td>
              <Td className="max-w-[220px] truncate text-[11px] text-ink-400">
                {s.names.filter((n) => n !== "pageview" && n !== "engage" && n !== "web_vital").join(", ")}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="py-3 text-[12px] text-ink-500">No sessions match.</p>}
    </div>
  );
}

export async function Sessions({ q, links, params }: ViewProps) {
  const page = Math.max(0, Number(one(params, "page") ?? 0) || 0);
  const rows = await sessions(q, { page, perPage: PER_PAGE });
  return (
    <Card
      title="Sessions"
      note="Newest first. A session is listed whole when any of its events match the filters and segments above. Open one for its full timeline."
      action={
        <span className="flex gap-4">
          {page > 0 && <Link href={links.with({ page: page - 1 ? String(page - 1) : undefined })}>&lt;- NEWER</Link>}
          {rows.length === PER_PAGE && <Link href={links.with({ page: String(page + 1) })}>OLDER -&gt;</Link>}
        </span>
      }
    >
      <SessionTable rows={rows} tz={q.tz} links={links} />
    </Card>
  );
}

function propsText(p: EventRow["props"], name: string): React.ReactNode {
  if (!p) return null;
  if (name === "engage") return `${duration(Number(p.ms) || 0)} engaged, scrolled ${p.scroll ?? "?"}%`;
  return Object.entries(p)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join("  ·  ");
}

function Timeline({ events, tz, links }: { events: EventRow[]; tz: string; links: ViewProps["links"] }) {
  let lastPath = "";
  return (
    <ol className="relative space-y-0 border-l border-line/18 pl-5 text-[12px]">
      {events.map((e) => {
        const newPage = e.name === "pageview" && e.path !== lastPath;
        if (e.name === "pageview") lastPath = e.path;
        return (
          <li key={String(e.id)} className={`relative py-1 ${newPage ? "mt-2" : ""}`}>
            <span
              aria-hidden
              className={`absolute top-2.5 -left-[25px] h-2 w-2 rounded-full ${e.name === "pageview" ? "bg-accent" : "border border-line/40 bg-ink"}`}
            />
            <span className="mr-3 inline-block w-28 text-ink-500 tabular-nums">{when(e.at, tz, true)}</span>
            {e.name === "pageview" ? (
              <span className="font-semibold text-ink-100">
                Viewed{" "}
                <Link href={links.view("content", { f: `path:${e.path}` })} className="text-accent!">
                  {e.path}
                </Link>
              </span>
            ) : (
              <span>
                <span className="text-ink-100">{e.name}</span>
                <span className="ml-2 text-ink-400 break-all">{propsText(e.props, e.name)}</span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export async function SessionDetail({ q, links, params }: ViewProps) {
  const id = one(params, "id") ?? "";
  const events = await sessionEvents(id);
  if (!events.length) return <Card title="Session">No events for this session.</Card>;
  const first = events[0];
  const last = events[events.length - 1];
  const engaged = events.filter((e) => e.name === "engage").reduce((s, e) => s + Math.min(1_800_000, Number(e.props?.ms) || 0), 0);
  return (
    <div className="space-y-4">
      <Card title="Session" action={<Link href={links.view("visitor", { id: first.visitorId })}>THIS VISITOR -&gt;</Link>}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] sm:grid-cols-4">
          {[
            ["Started", when(first.at, q.tz, true)],
            ["Length", duration(new Date(last.at).getTime() - new Date(first.at).getTime())],
            ["Engaged", duration(engaged)],
            ["Source", first.source],
            ["Where", first.country ?? "-"],
            ["Device", `${first.device} · ${first.browser ?? ""}`],
            ["Page views", exact(events.filter((e) => e.name === "pageview").length)],
            ["Events", exact(events.length)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] tracking-[0.12em] text-ink-500 uppercase">{k}</dt>
              <dd className="text-ink-100">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card title="Timeline">
        <Timeline events={events} tz={q.tz} links={links} />
      </Card>
    </div>
  );
}

export async function VisitorDetail({ q, links, params }: ViewProps) {
  const id = one(params, "id") ?? "";
  // A visitor's whole history, regardless of the range or filters above.
  const all = parseQuery({ f: `visitor:${id}`, tz: q.tz });
  const [summary, rows] = await Promise.all([visitorSummary(id), sessions(all, { perPage: 200, allTime: true })]);
  if (!summary?.first) return <Card title="Visitor">No events for this visitor.</Card>;
  return (
    <div className="space-y-4">
      <Card title={`Visitor ${id.slice(0, 8)}`} note="An anonymous browser: the id lives in its localStorage, so clearing site data or switching device makes a new visitor.">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] sm:grid-cols-6">
          {[
            ["First seen", when(summary.first, q.tz)],
            ["Last seen", when(summary.last!, q.tz)],
            ["Sessions", exact(summary.sessions)],
            ["Page views", exact(summary.pageviews)],
            ["Events", exact(summary.events)],
            ["Engaged", duration(summary.engagedMs)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] tracking-[0.12em] text-ink-500 uppercase">{k}</dt>
              <dd className="text-ink-100">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card title="Sessions (all time)">
        <SessionTable rows={rows} tz={q.tz} links={links} />
      </Card>
    </div>
  );
}
