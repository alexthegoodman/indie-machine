// Drives tests/free-ai.feature against a running build with the system Chrome. Events are
// caught at /api/events in the browser (page.route), so no database is needed.
// Usage:
//   npx next build && npx next start -p 3123
//   BASE_URL=http://localhost:3123 SCREENSHOT_DIR=/tmp/im-shots node tests/free-ai.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3123";
const SHOTS = process.env.SCREENSHOT_DIR;
const pwPath = process.env.PLAYWRIGHT_CORE;
const { chromium } = await import(pwPath ? pathToFileURL(path.join(pwPath, "index.mjs")).href : "playwright-core");

const PAGE = "/free-ai";
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

// WebGPU in headless Chrome needs these; without an adapter Yumon falls back to the CPU.
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-unsafe-webgpu", "--enable-gpu"] });

/** A context whose tracker may send (navigator.webdriver is set); every event lands in `events`. */
async function newContext(viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce", acceptDownloads: true });
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

const app = (page) => page.getByRole("region", { name: "Yumon threads" });
const threadList = (page) => app(page).getByRole("navigation", { name: "Threads" }).locator("ul > li");
const agent = (page) => app(page).getByRole("complementary", { name: "Agent" });
const agentStatus = (page) => agent(page).getByTestId("agent-status");
const input = (page) => app(page).getByRole("textbox", { name: "Message Yumon" });
const events = (context, name) => context.events.filter((e) => e.n === name);
const flushEvents = (page) =>
  page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    delete document.visibilityState;
  });

async function awake(page) {
  await waitFor(async () => /AWAKE/.test(await agentStatus(page).innerText()), "Yumon to wake", WAKE_MS);
}

async function wake(page) {
  await app(page).getByRole("button", { name: /WAKE YUMON/ }).first().click();
  await awake(page);
}

/** Finished Yumon replies in the open thread (each has its token meta line). */
const replies = (page) => app(page).locator("div.self-start").filter({ has: page.locator("span", { hasText: "ms/token" }) });

async function waitReply(page, count) {
  return waitFor(
    async () => {
      if ((await replies(page).count()) < count) return null;
      // Done writing: the agent panel leaves WRITING.
      if (/WRITING/.test(await agentStatus(page).innerText())) return null;
      return replies(page).nth(count - 1).innerText();
    },
    `Yumon reply ${count}`,
    WAKE_MS,
  );
}

async function send(page, text) {
  await input(page).fill(text);
  await input(page).press("Enter");
}

/** Set a range input the way a drag would, so React sees the change. */
async function setSlider(page, name, value) {
  await agent(page)
    .getByRole("slider", { name })
    .evaluate((el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(v));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
}

const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("im-yumon-threads-v1") ?? "null"));

/** A context and page on /free-ai with Yumon awake and `threads` finished one-turn threads. */
async function seeded(threads) {
  const context = await newContext({ width: 1440, height: 900 });
  const page = await newPage(context);
  await page.goto(BASE_URL + PAGE);
  await app(page).waitFor();
  await wake(page);
  for (let i = 0; i < threads; i++) {
    if (i > 0) await app(page).getByRole("button", { name: "+ NEW THREAD" }).click();
    await send(page, i === 0 ? TYPED : "hello there");
    await waitReply(page, 1);
  }
  return { context, page };
}

console.log(`\nFree AI BDD suite against ${BASE_URL}\n`);

await scenario("The page shows the thread manager and downloads nothing until Yumon is woken", async () => {
  const context = await newContext({ width: 1440, height: 900 });
  const page = await newPage(context);
  await page.goto(BASE_URL + PAGE);
  await app(page).waitFor();
  await waitFor(async () => (await threadList(page).count()) === 1, "one thread in the list");
  const nav = await app(page).getByRole("navigation", { name: "Threads" }).boundingBox();
  const head = await app(page).locator("h2").first().boundingBox();
  const side = await agent(page).boundingBox();
  assert.ok(nav.x + nav.width <= head.x && head.x + head.width <= side.x, "list | thread | agent, left to right");
  assert.equal(await app(page).locator("h2").first().innerText(), "New thread");
  assert.equal(await page.locator('a[href*="YumonPortal"], a[href*="releases/download"]').count(), 0, "no Portal download");
  assert.ok(!context.requests.some((u) => u.includes("/yumon/loop1-int4/")), "no model file requested before waking");
  await shot(page, "free-ai-01-asleep");
  assert.deepEqual(page.errors, []);
  await context.close();
});

await scenario("Chatting names the thread and records usage without text", async () => {
  const context = await newContext({ width: 1440, height: 900 });
  const page = await newPage(context);
  await page.goto(BASE_URL + PAGE);
  await app(page).waitFor();
  const t0 = Date.now();
  await wake(page);
  console.log(`    woke in ${Date.now() - t0} ms on ${await agentStatus(page).innerText()}`);
  await app(page).getByRole("button", { name: "Hi Yumon!" }).click();
  console.log(`    reply 1: ${JSON.stringify(await waitReply(page, 1))}`);
  assert.equal(await app(page).locator("h2").first().innerText(), "Hi Yumon!");
  await send(page, TYPED);
  console.log(`    reply 2: ${JSON.stringify(await waitReply(page, 2))}`);
  const stats = await agent(page).innerText();
  assert.match(stats, /REPLIES\s+2/);
  console.log(`    stats: ${stats.match(/AVG SPEED\s+(.+)/)?.[1]}`);
  await shot(page, "free-ai-02-chatting");
  if (SHOTS) {
    // The page's share image (public/images/free-ai-yumon-threads.png) is this capture.
    await page.evaluate(() => window.scrollTo(0, 0));
    await app(page).screenshot({ path: path.join(SHOTS, "free-ai-02-app.png") });
  }
  await flushEvents(page);
  const msgs = await waitFor(() => (events(context, "yumon_message").length >= 2 ? events(context, "yumon_message") : null), "two yumon_message events");
  const load = events(context, "yumon_load");
  assert.equal(load.length, 1);
  assert.equal(load[0].props.ok, true);
  assert.equal(load[0].p, PAGE);
  assert.deepEqual(msgs.map((m) => [m.props.ok, m.props.source, m.props.turn]), [[true, "suggestion", 1], [true, "input", 2]]);
  const raw = JSON.stringify(context.events).toLowerCase();
  assert.ok(!raw.includes("favorite food") && !raw.includes("hi yumon"), "no message text in events");
  assert.deepEqual(page.errors, []);
  await context.close();
});

await scenario("Threads survive a reload and keep their own settings", async () => {
  const { context, page } = await seeded(1);
  await app(page).getByRole("button", { name: "+ NEW THREAD" }).click();
  await waitFor(async () => (await app(page).locator("h2").first().innerText()) === "New thread", "a fresh thread");
  await agent(page).getByRole("checkbox", { name: "Memory of earlier turns" }).uncheck();
  await setSlider(page, /^Temperature/, 0);
  assert.match(await agent(page).innerText(), /0 \(greedy\)/);
  await send(page, "tell me a story");
  await waitReply(page, 1);
  assert.equal(await threadList(page).count(), 2);
  const newest = await app(page).locator("h2").first().innerText();
  assert.equal(newest, "tell me a story");
  await shot(page, "free-ai-03-two-threads");
  await page.reload();
  await app(page).waitFor();
  await awake(page);
  await waitFor(async () => (await threadList(page).count()) === 2, "both threads after reload");
  assert.equal(await app(page).locator("h2").first().innerText(), newest, "newer thread still open");
  assert.equal(await agent(page).getByRole("checkbox", { name: "Memory of earlier turns" }).isChecked(), false);
  assert.match(await agent(page).innerText(), /0 \(greedy\)/);
  await threadList(page).nth(1).getByRole("button").click();
  await waitFor(async () => (await app(page).locator("h2").first().innerText()) === TYPED, "older thread open");
  assert.equal(await agent(page).getByRole("checkbox", { name: "Memory of earlier turns" }).isChecked(), true);
  const saved = await stored(page);
  assert.equal(saved.threads.length, 2);
  assert.deepEqual(page.errors, []);
  await context.close();
});

await scenario("Rename, pin, regenerate, export and delete a thread", async () => {
  const { context, page } = await seeded(2);
  await app(page).getByRole("button", { name: "RENAME" }).click();
  await app(page).getByRole("textbox", { name: "Thread title" }).fill("Food talk");
  await app(page).getByRole("button", { name: "SAVE" }).click();
  await app(page).getByRole("button", { name: "PIN", exact: true }).click();
  // Make the other thread newer so only the pin can put "Food talk" first.
  await threadList(page).nth(1).getByRole("button").click();
  await send(page, "one more");
  await waitReply(page, 2);
  const first = threadList(page).first();
  assert.match(await first.innerText(), /Food talk/);
  assert.equal(await first.getByLabel("Pinned").count(), 1);
  await first.getByRole("button").click();
  await waitFor(async () => (await app(page).locator("h2").first().innerText()) === "Food talk", "Food talk open");
  const before = await replies(page).last().innerText();
  await app(page).getByRole("button", { name: /REGENERATE/ }).click();
  const after = await waitReply(page, 1);
  assert.equal(await replies(page).count(), 1, "the reply is replaced, not added");
  console.log(`    regenerated: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  await shot(page, "free-ai-04-pinned");
  const [download] = await Promise.all([page.waitForEvent("download"), app(page).getByRole("button", { name: "EXPORT .MD" }).click()]);
  assert.equal(download.suggestedFilename(), "food-talk.md");
  const md = await fs.readFile(await download.path(), "utf8");
  assert.match(md, /^# Food talk/);
  assert.ok(md.includes("**You:** hello there"), "export has the message");
  await app(page).getByRole("button", { name: "DELETE", exact: true }).click();
  await app(page).getByRole("button", { name: "CONFIRM DELETE" }).click();
  await waitFor(async () => (await threadList(page).count()) === 1, "one thread left");
  assert.doesNotMatch(await threadList(page).first().innerText(), /Food talk/);
  await flushEvents(page);
  await waitFor(() => events(context, "yumon_message").some((e) => e.props.source === "regenerate"), "regenerate event");
  const actions = await waitFor(() => {
    const a = events(context, "yumon_thread").map((e) => e.props.action);
    return a.includes("delete") ? a : null;
  }, "yumon_thread delete");
  console.log(`    thread actions: ${actions.join(", ")}`);
  for (const a of ["new", "rename", "pin", "export", "delete"]) assert.ok(actions.includes(a), `yumon_thread ${a}`);
  assert.ok(!JSON.stringify(context.events).toLowerCase().includes("food talk"), "no title in events");
  assert.deepEqual(page.errors, []);
  await context.close();
});

await scenario("Stopping a reply keeps what Yumon said so far", async () => {
  const context = await newContext({ width: 1440, height: 900 });
  const page = await newPage(context);
  await page.goto(BASE_URL + PAGE);
  await app(page).waitFor();
  await wake(page);
  await setSlider(page, /^Max reply tokens/, 256);
  let stopped = null;
  // A reply can end on its own before the click lands; try a few times.
  for (let attempt = 1; attempt <= 4 && !stopped; attempt++) {
    await send(page, "tell me a long story");
    const stop = app(page).getByRole("button", { name: "STOP" });
    try {
      await stop.click({ timeout: 10_000 });
    } catch {
      console.log(`    attempt ${attempt}: reply finished before STOP`);
      await waitReply(page, attempt);
      continue;
    }
    const text = await waitReply(page, attempt);
    if (/stopped/.test(text)) stopped = text;
    else console.log(`    attempt ${attempt}: reply ended on its own`);
  }
  assert.ok(stopped, "a reply was stopped");
  console.log(`    stopped reply: ${JSON.stringify(stopped)}`);
  await shot(page, "free-ai-05-stopped");
  assert.deepEqual(page.errors, []);
  await context.close();
});

await scenario("Narrow screens fold the thread list behind a button", async () => {
  const context = await newContext({ width: 390, height: 844 });
  const page = await newPage(context);
  await page.goto(BASE_URL + PAGE);
  await app(page).waitFor();
  const search = app(page).getByRole("searchbox", { name: "Search threads" });
  await waitFor(async () => (await threadList(page).count()) === 1, "thread list hydrated");
  assert.equal(await search.isVisible(), false, "list folded");
  assert.equal(await input(page).isVisible(), true, "composer visible");
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(width <= 390, `no horizontal scroll (${width}px)`);
  await shot(page, "free-ai-06-mobile");
  await app(page).getByRole("button", { name: /THREADS/ }).click();
  assert.equal(await search.isVisible(), true, "list open");
  await shot(page, "free-ai-07-mobile-list");
  assert.deepEqual(page.errors, []);
  await context.close();
});

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
