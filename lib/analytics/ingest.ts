// Server side of event logging: validate a batch from the browser tracker and store it.
// Anything malformed is dropped rather than rejected, field by field, so one bad prop never
// loses a visitor's page view.
import { userAgent } from "next/server";
import { db } from "@/lib/allegiance/db";
import type { Prisma } from "../../generated/prisma/client";
import {
  EVENT_NAME,
  ID,
  MAX_EVENTS_PER_BATCH,
  MAX_PATH,
  MAX_PROPS,
  MAX_STRING,
  PROP_KEY,
  type Props,
} from "./events";

export class IngestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const DAY_MS = 24 * 3600_000;
/** Per server instance: a visitor sending more than this in a window is a script, not a reader. */
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX_EVENTS = 600;
const recent = new Map<string, { start: number; count: number }>();

function rateLimited(visitorId: string, count: number, now: number): boolean {
  if (recent.size > 20_000) {
    for (const [k, v] of recent) if (now - v.start > RATE_WINDOW_MS) recent.delete(k);
  }
  const r = recent.get(visitorId);
  if (!r || now - r.start > RATE_WINDOW_MS) {
    recent.set(visitorId, { start: now, count });
    return count > RATE_MAX_EVENTS;
  }
  r.count += count;
  return r.count > RATE_MAX_EVENTS;
}

export function str(v: unknown, max = 128): string | undefined {
  if (typeof v !== "string") return undefined;
  // Control characters have no business in any of these fields.
  const t = v.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return t ? t.slice(0, max) : undefined;
}

export function path(v: unknown): string | undefined {
  const p = str(v, MAX_PATH);
  return p?.startsWith("/") ? p : undefined;
}

function props(v: unknown): Props | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: Props = {};
  let n = 0;
  for (const [k, val] of Object.entries(v)) {
    if (n >= MAX_PROPS) break;
    if (!PROP_KEY.test(k)) continue;
    if (typeof val === "string") {
      const s = str(val, MAX_STRING);
      if (s === undefined) continue;
      out[k] = s;
    } else if (typeof val === "boolean" || (typeof val === "number" && Number.isFinite(val))) {
      out[k] = val;
    } else continue;
    n++;
  }
  return n ? out : undefined;
}

export function device(type: string | undefined): string {
  if (!type) return "desktop";
  if (type === "mobile" || type === "tablet") return type;
  return "other";
}

function decodeHeader(v: string | null): string | undefined {
  if (!v) return undefined;
  try {
    return str(decodeURIComponent(v), 64);
  } catch {
    return str(v, 64);
  }
}

/** Store a batch. Returns how many events were written. */
export async function ingest(body: unknown, headers: Headers, now = Date.now()): Promise<number> {
  if (!body || typeof body !== "object") throw new IngestError(400, "Body must be a JSON object.");
  const b = body as Record<string, unknown>;
  const visitorId = typeof b.v === "string" && ID.test(b.v) ? b.v : null;
  const sessionId = typeof b.s === "string" && ID.test(b.s) ? b.s : null;
  if (!visitorId || !sessionId) throw new IngestError(400, "Missing visitor or session id.");
  if (!Array.isArray(b.e) || b.e.length === 0) return 0;
  if (b.e.length > MAX_EVENTS_PER_BATCH) throw new IngestError(413, "Too many events in one batch.");

  const ua = userAgent({ headers });
  if (ua.isBot) return 0;
  if (rateLimited(visitorId, b.e.length, now)) throw new IngestError(429, "Slow down.");

  const ctx = (b.ctx && typeof b.ctx === "object" ? b.ctx : {}) as Record<string, unknown>;
  const sw = typeof ctx.sw === "number" && Number.isInteger(ctx.sw) && ctx.sw > 0 && ctx.sw < 20_000 ? ctx.sw : null;
  const shared = {
    visitorId,
    sessionId,
    source: str(ctx.source)?.toLowerCase() ?? "direct",
    utmSource: str(ctx.utmSource)?.toLowerCase() ?? null,
    utmMedium: str(ctx.utmMedium)?.toLowerCase() ?? null,
    utmCampaign: str(ctx.utmCampaign) ?? null,
    entryPath: path(ctx.entry) ?? "/",
    // Vercel's edge sets these; locally they're absent.
    country: str(headers.get("x-vercel-ip-country"), 8) ?? null,
    city: decodeHeader(headers.get("x-vercel-ip-city")) ?? null,
    device: device(ua.device.type),
    browser: ua.browser.name ?? null,
    os: ua.os.name ?? null,
    screenW: sw,
    lang: str(ctx.lang, 16) ?? null,
  };

  // Batches can sit in the queue (or a closing tab) for a while: place each event at the
  // server time it happened, using the client's own clock only for the offset.
  const sent = typeof b.sent === "number" && Number.isFinite(b.sent) ? b.sent : now;
  const rows: Prisma.AnalyticsEventCreateManyInput[] = [];
  for (const raw of b.e) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    if (typeof e.n !== "string" || !EVENT_NAME.test(e.n)) continue;
    const p = path(e.p);
    if (!p) continue;
    const t = typeof e.t === "number" && Number.isFinite(e.t) ? e.t : sent;
    const at = Math.min(now, Math.max(now - DAY_MS, now - (sent - t)));
    const pr = props(e.props);
    rows.push({ ...shared, name: e.n, path: p, at: new Date(at), props: pr });
  }
  if (!rows.length) return 0;
  const r = await db().analyticsEvent.createMany({ data: rows });
  return r.count;
}
