import Link from "next/link";
import { Card, Td, Th } from "@/components/insights/ui";
import { surveyCounts, surveyPairs, surveyResponses, surveyTotals, type Count, type Pair } from "@/lib/analytics/survey";
import { exact, pct, when } from "@/lib/analytics/format";
import { queryParams } from "@/lib/analytics/query";
import { asks, choiceLabel, QUESTIONS, SURVEY_MODE, SURVEY_VERSION, type Question } from "@/lib/survey";
import type { ViewProps } from "./types";

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 border border-line/22 px-4 py-3">
      <div className="text-[10px] tracking-[0.14em] text-ink-500 uppercase">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold text-ink-100 tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-500">{hint}</div>}
    </div>
  );
}

/** Every choice of a question, answered or not, with its share of responses. */
function Answers({ q, counts, total }: { q: Question; counts: Count[]; total: number }) {
  const by = new Map(counts.map((c) => [c.key, c.n]));
  const rows = q.choices.map((c) => ({ key: c.key, label: c.label, n: by.get(c.key) ?? 0 })).sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <table className="w-full table-fixed text-[12px]">
      <tbody>
        {rows.map((r) => (
          <tr key={r.key}>
            <td className="relative py-0.5 pr-2">
              <div aria-hidden className="absolute inset-y-0.5 left-0 rounded-r-[3px] bg-accent/14" style={{ width: `${(r.n / max) * 100}%` }} />
              <div className="relative truncate px-2 py-1 text-ink-100">{r.label}</div>
            </td>
            <td className="w-24 py-0.5 text-right tabular-nums">
              <span className="text-ink-100">{exact(r.n)}</span>
              <span className="ml-1.5 inline-block w-9 text-[10px] text-ink-500">{pct(total ? r.n / total : 0)}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A count table of two answers against each other, shaded by share of the row. */
function Cross({
  pairs,
  rowLabel,
  colLabel,
  row,
  col,
  maxCols = 10,
}: {
  pairs: Pair[];
  rowLabel: string;
  colLabel: string;
  row: (k: string | null) => string;
  col: (k: string | null) => string;
  maxCols?: number;
}) {
  if (!pairs.length) return <p className="text-[12px] text-ink-500">No responses in this range.</p>;
  const sum = (key: "a" | "b") => {
    const m = new Map<string, number>();
    for (const p of pairs) m.set(String(p[key]), (m.get(String(p[key])) ?? 0) + p.n);
    return [...m].sort((x, y) => y[1] - x[1]);
  };
  const rows = sum("a");
  const cols = sum("b").slice(0, maxCols);
  const cell = new Map(pairs.map((p) => [`${p.a}\u0000${p.b}`, p.n]));
  const name = (k: string, f: (k: string | null) => string) => f(k === "null" ? null : k);
  return (
    <div className="overflow-x-auto">
      <table className="text-[12px]">
        <thead>
          <tr>
            <Th>
              {rowLabel} \ {colLabel}
            </Th>
            <Th right>All</Th>
            {cols.map(([c]) => (
              <Th key={c} right>
                <span className="inline-block max-w-[140px] truncate align-bottom normal-case" title={name(c, col)}>
                  {name(c, col)}
                </span>
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([r, total]) => (
            <tr key={r}>
              <Td className="max-w-[260px] truncate text-ink-100">{name(r, row)}</Td>
              <Td right className="text-ink-100">
                {exact(total)}
              </Td>
              {cols.map(([c]) => {
                const n = cell.get(`${r}\u0000${c}`) ?? 0;
                const share = total ? n / total : 0;
                return (
                  <td
                    key={c}
                    className="border border-ink px-2 py-1.5 text-right tabular-nums"
                    style={{ background: n ? `rgb(79 216 255 / ${0.06 + 0.6 * share})` : undefined }}
                    title={n ? `${exact(n)}, ${pct(share)} of ${name(r, row)}` : undefined}
                  >
                    {n ? <span className="text-ink-100">{exact(n)}</span> : <span className="text-ink-500">·</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const work = (k: string | null) => choiceLabel("work", k);
const found = (k: string | null) => choiceLabel("found", k);
const plain = (k: string | null) => k ?? "(none)";

// What readers said in the survey that opens every post (lib/survey.ts).
export async function Survey({ q, links, params }: ViewProps) {
  // Only the questions asked now (lib/survey.ts); one left out keeps its old answers in the CSV.
  const working = asks("work");
  const [totals, byWork, byFound, workFound, foundSource, byPath, detailed, latest] = await Promise.all([
    surveyTotals(q),
    working ? surveyCounts(q, "work") : [],
    surveyCounts(q, "found"),
    working ? surveyPairs(q, "work", "found") : [],
    surveyPairs(q, "found", "source"),
    surveyCounts(q, "path", 15),
    surveyResponses(q, { limit: 100, detailOnly: true }),
    surveyResponses(q, { limit: 50 }),
  ]);
  const exportHref = `/insights/export?${new URLSearchParams([...queryParams(q, params), ["kind", "survey"]])}`;

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-ink-500">
        Survey v{SURVEY_VERSION}, mode <span className="text-ink-300">{SURVEY_MODE}</span> (set in lib/survey.ts). Only the date range
        applies here; the event filters above don&apos;t. <a href={exportHref}>EXPORT CSV</a>
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Responses" value={exact(totals.responses)} />
        <Tile label="Shown to" value={exact(totals.shown)} hint="visitors who hit the gate" />
        <Tile
          label="Answer rate"
          value={totals.shown ? pct(totals.answered / totals.shown) : "-"}
          hint={totals.skipped ? `${exact(totals.skipped)} skipped` : "the rest left at the gate"}
        />
        <Tile label="With free text" value={exact(totals.withDetail)} hint={totals.responses ? pct(totals.withDetail / totals.responses) : undefined} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {QUESTIONS.map((x) => (
          <Card key={x.id} title={x.label}>
            <Answers q={x} counts={x.id === "work" ? byWork : byFound} total={totals.responses} />
          </Card>
        ))}
      </div>

      {working && (
        <Card title="Working on × found us through" note="Responses in each combination, shaded by share of the row.">
          <Cross pairs={workFound} rowLabel="Working on" colLabel="Found via" row={work} col={found} />
        </Card>
      )}

      <Card
        title="What they said vs. where the browser came from"
        note="Self-reported answer against the session's referrer. Search and AI assistants often arrive as 'direct', which is the gap this question fills."
      >
        <Cross pairs={foundSource} rowLabel="Said" colLabel="Referrer" row={found} col={plain} />
      </Card>

      <Card title="In their own words" note="Every response with free text, newest first.">
        {detailed.length ? (
          <ul className="space-y-3 text-[12px]">
            {detailed.map((r) => (
              <li key={r.id} className="border-l-2 border-accent/40 pl-3">
                {r.workDetail && <p className="text-[13px] leading-relaxed text-ink-100">&ldquo;{r.workDetail}&rdquo;</p>}
                {r.foundDetail && <p className="mt-1 text-ink-300">Found us: &ldquo;{r.foundDetail}&rdquo;</p>}
                <p className="mt-1 text-[11px] text-ink-500">
                  {r.work ? `${work(r.work)} · ` : ""}
                  {found(r.found)} · {r.source}
                  {r.country ? ` · ${r.country}` : ""} · {when(r.at, q.tz)} ·{" "}
                  <Link href={links.view("visitor", { id: r.visitorId })} className="text-ink-400! hover:text-accent!">
                    visitor
                  </Link>
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-ink-500">No free-text answers in this range.</p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card title="Answered on">
          {byPath.length ? (
            <table className="w-full table-fixed text-[12px]">
              <tbody>
                {byPath.map((p) => (
                  <tr key={p.key}>
                    <Td className="truncate">
                      <Link href={links.view("content", { f: `path:${p.key}` })} className="text-ink-100! hover:text-accent!" title={p.key ?? ""}>
                        {p.key}
                      </Link>
                    </Td>
                    <Td right className="w-14">
                      {exact(p.n)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[12px] text-ink-500">No responses in this range.</p>
          )}
        </Card>

        <Card title="Latest responses">
          {latest.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr>
                    <Th>When</Th>
                    {working && <Th>Working on</Th>}
                    <Th>Found via</Th>
                    <Th>Referrer</Th>
                    <Th>Country</Th>
                    <Th>Device</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {latest.map((r) => (
                    <tr key={r.id}>
                      <Td className="whitespace-nowrap text-ink-400">{when(r.at, q.tz)}</Td>
                      {working && <Td className="text-ink-100">{work(r.work)}</Td>}
                      <Td className="text-ink-100">{found(r.found)}</Td>
                      <Td>{r.utmSource ? `${r.source} (${r.utmSource})` : r.source}</Td>
                      <Td>{r.country ?? "-"}</Td>
                      <Td>{r.device}</Td>
                      <Td>
                        <Link href={links.view("session", { id: r.sessionId })} className="text-ink-400! hover:text-accent!">
                          session
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[12px] text-ink-500">No responses in this range.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
