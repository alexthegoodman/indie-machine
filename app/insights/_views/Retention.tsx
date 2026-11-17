import { Card, Td, Th } from "@/components/insights/ui";
import { retention } from "@/lib/analytics/reports";
import { exact, pct } from "@/lib/analytics/format";
import type { ViewProps } from "./types";

export async function Retention({ q }: ViewProps) {
  const cohorts = await retention(q);
  const weeks = Math.max(1, ...cohorts.map((c) => c.weeks.length));
  const totalSize = cohorts.reduce((s, c) => s + c.size, 0);
  // Weighted average for each week offset, over cohorts old enough to have that week.
  const avg = Array.from({ length: weeks }, (_, k) => {
    const eligible = cohorts.filter((c) => c.weeks.length > k);
    const size = eligible.reduce((s, c) => s + c.size, 0);
    return size ? eligible.reduce((s, c) => s + (c.weeks[k] ?? 0), 0) / size : null;
  });

  return (
    <Card
      title="Weekly retention"
      note="Visitors grouped by the week (Monday start) of their first ever visit, for first visits in this range that match the filters. Each cell is the share who came back in that week. Pick a longer range for more cohorts."
    >
      {cohorts.length ? (
        <div className="overflow-x-auto">
          <table className="text-[12px]">
            <caption className="sr-only">Share of each weekly cohort active in each following week</caption>
            <thead>
              <tr>
                <Th>Cohort</Th>
                <Th right>Visitors</Th>
                {Array.from({ length: weeks }, (_, k) => (
                  <Th key={k} right>
                    W{k}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="font-semibold">
                <Td className="text-ink-100">All</Td>
                <Td right className="text-ink-100">
                  {exact(totalSize)}
                </Td>
                {avg.map((a, k) => (
                  <Td key={k} right className="text-ink-100">
                    {a === null ? "" : pct(a, k ? 1 : 0)}
                  </Td>
                ))}
              </tr>
              {cohorts.map((c) => (
                <tr key={c.week}>
                  <Td className="whitespace-nowrap text-ink-100">{c.week}</Td>
                  <Td right>{exact(c.size)}</Td>
                  {Array.from({ length: weeks }, (_, k) => {
                    if (k >= c.weeks.length) return <Td key={k} />;
                    const share = c.size ? c.weeks[k] / c.size : 0;
                    return (
                      <td
                        key={k}
                        title={`${exact(c.weeks[k])} of ${exact(c.size)} visitors`}
                        className="border border-ink px-2 py-1.5 text-right tabular-nums text-ink-100"
                        style={{ background: k === 0 ? "rgb(79 216 255 / 0.2)" : `rgb(79 216 255 / ${0.06 + 0.9 * Math.min(1, share * 2)})`, color: share > 0.35 && k ? "var(--color-ink)" : undefined }}
                      >
                        {pct(share, k ? 1 : 0)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[12px] text-ink-500">No first-time visitors in this range.</p>
      )}
    </Card>
  );
}
