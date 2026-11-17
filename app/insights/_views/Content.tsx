import Link from "next/link";
import { BarList, Card, Rate, Td, Th } from "@/components/insights/ui";
import { breakdown, content, searches, vitals } from "@/lib/analytics/reports";
import { duration, exact, pct } from "@/lib/analytics/format";
import type { ViewProps } from "./types";

// Thresholds from web.dev: good at or under the first, poor above the second.
const VITAL_LIMITS: Record<string, [number, number, string]> = {
  LCP: [2500, 4000, "ms"],
  INP: [200, 500, "ms"],
  CLS: [0.1, 0.25, ""],
  FCP: [1800, 3000, "ms"],
  TTFB: [800, 1800, "ms"],
};

function vitalText(metric: string, v: number) {
  const unit = VITAL_LIMITS[metric]?.[2] ?? "";
  return unit ? `${exact(v)} ${unit}` : v.toFixed(3);
}

function vitalClass(metric: string, v: number) {
  const l = VITAL_LIMITS[metric];
  if (!l) return "text-ink-100";
  return v <= l[0] ? "text-accent" : v <= l[1] ? "text-ink-100" : "text-badge";
}

export async function Content({ q, links }: ViewProps) {
  const [rows, search, vit, vitPages, errors] = await Promise.all([
    content(q),
    searches(q),
    vitals(q),
    vitals(q, true),
    breakdown(q, "prop.msg", { name: "js_error", limit: 15 }),
  ]);

  return (
    <div className="space-y-4">
      <Card
        title="Pages"
        note="Engaged = visible, in-use time per session on the page. Read 50% / 100% = share of sessions whose article body reached that point (posts only). Exits = sessions that ended there."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-[12px]">
            <thead>
              <tr>
                <Th>Page</Th>
                <Th right>Views</Th>
                <Th right>Visitors</Th>
                <Th right>Engaged</Th>
                <Th right>Scroll</Th>
                <Th right>Read 50%</Th>
                <Th right>Read 100%</Th>
                <Th right>Entries</Th>
                <Th right>Exit rate</Th>
                <Th right>Outbound</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sessions = Math.max(1, r.sessions);
                const isPost = r.path.startsWith("/posts/");
                return (
                  <tr key={r.path} className="hover:bg-line/4">
                    <Td className="max-w-[340px] truncate">
                      <Link href={links.filter("path", r.path)} className="text-ink-100! hover:text-accent!" title={r.path}>
                        {r.path}
                      </Link>
                    </Td>
                    <Td right>{exact(r.views)}</Td>
                    <Td right>{exact(r.visitors)}</Td>
                    <Td right>{duration(r.avgEngagedMs)}</Td>
                    <Td right>{r.avgScroll === null ? "-" : `${Math.round(r.avgScroll)}%`}</Td>
                    <Td right>{isPost ? <Rate value={r.read50 / sessions} /> : "-"}</Td>
                    <Td right>{isPost ? <Rate value={r.read100 / sessions} /> : "-"}</Td>
                    <Td right>{exact(r.entries)}</Td>
                    <Td right>{pct(r.exits / Math.max(1, r.views))}</Td>
                    <Td right>{exact(r.outbound)}</Td>
                    <Td right>
                      <span className="flex justify-end gap-3 text-[10px]">
                        <Link href={links.view("journeys", { path: r.path })}>FLOW</Link>
                        <Link href={links.segment(`p:${r.path}`)}>DID</Link>
                        <a href={r.path} target="_blank" rel="noopener" aria-label={`Open ${r.path}`}>
                          ↗
                        </a>
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && <p className="py-3 text-[12px] text-ink-500">No page views in this range.</p>}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Searches" note="Queries typed into the search palette, once typing settled. Zero-result queries are content people looked for and didn't find.">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr>
                  <Th>Query</Th>
                  <Th right>Searches</Th>
                  <Th right>Results</Th>
                  <Th right>Opened</Th>
                </tr>
              </thead>
              <tbody>
                {search.map((s) => (
                  <tr key={s.q}>
                    <Td className="max-w-[260px] truncate">
                      <Link href={links.view("breakdown", { a: "path", name: "search_select", f: `prop.q:${s.q}` })} className="text-ink-100! hover:text-accent!">
                        {s.q}
                      </Link>
                    </Td>
                    <Td right>{exact(s.searches)}</Td>
                    <Td right className={s.results === 0 ? "text-badge" : ""}>
                      {s.results === null ? "-" : s.results === 0 ? "none" : exact(s.results)}
                    </Td>
                    <Td right>{exact(s.opened)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!search.length && <p className="py-3 text-[12px] text-ink-500">No searches in this range.</p>}
          </div>
        </Card>

        <Card title="Web vitals (p75)" note="75th percentile of real visits. Cyan = good, amber = poor by web.dev thresholds.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {["LCP", "INP", "CLS", "FCP", "TTFB"].map((m) => {
              const v = vit.find((x) => x.metric === m);
              return (
                <div key={m} className="border border-line/18 px-3 py-2">
                  <div className="text-[10px] tracking-[0.14em] text-ink-500">{m}</div>
                  <div className={`font-display text-lg font-semibold ${v ? vitalClass(m, v.p75) : "text-ink-500"}`}>{v ? vitalText(m, v.p75) : "-"}</div>
                  <div className="text-[10px] text-ink-500">{v ? `${pct(v.good)} good · ${exact(v.n)}` : "no samples"}</div>
                </div>
              );
            })}
          </div>
          {vitPages.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr>
                    <Th>Page</Th>
                    <Th>Metric</Th>
                    <Th right>p75</Th>
                    <Th right>Samples</Th>
                  </tr>
                </thead>
                <tbody>
                  {vitPages
                    .filter((v) => v.metric === "LCP" || v.metric === "INP" || v.metric === "CLS")
                    .slice(0, 15)
                    .map((v) => (
                      <tr key={`${v.path}-${v.metric}`}>
                        <Td className="max-w-[240px] truncate">
                          <Link href={links.filter("path", v.path!)} className="text-ink-100! hover:text-accent!">
                            {v.path}
                          </Link>
                        </Td>
                        <Td>{v.metric}</Td>
                        <Td right className={vitalClass(v.metric, v.p75)}>
                          {vitalText(v.metric, v.p75)}
                        </Td>
                        <Td right>{exact(v.n)}</Td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card title="Script errors" note="Uncaught errors in visitors' browsers (at most 5 per page load).">
        <BarList rows={errors} dim="prop.msg" links={links} metric="events" step={(k) => `e:js_error:msg=${k}`} empty="No script errors in this range." />
      </Card>
    </div>
  );
}
