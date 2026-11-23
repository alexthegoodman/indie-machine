// Drives tests/analytics.feature against a running build with the system Chrome. Needs
// DATABASE_URL for the local database (it seeds and clears its own test events, all with
// visitor ids starting "bddtest") and the dashboard password the server was started with. Usage:
//   npx next build && ANALYTICS_PASSWORD=bdd-test-password ANALYTICS_DB_CONCURRENCY=1 npx next start -p 3123
//   BASE_URL=http://localhost:3123 INSIGHTS_PASSWORD=bdd-test-password \
//     PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core SCREENSHOT_DIR=/tmp/im-shots \
//     node tests/analytics.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { allowPosts, storeSurveyPass } from "./survey-pass.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3123";
const PASSWORD = process.env.INSIGHTS_PASSWORD ?? "bdd-test-password";
const SHOTS = process.env.SCREENSHOT_DIR;
const pwPath = process.env.PLAYWRIGHT_CORE;
const { chromium } = await import(pwPath ? pathToFileURL(path.join(pwPath, "index.mjs")).href : "playwright-core");
try { process.loadEnvFile(".env"); } catch { /* environment provides DATABASE_URL */ }

const POST = "/posts/fft-ocean-water";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const rows = async (sql, args = []) => (await client.query(sql, args)).rows;
const clearTestEvents = () => client.query(`DELETE FROM analytics_events WHERE "visitorId" LIKE 'bddtest%'`);
const clearSurveyPasses = () => client.query(`DELETE FROM survey_responses WHERE "visitorId" LIKE 'bddtest-browser-%'`);

async function waitFor(fn, label, ms = 10_000) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`timed out waiting for ${label}`);
}

const results = [];
async function scenario(name, fn) {
  const start = performance.now();
  try {
    await clearTestEvents();
    await fn();
    results.push({ name, ok: true });
    console.log(`  [PASS] ${name} (${(performance.now() - start).toFixed(0)}ms)`);
  } catch (err) {
    results.push({ name, ok: false });
    console.error(`  [FAIL] ${name}\n`, err);
  }
}

async function shot(page, name, fullPage = false) {
  if (!SHOTS) return;
  await fs.mkdir(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage });
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
let vseq = 0;
/** A page whose tracker is allowed to send (navigator.webdriver is set) under a known visitor id. */
async function trackedPage(viewport = { width: 1440, height: 900 }) {
  const visitor = `bddtest-browser-${Date.now().toString(36)}${vseq++}`;
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await context.addInitScript((v) => {
    try {
      localStorage.setItem("im_analytics_test", "1");
      localStorage.setItem("im_vid", v);
    } catch {
      // about:blank (used to leave a page) has no storage
    }
  }, visitor);
  // Past the reader survey (tests/survey.feature), which would stop posts after their intro.
  await storeSurveyPass(visitor);
  await allowPosts(context, null);
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  return { page, visitor };
}
const eventsOf = (visitor) =>
  rows(`SELECT name, path, props, "sessionId", source, "entryPath" FROM analytics_events WHERE "visitorId" = $1 ORDER BY "at", id`, [visitor]);

console.log(`\nAnalytics BDD suite against ${BASE_URL}\n`);

await scenario("Browsing the site records what the visitor did", async () => {
  const { page, visitor } = await trackedPage();
  await page.goto(BASE_URL + "/dev");
  for (let i = 0; i < 6; i++) {
    await page.mouse.move(200 + i * 40, 300 + i * 10);
    await page.waitForTimeout(450);
  }
  const link = page.locator(`main a[href="${POST}"]`).first();
  await link.scrollIntoViewIfNeeded();
  await link.click();
  await page.waitForURL(`**${POST}`);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.goto("about:blank");

  const ev = await waitFor(async () => {
    const e = await eventsOf(visitor);
    return e.some((x) => x.name === "engage" && x.path === POST) && e.some((x) => x.name === "read_depth" && x.props?.pct === 100) ? e : null;
  }, "the post's engage and read_depth 100 events");
  const names = (p) => ev.filter((x) => x.path === p).map((x) => x.name);
  assert.ok(names("/dev").includes("pageview"), "pageview /dev");
  assert.ok(names(POST).includes("pageview"), "pageview of the post");
  const click = ev.find((x) => x.name === "link_click");
  assert.equal(click?.path, "/dev");
  assert.equal(click?.props?.href, POST);
  assert.ok(click?.props?.area, "link_click has an area");
  const engage = ev.find((x) => x.name === "engage" && x.path === "/dev");
  assert.ok(engage && engage.props.ms >= 1000, `engage on /dev: ${JSON.stringify(engage?.props)}`);
  assert.deepEqual(ev.filter((x) => x.name === "read_depth").map((x) => x.props.pct), [25, 50, 75, 100]);
  assert.equal(new Set(ev.map((x) => x.sessionId)).size, 1, "one session");
  assert.ok(ev.every((x) => x.source === "direct" && x.entryPath === "/dev"), "session attribution on every event");
  assert.deepEqual(page.errors, []);
  console.log(`    ${ev.length} events: ${[...new Set(ev.map((x) => x.name))].join(", ")}; link_click area "${click.props.area}"`);
  await page.context().close();
});

await scenario("Web vitals are sent once per metric per page load", async () => {
  const { page, visitor } = await trackedPage();
  await page.goto(BASE_URL + "/");
  // Client-side navigations re-render the tracker; each used to add another set of vitals observers.
  for (const href of ["/dev", "/products", "/announcements", "/dev", "/"]) {
    await page.locator(`a[href="${href}"]`).first().click();
    await page.waitForURL((u) => new URL(u).pathname === href);
    await page.mouse.click(5, 300);
    await page.keyboard.press("End");
    await page.waitForTimeout(400);
  }
  await page.goto("about:blank");
  const ev = await waitFor(async () => {
    const e = await eventsOf(visitor);
    return e.filter((x) => x.name === "pageview").length >= 6 && e.some((x) => x.name === "web_vital") ? e : null;
  }, "page views and web vitals");
  await page.waitForTimeout(1500);
  const vitals = (await eventsOf(visitor)).filter((x) => x.name === "web_vital").map((x) => x.props.metric);
  console.log(`    web_vital events: ${vitals.length} (${vitals.join(", ")}) over ${ev.filter((x) => x.name === "pageview").length} page views`);
  assert.ok(vitals.length <= 5, `${vitals.length} web_vital events`);
  assert.equal(new Set(vitals).size, vitals.length, "no metric sent twice");
  await page.context().close();
});

await scenario("Search queries and the dashboard itself", async () => {
  const { page, visitor } = await trackedPage();
  await page.goto(BASE_URL + "/");
  await page.keyboard.press("Control+K");
  await page.getByRole("combobox").fill("zzzz-no-such-post");
  const search = await waitFor(async () => (await eventsOf(visitor)).find((x) => x.name === "search"), "the search event");
  assert.equal(search.props.q, "zzzz-no-such-post");
  assert.equal(search.props.results, 0);
  await page.keyboard.press("Escape");
  await page.goto(BASE_URL + "/insights");
  await page.waitForTimeout(500);
  await page.goto("about:blank");
  await page.waitForTimeout(1000);
  const views = (await eventsOf(visitor)).filter((x) => x.path.startsWith("/insights"));
  assert.deepEqual(views, [], "nothing recorded on /insights");
  await page.context().close();
});

await scenario("The ingest endpoint refuses bad batches", async () => {
  const batch = (v, s, e) => ({ v, s, sent: Date.now(), ctx: { source: "bdd-api.example", entry: "/" }, e });
  const ev = (n, p = "/", props) => ({ n, p, t: Date.now(), props });
  const send = (body, headers = {}) =>
    fetch(BASE_URL + "/api/events", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }).then((r) => r.status);

  const good = batch("bddtest-api-good", "bddtest-api-sess1", [
    ev("pageview"),
    ev("BadName"),
    ev("pageview", "no-slash"),
    ev("outbound_click", "/", { host: "github.com", nested: { x: 1 }, "bad key": 1, n: 3, ok: true }),
  ]);
  const cases = [
    ["valid batch", await send(good), 204],
    ["foreign Origin", await send(batch("bddtest-api-orig", "bddtest-api-sess2", [ev("pageview")]), { Origin: "https://evil.example" }), 403],
    ["not JSON", await send("{nope"), 400],
    ["missing session id", await send({ v: "bddtest-api-nosess", e: [ev("pageview")] }), 400],
    ["51 events", await send(batch("bddtest-api-many", "bddtest-api-sess3", Array.from({ length: 51 }, () => ev("pageview")))), 413],
    ["Googlebot UA", await send(batch("bddtest-api-bot", "bddtest-api-sess4", [ev("pageview")]), { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }), 204],
  ];
  for (const [name, got, want] of cases) assert.equal(got, want, `${name}: ${got}`);
  const stored = await rows(`SELECT "visitorId", name, props FROM analytics_events WHERE "visitorId" LIKE 'bddtest-api%' ORDER BY id`);
  assert.deepEqual(stored.map((r) => r.visitorId), ["bddtest-api-good", "bddtest-api-good"]);
  assert.deepEqual(stored.map((r) => r.name), ["pageview", "outbound_click"]);
  assert.deepEqual(stored[1].props, { host: "github.com", n: 3, ok: true });
});

async function signIn(page) {
  await page.goto(BASE_URL + "/insights");
  await page.getByLabel("PASSWORD").fill(PASSWORD);
  await page.getByRole("button", { name: "SIGN IN" }).click();
  await page.getByRole("navigation", { name: "Views" }).waitFor();
}

async function plainPage(viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && page.errors.push(m.text()));
  return page;
}

await scenario("The dashboard is behind the password", async () => {
  const page = await plainPage();
  await page.goto(BASE_URL + "/insights");
  await page.getByLabel("PASSWORD").waitFor();
  assert.equal(await page.getByRole("navigation", { name: "Views" }).count(), 0);
  await shot(page, "insights-01-sign-in");
  await page.getByLabel("PASSWORD").fill("wrong-password");
  await page.getByRole("button", { name: "SIGN IN" }).click();
  await page.getByRole("alert").filter({ hasText: "That's not the password." }).waitFor();
  assert.equal((await fetch(BASE_URL + "/insights/export?range=7d")).status, 401);
  await signIn(page);
  await page.getByRole("region", { name: "Visitors" }).first().waitFor();
  assert.ok(await page.getByText("Bounce rate").isVisible());
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

/** 30 sessions over the last five days; see the feature file for the shape. */
async function seed() {
  const sources = ["bdd-hn.example", "bdd-reddit.example", "bdd-direct.example"];
  const values = [];
  const args = [];
  const add = (at, name, v, s, source, p, props, device = "desktop") => {
    const base = args.length;
    args.push(at, name, v, s, p, source, "/", device, "Chrome", "Windows", props ? JSON.stringify(props) : null);
    values.push(`(${Array.from({ length: 11 }, (_, i) => `$${base + i + 1}`).join(",")})`);
  };
  const now = Date.now();
  for (let i = 0; i < 30; i++) {
    const source = sources[i % 3];
    const v = `bddtest-seed-v${i}`;
    const s = `bddtest-seed-s${i}`;
    const t0 = now - i * 4 * 3600_000 - 10 * 60_000;
    const at = (sec) => new Date(t0 + sec * 1000);
    const device = i % 5 === 0 ? "mobile" : "desktop";
    add(at(0), "pageview", v, s, source, "/", null, device);
    add(at(20), "engage", v, s, source, "/", { ms: 20000, scroll: 60 }, device);
    if (i % 2 === 0) {
      add(at(30), "pageview", v, s, source, POST, null, device);
      add(at(60), "read_depth", v, s, source, POST, { pct: 50 }, device);
      if (i % 4 === 0) add(at(120), "read_depth", v, s, source, POST, { pct: 100 }, device);
      add(at(130), "engage", v, s, source, POST, { ms: 90000, scroll: 100 }, device);
      if (source === "bdd-hn.example") add(at(140), "outbound_click", v, s, source, POST, { host: "github.com", href: "https://github.com/indie" }, device);
    }
  }
  await client.query(
    `INSERT INTO analytics_events ("at", name, "visitorId", "sessionId", path, source, "entryPath", device, browser, os, props)
     SELECT a::timestamptz AT TIME ZONE 'UTC', n, v, s, p, src, e, d, b, o, pr::jsonb FROM (VALUES ${values.join(",")}) AS x(a, n, v, s, p, src, e, d, b, o, pr)`,
    args.map((a) => (a instanceof Date ? a.toISOString() : a)),
  );
}

await scenario("Drawing connections in seeded data", async () => {
  await seed();
  const page = await plainPage();
  await signIn(page);
  const hn = "f=source%3Abdd-hn.example";

  await page.goto(`${BASE_URL}/insights?range=7d&${hn}`);
  const tile = page.locator("div[title='Distinct browsers']");
  assert.equal((await tile.locator(".font-display").textContent()).trim(), "10");
  await shot(page, "insights-02-overview-filtered", true);

  await page.goto(`${BASE_URL}/insights?range=7d&${hn}&view=funnels&step=p%3A%2F&step=p%3A${encodeURIComponent(POST)}&step=e%3Aoutbound_click`);
  const counts = await page.locator("ol li strong").allTextContents();
  assert.deepEqual(counts.slice(0, 3), ["10", "5", "5"]);
  await shot(page, "insights-03-funnel", true);

  await page.goto(`${BASE_URL}/insights?range=7d&f=source%3Abdd-*&did=e%3Aoutbound_click&view=sessions`);
  const sessionLinks = page.locator("tbody tr td:first-child a");
  assert.equal(await sessionLinks.count(), 5);
  await shot(page, "insights-04-sessions-did");
  await sessionLinks.first().click();
  await page.getByText(`Viewed ${POST}`).waitFor();
  await page.getByText("outbound_click").first().waitFor();
  await shot(page, "insights-05-session-timeline", true);

  const views = [
    ["breakdown&a=source&b=section", "insights-06-breakdown"],
    ["content", "insights-07-content"],
    [`journeys&path=${encodeURIComponent(POST)}`, "insights-08-journeys"],
    ["retention", "insights-09-retention"],
    ["events", "insights-10-events"],
  ];
  for (const [v, name] of views) {
    const res = await page.goto(`${BASE_URL}/insights?range=7d&f=source%3Abdd-*&view=${v}`);
    assert.equal(res.status(), 200, v);
    await shot(page, name, true);
  }
  const csv = await page.evaluate(async (u) => (await fetch(u)).text(), `${BASE_URL}/insights/export?range=7d&${hn}`);
  assert.equal(csv.trim().split("\n").length, 1 + 10 * 2 + 5 * 4 + 3, "CSV rows for the HN slice");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

await scenario("The dashboard fits a phone", async () => {
  await seed();
  const page = await plainPage({ width: 390, height: 844 });
  await signIn(page);
  await page.goto(`${BASE_URL}/insights?range=7d&f=source%3Abdd-*`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `page overflows by ${overflow}px`);
  await shot(page, "insights-11-phone", true);
  await page.context().close();
});

await clearTestEvents();
await clearSurveyPasses();
await client.end();
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} scenarios passed\n`);
process.exit(failed ? 1 : 0);
