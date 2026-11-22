// Drives tests/courses.feature against a running build with the system Chrome. Usage:
//   npx next build && npx next start -p 3123
//   BASE_URL=http://localhost:3123 PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core \
//     SCREENSHOT_DIR=/tmp/im-shots node tests/courses.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3123";
const SHOTS = process.env.SCREENSHOT_DIR;
const pwPath = process.env.PLAYWRIGHT_CORE;
const { chromium } = await import(pwPath ? pathToFileURL(path.join(pwPath, "index.mjs")).href : "playwright-core");

const COURSE = "/courses/n-grammer";
const L1 = `${COURSE}/what-is-an-n-gram`;
const L4 = `${COURSE}/bigram-ids-and-the-table`;
const L5 = `${COURSE}/pytorch-to-hyperfield`;
const L6 = `${COURSE}/training-the-layer`;
const LESSONS = ["what-is-an-n-gram", "the-layer-at-a-glance", "snapping-to-centroids", "bigram-ids-and-the-table", "pytorch-to-hyperfield", "training-the-layer"];

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

async function shot(page, name, opts = {}) {
  if (!SHOTS) return;
  await fs.mkdir(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), ...opts });
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
async function newPage({ viewport = { width: 1440, height: 1000 } } = {}) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  page.on("response", (r) => r.status() >= 400 && !r.url().includes("/_vercel/") && page.errors.push(`${r.status()} ${r.url()}`));
  page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && page.errors.push(m.text()));
  return page;
}
const noErrors = (page) => assert.deepEqual(page.errors, [], "no page errors");

async function open(page, url) {
  await page.goto(BASE_URL + url);
  await page.locator("[data-lesson-player], [data-course-card], [data-lesson-card]").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(300); // hydration + hash restore
}
const visible = (page) => page.locator("section.course-slide:visible");
const currentId = (page) => visible(page).getAttribute("data-slide");

/** Set a range input like a user dragging it (React listens for input events). */
async function setRange(locator, value) {
  await locator.evaluate((el, v) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

console.log(`\nCourses BDD suite against ${BASE_URL}\n`);

await scenario("The courses index links the N-Grammer course", async () => {
  const page = await newPage();
  await open(page, "/courses");
  const card = page.locator('[data-course-card="n-grammer"]');
  assert.match(await card.innerText(), /The N-Grammer Course/);
  assert.equal(await page.locator('nav[aria-label="Main navigation"] a[href="/courses"]').count() > 0, true, "nav link");
  await shot(page, "courses-index");
  noErrors(page);
  await page.context().close();
});

await scenario("The course page lists six lessons with Course structured data", async () => {
  const page = await newPage();
  await open(page, COURSE);
  assert.equal(await page.locator("[data-lesson-card]").count(), 6);
  const ld = await page.locator('script[type="application/ld+json"]').evaluateAll((els) => els.map((e) => JSON.parse(e.textContent)));
  const course = ld.flatMap((d) => d["@graph"] ?? [d]).find((n) => n["@type"] === "Course");
  assert.ok(course, "Course node");
  assert.equal(course.isAccessibleForFree, true);
  assert.equal(course.hasPart.length, 6);
  await shot(page, "course-page");
  noErrors(page);
  await page.context().close();
});

await scenario("Every slide is in the HTML, one is shown", async () => {
  const html = await (await fetch(BASE_URL + L1)).text();
  for (const s of ["Language is full of local patterns", "Count some bigrams", "The problem with token bigrams", "which pairs are the bigrams?", "Why does N-Grammer pair up cluster ids"]) {
    assert.ok(html.includes(s), `HTML has "${s}"`);
  }
  const page = await newPage();
  await open(page, L1);
  assert.equal(await visible(page).count(), 1);
  assert.equal(await page.locator("section.course-slide").count(), 5);
  await shot(page, "lesson1-slide1");
  noErrors(page);
  await page.context().close();
});

await scenario("Slides move with the buttons and the arrow keys", async () => {
  const page = await newPage();
  await open(page, L1);
  await page.locator("[data-next]").click();
  assert.equal(await currentId(page), "count");
  assert.equal(new URL(page.url()).hash, "#s-count");
  await shot(page, "lesson1-bigram-counter");
  await page.keyboard.press("ArrowLeft");
  assert.equal(await currentId(page), "local-patterns");
  noErrors(page);
  await page.context().close();
});

await scenario("Answering a quiz gives feedback and is remembered", async () => {
  const page = await newPage();
  await open(page, `${L1}#s-q-bigram`);
  assert.equal(await currentId(page), "q-bigram");
  await visible(page).locator('[role="radio"]').first().click();
  const quiz = visible(page).locator("[data-quiz]");
  assert.equal(await quiz.getAttribute("data-correct"), "true");
  assert.match(await quiz.innerText(), /CORRECT[\s\S]*Three tokens give two bigrams/);
  await shot(page, "lesson1-quiz");
  await page.reload();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('[data-quiz="n-grammer/what-is-an-n-gram/q-bigram"]').getAttribute("data-correct"), "true");
  noErrors(page);
  await page.context().close();
});

await scenario("Reaching the last slide finishes the lesson", async () => {
  const page = await newPage();
  await open(page, `${L1}#s-q-vocab`);
  const finale = visible(page).locator("[data-finale]");
  assert.equal(await finale.locator(`a[href="${COURSE}/the-layer-at-a-glance"]`).count(), 1);
  await open(page, COURSE);
  assert.equal(await page.locator("[data-course-progress]").getAttribute("data-course-progress"), "1");
  assert.equal(await page.locator('[data-lesson-card="what-is-an-n-gram"] [data-done]').count(), 1);
  noErrors(page);
  await page.context().close();
});

await scenario("The live layer runs Hyperfield in the page", async () => {
  const page = await newPage();
  await open(page, `${L5}#s-live`);
  const live = visible(page).locator("[data-live-ngram]");
  await live.waitFor({ timeout: 15000 });
  assert.equal(await live.getAttribute("data-backend"), "cpu");
  const rows = live.locator("tbody tr");
  assert.equal(await rows.count(), 10, "one row per word");
  // "the cat sat on the mat and the cat ran": the second "cat after the" (pos 8) repeats pos 1.
  assert.match(await rows.nth(8).innerText(), /↺ pos 1/);
  // Matches tests/courses-parity.mjs (and so PyTorch) for the first word.
  assert.match(await rows.nth(0).innerText(), /#17\s+#39/);
  await shot(page, "lesson5-live");
  await open(page, `${L5}#s-forward`);
  await shot(page, "lesson5-code");
  noErrors(page);
  await page.context().close();
});

await scenario("The live layer at zero projection is a no-op", async () => {
  const page = await newPage();
  await open(page, `${L6}#s-zero`);
  const live = visible(page).locator("[data-live-ngram]");
  await live.waitFor({ timeout: 15000 });
  const deltas = async () => (await live.locator("tbody tr td:last-child").allInnerTexts()).map(Number);
  assert.ok((await deltas()).every((d) => d === 0), "all zero at scale 0");
  await setRange(visible(page).locator('input[type="range"]'), 0.5);
  await page.waitForTimeout(400);
  assert.ok((await deltas()).every((d) => d > 0), "all non-zero at scale 0.5");
  noErrors(page);
  await page.context().close();
});

await scenario("The centroid demo trains and leaves a dead centroid", async () => {
  const page = await newPage();
  await open(page, `${L6}#s-train`);
  const lossEl = visible(page).locator("[data-loss]");
  const before = Number(await lossEl.getAttribute("data-loss"));
  const step = visible(page).getByRole("button", { name: "ONE STEP" });
  for (let i = 0; i < 15; i++) await step.click();
  const after = Number(await lossEl.getAttribute("data-loss"));
  assert.ok(after < before, `loss ${before} -> ${after}`);
  assert.match(await visible(page).locator("li", { hasText: "centroid 3" }).innerText(), /0 pts/);
  await shot(page, "lesson6-training");
  noErrors(page);
  await page.context().close();
});

await scenario("Visualizations react to input", async () => {
  const page = await newPage();
  await open(page, `${L4}#s-row`);
  const ranges = visible(page).locator('input[type="range"]'); // K, heads, head, prev, id
  await setRange(ranges.nth(0), 4);
  await setRange(ranges.nth(1), 2);
  await setRange(ranges.nth(2), 1);
  await setRange(ranges.nth(3), 2);
  await setRange(ranges.nth(4), 3);
  await page.waitForTimeout(200);
  assert.equal(await visible(page).locator("[data-row]").getAttribute("data-row"), "31");
  await shot(page, "lesson4-row-finder");
  await open(page, `${L4}#s-size`);
  await setRange(visible(page).locator('input[type="range"]').nth(0), 64);
  await visible(page).getByRole("button", { name: "YUMON CP1 PRESET" }).click();
  assert.equal(await visible(page).locator("[data-params]").getAttribute("data-params"), "16842752");
  await open(page, `${COURSE}/snapping-to-centroids#s-snap`);
  await shot(page, "lesson3-centroid-snap");
  await open(page, `${COURSE}/the-layer-at-a-glance#s-step`);
  await shot(page, "lesson2-pipeline");
  noErrors(page);
  await page.context().close();
});

await scenario("Narrow screens do not scroll sideways", async () => {
  const page = await newPage({ viewport: { width: 390, height: 844 } });
  for (const l of LESSONS) {
    await open(page, `${COURSE}/${l}`);
    const ids = await page.locator("section.course-slide").evaluateAll((els) => els.map((e) => e.dataset.slide));
    for (const id of ids) {
      await page.evaluate((h) => (window.location.hash = h), `s-${id}`);
      await page.reload();
      await page.waitForTimeout(250);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 1, `${l}#${id} overflows by ${over}px`);
    }
  }
  await open(page, `${L5}#s-forward`);
  await shot(page, "mobile-code", { fullPage: true });
  noErrors(page);
  await page.context().close();
});

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
