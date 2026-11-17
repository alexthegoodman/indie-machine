import Link from "next/link";
import { Card, Td, Th } from "@/components/insights/ui";
import { breakdown, flows, journey } from "@/lib/analytics/reports";
import { exact, pct } from "@/lib/analytics/format";
import { one } from "@/lib/analytics/query";
import type { ViewProps } from "./types";

function Side({ title, rows, total, links, pick }: { title: string; rows: { key: string | null; sessions: number }[]; total: number; links: ViewProps["links"]; pick: boolean }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-[10px] tracking-[0.14em] text-ink-500 uppercase">{title}</h3>
      <ul className="space-y-1 text-[12px]">
        {rows.map((r) => {
          const k = r.key ?? "";
          const special = k.startsWith("(");
          return (
            <li key={k} className="relative">
              <div aria-hidden className="absolute inset-y-0 left-0 rounded-r-[3px] bg-accent/14" style={{ width: `${(r.sessions / Math.max(1, total)) * 100}%` }} />
              <div className="relative flex items-center gap-2 px-2 py-1">
                {special || !pick ? (
                  <span className={`truncate ${special ? "text-ink-400" : "text-ink-100"}`}>{k}</span>
                ) : (
                  <Link href={links.with({ path: k })} className="truncate text-ink-100! hover:text-accent!" title="Follow this page">
                    {k}
                  </Link>
                )}
                <span className="ml-auto shrink-0 tabular-nums text-ink-100">{exact(r.sessions)}</span>
                <span className="w-10 shrink-0 text-right text-[10px] text-ink-500">{pct(r.sessions / Math.max(1, total))}</span>
              </div>
            </li>
          );
        })}
        {!rows.length && <li className="text-ink-500">Nothing yet.</li>}
      </ul>
    </div>
  );
}

export async function Journeys({ q, links, params }: ViewProps) {
  const top = await breakdown(q, "path", { name: "pageview", limit: 40 });
  const path = one(params, "path") || top[0]?.key || "/";
  const [j, f] = await Promise.all([journey(q, path), flows(q)]);

  return (
    <div className="space-y-4">
      <Card
        title="Page flow"
        note="Page views of the chosen page, with the page viewed just before it in the same session and just after. Click a page on either side to step along the path."
        action={
          <form method="get" action="/insights" className="flex items-center gap-1.5">
            {links.hidden(["path"]).map(([k, v], i) => (
              <input key={`${k}-${i}`} type="hidden" name={k} value={v} />
            ))}
            <label htmlFor="ins-jpath" className="sr-only">
              Page
            </label>
            <select id="ins-jpath" name="path" defaultValue={path} className="h-8 max-w-[260px] border border-line/28 bg-ink px-2 text-[12px] text-ink-100">
              {[path, ...top.map((t) => t.key!).filter((k) => k && k !== path)].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button className="h-8 cursor-pointer border border-accent/50 px-3 text-[11px] text-accent">GO</button>
          </form>
        }
      >
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <Side title="Came from" rows={j.prev} total={j.views} links={links} pick />
          <div className="self-center border border-accent/50 bg-accent/8 px-5 py-4 text-center">
            <div className="max-w-[260px] truncate font-display text-base font-semibold text-ink-100" title={path}>
              {path}
            </div>
            <div className="mt-1 text-[11px] text-ink-400">{exact(j.views)} views</div>
            <div className="mt-2 flex justify-center gap-3 text-[10px]">
              <Link href={links.filter("path", path)}>FILTER</Link>
              <Link href={links.segment(`p:${path}`)}>DID</Link>
            </div>
          </div>
          <Side title="Went to" rows={j.next} total={j.views} links={links} pick />
        </div>
      </Card>

      <Card title="Common paths" note="The first four distinct pages of each session, most common sequences first. Reloads of the same page are folded together.">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr>
                <Th>Path</Th>
                <Th right>Sessions</Th>
                <Th right>Avg pages</Th>
              </tr>
            </thead>
            <tbody>
              {f.map((r) => (
                <tr key={r.flow}>
                  <Td className="text-ink-100">
                    {r.flow.split(" > ").map((p, i) => (
                      <span key={i}>
                        {i > 0 && <span className="px-1.5 text-ink-500">→</span>}
                        {p === "..." ? (
                          <span className="text-ink-500">...</span>
                        ) : (
                          <Link href={links.with({ path: p })} className="text-ink-100! hover:text-accent!">
                            {p}
                          </Link>
                        )}
                      </span>
                    ))}
                  </Td>
                  <Td right>{exact(r.sessions)}</Td>
                  <Td right>{r.avgPages.toFixed(1)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          {!f.length && <p className="py-3 text-[12px] text-ink-500">No sessions in this range.</p>}
        </div>
      </Card>
    </div>
  );
}
