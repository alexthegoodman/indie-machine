import Link from "next/link";
import { BarList, Card, Td, Th } from "@/components/insights/ui";
import { breakdown, events } from "@/lib/analytics/reports";
import { when } from "@/lib/analytics/format";
import { EVENT_NAMES } from "@/lib/analytics/events";
import { one } from "@/lib/analytics/query";
import type { ViewProps } from "./types";

const PER_PAGE = 100;

export async function Events({ q, links, params }: ViewProps) {
  const beforeRaw = one(params, "before");
  const before = beforeRaw && /^\d+$/.test(beforeRaw) ? BigInt(beforeRaw) : undefined;
  const [rows, names] = await Promise.all([events(q, { before, limit: PER_PAGE }), breakdown(q, "name", { limit: 40 })]);
  const exportHref = links.view("events").replace("/insights", "/insights/export");

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card
        title="Raw events"
        note="Newest first, every field. Click a value to filter by it."
        action={
          <span className="flex gap-4">
            {before && <Link href={links.with({ before: undefined })}>NEWEST</Link>}
            {rows.length === PER_PAGE && <Link href={links.with({ before: String(rows[rows.length - 1].id) })}>OLDER -&gt;</Link>}
            <a href={exportHref} download>
              EXPORT CSV
            </a>
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[12px]">
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>Event</Th>
                <Th>Page</Th>
                <Th>Properties</Th>
                <Th>Source</Th>
                <Th>Session</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={String(e.id)} className="align-top hover:bg-line/4">
                  <Td className="whitespace-nowrap text-ink-400">{when(e.at, q.tz, true)}</Td>
                  <Td>
                    <Link href={links.filter("name", e.name)} className="text-ink-100! hover:text-accent!">
                      {e.name}
                    </Link>
                  </Td>
                  <Td className="max-w-[220px] truncate">
                    <Link href={links.filter("path", e.path)} className="text-ink-100! hover:text-accent!" title={e.path}>
                      {e.path}
                    </Link>
                  </Td>
                  <Td className="max-w-[360px]">
                    {e.props &&
                      Object.entries(e.props).map(([k, v]) => (
                        <Link
                          key={k}
                          href={links.filter(`prop.${k}`, String(v))}
                          className="mr-2 inline-block max-w-full truncate align-top text-ink-400! hover:text-accent!"
                          title={`${k} = ${String(v)}`}
                        >
                          <span className="text-ink-500">{k}=</span>
                          {String(v)}
                        </Link>
                      ))}
                  </Td>
                  <Td>
                    <Link href={links.filter("source", e.source)} className="text-ink-300! hover:text-accent!">
                      {e.source}
                    </Link>
                  </Td>
                  <Td>
                    <Link href={links.view("session", { id: e.sessionId })} className="font-mono text-ink-400! hover:text-accent!">
                      {e.sessionId.slice(0, 8)}
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="py-3 text-[12px] text-ink-500">No events match.</p>}
        </div>
      </Card>

      <div className="space-y-4">
        <Card title="Event names">
          <BarList rows={names} dim="name" links={links} metric="events" step={(k) => `e:${k}`} />
        </Card>
        <Card title="What they mean">
          <dl className="space-y-2 text-[11px]">
            {Object.entries(EVENT_NAMES).map(([k, v]) => (
              <div key={k}>
                <dt className="text-ink-100">
                  <Link href={links.view("breakdown", { name: k, a: "path" })}>{k}</Link>
                </dt>
                <dd className="text-ink-500">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] text-ink-500">
            Add a click event anywhere with <code>data-track=&quot;name&quot;</code> and <code>data-track-*</code> attributes, or call <code>track()</code> from{" "}
            <code>lib/analytics/client.ts</code>.
          </p>
        </Card>
      </div>
    </div>
  );
}
