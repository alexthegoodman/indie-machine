import Link from "next/link";
import { Card, Td, Th } from "@/components/insights/ui";
import { breakdown, funnel } from "@/lib/analytics/reports";
import { duration, exact, pct } from "@/lib/analytics/format";
import { DIMENSIONS, all, isDim, one, parseStep, stepLabel, type Dim, type Step } from "@/lib/analytics/query";
import type { ViewProps } from "./types";

const MAX_STEPS = 6;
const DEFAULT_STEPS = ["p:/", "p:/posts/*", "e:outbound_click"];
const INPUT = "h-9 border border-line/28 bg-ink px-2 text-[12px] text-ink-100 focus:border-accent focus:outline-none";

export async function Funnels({ q, links, params }: ViewProps) {
  const given = all(params, "step").filter((s) => s.trim());
  const raw = given.length ? given : DEFAULT_STEPS;
  const steps = raw.map(parseStep).filter((s): s is Step => !!s).slice(0, MAX_STEPS);
  const scope = one(params, "scope") === "visitor" ? "visitor" : "session";
  const byRaw = one(params, "by");
  const by: Dim | undefined = byRaw && isDim(byRaw) ? byRaw : undefined;
  const [result, pages, names] = await Promise.all([
    funnel(q, steps, scope, by),
    breakdown(q, "path", { name: "pageview", limit: 30 }),
    breakdown(q, "name", { limit: 30 }),
  ]);
  const first = result.steps[0]?.count ?? 0;
  const unit = scope === "visitor" ? "visitors" : "sessions";

  return (
    <div className="space-y-4">
      <Card
        title="Funnel"
        note={
          <>
            Steps in order, each after the one before within the same {scope === "visitor" ? "visitor (across sessions)" : "session"}. A step is{" "}
            <code>p:/path</code> (a page view, <code>*</code> wildcard), <code>e:event</code>, or <code>e:event:prop=value</code>. Filters and segments above apply.
          </>
        }
      >
        <form method="get" action="/insights" className="space-y-3">
          {links.hidden(["step", "scope", "by"]).map(([k, v], i) => (
            <input key={`${k}-${i}`} type="hidden" name={k} value={v} />
          ))}
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: MAX_STEPS }, (_, i) => (
              <label key={i} className="flex items-center gap-2 text-[11px] text-ink-500">
                <span className="w-4 text-right">{i + 1}</span>
                <input name="step" list="ins-funnel-steps" defaultValue={raw[i] ?? ""} placeholder={i < 2 ? "required" : "optional"} className={`${INPUT} min-w-0 flex-1`} />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-[11px] text-ink-500">
              Count
              <select name="scope" defaultValue={scope} className={INPUT}>
                <option value="session">sessions</option>
                <option value="visitor">visitors</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-[11px] text-ink-500">
              Split by
              <select name="by" defaultValue={by ?? ""} className={INPUT}>
                <option value="">nothing</option>
                {Object.entries(DIMENSIONS)
                  .filter(([k]) => k !== "visitor" && k !== "session" && k !== "name")
                  .map(([k, d]) => (
                    <option key={k} value={k}>
                      {d.label}
                    </option>
                  ))}
              </select>
            </label>
            <button className="h-9 cursor-pointer border border-accent/50 px-4 text-[11px] tracking-[0.1em] text-accent hover:bg-accent/10">RUN</button>
          </div>
          <datalist id="ins-funnel-steps">
            {names.map((n) => (
              <option key={`e${n.key}`} value={`e:${n.key}`} />
            ))}
            {pages.map((p) => (
              <option key={`p${p.key}`} value={`p:${p.key}`} />
            ))}
          </datalist>
        </form>
      </Card>

      {steps.length > 0 && (
        <Card title="Result">
          <ol className="space-y-3">
            {steps.map((s, i) => {
              const c = result.steps[i]?.count ?? 0;
              const prev = i ? (result.steps[i - 1]?.count ?? 0) : c;
              const med = result.steps[i]?.medianSec;
              return (
                <li key={s.raw}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12px]">
                    <span className="text-ink-100">
                      <span className="mr-2 text-ink-500">{i + 1}.</span>
                      {stepLabel(s)}
                    </span>
                    <span className="tabular-nums">
                      <strong className="text-ink-100">{exact(c)}</strong> <span className="text-ink-500">{unit}</span>
                      {i > 0 && (
                        <span className="ml-3 text-ink-400">
                          {pct(prev ? c / prev : 0)} of previous · {pct(first ? c / first : 0)} overall
                          {med !== null && med !== undefined && <> · median {duration(med * 1000)} after</>}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 h-6 bg-line/6">
                    <div className="h-full rounded-r-[4px] bg-accent/70" style={{ width: `${first ? (c / first) * 100 : 0}%` }} />
                  </div>
                  <div className="mt-1 flex gap-3 text-[10px]">
                    <Link href={links.segment(s.raw)}>SESSIONS THAT DID THIS</Link>
                    {i > 0 && (
                      <Link href={links.view("sessions", { did: steps[i - 1].raw, didnt: s.raw })}>DROPPED HERE</Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {by && result.segments.length > 0 && (
        <Card title={`Split by ${DIMENSIONS[by as keyof typeof DIMENSIONS]?.label ?? by}`} note="Each one counted under the value from its first step-1 event.">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr>
                  <Th>{DIMENSIONS[by as keyof typeof DIMENSIONS]?.label ?? by}</Th>
                  {steps.map((s, i) => (
                    <Th key={s.raw} right>
                      Step {i + 1}
                    </Th>
                  ))}
                  <Th right>Conversion</Th>
                </tr>
              </thead>
              <tbody>
                {result.segments.map((r) => (
                  <tr key={r.key ?? "(none)"}>
                    <Td>
                      <Link href={links.filter(by, r.key)} className="text-ink-100! hover:text-accent!">
                        {r.key ?? "(none)"}
                      </Link>
                    </Td>
                    {r.counts.map((c, i) => (
                      <Td key={i} right>
                        {exact(c)}
                      </Td>
                    ))}
                    <Td right className="text-ink-100">
                      {pct(r.counts[0] ? r.counts[r.counts.length - 1] / r.counts[0] : 0, 1)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
