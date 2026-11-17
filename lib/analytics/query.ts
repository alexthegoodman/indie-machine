// The /insights query model. Everything a dashboard view shows is described by its URL, so any
// view can be bookmarked or shared and every table cell can link to a narrower view:
//   range=24h|7d|30d|90d|365d|custom   from=YYYY-MM-DD to=YYYY-MM-DD (custom, inclusive)
//   tz=Area/City                        buckets and calendar days in this zone
//   f=dim:value  f=!dim:value           event filters, repeatable (dims below, or prop.<key>)
//   did=step  didnt=step                keep sessions that did / never did a step (see parseStep)
// Filters narrow the events counted. `did`/`didnt` narrow which sessions count at all, which is
// how a question like "people who clicked a sponsor: where did they come from?" is asked.
import { Prisma } from "../../generated/prisma/client";
import { PROP_KEY } from "./events";

const sql = Prisma.sql;
export type Sql = Prisma.Sql;

/** Filterable, groupable columns. `expr` is trusted SQL over the alias `e`. */
export const DIMENSIONS = {
  path: { label: "Page", expr: `e."path"` },
  name: { label: "Event", expr: `e."name"` },
  source: { label: "Source", expr: `e."source"` },
  entry: { label: "Landing page", expr: `e."entryPath"` },
  utm_source: { label: "UTM source", expr: `e."utmSource"` },
  utm_medium: { label: "UTM medium", expr: `e."utmMedium"` },
  utm_campaign: { label: "UTM campaign", expr: `e."utmCampaign"` },
  country: { label: "Country", expr: `e."country"` },
  city: { label: "City", expr: `e."city"` },
  device: { label: "Device", expr: `e."device"` },
  browser: { label: "Browser", expr: `e."browser"` },
  os: { label: "OS", expr: `e."os"` },
  lang: { label: "Language", expr: `e."lang"` },
  screen: {
    label: "Screen width",
    expr: `CASE WHEN e."screenW" IS NULL THEN NULL WHEN e."screenW" < 640 THEN '< 640' WHEN e."screenW" < 1024 THEN '640-1023' WHEN e."screenW" < 1440 THEN '1024-1439' WHEN e."screenW" < 1920 THEN '1440-1919' ELSE '1920+' END`,
  },
  section: {
    label: "Section",
    expr: `CASE WHEN e."path" = '/' THEN '/' ELSE '/' || split_part(e."path", '/', 2) END`,
  },
  visitor: { label: "Visitor", expr: `e."visitorId"` },
  session: { label: "Session", expr: `e."sessionId"` },
} as const;

export type DimKey = keyof typeof DIMENSIONS;
/** A dimension or a property of the event: "prop.href". */
export type Dim = DimKey | `prop.${string}`;
export const NONE = "(none)";

export function isDim(s: string): s is Dim {
  if (s in DIMENSIONS) return true;
  return s.startsWith("prop.") && PROP_KEY.test(s.slice(5));
}

export function dimLabel(d: Dim): string {
  return d.startsWith("prop.") ? `${d.slice(5)} (prop)` : DIMENSIONS[d as DimKey].label;
}

export function dimExpr(d: Dim): Sql {
  if (d.startsWith("prop.")) return sql`(e."props"->>${d.slice(5)})`;
  return Prisma.raw(`(${DIMENSIONS[d as DimKey].expr})`);
}

/** A numeric property, or NULL when it's missing or not a number (props are client-supplied). */
export function numProp(key: string, alias = "e"): Sql {
  const p = Prisma.raw(`${alias}."props"`);
  return sql`(CASE WHEN jsonb_typeof(${p}->${key}) = 'number' THEN (${p}->>${key})::float8 END)`;
}

/** Engaged ms of an `engage` event, capped so one stuck tab can't skew an average. */
export function engagedMs(alias = "e"): Sql {
  return sql`LEAST(COALESCE(${numProp("ms", alias)}, 0), 1800000)`;
}

export type Filter = { dim: Dim; value: string; neg: boolean };

/**
 * A step a session can take, used by `did`/`didnt` and funnels:
 *   p:/posts/*                a page view whose path matches (* is a wildcard)
 *   e:outbound_click          any event of that name
 *   e:outbound_click:host=github.com   ...whose property equals a value
 */
export type Step = { raw: string; kind: "page" | "event"; value: string; propKey?: string; propValue?: string };

export function parseStep(raw: string): Step | null {
  const s = raw.trim();
  if (s.startsWith("p:") && s.length > 2) return { raw: s, kind: "page", value: s.slice(2) };
  if (s.startsWith("e:") && s.length > 2) {
    const body = s.slice(2);
    const colon = body.indexOf(":");
    if (colon < 0) return { raw: s, kind: "event", value: body };
    const prop = body.slice(colon + 1);
    const eq = prop.indexOf("=");
    if (eq < 1 || !PROP_KEY.test(prop.slice(0, eq))) return null;
    return { raw: s, kind: "event", value: body.slice(0, colon), propKey: prop.slice(0, eq), propValue: prop.slice(eq + 1) };
  }
  return null;
}

export function stepLabel(s: Step): string {
  if (s.kind === "page") return `Viewed ${s.value}`;
  return s.propKey ? `${s.value} where ${s.propKey} = ${s.propValue}` : s.value;
}

function likePattern(glob: string): string {
  return glob.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/\*/g, "%");
}

/** SQL that is true for an event (alias `e`) matching the step. */
export function stepSql(s: Step, alias = "e"): Sql {
  const a = (col: string) => Prisma.raw(`${alias}."${col}"`);
  if (s.kind === "page") {
    return s.value.includes("*")
      ? sql`(${a("name")} = 'pageview' AND ${a("path")} LIKE ${likePattern(s.value)})`
      : sql`(${a("name")} = 'pageview' AND ${a("path")} = ${s.value})`;
  }
  if (s.propKey) return sql`(${a("name")} = ${s.value} AND ${a("props")}->>${s.propKey} = ${s.propValue})`;
  return sql`(${a("name")} = ${s.value})`;
}

export const RANGES = {
  "24h": { label: "Last 24 hours", ms: 24 * 3600_000 },
  "7d": { label: "Last 7 days", ms: 7 * 24 * 3600_000 },
  "30d": { label: "Last 30 days", ms: 30 * 24 * 3600_000 },
  "90d": { label: "Last 90 days", ms: 90 * 24 * 3600_000 },
  "365d": { label: "Last 12 months", ms: 365 * 24 * 3600_000 },
} as const;

export type Grain = "hour" | "day" | "week";

export type Query = {
  range: keyof typeof RANGES | "custom";
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  tz: string;
  grain: Grain;
  filters: Filter[];
  did: Step[];
  didnt: Step[];
};

type Params = Record<string, string | string[] | undefined>;

export function all(p: Params, key: string): string[] {
  const v = p[key];
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

export function one(p: Params, key: string): string | undefined {
  return all(p, key)[0];
}

function validTz(tz: string | undefined): string | undefined {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

/** Offset of `tz` from UTC at instant `ms`, in ms. */
function tzOffset(ms: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** The instant a calendar day starts in `tz`. */
export function zonedDayStart(day: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const first = guess - tzOffset(guess, tz);
  return new Date(guess - tzOffset(first, tz));
}

export function defaultTz(): string {
  return validTz(process.env.ANALYTICS_TIMEZONE) ?? "UTC";
}

export function parseQuery(p: Params, now = Date.now()): Query {
  const tz = validTz(one(p, "tz")) ?? defaultTz();
  let range = (one(p, "range") ?? "7d") as Query["range"];
  let from: Date, to: Date;
  const cFrom = range === "custom" ? zonedDayStart(one(p, "from") ?? "", tz) : null;
  const cTo = range === "custom" ? zonedDayStart(one(p, "to") ?? "", tz) : null;
  if (cFrom && cTo && cFrom <= cTo) {
    from = cFrom;
    to = new Date(Math.min(cTo.getTime() + 24 * 3600_000, now + 60_000));
  } else {
    if (!(range in RANGES)) range = "7d";
    to = new Date(now);
    from = new Date(now - RANGES[range as keyof typeof RANGES].ms);
  }
  const span = to.getTime() - from.getTime();
  const grain: Grain = span <= 3 * 24 * 3600_000 ? "hour" : span <= 120 * 24 * 3600_000 ? "day" : "week";

  const filters: Filter[] = [];
  for (const f of all(p, "f")) {
    const neg = f.startsWith("!");
    const body = neg ? f.slice(1) : f;
    const colon = body.indexOf(":");
    if (colon < 1) continue;
    const dim = body.slice(0, colon);
    if (!isDim(dim)) continue;
    filters.push({ dim, value: body.slice(colon + 1), neg });
  }
  const steps = (key: string) => all(p, key).map(parseStep).filter((s): s is Step => !!s);

  return {
    range,
    from,
    to,
    prevFrom: new Date(from.getTime() - span),
    prevTo: from,
    tz,
    grain,
    filters,
    did: steps("did"),
    didnt: steps("didnt"),
  };
}

/** A timestamp parameter compared against the `timestamp(3)` (UTC, no zone) columns. */
export function ts(d: Date): Sql {
  return sql`${d.toISOString().slice(0, 23).replace("T", " ")}::timestamp`;
}

/** A UTC timestamp expression shown as wall-clock time in the query's zone. */
export function local(q: Query, expr: Sql): Sql {
  return sql`((${expr}) AT TIME ZONE 'UTC' AT TIME ZONE ${q.tz})`;
}

export type WhereOpts = {
  /** Use the previous period instead of the current one. */
  prev?: boolean;
  /** Leave out filters on these dimensions (e.g. a journey view ignores the page filter). */
  skip?: Dim[];
  /** No time bound (visitor and session drill-downs). */
  allTime?: boolean;
};

/** The WHERE clause (without the keyword) for events aliased `e`. */
export function where(q: Query, opts: WhereOpts = {}): Sql {
  const from = opts.prev ? q.prevFrom : q.from;
  const to = opts.prev ? q.prevTo : q.to;
  const parts: Sql[] = [];
  if (!opts.allTime) parts.push(sql`e."at" >= ${ts(from)} AND e."at" < ${ts(to)}`);
  for (const f of q.filters) {
    if (opts.skip?.includes(f.dim)) continue;
    const x = dimExpr(f.dim);
    if (f.value === NONE) parts.push(f.neg ? sql`${x} IS NOT NULL` : sql`${x} IS NULL`);
    else if (f.value.includes("*")) {
      const like = sql`${x} LIKE ${likePattern(f.value)}`;
      parts.push(f.neg ? sql`NOT COALESCE(${like}, false)` : like);
    } else parts.push(f.neg ? sql`${x} IS DISTINCT FROM ${f.value}` : sql`${x} = ${f.value}`);
  }
  const bound = opts.allTime ? sql`true` : sql`d."at" >= ${ts(from)} AND d."at" < ${ts(to)}`;
  for (const s of q.did) {
    parts.push(sql`EXISTS (SELECT 1 FROM analytics_events d WHERE d."sessionId" = e."sessionId" AND ${bound} AND ${stepSql(s, "d")})`);
  }
  for (const s of q.didnt) {
    parts.push(sql`NOT EXISTS (SELECT 1 FROM analytics_events d WHERE d."sessionId" = e."sessionId" AND ${bound} AND ${stepSql(s, "d")})`);
  }
  return parts.length ? Prisma.join(parts, " AND ") : sql`true`;
}

/** Serialize the shared parts of a query back to URL params (for links between views). */
export function queryParams(q: Query, p: Params): URLSearchParams {
  const out = new URLSearchParams();
  out.set("range", q.range);
  if (q.range === "custom") {
    for (const k of ["from", "to"]) {
      const v = one(p, k);
      if (v) out.set(k, v);
    }
  }
  if (one(p, "tz")) out.set("tz", q.tz);
  for (const f of q.filters) out.append("f", `${f.neg ? "!" : ""}${f.dim}:${f.value}`);
  for (const s of q.did) out.append("did", s.raw);
  for (const s of q.didnt) out.append("didnt", s.raw);
  return out;
}
