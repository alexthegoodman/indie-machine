import Link from "next/link";
import type { Links } from "@/lib/analytics/links";
import { DIMENSIONS, RANGES, dimLabel, one, stepLabel, type Query } from "@/lib/analytics/query";
import type { Params } from "@/lib/analytics/links";

const INPUT = "h-9 border border-line/28 bg-ink px-2 text-[12px] text-ink-100 focus:border-accent focus:outline-none";
const BUTTON = "h-9 cursor-pointer border border-accent/50 px-3 text-[11px] tracking-[0.1em] text-accent hover:bg-accent/10";

function Hidden({ links, except }: { links: Links; except: string[] }) {
  return (
    <>
      {links.hidden(except).map(([k, v], i) => (
        <input key={`${k}-${i}`} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

// One row of controls above every view: the date range first, then the filters and segments
// that scope everything below. Plain GET forms, so the URL is always the whole state.
export function FilterBar({
  q,
  links,
  params,
  suggestions,
}: {
  q: Query;
  links: Links;
  params: Params;
  suggestions: { pages: string[]; events: string[] };
}) {
  const fromValue = one(params, "from") ?? q.from.toISOString().slice(0, 10);
  const toValue = one(params, "to") ?? q.to.toISOString().slice(0, 10);
  const chips = [
    ...q.filters.map((f) => {
      const raw = `${f.neg ? "!" : ""}${f.dim}:${f.value}`;
      return { key: `f-${raw}`, text: `${dimLabel(f.dim)} ${f.neg ? "≠" : "="} ${f.value}`, remove: links.removeFilter(raw), flip: links.toggleFilter(raw) };
    }),
    ...q.did.map((s) => ({ key: `d-${s.raw}`, text: `Sessions that: ${stepLabel(s)}`, remove: links.removeSegment("did", s), flip: undefined })),
    ...q.didnt.map((s) => ({ key: `n-${s.raw}`, text: `Sessions that never: ${stepLabel(s)}`, remove: links.removeSegment("didnt", s), flip: undefined })),
  ];

  return (
    <div className="space-y-3 border-b border-line/14 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Date range" className="flex flex-wrap border border-line/22">
          {Object.entries(RANGES).map(([key, r]) => (
            <Link
              key={key}
              href={links.with({ range: key, from: undefined, to: undefined, page: undefined, before: undefined })}
              aria-current={q.range === key ? "true" : undefined}
              className={`px-3 py-2 text-[11px] tracking-[0.06em] ${q.range === key ? "bg-accent/14 text-accent!" : "text-ink-400! hover:text-ink-100!"}`}
              title={r.label}
            >
              {key.toUpperCase()}
            </Link>
          ))}
        </nav>
        <form method="get" action="/insights" className="flex flex-wrap items-center gap-1.5">
          <Hidden links={links} except={["range", "from", "to", "page", "before"]} />
          <input type="hidden" name="range" value="custom" />
          <label className="sr-only" htmlFor="ins-from">From</label>
          <input id="ins-from" type="date" name="from" defaultValue={fromValue} className={INPUT} />
          <span className="text-ink-500">to</span>
          <label className="sr-only" htmlFor="ins-to">To</label>
          <input id="ins-to" type="date" name="to" defaultValue={toValue} className={INPUT} />
          <button className={BUTTON}>APPLY</button>
        </form>
        <span className="ml-auto text-[11px] text-ink-500">
          {q.tz} · by {q.grain}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form method="get" action="/insights" className="flex flex-wrap items-center gap-1.5">
          <Hidden links={links} except={["page", "before", "fdim", "fval", "fneg"]} />
          <label className="sr-only" htmlFor="ins-fdim">Filter dimension</label>
          <select id="ins-fdim" name="fdim" className={INPUT} defaultValue="path">
            {Object.entries(DIMENSIONS).map(([k, d]) => (
              <option key={k} value={k}>
                {d.label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="ins-fneg">Match</label>
          <select id="ins-fneg" name="fneg" className={INPUT} defaultValue="">
            <option value="">is</option>
            <option value="1">is not</option>
          </select>
          <label className="sr-only" htmlFor="ins-fval">Value</label>
          <input id="ins-fval" name="fval" list="ins-pages" placeholder="value, * wildcard, prop: use Breakdown" className={`${INPUT} w-64`} />
          <button className={BUTTON}>+ FILTER</button>
        </form>
        <form method="get" action="/insights" className="flex flex-wrap items-center gap-1.5">
          <Hidden links={links} except={["page", "before", "seg", "segneg"]} />
          <label className="sr-only" htmlFor="ins-segneg">Segment</label>
          <select id="ins-segneg" name="segneg" className={INPUT} defaultValue="">
            <option value="">sessions that did</option>
            <option value="1">sessions that never</option>
          </select>
          <label className="sr-only" htmlFor="ins-seg">Step</label>
          <input id="ins-seg" name="seg" list="ins-steps" placeholder="p:/posts/*  or  e:outbound_click" className={`${INPUT} w-64`} />
          <button className={BUTTON}>+ SEGMENT</button>
        </form>
        <datalist id="ins-pages">
          {suggestions.pages.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <datalist id="ins-steps">
          {suggestions.events.map((e) => (
            <option key={`e-${e}`} value={`e:${e}`} />
          ))}
          {suggestions.pages.map((p) => (
            <option key={`p-${p}`} value={`p:${p}`} />
          ))}
        </datalist>
      </div>

      {chips.length > 0 && (
        <ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <li key={c.key} className="flex items-center border border-accent/40 bg-accent/8 text-[11px] text-ink-100">
              <span className="px-2.5 py-1.5">{c.text}</span>
              {c.flip && (
                <Link href={c.flip} className="border-l border-accent/30 px-2 py-1.5 text-ink-400! hover:text-accent!" title="Invert">
                  ⇄
                </Link>
              )}
              <Link href={c.remove} className="border-l border-accent/30 px-2 py-1.5 text-ink-400! hover:text-accent!" aria-label={`Remove ${c.text}`}>
                ✕
              </Link>
            </li>
          ))}
          <li>
            <Link href={links.with({ f: undefined, did: undefined, didnt: undefined, page: undefined, before: undefined })} className="text-[11px] text-ink-500! hover:text-accent!">
              CLEAR ALL
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}
