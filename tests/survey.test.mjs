// Drives tests/survey.feature against a running build with the system Chrome. Needs
// DATABASE_URL for the local database (its rows all have visitor ids starting "bddtest", and it
// deletes them before and after) and the dashboard password the server was started with. Usage:
//   npx next build && ANALYTICS_PASSWORD=bdd-test-password ANALYTICS_DB_CONCURRENCY=1 npx next start -p 3123
//   BASE_URL=http://localhost:3123 INSIGHTS_PASSWORD=bdd-test-password \
//     PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core SCREENSHOT_DIR=/tmp/im-shots \
//     node tests/survey.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3123";
const PASSWORD = process.env.INSIGHTS_PASSWORD ?? "bdd-test-password";
const SHOTS = process.env.SCREENSHOT_DIR;
const pwPath = process.env.PLAYWRIGHT_CORE;
const { chromium } = await import(pwPath ? pathToFileURL(path.join(pwPath, "index.mjs")).href : "playwright-core");
try { process.loadEnvFile(".env"); } catch { /* environment provides DATABASE_URL */ }

const DEV = "/posts/fft-ocean-water";
const REVIEW = "/posts/kiri-lightweight-container-runtime-docker-alternative-review";
const GAME = "/posts/bankster-game-announcement";
/** The dev post's intro, and its first heading after the intro. */
const DEV_INTRO = "Phillips-spectrum height field";
const DEV_LATER = "actually being computed";
const CARD = 'section[aria-labelledby="im-survey-title"]';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const rows = async (sql, args = []) => (await client.query(sql, args)).rows;
const clearTestRows = async () => {
  await client.query(`DELETE FROM survey_responses WHERE "visitorId" LIKE 'bddtest%'`);
  await client.query(`DELETE FROM analytics_events WHERE "visitorId" LIKE 'bddtest%'`);
};

async function waitFor(fn, label, ms = 12_000) {
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
    await clearTestRows();
    await fn();
    results.push({ name, ok: true });
    console.log(`  [PASS] ${name} (${(performance.now() - start).toFixed(0)}ms)`);
  } catch (err) {
    results.push({ name, ok: false });
    console.error(`  [FAIL] ${name}\n`, err);
  }
}

async function shot(page, name, opts = {}) {
  if (!SHOTS) return;
  await fs.mkdir(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), ...opts });
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
let vseq = 0;
/**
 * A page under a known visitor id whose tracker may send. `storage` is extra localStorage;
 * `stored` also puts a survey response on record for the visitor. `window.__surveySeen` turns
 * true if the survey is ever in the page.
 */
async function newPage({ viewport = { width: 1440, height: 900 }, storage = {}, stored = false } = {}) {
  const visitor = `bddtest-survey-${Date.now().toString(36)}${vseq++}`;
  if (stored) {
    await client.query(
      `INSERT INTO survey_responses (id, version, "visitorId", "sessionId", path, work, found, source, "entryPath", device)
       VALUES ($1, 1, $1, 'bddtest-session', '/', 'game', 'reddit', 'direct', '/', 'desktop')`,
      [visitor],
    );
  }
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await context.addInitScript(
    ([v, extra]) => {
      try {
        localStorage.setItem("im_analytics_test", "1");
        localStorage.setItem("im_vid", v);
        for (const [k, x] of Object.entries(extra)) localStorage.setItem(k, x);
      } catch {
        // about:blank has no storage
      }
      window.__surveySeen = false;
      new MutationObserver(() => {
        if (document.getElementById("im-survey-title")) window.__surveySeen = true;
      }).observe(document, { childList: true, subtree: true });
    },
    [visitor, storage],
  );
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  page.on("response", (r) => r.status() >= 400 && !r.url().includes("/_vercel/") && page.errors.push(`${r.status()} ${r.url()}`));
  page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && page.errors.push(m.text()));
  return { page, visitor };
}

const eventsOf = (visitor) => rows(`SELECT name, props FROM analytics_events WHERE "visitorId" = $1 ORDER BY "at", id`, [visitor]);
const responsesOf = (visitor) => rows(`SELECT * FROM survey_responses WHERE "visitorId" = $1`, [visitor]);
const h2s = (page) => page.locator("#post-body > h2").count();
const chapters = (page) => page.getByText(/^CHAPTERS · \d+$/).count();

async function answer(page, work, found, notes = {}) {
  const card = page.locator(CARD);
  await card.waitFor();
  await card.getByLabel(work, { exact: true }).check();
  await card.getByLabel(found, { exact: true }).check();
  if (notes.work) await card.getByPlaceholder("Tell us more").fill(notes.work);
  if (notes.found) await card.getByPlaceholder("Where?").fill(notes.found);
  await card.getByRole("button", { name: "CONTINUE READING" }).click();
  await card.waitFor({ state: "detached" });
  await page.locator("#post-body > h2").first().waitFor();
}

console.log(`\nSurvey BDD suite against ${BASE_URL}\n`);

await scenario("A new reader sees the intro and the survey, not the rest", async () => {
  const { page, visitor } = await newPage();
  await page.goto(BASE_URL + DEV);
  const card = page.locator(CARD);
  await card.waitFor();
  assert.ok(await page.locator("#post-body > [data-lede]").isVisible(), "the intro is visible");
  assert.equal(await h2s(page), 0, "no article h2 in the page");
  assert.equal(await chapters(page), 0, "no chapter list");
  assert.ok(await card.getByText("What are you working on right now?").isVisible());
  assert.ok(await card.getByText("How did you find Indie Machine?").isVisible());
  assert.ok(await card.getByRole("button", { name: "CONTINUE READING" }).isDisabled());
  const html = await (await fetch(BASE_URL + DEV)).text();
  assert.ok(html.includes(DEV_INTRO), "the intro is in the HTML");
  assert.ok(!html.includes(DEV_LATER), "the rest of the post is not in the HTML");
  await shot(page, "survey-01-gate");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  await page.goto("about:blank");
  const ev = await waitFor(async () => {
    const e = await eventsOf(visitor);
    return e.some((x) => x.name === "survey_view") && e.some((x) => x.name === "pageview") ? e : null;
  }, "survey_view");
  assert.deepEqual(ev.find((x) => x.name === "survey_view").props, { version: 1 });
  assert.equal(ev.filter((x) => x.name === "read_depth").length, 0, "no read_depth before the rest arrives");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

await scenario("Answering opens the post and stores the answers", async () => {
  const { page, visitor } = await newPage();
  await page.goto(BASE_URL + DEV + "?utm_source=bdd-newsletter");
  const card = page.locator(CARD);
  await card.waitFor();
  await card.getByLabel("A game", { exact: true }).check();
  assert.ok(await card.getByRole("button", { name: "CONTINUE READING" }).isDisabled(), "still disabled with one answer");
  await card.getByLabel("Hacker News").check();
  await card.getByPlaceholder("Tell us more").fill("A roguelike in Rust, looking for wgpu tips");
  await shot(page, "survey-02-answered");
  const t0 = performance.now();
  await card.getByRole("button", { name: "CONTINUE READING" }).click();
  await card.waitFor({ state: "detached" });
  await page.locator("#post-body > h2").first().waitFor();
  const ms = performance.now() - t0;
  assert.ok((await h2s(page)) >= 3, "the article's h2s arrived");
  await waitFor(async () => (await chapters(page)) === 1, "the chapter list");
  await shot(page, "survey-03-open");

  const [r] = await responsesOf(visitor);
  assert.ok(r, "a response is stored");
  assert.equal(r.work, "game");
  assert.equal(r.found, "hn");
  assert.equal(r.workDetail, "A roguelike in Rust, looking for wgpu tips");
  assert.equal(r.foundDetail, null);
  assert.equal(r.path, DEV);
  assert.equal(r.source, "direct");
  assert.equal(r.utmSource, "bdd-newsletter");
  assert.equal(r.version, 1);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await page.goto("about:blank");
  const ev = await waitFor(async () => {
    const e = await eventsOf(visitor);
    return e.some((x) => x.name === "survey_submit") && e.some((x) => x.name === "read_depth" && x.props.pct === 100) ? e : null;
  }, "survey_submit and read_depth 100");
  assert.deepEqual(ev.find((x) => x.name === "survey_submit").props, { version: 1, ok: true, work: "game", found: "hn", detail: true });
  assert.deepEqual(page.errors, []);
  console.log(`    stored ${r.work}/${r.found} from ${r.source} (${r.utmSource}); rest of the post in ${ms.toFixed(0)} ms`);
  await page.context().close();
});

await scenario("Answered once, every post is open", async () => {
  const { page } = await newPage({ storage: { im_survey_done: "1" }, stored: true });
  for (const url of [REVIEW, GAME]) {
    const t0 = performance.now();
    await page.goto(BASE_URL + url);
    await page.locator("#post-body > h2").first().waitFor();
    console.log(`    ${url}: rest arrived ${(performance.now() - t0).toFixed(0)} ms after navigation started`);
    assert.equal(await page.evaluate(() => window.__surveySeen), false, `${url}: survey never shown`);
  }
  const next = page.getByRole("region", { name: "Up next" }).locator('a[href^="/posts/"]').first();
  const href = await next.getAttribute("href");
  await next.scrollIntoViewIfNeeded();
  await next.click();
  await page.waitForURL(`**${href}`);
  await page.locator("#post-body > h2").first().waitFor();
  assert.equal(await page.locator(CARD).count(), 0, `${href}: no survey after client navigation`);
  assert.equal(await page.evaluate(() => window.__surveySeen), false, "survey never shown");
  assert.deepEqual(page.errors, []);
  console.log(`    client-navigated to ${href}`);
  await page.context().close();
});

await scenario("The server decides, not the browser", async () => {
  const { page, visitor } = await newPage({ storage: { im_survey_done: "1" } });
  await page.goto(BASE_URL + DEV);
  await page.locator(CARD).waitFor();
  assert.equal(await h2s(page), 0, "the rest was not sent");
  assert.equal(await page.evaluate(() => localStorage.getItem("im_survey_done")), null, "the stale flag is cleared");
  assert.equal((await responsesOf(visitor)).length, 0);
  await page.context().close();
});

await scenario("Phones get the same gate", async () => {
  const { page } = await newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE_URL + REVIEW);
  const card = page.locator(CARD);
  await card.waitFor();
  await card.scrollIntoViewIfNeeded();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `page overflows by ${overflow}px`);
  const box = await card.boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 390, `card spans ${box.x}..${box.x + box.width}`);
  if (SHOTS) {
    await fs.mkdir(SHOTS, { recursive: true });
    await card.screenshot({ path: path.join(SHOTS, "survey-04-phone.png") });
  }
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

await scenario("Answering again replaces the earlier answers", async () => {
  const { page, visitor } = await newPage();
  await page.goto(BASE_URL + DEV);
  await answer(page, "AI / ML models or agents", "Somewhere else", { found: "a podcast" });
  const [first] = await responsesOf(visitor);
  assert.equal(first.foundDetail, "a podcast");
  await page.evaluate(() => localStorage.removeItem("im_survey_done"));
  await page.reload();
  await answer(page, "A web app or SaaS", "Hacker News");
  const stored = await responsesOf(visitor);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].work, "web");
  assert.equal(stored[0].found, "hn");
  assert.equal(stored[0].foundDetail, null, "found free text dropped unless 'other'");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

async function signIn(page) {
  await page.goto(BASE_URL + "/insights");
  await page.getByLabel("PASSWORD").fill(PASSWORD);
  await page.getByRole("button", { name: "SIGN IN" }).click();
  await page.getByRole("navigation", { name: "Views" }).waitFor();
}

await scenario("The Survey view shows what readers said", async () => {
  const seed = [
    ...Array.from({ length: 6 }, () => ["game", null, "reddit", null, "reddit.com"]),
    ...Array.from({ length: 4 }, () => ["ai", null, "search", null, "direct"]),
    ["other", "BDD note: building a synth plugin", "other", "a Discord server", "direct"],
    ["learning", "BDD note: learning wgpu", "friend", null, "direct"],
  ];
  for (const [i, [work, workDetail, found, foundDetail, source]] of seed.entries()) {
    await client.query(
      `INSERT INTO survey_responses (id, version, "visitorId", "sessionId", path, work, "workDetail", found, "foundDetail", source, "entryPath", device, country)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $4, 'desktop', 'US')`,
      [`bddtest-seed-${i}`, `bddtest-seed-v${i}`, `bddtest-seed-s${i}`, DEV, work, workDetail, found, foundDetail, source],
    );
  }
  const { page } = await newPage();
  await signIn(page);
  await page.getByRole("link", { name: "Survey", exact: true }).click();
  await page.waitForURL("**view=survey**");
  const tile = page.locator("div", { hasText: /^Responses/ }).locator("div.font-display").first();
  const responses = Number((await tile.textContent()).replace(/,/g, ""));
  assert.ok(responses >= 12, `Responses tile says ${responses}`);
  for (const label of ["A game", "Dev tools or infrastructure", "Reddit", "Somewhere else"]) {
    assert.ok(await page.getByRole("cell", { name: label, exact: true }).first().isVisible(), `choice "${label}" listed`);
  }
  const words = page.getByRole("region", { name: "In their own words" });
  assert.ok(await words.getByText("BDD note: building a synth plugin").isVisible());
  assert.ok(await words.getByText("BDD note: learning wgpu").isVisible());
  await shot(page, "survey-05-insights", { fullPage: true });

  const csvHref = await page.getByRole("link", { name: "EXPORT CSV" }).getAttribute("href");
  const csv = await (await page.request.get(BASE_URL + csvHref)).text();
  const seeded = csv.split("\n").filter((l) => l.startsWith("bddtest-seed-"));
  assert.equal(seeded.length, seed.length, `CSV rows for the seed: ${seeded.length}`);
  assert.ok(csv.split("\n")[0].startsWith("id,at,version,path,work,workDetail"));
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

await clearTestRows();
await client.end();
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} scenarios passed\n`);
process.exit(failed ? 1 : 0);
