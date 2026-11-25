import Link from "next/link";
import { BarList, Card, Kpi } from "@/components/insights/ui";
import { TimeChart } from "@/components/insights/TimeChart";
import { Heatmap } from "@/components/insights/Heatmap";
import { breakdown, heatmap, kpis, liveNow, series } from "@/lib/analytics/reports";
import { duration, exact, num, pct } from "@/lib/analytics/format";
import { one } from "@/lib/analytics/query";
import type { ViewProps } from "./types";

const METRICS = { visitors: "Visitors", sessions: "Sessions", pageviews: "Page views", events: "Events" } as const;
type Metric = keyof typeof METRICS;

export async function Overview({ q, links, params }: ViewProps) {
  const metric: Metric = (one(params, "metric") as Metric) in METRICS ? (one(params, "metric") as Metric) : "visitors";
  const [k, s, live, pages, sources, entries, countries, devices, browsers, oses, screens, campaigns, names, outbound, sections, heat] =
    await Promise.all([
      kpis(q),
      series(q),
      liveNow(),
      breakdown(q, "path", { name: "pageview" }),
      breakdown(q, "source"),
      breakdown(q, "entry"),
      breakdown(q, "country"),
      breakdown(q, "device"),
      breakdown(q, "browser"),
      breakdown(q, "os"),
      breakdown(q, "screen"),
      breakdown(q, "utm_campaign"),
      breakdown(q, "name", { limit: 20 }),
      breakdown(q, "prop.host", { name: "outbound_click" }),
      breakdown(q, "section", { name: "pageview" }),
      heatmap(q),
    ]);
  const total = k.now.visitors;
  const { now, prev } = k;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        <div className="min-w-0 border border-accent/40 bg-accent/5 px-4 py-3" title="Visitors with any event in the last 5 minutes">
          <div className="flex items-center gap-2 text-[10px] tracking-[0.14em] text-accent uppercase">
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> Live now
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-ink-100 tabular-nums">{exact(live.visitors)}</div>
          <div className="mt-0.5 truncate text-[11px] text-ink-500">{live.pages[0] ? `top: ${live.pages[0].path}` : "nobody right now"}</div>
        </div>
        <Kpi label="Visitors" value={num(now.visitors)} now={now.visitors} prev={prev.visitors} hint="Distinct browsers" />
        <Kpi label="New visitors" value={num(now.newVisitors)} now={now.newVisitors} prev={prev.newVisitors} hint="First event ever falls in this range" />
        <Kpi label="Sessions" value={num(now.sessions)} now={now.sessions} prev={prev.sessions} />
        <Kpi label="Page views" value={num(now.pageviews)} now={now.pageviews} prev={prev.pageviews} />
        <Kpi label="Engaged / session" value={duration(now.avgEngagedMs)} now={now.avgEngagedMs} prev={prev.avgEngagedMs} hint="Visible, in-use time on the page" />
        <Kpi label="Pages / session" value={now.pagesPerSession.toFixed(2)} now={now.pagesPerSession} prev={prev.pagesPerSession} />
        <Kpi label="Bounce rate" value={pct(now.bounceRate)} now={now.bounceRate} prev={prev.bounceRate} invert hint="Sessions with a single page view" />
      </div>

      <Card
        title={METRICS[metric]}
        action={
          <nav aria-label="Chart measure" className="flex gap-3">
            {(Object.keys(METRICS) as Metric[]).map((m) => (
              <Link key={m} href={links.with({ metric: m === "visitors" ? undefined : m })} aria-current={m === metric ? "true" : undefined} className={m === metric ? "text-accent!" : "text-ink-500! hover:text-ink-100!"}>
                {METRICS[m].toUpperCase()}
              </Link>
            ))}
          </nav>
        }
      >
        <TimeChart
          label={METRICS[metric]}
          grain={q.grain}
          points={s.now.map((p) => ({ t: p.t, v: p[metric] }))}
          prev={s.prev.map((p) => ({ t: p.t, v: p[metric] }))}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <Card title="Top pages" action={<Link href={links.view("content")}>ALL CONTENT -&gt;</Link>}>
          <BarList rows={pages} dim="path" links={links} total={total} step={(k) => `p:${k}`} />
        </Card>
        <Card title="Sources" note="Referring site of the session; direct includes apps and private links.">
          <BarList rows={sources} dim="source" links={links} total={total} />
        </Card>
        <Card title="Landing pages">
          <BarList rows={entries} dim="entry" links={links} total={total} />
        </Card>
        <Card title="Sections">
          <BarList rows={sections} dim="section" links={links} total={total} />
        </Card>
        <Card title="Countries" action={<Link href={links.view("map")}>MAP -&gt;</Link>} note={countries.every((r) => r.key === null) ? "Countries come from Vercel's edge headers, so local runs have none." : undefined}>
          <BarList rows={countries} dim="country" links={links} total={total} />
        </Card>
        <Card title="UTM campaigns" note="utm_campaign on the landing URL. ?ref= counts as a UTM source.">
          <BarList rows={campaigns} dim="utm_campaign" links={links} total={total} empty="No tagged campaigns in this range." />
        </Card>
        <Card title="Devices">
          <BarList rows={devices} dim="device" links={links} total={total} />
        </Card>
        <Card title="Browsers">
          <BarList rows={browsers} dim="browser" links={links} total={total} />
        </Card>
        <Card title="Operating systems">
          <BarList rows={oses} dim="os" links={links} total={total} />
        </Card>
        <Card title="Screen widths">
          <BarList rows={screens} dim="screen" links={links} total={total} />
        </Card>
        <Card title="Outbound clicks" note="Hosts visitors left for. Share is of all visitors in range." action={<Link href={links.view("breakdown", { a: "prop.href", name: "outbound_click" })}>BY URL -&gt;</Link>}>
          <BarList rows={outbound} dim="prop.host" links={links} total={total} step={(k) => `e:outbound_click:host=${k}`} empty="No outbound clicks in this range." />
        </Card>
        <Card title="Events" action={<Link href={links.view("events")}>EXPLORE -&gt;</Link>}>
          <BarList rows={names} dim="name" links={links} metric="events" step={(k) => `e:${k}`} />
        </Card>
      </div>

      <Card title="When people visit" note="Sessions with a page view, by weekday and hour.">
        <Heatmap cells={heat} tz={q.tz} />
      </Card>
    </div>
  );
}
