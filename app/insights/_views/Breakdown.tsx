import Link from "next/link";
import { BarList, Card, Td, Th } from "@/components/insights/ui";
import { breakdown, crosstab, propKeys } from "@/lib/analytics/reports";
import { exact, pct } from "@/lib/analytics/format";
import { DIMENSIONS, dimLabel, isDim, one, type Dim } from "@/lib/analytics/query";
import type { ViewProps } from "./types";

const INPUT = "h-9 border border-line/28 bg-ink px-2 text-[12px] text-ink-100 focus:border-accent focus:outline-none";

function DimSelect({ name, value, props, allowNone }: { name: string; value?: Dim; props: string[]; allowNone?: boolean }) {
  return (
    <select name={name} defaultValue={value ?? ""} className={INPUT}>
      {allowNone && <option value="">nothing</option>}
      {Object.entries(DIMENSIONS).map(([k, d]) => (
        <option key={k} value={k}>
          {d.label}
        </option>
      ))}
      {props.length > 0 && (
        <optgroup label="Event properties">
          {props.map((p) => (
            <option key={p} value={`prop.${p}`}>
              {p}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

// Group any slice by any dimension or event property, optionally against a second one.
export async function Breakdown({ q, links, params }: ViewProps) {
  const aRaw = one(params, "a") ?? "source";
  const bRaw = one(params, "b") ?? "";
  const a: Dim = isDim(aRaw) ? aRaw : "source";
  const b: Dim | undefined = bRaw && isDim(bRaw) && bRaw !== a ? bRaw : undefined;
  const name = one(params, "name") || undefined;
  const [names, keys] = await Promise.all([breakdown(q, "name", { limit: 40 }), name ? propKeys(q, name) : Promise.resolve([])]);
  const propNames = keys.map((k) => k.key);
  for (const d of [a, b]) if (d?.startsWith("prop.") && !propNames.includes(d.slice(5))) propNames.push(d.slice(5));

  const [rows, cross] = await Promise.all([
    b ? Promise.resolve([]) : breakdown(q, a, { name, limit: 100 }),
    b ? crosstab(q, a, b, name) : Promise.resolve(null),
  ]);
  const total = rows.reduce((s, r) => Math.max(s, r.visitors), 0);

  return (
    <div className="space-y-4">
      <Card title="Breakdown" note="Visitors by one dimension, or two against each other. Pick an event to count only those events and to group by their properties (outbound_click by href, search by q, ...).">
        <form method="get" action="/insights" className="flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
          {links.hidden(["a", "b", "name"]).map(([k, v], i) => (
            <input key={`${k}-${i}`} type="hidden" name={k} value={v} />
          ))}
          <label className="flex items-center gap-2">
            Event
            <select name="name" defaultValue={name ?? ""} className={INPUT}>
              <option value="">any</option>
              {names.map((n) => (
                <option key={n.key} value={n.key ?? ""}>
                  {n.key} ({exact(n.events)})
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            Rows
            <DimSelect name="a" value={a} props={propNames} />
          </label>
          <label className="flex items-center gap-2">
            Columns
            <DimSelect name="b" value={b} props={propNames} allowNone />
          </label>
          <button className="h-9 cursor-pointer border border-accent/50 px-4 text-[11px] tracking-[0.1em] text-accent hover:bg-accent/10">APPLY</button>
        </form>
        {name && keys.length > 0 && (
          <p className="mt-3 text-[11px] text-ink-500">
            Properties on {name}:{" "}
            {keys.map((k, i) => (
              <span key={k.key}>
                {i > 0 && ", "}
                <Link href={links.with({ a: `prop.${k.key}` })}>{k.key}</Link> <span className="text-ink-500">({exact(k.n)})</span>
              </span>
            ))}
          </p>
        )}
      </Card>

      {!b && (
        <Card title={`${dimLabel(a)}${name ? ` · ${name}` : ""}`}>
          <BarList
            rows={rows}
            dim={a}
            links={links}
            total={total || undefined}
            metric={name ? "events" : "visitors"}
            step={a === "path" ? (k) => `p:${k}` : a === "name" ? (k) => `e:${k}` : name && a.startsWith("prop.") ? (k) => `e:${name}:${a.slice(5)}=${k}` : undefined}
          />
        </Card>
      )}

      {b && cross && (
        <Card title={`${dimLabel(a)} × ${dimLabel(b)}`} note="Visitors in each combination. Shading is the share of the row, so rows compare by mix, not by size. Click a cell to see those sessions.">
          <div className="overflow-x-auto">
            <table className="text-[12px]">
              <thead>
                <tr>
                  <Th>{dimLabel(a)}</Th>
                  <Th right>All</Th>
                  {cross.cols.map((c) => (
                    <Th key={c} right>
                      <span className="inline-block max-w-[140px] truncate align-bottom normal-case" title={c}>
                        {c}
                      </span>
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cross.rows.map((r) => {
                  const rowTotal = cross.rowTotals.get(r) ?? 0;
                  return (
                    <tr key={r}>
                      <Td className="max-w-[260px] truncate">
                        <Link href={links.filter(a, r === "(none)" ? null : r)} className="text-ink-100! hover:text-accent!" title={r}>
                          {r}
                        </Link>
                      </Td>
                      <Td right className="text-ink-100">
                        {exact(rowTotal)}
                      </Td>
                      {cross.cols.map((c) => {
                        const n = cross.cells.get(`${r}\u0000${c}`) ?? 0;
                        const share = rowTotal ? n / rowTotal : 0;
                        const href = `${links.filter(a, r === "(none)" ? null : r)}`;
                        const both = new URL(href, "http://x").searchParams;
                        both.append("f", `${b}:${c}`);
                        both.set("view", "sessions");
                        for (const k of ["a", "b", "name"]) both.delete(k);
                        return (
                          <td key={c} className="border border-ink p-0 text-right tabular-nums" style={{ background: n ? `rgb(79 216 255 / ${0.06 + 0.6 * share})` : undefined }}>
                            {n ? (
                              <Link href={`/insights?${both}`} className="block px-2 py-1.5 text-ink-100!" title={`${exact(n)} visitors, ${pct(share)} of ${r}`}>
                                {exact(n)}
                              </Link>
                            ) : (
                              <span className="block px-2 py-1.5 text-ink-500">·</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
