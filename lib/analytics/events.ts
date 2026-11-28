// The wire format between the browser tracker (lib/analytics/client.ts) and /api/events, and
// the limits both sides enforce. Imported by client and server, so no Node or DOM APIs here.

/** Events the site sends today. Any name matching EVENT_NAME is accepted, so new ones need no server change. */
export const EVENT_NAMES = {
  pageview: "A page was shown (first load or client-side navigation).",
  engage: "Time on a page while visible and in use: { ms, scroll } (scroll = deepest % of the page seen). Sent as deltas, so sum them.",
  read_depth: "A post's article body was read to { pct } = 25 | 50 | 75 | 100, once per view.",
  link_click: "An internal link was clicked: { href, area } (area = the labelled region it sits in).",
  outbound_click: "A link off the site was clicked: { href, host, text, area }.",
  search: "A search palette query settled: { q, results }.",
  search_select: "A search result was opened: { q, slug, rank }.",
  save: "A post was saved or unsaved to the library: { slug, saved }.",
  share: "The share button on a post: { slug, method } (native | copy).",
  launch_submit: "A Visitor Launch was submitted: { ok, code }.",
  ad_click: "A sponsor or house ad was clicked: { ad, placement, booked }.",
  yumon_open: "The Yumon chat was expanded on a narrow screen: { status }.",
  yumon_load: "Yumon was woken on a post or /free-ai: { ok, ms, backend, fallback, auto, err? } (auto = loaded without a click, after an earlier visit).",
  yumon_message: "A message to Yumon: { ok, turn, source, chars, tokens, msPerToken, memories, backend, stopped?, err? } (source = input | suggestion | regenerate; regenerate and stopped only on /free-ai). No message text.",
  yumon_thread: "A /free-ai thread action: { action, threads } (action = new | rename | pin | delete | delete_all | export). No titles or text.",
  yumon_clear: "The Yumon chat was cleared: { turns }.",
  gherkin_load: "The Gherkin Yumon (/free-ai/gherkin) was loaded: { ok, ms, backend, fallback, err? }.",
  gherkin_write: "A /free-ai/gherkin continuation: { ok, source, promptTokens, tokens, msPerToken, end, temperature, backend, err? } (source = input | example; end = eos | context | max | stopped). No text.",
  gherkin_compile: "Gherkin compiled to TypeScript on /free-ai/gherkin: { features, scenarios, steps, matched, implemented, stubs, edited } (edited = the Gherkin was changed after Compile filled it in). No text.",
  survey_view: "The reader survey closed off a post after its intro: { version }. Once per post view, only for visitors who haven't answered.",
  survey_submit: "The reader survey was answered: { version, ok, work, found, detail } (choice keys from lib/survey.ts, work only while that question is asked; detail = any free text given, the text itself is only in survey_responses).",
  survey_skip: "The reader survey was skipped (only when SURVEY_MODE is optional): { version }.",
  web_vital:"A Core Web Vital for the page: { metric, value, rating }.",
  js_error: "An uncaught script error: { msg, src }.",
} as const;

export const EVENT_NAME = /^[a-z][a-z0-9_]{0,39}$/;
export const ID = /^[A-Za-z0-9_-]{8,40}$/;
export const PROP_KEY = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;

export const MAX_EVENTS_PER_BATCH = 50;
export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_PROPS = 16;
export const MAX_STRING = 256;
export const MAX_PATH = 256;

export type PropValue = string | number | boolean;
export type Props = Record<string, PropValue>;

/** One queued event. `t` is the client clock at the time it happened. */
export type WireEvent = { n: string; p: string; t: number; props?: Props };

/** Session attribution, captured once when the session starts. */
export type WireContext = {
  source: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  entry: string;
  sw?: number;
  lang?: string;
};

export type WireBatch = {
  v: string; // visitor id
  s: string; // session id
  ctx: WireContext;
  sent: number; // client clock at send, to correct for skew
  e: WireEvent[];
};

/** localStorage key: set to "1" and this browser sends nothing (the /insights login sets it). */
export const OPT_OUT_KEY = "im_analytics_off";
/** localStorage key: "1" lets automated browsers (navigator.webdriver) send events, for the BDD suite. */
export const TEST_KEY = "im_analytics_test";
