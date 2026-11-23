// Drives tests/yumon-chat.feature against a running build with the system Chrome. Events are
// caught at /api/events in the browser (page.route), so no database is needed.
// Usage:
//   npx next build && npx next start -p 3123
//   BASE_URL=http://localhost:3123 SCREENSHOT_DIR=/tmp/im-shots node tests/yumon-chat.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { allowPosts, storeSurveyPass } from "./survey-pass.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3123";
const SHOTS = process.env.SCREENSHOT_DIR;
const pwPath = process.env.PLAYWRIGHT_CORE;
const { chromium } = await import(pwPath ? pathToFileURL(path.join(pwPath, "index.mjs")).href : "playwright-core");

const POST = "/posts/kiri-lightweight-container-runtime-docker-alternative-review";
const TYPED = "what is your favorite food?";
const WAKE_MS = 90_000;

const results = [];
async function scenario(name, fn) {
  const start = performance.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  [PASS] ${name} (${(performance.now() - start).toFixed(0)}ms)`);
  } catch (err) {
    results.push({ name, ok: false });
    console.error(`  [FAIL] ${name}\n`, err);
  }
}

async function shot(page, name) {
  if (!SHOTS) return;
  await fs.mkdir(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function waitFor(fn, what, ms = 20_000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

await storeSurveyPass();
// WebGPU in headless Chrome needs these; without an adapter Yumon falls back to the CPU.
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-unsafe-webgpu", "--enable-gpu"] });

/** A context whose tracker may send (navigator.webdriver is set); every event lands in `events`. */
async function newContext(viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  // Past the reader survey (tests/survey.feature), which would stop posts after their intro.
  await allowPosts(context);
  await context.addInitScript(() => {
    try {
      localStorage.setItem("im_analytics_test", "1");
    } catch {
      // about:blank has no storage
    }
  });
  context.events = [];
  context.requests = [];
  await context.route("**/api/events", async (route) => {
    const batch = JSON.parse(route.request().postData() ?? "{}");
    context.events.push(...(batch.e ?? []));
    await route.fulfill({ status: 204 });
  });
  context.on("request", (r) => context.requests.push(r.url()));
  return context;
}

async function newPage(context) {
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  page.on("response", (r) => r.status() >= 400 && !r.url().includes("/_vercel/") && page.errors.push(`${r.status()} ${r.url()}`));
  page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && page.errors.push(m.text()));
  return page;
}

const chat = (page) => page.getByRole("region", { name: "Chat with Yumon" });
const status = (page) => chat(page).locator("header [aria-live]");
const yumonEvents = (context, name) => context.events.filter((e) => e.n === name);
// The tracker flushes every few seconds; hiding the page sends the queue at once.
const flushEvents = (page) =>
  page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    delete document.visibilityState;
  });

async function wake(page) {
  await chat(page).getByRole("button", { name: /WAKE YUMON/ }).click();
  await waitFor(async () => /AWAKE/.test(await status(page).innerText()), "Yumon to wake", WAKE_MS);
}

/** Text of the newest Yumon bubble once it has a reply with its token meta line. */
async function waitReply(page, count) {
  return waitFor(
    async () => {
      const bubbles = chat(page).locator("div.self-start").filter({ has: page.locator("span", { hasText: "ms/token" }) });
      if ((await bubbles.count()) < count) return null;
      return bubbles.nth(count - 1).innerText();
    },
    `Yumon reply ${count}`,
    WAKE_MS,
  );
}

console.log(`\nYumon chat BDD suite against ${BASE_URL}\n`);

await scenario("Wide screens show the chat left of the article and no right sidebar", async () => {
  const context = await newContext({ width: 1440, height: 900 });
  const page = await newPage(context);
  await page.goto(BASE_URL + POST);
  await chat(page).waitFor();
  const c = await chat(page).boundingBox();
  const article = await page.locator("#post-body").boundingBox();
  const column = await page.locator("h1").first().evaluate((h) => {
    const r = h.closest("div.min-w-0").getBoundingClientRect();
    return { x: r.x, width: r.width };
  });
  const main = await page.locator("#main").boundingBox();
  assert.ok(c.x + c.width <= column.x, "chat is left of the article column");
  const share = c.width / (c.width + column.width);
  assert.ok(share > 0.27 && share < 0.33, `chat share ${share.toFixed(2)}`);
  assert.ok(article.x >= column.x, "article body is in the column");
  assert.ok(main.x + main.width - (column.x + column.width) < 40, "the article column reaches the right edge");
  assert.equal(await page.locator('section[aria-label="Chapters"]').count(), 0, "no chapters side panel");
  const inColumn = await page.locator("h1").first().evaluate((h) => {
    const col = h.closest("div.min-w-0");
    return { chapters: !!col.querySelector("details summary"), upNext: !!col.querySelector('section[aria-label="Up next"]') };
  });
  assert.ok(inColumn.chapters && inColumn.upNext, `chapters + up next in the column: ${JSON.stringify(inColumn)}`);
  assert.ok(!context.requests.some((u) => u.includes("/yumon/cp1-int4/")), "no model file requested before waking");
  await shot(page, "yumon-01-layout-desktop");
  await page.evaluate(() => document.querySelector('section[aria-label="Up next"]').scrollIntoView());
  await page.waitForTimeout(300);
  await shot(page, "yumon-02-up-next-in-body");
  assert.deepEqual(page.errors, []);
  await context.close();
});

await scenario("Waking Yumon and chatting records usage without message text", async () => {
  const context = await newContext({ width: 1440, height: 900 });
  const page = await newPage(context);
  await page.goto(BASE_URL + POST);
  await chat(page).waitFor();
  await shot(page, "yumon-03-asleep");
  const t0 = Date.now();
  await wake(page);
  console.log(`    woke in ${Date.now() - t0} ms on ${await status(page).innerText()}`);
  const weights = context.requests.filter((u) => u.endsWith("/model-int4.safetensors"));
  console.log(`    weights from ${weights.join(", ")}`);
  assert.equal(weights.length, 1, "weights fetched once");
  await chat(page).getByRole("button", { name: "Hi Yumon!" }).click();
  const first = await waitReply(page, 1);
  console.log(`    reply 1: ${JSON.stringify(first)}`);
  await chat(page).getByRole("textbox", { name: "Message Yumon" }).fill(TYPED);
  await chat(page).getByRole("button", { name: "SEND" }).click();
  const second = await waitReply(page, 2);
  console.log(`    reply 2: ${JSON.stringify(second)}`);
  await shot(page, "yumon-04-chatting");
  await flushEvents(page);
  const msgs = await waitFor(() => (yumonEvents(context, "yumon_message").length >= 2 ? yumonEvents(context, "yumon_message") : null), "two yumon_message events");
  const load = yumonEvents(context, "yumon_load");
  assert.equal(load.length, 1);
  assert.equal(load[0].props.ok, true);
  assert.equal(load[0].props.auto, false);
  assert.equal(load[0].p, POST);
  assert.deepEqual(msgs.map((m) => [m.props.ok, m.props.source, m.props.turn]), [[true, "suggestion", 1], [true, "input", 2]]);
  assert.equal(msgs[1].props.chars, TYPED.length);
  console.log(`    events: ${JSON.stringify([...load, ...msgs].map((e) => [e.n, e.props]))}`);
  const raw = JSON.stringify(context.events).toLowerCase();
  assert.ok(!raw.includes("favorite food") && !raw.includes("hi yumon"), "no message text in events");
  assert.deepEqual(page.errors, []);
  await context.close();
});

await scenario("The model and conversation survive moving to the next post", async () => {
  const context = await newContext({ width: 1440, height: 900 });
  const page = await newPage(context);
  await page.goto(BASE_URL + POST);
  await wake(page);
  await chat(page).getByRole("button", { name: "Hi Yumon!" }).click();
  await waitReply(page, 1);
  // Auto-advance off, or the end card's countdown navigates on its own while we scroll past it.
  const upNext = page.locator('section[aria-label="Up next"]');
  const auto = upNext.getByRole("switch", { name: "AUTO-ADVANCE" });
  await auto.evaluate((el) => el.scrollIntoView({ block: "center" }));
  if ((await auto.getAttribute("aria-checked")) === "true") await auto.click();
  // Click the card (its link's ::after covers it): the link's own box includes title lines
  // that line-clamp hides, and Playwright may aim at one of those.
  const card = upNext.locator("article").first();
  const href = await card.locator('a[href^="/posts/"]').getAttribute("href");
  await card.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await card.click();
  await page.waitForURL(`**${href}`);
  await page.locator("h1").first().waitFor();
  assert.match(await status(page).innerText(), /AWAKE/);
  assert.ok(await chat(page).getByText("Hi Yumon!").count(), "earlier message still shown");
  await shot(page, "yumon-05-next-post");
  await flushEvents(page);
  await page.waitForTimeout(500);
  assert.equal(yumonEvents(context, "yumon_load").length, 1, "one load for both posts");
  assert.deepEqual(page.errors, []);
  await context.close();
});

await scenario("A browser that woke Yumon before loads it without a click", async () => {
  const context = await newContext({ width: 1440, height: 900 });
  await context.addInitScript(() => localStorage.setItem("im_yumon_auto", "1"));
  const page = await newPage(context);
  await page.goto(BASE_URL + POST);
  await waitFor(async () => /AWAKE/.test(await status(page).innerText()), "Yumon to wake on its own", WAKE_MS);
  await flushEvents(page);
  const load = await waitFor(() => yumonEvents(context, "yumon_load")[0], "yumon_load");
  assert.equal(load.props.ok, true);
  assert.equal(load.props.auto, true);
  assert.deepEqual(page.errors, []);
  await context.close();
});

await scenario("Narrow screens collapse the chat above the article", async () => {
  const context = await newContext({ width: 390, height: 844 });
  const page = await newPage(context);
  await page.goto(BASE_URL + POST);
  await chat(page).waitFor();
  const c = await chat(page).boundingBox();
  const h1 = await page.locator("h1").first().boundingBox();
  assert.ok(c.height < 80, `collapsed bar (${c.height}px)`);
  assert.ok(c.y < h1.y, "chat bar is above the article");
  assert.equal(await chat(page).getByRole("textbox", { name: "Message Yumon" }).isVisible(), false);
  await shot(page, "yumon-06-mobile-collapsed");
  await chat(page).getByRole("button", { name: "OPEN" }).click();
  assert.equal(await chat(page).getByRole("textbox", { name: "Message Yumon" }).isVisible(), true);
  await shot(page, "yumon-07-mobile-open");
  await flushEvents(page);
  await waitFor(() => yumonEvents(context, "yumon_open")[0], "yumon_open");
  assert.ok(!context.requests.some((u) => u.includes("/yumon/cp1-int4/")), "opening alone downloads nothing");
  assert.deepEqual(page.errors, []);
  await context.close();
});

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
