// Drives tests/free-ai-gherkin.feature against a running build with the system Chrome. Events are
// caught at /api/events in the browser (page.route), so no database is needed.
// The greedy scenario compares with hyperfield's recorded int4 comparison (hyperfield
// `npx playwright test -g "Yumon Gherkin"` writes tests/output/yumon-gherkin-webgpu.json).
// Usage:
//   npx next build && npx next start -p 3123
//   BASE_URL=http://localhost:3123 SCREENSHOT_DIR=/tmp/im-shots node tests/free-ai-gherkin.test.mjs
//   (HYPERFIELD_COMPARE=<path> overrides the comparison file)
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3123";
const SHOTS = process.env.SCREENSHOT_DIR;
const COMPARE =
  process.env.HYPERFIELD_COMPARE ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "hyperfield", "tests", "output", "yumon-gherkin-webgpu.json");
const pwPath = process.env.PLAYWRIGHT_CORE;
const { chromium } = await import(pwPath ? pathToFileURL(path.join(pwPath, "index.mjs")).href : "playwright-core");

const PAGE = "/free-ai/gherkin";
const MODEL_FOLDER = "/yumon/gherkin-proc-1024-extended-int4/";
const VEHICLES =
  "Feature: Vehicles API\n  As an API client\n  I want to create, read, update and delete vehicles over HTTP\n  So that other systems can work with vehicles\n\n  Background:\n    Given";
const TYPED = "Feature: Invoice export\n  As an accountant\n  I want to export invoices\n  So that I can file my taxes\n\n  Scenario: Export as CSV\n    Given";
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

async function shot(page, name, locator) {
  if (!SHOTS) return;
  await fs.mkdir(SHOTS, { recursive: true });
  await (locator ?? page).screenshot({ path: path.join(SHOTS, `${name}.png`) });
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
  const context = await browser.newContext({ viewport, reducedMotion: "reduce", permissions: ["clipboard-read", "clipboard-write"] });
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

const writer = (page) => page.getByRole("region", { name: "Gherkin writer" });
const panel = (page) => writer(page).getByRole("complementary", { name: "Model" });
const status = (page) => writer(page).getByTestId("gherkin-status");
const editor = (page) => writer(page).getByRole("textbox", { name: "// YOUR OPENING" });
const meta = (page) => writer(page).getByTestId("gherkin-meta");
const continuation = (page) => writer(page).getByTestId("gherkin-continuation");
const events = (context, name) => context.events.filter((e) => e.n === name);
const flushEvents = (page) =>
  page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    delete document.visibilityState;
  });

/** Set a range input the way a drag would, so React sees the change. */
async function setSlider(page, name, value) {
  await panel(page)
    .getByRole("slider", { name })
    .evaluate((el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(v));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
}

const continueButton = (page) => writer(page).getByRole("button", { name: /CONTINUE/ });

/** Waits for the continuation to finish (the meta line gets its ms/token). */
const finished = (page) => waitFor(async () => (/ms\/token/.test((await meta(page).innerText().catch(() => "")) ?? "") ? meta(page).innerText() : null), "the continuation to finish", WAKE_MS + 60_000);

console.log(`\nGherkin writer BDD suite against ${BASE_URL}\n`);

await scenario("The page downloads nothing until Yumon is woken, and /free-ai links to it", async () => {
  const context = await newContext({ width: 1440, height: 900 });
  const page = await newPage(context);
  await page.goto(BASE_URL + "/free-ai");
  const link = page.getByTestId("gherkin-link");
  assert.equal(await link.getAttribute("href"), PAGE);
  await link.click();
  await page.waitForURL("**" + PAGE);
  await writer(page).waitFor();
  assert.ok((await editor(page).inputValue()).startsWith("Feature: Recipe form"), "first example preloaded");
  assert.equal(await writer(page).getByTestId("gherkin-examples").getByRole("button").count(), 6);
  assert.match(await status(page).innerText(), /ASLEEP/);
  assert.match(await panel(page).innerText(), /gherkin-proc-1024-extended · int4/);
  assert.ok(!context.requests.some((u) => u.includes(MODEL_FOLDER)), "no model file requested before waking");
  await shot(page, "gherkin-01-asleep");
  assert.deepEqual(page.errors, []);
  await context.close();
});

await scenario("A greedy continuation matches Hyperfield's int4 output for the same opening", async () => {
  const compare = JSON.parse(await fs.readFile(COMPARE, "utf8"));
  const ref = compare.replies.find((r) => r.variant === "int4" && r.mode === "greedy" && r.prompt === VEHICLES);
  assert.ok(ref, `no int4 greedy reply for the Vehicles API opening in ${COMPARE}`);
  const context = await newContext({ width: 1440, height: 900 });
  const page = await newPage(context);
  await page.goto(BASE_URL + PAGE);
  await writer(page).waitFor();
  await writer(page).getByRole("button", { name: "Vehicles API" }).click();
  assert.equal(await editor(page).inputValue(), VEHICLES);
  await setSlider(page, "Temperature", 0);
  const t0 = Date.now();
  await continueButton(page).click();
  const m = await finished(page);
  console.log(`    ${m} (${Date.now() - t0} ms incl. wake, ${await status(page).innerText()})`);
  await writer(page).getByRole("checkbox", { name: /as written/ }).check();
  const raw = await continuation(page).innerText();
  console.log(`    as written: ${JSON.stringify(raw.slice(0, 160))}`);
  assert.ok(raw.startsWith(ref.text), `page continuation starts with hyperfield's int4 greedy text\n page: ${JSON.stringify(raw.slice(0, ref.text.length + 20))}\n  ref: ${JSON.stringify(ref.text)}`);
  await writer(page).getByRole("checkbox", { name: /as written/ }).uncheck();
  const shown = await continuation(page).innerText();
  assert.match(shown, /\n\s+(And|Given|When|Then) /, "keywords capitalized for display");
  assert.doesNotMatch(shown, /\n\s+(and|given|when|then) /, "no lowercase line-leading keywords left");
  await shot(page, "gherkin-02-vehicles");
  if (SHOTS) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, "gherkin-02-app", writer(page));
  }
  await flushEvents(page);
  const writes = await waitFor(() => (events(context, "gherkin_write").length ? events(context, "gherkin_write") : null), "a gherkin_write event");
  const loads = events(context, "gherkin_load");
  assert.equal(loads.length, 1);
  assert.equal(loads[0].props.ok, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].props.ok, true);
  assert.equal(writes[0].props.source, "example");
  assert.equal(writes[0].props.temperature, 0);
  console.log(`    gherkin_write: ${JSON.stringify(writes[0].props)}`);
  const all = JSON.stringify(context.events);
  assert.ok(!all.includes("Vehicles API") && !all.includes("vehicles"), "no event carries the opening's text");
  assert.deepEqual(page.errors, []);
  await context.close();
});

await scenario("A typed opening, STOP, and USE AS OPENING", async () => {
  const context = await newContext({ width: 1440, height: 900 });
  const page = await newPage(context);
  await page.goto(BASE_URL + PAGE);
  await writer(page).waitFor();
  await panel(page).getByRole("button", { name: /WAKE YUMON/ }).click();
  await waitFor(async () => /AWAKE/.test(await status(page).innerText()), "Yumon to wake", WAKE_MS);
  await editor(page).fill(TYPED);
  await setSlider(page, "Max new tokens", 255);
  await continueButton(page).click();
  await waitFor(async () => ((await continuation(page).innerText().catch(() => "")).length > 20 ? true : null), "some text", 60_000);
  await writer(page).getByRole("button", { name: "STOP" }).click();
  const m = await finished(page);
  console.log(`    ${m}`);
  assert.match(m, /stopped$/);
  const text = await continuation(page).innerText();
  console.log(`    stopped text: ${JSON.stringify(text)}`);
  await flushEvents(page);
  const writes = await waitFor(() => (events(context, "gherkin_write").length ? events(context, "gherkin_write") : null), "a gherkin_write event");
  assert.equal(writes[0].props.source, "input");
  assert.equal(writes[0].props.end, "stopped");
  await writer(page).getByRole("button", { name: "USE AS OPENING" }).click();
  const value = await editor(page).inputValue();
  assert.ok(value.startsWith(TYPED), "editor starts with the typed opening");
  assert.ok(value.length > TYPED.length + 10, "editor holds Yumon's text after it");
  await shot(page, "gherkin-03-stopped");
  assert.deepEqual(page.errors, []);
  await context.close();
});

await scenario("Narrow screens stack the editor above the model panel", async () => {
  const context = await newContext({ width: 390, height: 844 });
  const page = await newPage(context);
  await page.goto(BASE_URL + PAGE);
  await writer(page).waitFor();
  const ed = await editor(page).boundingBox();
  const side = await panel(page).boundingBox();
  assert.ok(ed.y + ed.height <= side.y, "editor above the model panel");
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(width <= 390, `no horizontal scroll (${width}px)`);
  await shot(page, "gherkin-04-mobile");
  assert.deepEqual(page.errors, []);
  await context.close();
});

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
