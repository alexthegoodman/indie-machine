// Browser side of event logging. `track()` queues an event; the queue goes to /api/events every
// few seconds, when it fills, and (by sendBeacon) when the page is hidden or closed.
// Ids are random and live in this browser only: a visitor id in localStorage, a session id in
// sessionStorage that is replaced after 30 idle minutes. Nothing here is a cookie.
import {
  MAX_EVENTS_PER_BATCH,
  MAX_STRING,
  OPT_OUT_KEY,
  TEST_KEY,
  type Props,
  type WireBatch,
  type WireContext,
  type WireEvent,
} from "./events";

const ENDPOINT = "/api/events";
const VISITOR_KEY = "im_vid";
const SESSION_KEY = "im_session";
const IDLE_MS = 30 * 60_000;
const FLUSH_MS = 4000;
/** Engaged time only counts while the visitor did something in the last this-many ms. */
const ACTIVE_WINDOW_MS = 30_000;
/** Pages that never report (the analytics dashboard itself). */
const IGNORED = /^\/insights(\/|$)/;

type Session = { id: string; last: number; ctx: WireContext };

let queue: WireEvent[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let memoryVisitor = "";
let memorySession: Session | null = null;

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
}

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: string) {
  try {
    storage().setItem(key, value);
  } catch {
    // Storage blocked (private mode, sandboxed frame): the in-memory copy carries the page.
  }
}

const local = () => window.localStorage;
const session = () => window.sessionStorage;

export function analyticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (read(local, OPT_OUT_KEY) === "1") return false;
  if (navigator.webdriver && read(local, TEST_KEY) !== "1") return false;
  return !IGNORED.test(location.pathname);
}

/** Exclude (or re-include) this browser from analytics. */
export function setOptOut(off: boolean) {
  try {
    // "0" rather than removing it, so the dashboard's exclude-by-default doesn't flip it back.
    localStorage.setItem(OPT_OUT_KEY, off ? "1" : "0");
  } catch {
    // nothing to do
  }
}

function visitorId(): string {
  if (memoryVisitor) return memoryVisitor;
  let id = read(local, VISITOR_KEY);
  if (!id) {
    id = randomId();
    write(local, VISITOR_KEY, id);
  }
  return (memoryVisitor = id);
}

function referrerSource(): string {
  try {
    if (!document.referrer) return "direct";
    const host = new URL(document.referrer).hostname.replace(/^www\./, "");
    return host === location.hostname.replace(/^www\./, "") ? "direct" : host || "direct";
  } catch {
    return "direct";
  }
}

function clip(s: string | null | undefined, n = 128): string | undefined {
  const t = s?.trim();
  return t ? t.slice(0, n) : undefined;
}

function newSession(now: number): Session {
  const q = new URLSearchParams(location.search);
  return {
    id: randomId(),
    last: now,
    ctx: {
      source: referrerSource(),
      // ?ref= is what most launch sites and newsletters append when there's no UTM.
      utmSource: clip(q.get("utm_source") ?? q.get("ref")),
      utmMedium: clip(q.get("utm_medium")),
      utmCampaign: clip(q.get("utm_campaign")),
      entry: location.pathname.slice(0, 256),
      sw: window.screen?.width || undefined,
      lang: clip(navigator.language, 16),
    },
  };
}

function currentSession(now: number): Session {
  let s = memorySession;
  if (!s) {
    try {
      s = JSON.parse(read(session, SESSION_KEY) ?? "null");
    } catch {
      s = null;
    }
  }
  if (!s || typeof s.id !== "string" || now - s.last > IDLE_MS) s = newSession(now);
  s.last = now;
  memorySession = s;
  write(session, SESSION_KEY, JSON.stringify(s));
  return s;
}

function cleanProps(props?: Record<string, unknown>): Props | undefined {
  if (!props) return undefined;
  const out: Props = {};
  let any = false;
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === "string") out[k] = v.slice(0, MAX_STRING);
    else if (typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) out[k] = v;
    else continue;
    any = true;
  }
  return any ? out : undefined;
}

/** This browser's visitor and session ids and the session's attribution (for the survey). */
export function identity(): { v: string; s: string; ctx: WireContext } {
  const s = currentSession(Date.now());
  return { v: visitorId(), s: s.id, ctx: s.ctx };
}

/** Queue an event for the current page (or `path`, for events about the page being left). */
export function track(name: string, props?: Record<string, unknown>, path?: string) {
  if (!analyticsEnabled()) return;
  // Starts (or extends) the session now, so its source and landing page are this page's.
  currentSession(Date.now());
  queue.push({ n: name, p: (path ?? location.pathname).slice(0, 256), t: Date.now(), props: cleanProps(props) });
  if (queue.length >= MAX_EVENTS_PER_BATCH) flush();
  else if (!timer) timer = setTimeout(() => flush(), FLUSH_MS);
}

/** Send the queue now. `beacon` for page hide/unload, where a fetch may be cancelled. */
export function flush(beacon = false) {
  clearTimeout(timer);
  timer = undefined;
  if (!queue.length) return;
  const now = Date.now();
  const s = currentSession(now);
  const batch: WireBatch = { v: visitorId(), s: s.id, ctx: s.ctx, sent: now, e: queue.splice(0, MAX_EVENTS_PER_BATCH) };
  const body = JSON.stringify(batch);
  if (beacon && navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) {
    // queued by the browser
  } else {
    fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  }
  if (queue.length) flush(beacon);
}

// --- Page lifecycle: engaged time and scroll depth for the page in view. ---------------------

let pagePath = "";
let engagedMs = 0;
let maxScroll = 0;
let lastActivity = 0;
let started = false;

function scrollPct(): number {
  const doc = document.documentElement;
  const max = doc.scrollHeight;
  if (!max) return 100;
  return Math.min(100, Math.round(((window.scrollY + window.innerHeight) / max) * 100));
}

/** Report the time gathered on the current page since the last report. */
function reportEngagement() {
  if (pagePath && engagedMs >= 1000) track("engage", { ms: engagedMs, scroll: maxScroll }, pagePath);
  engagedMs = 0;
}

/** Call on every route change (and the first render). */
export function pageview(path: string) {
  if (path === pagePath) return;
  reportEngagement();
  pagePath = path;
  maxScroll = 0;
  lastActivity = Date.now();
  if (IGNORED.test(path)) return;
  track("pageview");
  requestAnimationFrame(() => (maxScroll = Math.max(maxScroll, scrollPct())));
}

/** The labelled region an element sits in ("Visitor launches", "Main navigation", "Sponsor"). */
function areaOf(el: Element): string | undefined {
  const region = el.closest("[data-track-area],[aria-label]:is(nav,aside,section,header,footer,[role=region],[role=dialog]),header,footer");
  if (!region) return el.closest("main") ? "content" : undefined;
  return (
    region.getAttribute("data-track-area") ??
    region.getAttribute("aria-label") ??
    region.tagName.toLowerCase()
  ).slice(0, 64);
}

function dataProps(el: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(el.dataset)) {
    if (k.startsWith("track") && k !== "track" && k !== "trackArea" && v !== undefined) {
      out[k.slice(5, 6).toLowerCase() + k.slice(6)] = v;
    }
  }
  return out;
}

function onClick(e: MouseEvent) {
  const target = e.target as Element | null;
  if (!target?.closest) return;
  const tagged = target.closest<HTMLElement>("[data-track]");
  if (tagged) {
    track(tagged.dataset.track!, { ...dataProps(tagged), area: areaOf(tagged) });
    return;
  }
  const a = target.closest<HTMLAnchorElement>("a[href]");
  if (!a) return;
  let url: URL;
  try {
    url = new URL(a.href, location.href);
  } catch {
    return;
  }
  const text = (a.getAttribute("aria-label") ?? a.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (url.protocol === "mailto:") {
    track("outbound_click", { href: url.href, host: "mailto", text, area: areaOf(a) });
  } else if (url.host && url.host !== location.host) {
    track("outbound_click", { href: url.href, host: url.hostname.replace(/^www\./, ""), text, area: areaOf(a) });
  } else if (url.pathname + url.search !== location.pathname + location.search) {
    track("link_click", { href: url.pathname + url.search, text, area: areaOf(a) });
  }
}

let errorCount = 0;

/** Wire up global listeners. Safe to call more than once. */
export function startAnalytics() {
  if (started || typeof window === "undefined") return;
  started = true;
  const active = () => (lastActivity = Date.now());
  for (const type of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"]) {
    window.addEventListener(type, active, { passive: true, capture: true });
  }
  window.addEventListener(
    "scroll",
    () => {
      active();
      maxScroll = Math.max(maxScroll, scrollPct());
    },
    { passive: true },
  );
  setInterval(() => {
    if (document.visibilityState === "visible" && Date.now() - lastActivity < ACTIVE_WINDOW_MS) engagedMs += 1000;
  }, 1000);
  document.addEventListener("click", onClick, { capture: true });
  // Hidden covers tab switches, app switches on mobile and most closes; pagehide the rest.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      reportEngagement();
      flush(true);
    } else {
      lastActivity = Date.now();
    }
  });
  window.addEventListener("pagehide", () => {
    reportEngagement();
    flush(true);
  });
  window.addEventListener("error", (e) => {
    if (errorCount++ >= 5) return;
    track("js_error", { msg: String(e.message).slice(0, 200), src: `${e.filename ?? ""}:${e.lineno ?? 0}`.slice(-120) });
  });
}
