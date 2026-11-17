// The /insights reports. Each takes a parsed Query (lib/analytics/query.ts) and runs plain SQL
// against analytics_events; counts are cast to int/float8 in SQL so no BigInt reaches the page.
import { db } from "@/lib/allegiance/db";
import { Prisma } from "../../generated/prisma/client";
import {
  dimExpr,
  engagedMs,
  local,
  numProp,
  stepSql,
  ts,
  where,
  type Dim,
  type Query,
  type Sql,
  type Step,
} from "./query";

const sql = Prisma.sql;

/**
 * A dashboard view runs a dozen-plus reports at once. Cap how many hit the database together:
 * serverless instances share a small connection budget, and the local `prisma dev` server drops
 * every connection when several heavy queries arrive at once. ANALYTICS_DB_CONCURRENCY overrides.
 */
const LIMIT = Math.max(1, Number(process.env.ANALYTICS_DB_CONCURRENCY) || (process.env.NODE_ENV === "production" ? 4 : 1));
let active = 0;
const waiting: (() => void)[] = [];

async function run<T>(q: Sql): Promise<T[]> {
  if (active >= LIMIT) await new Promise<void>((r) => waiting.push(r));
  active++;
  try {
    return await db().$queryRaw<T[]>(q);
  } finally {
    active--;
    waiting.shift()?.();
  }
}

// --- Overview --------------------------------------------------------------------------------

export type Kpis = {
  visitors: number;
  newVisitors: number;
  sessions: number;
  pageviews: number;
  events: number;
  avgEngagedMs: number;
  bounceRate: number;
  pagesPerSession: number;
};

async function kpisFor(q: Query, prev: boolean): Promise<Kpis> {
  const from = prev ? q.prevFrom : q.from;
  const [r] = await run<Kpis>(sql`
    WITH ev AS (SELECT * FROM analytics_events e WHERE ${where(q, { prev })}),
    sess AS (
      SELECT e."sessionId", count(*) FILTER (WHERE e.name = 'pageview') AS pv,
             COALESCE(sum(${engagedMs()}) FILTER (WHERE e.name = 'engage'), 0) AS ms
      FROM ev e GROUP BY 1
    ),
    vis AS (SELECT DISTINCT "visitorId" FROM ev)
    SELECT
      (SELECT count(*) FROM vis)::int AS "visitors",
      (SELECT count(*) FROM vis v WHERE NOT EXISTS (
        SELECT 1 FROM analytics_events o WHERE o."visitorId" = v."visitorId" AND o."at" < ${ts(from)}))::int AS "newVisitors",
      (SELECT count(*) FROM sess)::int AS "sessions",
      (SELECT count(*) FROM ev WHERE name = 'pageview')::int AS "pageviews",
      (SELECT count(*) FROM ev)::int AS "events",
      COALESCE((SELECT avg(ms) FROM sess), 0)::float8 AS "avgEngagedMs",
      COALESCE((SELECT avg(CASE WHEN pv <= 1 THEN 1 ELSE 0 END) FROM sess WHERE pv > 0), 0)::float8 AS "bounceRate",
      COALESCE((SELECT avg(pv) FROM sess WHERE pv > 0), 0)::float8 AS "pagesPerSession"
  `);
  return r;
}

export async function kpis(q: Query): Promise<{ now: Kpis; prev: Kpis }> {
  const [now, prev] = await Promise.all([kpisFor(q, false), kpisFor(q, true)]);
  return { now, prev };
}

export type SeriesPoint = { t: string; visitors: number; sessions: number; pageviews: number; events: number };

async function seriesFor(q: Query, prev: boolean): Promise<SeriesPoint[]> {
  const from = prev ? q.prevFrom : q.from;
  const to = prev ? q.prevTo : q.to;
  const step = `1 ${q.grain}`;
  return run<SeriesPoint>(sql`
    WITH b AS (
      SELECT generate_series(
        date_trunc(${q.grain}, ${local(q, ts(from))}),
        ${local(q, ts(new Date(to.getTime() - 1)))},
        ${step}::interval
      ) AS t
    ),
    ev AS (
      SELECT date_trunc(${q.grain}, ${local(q, sql`e."at"`)}) AS t, e."visitorId", e."sessionId", e.name
      FROM analytics_events e WHERE ${where(q, { prev })}
    )
    SELECT to_char(b.t, 'YYYY-MM-DD"T"HH24:MI') AS t,
      count(DISTINCT ev."visitorId")::int AS "visitors",
      count(DISTINCT ev."sessionId")::int AS "sessions",
      (count(ev.name) FILTER (WHERE ev.name = 'pageview'))::int AS "pageviews",
      count(ev.name)::int AS "events"
    FROM b LEFT JOIN ev ON ev.t = b.t
    GROUP BY b.t ORDER BY b.t
  `);
}

export async function series(q: Query): Promise<{ now: SeriesPoint[]; prev: SeriesPoint[] }> {
  const [now, prev] = await Promise.all([seriesFor(q, false), seriesFor(q, true)]);
  return { now, prev };
}

export type Row = { key: string | null; visitors: number; sessions: number; events: number };

/** Top values of a dimension. `name` limits it to one event type ("pageview" for top pages). */
export async function breakdown(q: Query, dim: Dim, opts: { name?: string; limit?: number } = {}): Promise<Row[]> {
  const name = opts.name ? sql`AND e.name = ${opts.name}` : Prisma.empty;
  return run<Row>(sql`
    SELECT ${dimExpr(dim)} AS key,
      count(DISTINCT e."visitorId")::int AS "visitors",
      count(DISTINCT e."sessionId")::int AS "sessions",
      count(*)::int AS "events"
    FROM analytics_events e
    WHERE ${where(q)} ${name}
    GROUP BY 1 ORDER BY "visitors" DESC, "events" DESC, 1
    LIMIT ${opts.limit ?? 10}
  `);
}

export type Cross = { rows: string[]; cols: string[]; cells: Map<string, number>; rowTotals: Map<string, number> };

/** Visitors by two dimensions at once, top `maxRows` x `maxCols` values. */
export async function crosstab(q: Query, a: Dim, b: Dim, name: string | undefined, maxRows = 15, maxCols = 8): Promise<Cross> {
  const nameSql = name ? sql`AND e.name = ${name}` : Prisma.empty;
  const raw = await run<{ a: string | null; b: string | null; n: number; at: number; bt: number }>(sql`
    WITH ev AS (SELECT ${dimExpr(a)} AS a, ${dimExpr(b)} AS b, e."visitorId" FROM analytics_events e WHERE ${where(q)} ${nameSql}),
    ta AS (SELECT a, count(DISTINCT "visitorId") n FROM ev GROUP BY a ORDER BY n DESC LIMIT ${maxRows}),
    tb AS (SELECT b, count(DISTINCT "visitorId") n FROM ev GROUP BY b ORDER BY n DESC LIMIT ${maxCols})
    SELECT ev.a, ev.b, count(DISTINCT ev."visitorId")::int AS n, ta.n::int AS at, tb.n::int AS bt
    FROM ev JOIN ta ON ta.a IS NOT DISTINCT FROM ev.a JOIN tb ON tb.b IS NOT DISTINCT FROM ev.b
    GROUP BY ev.a, ev.b, ta.n, tb.n
  `);
  const label = (v: string | null) => v ?? "(none)";
  const rowTotals = new Map<string, number>();
  const colTotals = new Map<string, number>();
  const cells = new Map<string, number>();
  for (const r of raw) {
    rowTotals.set(label(r.a), r.at);
    colTotals.set(label(r.b), r.bt);
    cells.set(`${label(r.a)}\u0000${label(r.b)}`, r.n);
  }
  const byTotal = (m: Map<string, number>) => [...m.entries()].sort((x, y) => y[1] - x[1]).map(([k]) => k);
  return { rows: byTotal(rowTotals), cols: byTotal(colTotals), cells, rowTotals };
}

/** Sessions with a page view, by weekday (1 = Monday) and hour, in the query's zone. */
export async function heatmap(q: Query): Promise<{ dow: number; hour: number; n: number }[]> {
  return run(sql`
    SELECT extract(isodow FROM ${local(q, sql`e."at"`)})::int AS dow,
           extract(hour FROM ${local(q, sql`e."at"`)})::int AS hour,
           count(DISTINCT e."sessionId")::int AS n
    FROM analytics_events e WHERE ${where(q)} AND e.name = 'pageview'
    GROUP BY 1, 2
  `);
}

export async function liveNow(): Promise<{ visitors: number; pages: { path: string; n: number }[] }> {
  const since = ts(new Date(Date.now() - 5 * 60_000));
  const [v] = await run<{ n: number }>(sql`SELECT count(DISTINCT "visitorId")::int AS n FROM analytics_events WHERE "at" >= ${since}`);
  const pages = await run<{ path: string; n: number }>(sql`
    SELECT path, count(DISTINCT "visitorId")::int AS n FROM analytics_events
    WHERE "at" >= ${since} AND name = 'pageview' GROUP BY 1 ORDER BY 2 DESC LIMIT 5
  `);
  return { visitors: v.n, pages };
}

// --- Content ---------------------------------------------------------------------------------

export type ContentRow = {
  path: string;
  views: number;
  visitors: number;
  sessions: number;
  entries: number;
  exits: number;
  avgEngagedMs: number;
  avgScroll: number | null;
  read50: number;
  read100: number;
  outbound: number;
};

export async function content(q: Query, limit = 100): Promise<ContentRow[]> {
  return run<ContentRow>(sql`
    WITH ev AS (SELECT * FROM analytics_events e WHERE ${where(q)}),
    pv AS (
      SELECT path, count(*) AS views, count(DISTINCT "visitorId") AS visitors, count(DISTINCT "sessionId") AS sessions
      FROM ev WHERE name = 'pageview' GROUP BY path
    ),
    eng AS (
      SELECT path, sum(ms) AS ms, avg(scroll) AS scroll FROM (
        SELECT e.path, e."sessionId", sum(${engagedMs()}) AS ms, max(${numProp("scroll")}) AS scroll
        FROM ev e WHERE e.name = 'engage' GROUP BY 1, 2
      ) x GROUP BY path
    ),
    rd AS (
      SELECT e.path,
        count(DISTINCT e."sessionId") FILTER (WHERE ${numProp("pct")} >= 50) AS r50,
        count(DISTINCT e."sessionId") FILTER (WHERE ${numProp("pct")} >= 100) AS r100
      FROM ev e WHERE e.name = 'read_depth' GROUP BY 1
    ),
    ent AS (
      SELECT path, count(*) AS n FROM (
        SELECT DISTINCT ON ("sessionId") "sessionId", path FROM ev WHERE name = 'pageview' ORDER BY "sessionId", "at", id
      ) x GROUP BY path
    ),
    ex AS (
      SELECT path, count(*) AS n FROM (
        SELECT DISTINCT ON ("sessionId") "sessionId", path FROM ev WHERE name = 'pageview' ORDER BY "sessionId", "at" DESC, id DESC
      ) x GROUP BY path
    ),
    ob AS (SELECT path, count(*) AS n FROM ev WHERE name = 'outbound_click' GROUP BY path)
    SELECT pv.path,
      pv.views::int AS "views", pv.visitors::int AS "visitors", pv.sessions::int AS "sessions",
      COALESCE(ent.n, 0)::int AS "entries", COALESCE(ex.n, 0)::int AS "exits",
      (COALESCE(eng.ms, 0) / pv.sessions)::float8 AS "avgEngagedMs",
      eng.scroll::float8 AS "avgScroll",
      COALESCE(rd.r50, 0)::int AS "read50", COALESCE(rd.r100, 0)::int AS "read100",
      COALESCE(ob.n, 0)::int AS "outbound"
    FROM pv
    LEFT JOIN eng ON eng.path = pv.path LEFT JOIN rd ON rd.path = pv.path
    LEFT JOIN ent ON ent.path = pv.path LEFT JOIN ex ON ex.path = pv.path LEFT JOIN ob ON ob.path = pv.path
    ORDER BY pv.views DESC, pv.path LIMIT ${limit}
  `);
}

export type SearchRow = { q: string; searches: number; sessions: number; results: number | null; opened: number };

export async function searches(q: Query, limit = 30): Promise<SearchRow[]> {
  return run<SearchRow>(sql`
    SELECT lower(e."props"->>'q') AS q,
      (count(*) FILTER (WHERE e.name = 'search'))::int AS "searches",
      count(DISTINCT e."sessionId")::int AS "sessions",
      (max(${numProp("results")}) FILTER (WHERE e.name = 'search'))::float8 AS "results",
      (count(*) FILTER (WHERE e.name = 'search_select'))::int AS "opened"
    FROM analytics_events e
    WHERE ${where(q)} AND e.name IN ('search', 'search_select') AND e."props"->>'q' <> ''
    GROUP BY 1 ORDER BY "searches" DESC, "sessions" DESC LIMIT ${limit}
  `);
}

export type VitalRow = { metric: string; p75: number; n: number; good: number };

export async function vitals(q: Query, byPath = false): Promise<(VitalRow & { path?: string })[]> {
  const group = byPath ? sql`, e.path` : Prisma.empty;
  return run(sql`
    SELECT e."props"->>'metric' AS metric ${group},
      percentile_cont(0.75) WITHIN GROUP (ORDER BY ${numProp("value")})::float8 AS p75,
      count(*)::int AS n,
      (avg(CASE WHEN e."props"->>'rating' = 'good' THEN 1 ELSE 0 END))::float8 AS good
    FROM analytics_events e WHERE ${where(q)} AND e.name = 'web_vital' AND ${numProp("value")} IS NOT NULL
    GROUP BY 1 ${group} ORDER BY ${byPath ? sql`n DESC` : sql`1`} LIMIT 60
  `);
}

// --- Journeys --------------------------------------------------------------------------------

/** Where visitors came from before `path`, and went after it, by page view order in a session. */
export async function journey(q: Query, path: string): Promise<{ prev: Row[]; next: Row[]; views: number }> {
  const rows = await run<{ side: string; key: string; n: number }>(sql`
    WITH pv AS (
      SELECT e."sessionId", e.path, e."at", e.id,
        lag(e.path) OVER w AS prev, lead(e.path) OVER w AS next
      FROM analytics_events e
      WHERE ${where(q, { skip: ["path", "name"] })} AND e.name = 'pageview'
      WINDOW w AS (PARTITION BY e."sessionId" ORDER BY e."at", e.id)
    )
    SELECT 'prev' AS side, COALESCE(prev, '(entrance)') AS key, count(*)::int AS n FROM pv WHERE path = ${path} GROUP BY 2
    UNION ALL
    SELECT 'next' AS side, COALESCE(next, '(exit)') AS key, count(*)::int AS n FROM pv WHERE path = ${path} GROUP BY 2
  `);
  const side = (s: string) =>
    rows
      .filter((r) => r.side === s)
      .sort((a, b) => b.n - a.n)
      .slice(0, 15)
      .map((r) => ({ key: r.key, visitors: 0, sessions: r.n, events: r.n }));
  const views = rows.filter((r) => r.side === "next").reduce((s, r) => s + r.n, 0);
  return { prev: side("prev"), next: side("next"), views };
}

/** The most common sequences of the first four distinct pages in a session. */
export async function flows(q: Query, limit = 20): Promise<{ flow: string; sessions: number; avgPages: number }[]> {
  return run(sql`
    WITH pv AS (
      SELECT e."sessionId", e.path, e."at", e.id, lag(e.path) OVER (PARTITION BY e."sessionId" ORDER BY e."at", e.id) AS prev
      FROM analytics_events e WHERE ${where(q, { skip: ["path", "name"] })} AND e.name = 'pageview'
    ),
    s AS (
      SELECT "sessionId", array_agg(path ORDER BY "at", id) AS pages FROM pv
      WHERE prev IS DISTINCT FROM path GROUP BY 1
    )
    SELECT array_to_string(pages[1:4], ' > ') || CASE WHEN cardinality(pages) > 4 THEN ' > ...' ELSE '' END AS flow,
      count(*)::int AS sessions, avg(cardinality(pages))::float8 AS "avgPages"
    FROM s GROUP BY 1 ORDER BY 2 DESC LIMIT ${limit}
  `);
}

export type FunnelResult = {
  steps: { count: number; medianSec: number | null }[];
  segments: { key: string | null; counts: number[] }[];
};

/**
 * Ordered funnel: how many sessions (or visitors) did step 1, then step 2 after it, and so on.
 * `by` splits the result by a dimension taken from each one's first step-1 event.
 */
export async function funnel(q: Query, steps: Step[], scope: "session" | "visitor", by?: Dim): Promise<FunnelResult> {
  if (!steps.length) return { steps: [], segments: [] };
  const key = Prisma.raw(scope === "visitor" ? `e."visitorId"` : `e."sessionId"`);
  const seg = by ? sql`(array_agg(${dimExpr(by)} ORDER BY e."at"))[1]` : sql`NULL::text`;
  const ctes: Sql[] = [
    sql`base AS (SELECT e.*, ${key} AS k FROM analytics_events e WHERE ${where(q, { skip: ["path", "name"] })})`,
    sql`s1 AS (SELECT e.k, min(e."at") AS t, ${seg} AS seg FROM base e WHERE ${stepSql(steps[0])} GROUP BY e.k)`,
  ];
  for (let i = 1; i < steps.length; i++) {
    const prev = Prisma.raw(`s${i}`);
    ctes.push(sql`${Prisma.raw(`s${i + 1}`)} AS (
      SELECT e.k, min(e."at") AS t FROM base e JOIN ${prev} p ON p.k = e.k AND e."at" > p.t
      WHERE ${stepSql(steps[i])} GROUP BY e.k)`);
  }
  const cols: Sql[] = [];
  for (let i = 1; i <= steps.length; i++) {
    const s = Prisma.raw(`s${i}`);
    cols.push(sql`(SELECT count(*) FROM ${s})::int AS ${Prisma.raw(`c${i}`)}`);
    if (i > 1) {
      const p = Prisma.raw(`s${i - 1}`);
      cols.push(sql`(SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM x.t - y.t))
        FROM ${s} x JOIN ${p} y ON y.k = x.k)::float8 AS ${Prisma.raw(`m${i}`)}`);
    }
  }
  const with_ = Prisma.join(ctes, ",\n");
  const [totals] = await run<Record<string, number | null>>(sql`WITH ${with_} SELECT ${Prisma.join(cols, ", ")}`);
  const result: FunnelResult = {
    steps: steps.map((_, i) => ({ count: Number(totals[`c${i + 1}`] ?? 0), medianSec: i ? (totals[`m${i + 1}`] as number | null) : null })),
    segments: [],
  };
  if (by) {
    const joins = steps.slice(1).map((_, i) => sql`LEFT JOIN ${Prisma.raw(`s${i + 2}`)} ON ${Prisma.raw(`s${i + 2}`)}.k = s1.k`);
    const counts = steps.map((_, i) => sql`count(${Prisma.raw(`s${i + 1}`)}.k)::int AS ${Prisma.raw(`c${i + 1}`)}`);
    const segRows = await run<Record<string, number | string | null>>(sql`
      WITH ${with_}
      SELECT s1.seg AS key, ${Prisma.join(counts, ", ")} FROM s1 ${Prisma.join(joins, " ")}
      GROUP BY s1.seg ORDER BY c1 DESC LIMIT 15`);
    result.segments = segRows.map((r) => ({ key: r.key as string | null, counts: steps.map((_, i) => Number(r[`c${i + 1}`] ?? 0)) }));
  }
  return result;
}

// --- Retention -------------------------------------------------------------------------------

export type Cohort = { week: string; size: number; weeks: number[] };

/**
 * Weekly cohorts of visitors first seen in the range (and matching its filters), with how many
 * came back in each following week. Week 0 is the week they arrived.
 */
export async function retention(q: Query, maxWeeks = 12): Promise<Cohort[]> {
  const rows = await run<{ w0: string; k: number; n: number }>(sql`
    WITH firsts AS (
      SELECT "visitorId" AS v, min("at") AS f FROM analytics_events GROUP BY 1
      HAVING min("at") >= ${ts(q.from)} AND min("at") < ${ts(q.to)}
    ),
    cohort AS (
      SELECT DISTINCT e."visitorId" AS v, date_trunc('week', ${local(q, sql`f.f`)}) AS w0
      FROM analytics_events e JOIN firsts f ON f.v = e."visitorId" WHERE ${where(q)}
    ),
    act AS (
      SELECT DISTINCT e."visitorId" AS v, date_trunc('week', ${local(q, sql`e."at"`)}) AS w
      FROM analytics_events e JOIN cohort c ON c.v = e."visitorId" WHERE e."at" >= ${ts(q.from)}
    )
    SELECT to_char(c.w0, 'YYYY-MM-DD') AS w0, ((a.w::date - c.w0::date) / 7)::int AS k, count(DISTINCT c.v)::int AS n
    FROM cohort c JOIN act a ON a.v = c.v AND a.w >= c.w0
    GROUP BY 1, 2 ORDER BY 1, 2
  `);
  const byWeek = new Map<string, Cohort>();
  for (const r of rows) {
    const week = r.w0;
    let c = byWeek.get(week);
    if (!c) byWeek.set(week, (c = { week, size: 0, weeks: [] }));
    if (r.k > maxWeeks) continue;
    c.weeks[r.k] = r.n;
    if (r.k === 0) c.size = r.n;
  }
  return [...byWeek.values()].map((c) => ({ ...c, weeks: Array.from({ length: c.weeks.length }, (_, i) => c.weeks[i] ?? 0) }));
}

// --- Sessions and visitors -------------------------------------------------------------------

export type SessionRow = {
  id: string;
  visitorId: string;
  start: Date;
  end: Date;
  source: string;
  utmCampaign: string | null;
  entry: string;
  exit: string | null;
  country: string | null;
  city: string | null;
  device: string;
  browser: string | null;
  os: string | null;
  pageviews: number;
  events: number;
  engagedMs: number;
  names: string[];
};

/** Whole sessions (every event in them) that had at least one event matching the query. */
export async function sessions(q: Query, opts: { page?: number; perPage?: number; allTime?: boolean } = {}): Promise<SessionRow[]> {
  const per = opts.perPage ?? 50;
  return run<SessionRow>(sql`
    WITH ids AS (
      SELECT e."sessionId", min(e."at") AS first FROM analytics_events e WHERE ${where(q, { allTime: opts.allTime })}
      GROUP BY 1 ORDER BY 2 DESC LIMIT ${per} OFFSET ${(opts.page ?? 0) * per}
    )
    SELECT e."sessionId" AS id, min(e."visitorId") AS "visitorId", min(e."at") AS start, max(e."at") AS "end",
      min(e.source) AS source, min(e."utmCampaign") AS "utmCampaign", min(e."entryPath") AS entry,
      (array_agg(e.path ORDER BY e."at" DESC, e.id DESC) FILTER (WHERE e.name = 'pageview'))[1] AS exit,
      min(e.country) AS country, min(e.city) AS city, min(e.device) AS device, min(e.browser) AS browser, min(e.os) AS os,
      (count(*) FILTER (WHERE e.name = 'pageview'))::int AS pageviews, count(*)::int AS events,
      (COALESCE(sum(${engagedMs()}) FILTER (WHERE e.name = 'engage'), 0))::float8 AS "engagedMs",
      array_agg(DISTINCT e.name) AS names
    FROM analytics_events e JOIN ids ON ids."sessionId" = e."sessionId"
    GROUP BY e."sessionId" ORDER BY start DESC
  `);
}

export type EventRow = {
  id: bigint;
  at: Date;
  name: string;
  path: string;
  visitorId: string;
  sessionId: string;
  source: string;
  country: string | null;
  device: string;
  browser: string | null;
  props: Record<string, unknown> | null;
};

export async function sessionEvents(sessionId: string): Promise<EventRow[]> {
  return run<EventRow>(sql`
    SELECT id, "at", name, path, "visitorId", "sessionId", source, country, device, browser, props
    FROM analytics_events WHERE "sessionId" = ${sessionId} ORDER BY "at", id LIMIT 2000
  `);
}

export async function visitorSummary(visitorId: string) {
  const [r] = await run<{ first: Date | null; last: Date | null; sessions: number; pageviews: number; events: number; engagedMs: number }>(sql`
    SELECT min(e."at") AS first, max(e."at") AS last, count(DISTINCT e."sessionId")::int AS sessions,
      (count(*) FILTER (WHERE e.name = 'pageview'))::int AS pageviews, count(*)::int AS events,
      (COALESCE(sum(${engagedMs()}) FILTER (WHERE e.name = 'engage'), 0))::float8 AS "engagedMs"
    FROM analytics_events e WHERE e."visitorId" = ${visitorId}
  `);
  return r;
}

// --- Event explorer --------------------------------------------------------------------------

export async function events(q: Query, opts: { before?: bigint; limit?: number } = {}): Promise<EventRow[]> {
  const before = opts.before ? sql`AND e.id < ${opts.before}` : Prisma.empty;
  return run<EventRow>(sql`
    SELECT e.id, e."at", e.name, e.path, e."visitorId", e."sessionId", e.source, e.country, e.device, e.browser, e.props
    FROM analytics_events e WHERE ${where(q)} ${before}
    ORDER BY e.id DESC LIMIT ${opts.limit ?? 100}
  `);
}

/** Property keys seen on an event name, most common first. */
export async function propKeys(q: Query, name: string): Promise<{ key: string; n: number }[]> {
  return run(sql`
    SELECT k AS key, count(*)::int AS n
    FROM analytics_events e, jsonb_object_keys(CASE WHEN jsonb_typeof(e.props) = 'object' THEN e.props ELSE '{}'::jsonb END) AS k
    WHERE ${where(q)} AND e.name = ${name}
    GROUP BY 1 ORDER BY 2 DESC LIMIT 30
  `);
}

export async function exportRows(q: Query, limit = 100_000): Promise<EventRow[]> {
  return run<EventRow>(sql`
    SELECT e.id, e."at", e.name, e.path, e."visitorId", e."sessionId", e.source, e."utmSource", e."utmMedium",
      e."utmCampaign", e."entryPath", e.country, e.city, e.device, e.browser, e.os, e."screenW", e.lang, e.props
    FROM analytics_events e WHERE ${where(q)} ORDER BY e.id DESC LIMIT ${limit}
  `);
}
