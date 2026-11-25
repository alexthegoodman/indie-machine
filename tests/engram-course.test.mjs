// Drives tests/engram-course.feature against a running build with the system Chrome. Usage:
//   npx next build && npx next start -p 3123
//   BASE_URL=http://localhost:3123 PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core \
//     SCREENSHOT_DIR=/tmp/im-shots node tests/engram-course.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3123";
const SHOTS = process.env.SCREENSHOT_DIR;
const pwPath = process.env.PLAYWRIGHT_CORE;
const { chromium } = await import(pwPath ? pathToFileURL(path.join(pwPath, "index.mjs")).href : "playwright-core");

const COURSE = "/courses/engram";
const LESSONS = {
  "memory-vs-compute": ["Some knowledge is a lookup", "Two kinds of sparsity", "What the paper measured", "If you took the N-Grammer course", "What decides which Engram rows a token reads?"],
  "tokenizer-compression": ["How much does it compress?", "Which of these end up as the same compressed id?", "Where does the compressed id get used?"],
  "multi-head-hashing": ["Too many n-grams for an exact table", "The hash", "Watch it collide", "Why several heads, why primes", "How big are the tables?", "Which row? (current token 5, previous 3)"],
  "gate-and-conv": ["The lookup can't see context", "The gate", "Why the square root", "A short conv over the gated values", "Which positions does it read?"],
  "pytorch-to-hyperfield": ["The hash in both", "The layer in both", "Op by op", "Run it in your browser", "Does it match PyTorch?", "The packaged layer", "Why does the TypeScript hash use BigInt?"],
  "training-and-serving": ["Where it goes", "How much memory?", "The training recipe", "Serving a 100B table", "What ends up in the table", "With Engram disabled at inference, which kind of task suffers most?"],
};

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
const step = (page, id) => page.locator(`#s-${id}`);

/** Set a range input like a user dragging it (React listens for input events). */
async function setRange(locator, value) {
  await locator.evaluate((el, v) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

const decode = (html) => html.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/<!-- -->/g, "");

console.log(`\nEngram course BDD suite against ${BASE_URL}\n`);

await scenario("The courses index lists both courses", async () => {
  const page = await newPage();
  await open(page, "/courses");
  assert.match(await page.locator('[data-course-card="n-grammer"]').innerText(), /The N-Grammer Course/);
  assert.match(await page.locator('[data-course-card="engram"]').innerText(), /The Engram Course/);
  await shot(page, "engram-courses-index");
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
  await shot(page, "engram-course-page");
  noErrors(page);
  await page.context().close();
});

await scenario("Every lesson's steps are in the server HTML", async () => {
  for (const [lesson, texts] of Object.entries(LESSONS)) {
    const html = decode(await (await fetch(`${BASE_URL}${COURSE}/${lesson}`)).text());
    for (const t of texts) assert.ok(html.includes(t), `${lesson} HTML has "${t}"`);
  }
});

await scenario("Tokenizer compression groups normalized tokens", async () => {
  const page = await newPage();
  await open(page, `${COURSE}/tokenizer-compression#s-why`);
  const summary = step(page, "why").locator("[data-compression-summary]");
  assert.match(await summary.innerText(), /13 raw tokens → 4 compressed ids/);
  await shot(page, "engram-compression");
  const input = step(page, "why").locator("input");
  await input.fill((await input.inputValue()) + "| APPLE");
  assert.match(await summary.innerText(), /14 raw tokens → 4 compressed ids/);
  noErrors(page);
  await page.context().close();
});

await scenario("The hash widget shows the mix and the rows of both heads", async () => {
  const page = await newPage();
  await open(page, `${COURSE}/multi-head-hashing#s-buckets`);
  await step(page, "buckets").getByRole("button", { name: "TRIGRAMS" }).click();
  const detail = await step(page, "buckets").locator("[data-hash-detail]").innerText();
  assert.match(detail, /mod 41 = row \d+/);
  assert.match(detail, /mod 43 = row \d+/);
  assert.equal(await step(page, "buckets").locator('[data-hash-head="0"] > div').count(), 41);
  await shot(page, "engram-hash-buckets");
  noErrors(page);
  await page.context().close();
});

await scenario("The gate and conv widgets compute the lesson's numbers", async () => {
  const page = await newPage();
  await open(page, `${COURSE}/gate-and-conv#s-curve`);
  assert.match(await step(page, "curve").locator("[data-gate-value]").innerText(), /gate = 0\.9262/); // σ(√6.4)
  await shot(page, "engram-gate");
  await open(page, `${COURSE}/gate-and-conv#s-conv`);
  assert.equal(await step(page, "conv").locator("[data-conv-taps]").getAttribute("data-conv-taps"), "3,6,9,12");
  await shot(page, "engram-conv");
  noErrors(page);
  await page.context().close();
});

await scenario("The live layer runs Hyperfield in the page", async () => {
  const page = await newPage();
  await open(page, `${COURSE}/pytorch-to-hyperfield#s-live`);
  const live = step(page, "live").locator("[data-live-engram]");
  await live.waitFor({ timeout: 15000 });
  assert.equal(await live.getAttribute("data-backend"), "cpu");
  assert.equal(await live.locator("tbody tr").count(), 13, "one row per word");
  // "The cat sat on the mat and the Cat sat on the hat": positions 8-11 repeat 1-4 (bigrams), 9-11 repeat 2-4 (trigrams).
  assert.equal(await live.locator("tbody tr[data-bigram-repeat]").count(), 4);
  assert.equal(await live.locator("tbody tr[data-trigram-repeat]").count(), 3);
  const gates = await live.locator("[data-gate]").evaluateAll((els) => els.map((e) => Number(e.dataset.gate)));
  assert.ok(gates.every((g) => g > 0 && g < 1), "gates in (0, 1)");
  await shot(page, "engram-live");
  await open(page, `${COURSE}/pytorch-to-hyperfield#s-forward`);
  await shot(page, "engram-code");
  noErrors(page);
  await page.context().close();
});

await scenario("A zero-initialized conv adds nothing", async () => {
  const page = await newPage();
  await open(page, `${COURSE}/training-and-serving#s-recipe`);
  const live = step(page, "recipe").locator("[data-live-engram]");
  await live.waitFor({ timeout: 15000 });
  const conv = async () => live.locator("[data-conv]").evaluateAll((els) => els.map((e) => Number(e.dataset.conv)));
  assert.ok((await conv()).every((d) => d === 0), "all zero at scale 0");
  await setRange(step(page, "recipe").locator('input[type="range"]'), 0.5);
  await page.waitForTimeout(500);
  assert.ok((await conv()).every((d) => d > 0), "all non-zero at scale 0.5");
  await shot(page, "engram-zero-conv");
  noErrors(page);
  await page.context().close();
});

await scenario("Answering a quiz gives feedback", async () => {
  const page = await newPage();
  await open(page, `${COURSE}/multi-head-hashing#s-q-row`);
  await step(page, "q-row").locator('[role="radio"]').nth(1).click();
  const quiz = step(page, "q-row").locator("[data-quiz]");
  assert.equal(await quiz.getAttribute("data-correct"), "true");
  assert.match(await quiz.innerText(), /CORRECT[\s\S]*31 mod 11 = 9/);
  noErrors(page);
  await page.context().close();
});

await scenario("Narrow screens do not scroll sideways", async () => {
  const page = await newPage({ viewport: { width: 390, height: 844 } });
  for (const l of Object.keys(LESSONS)) {
    await open(page, `${COURSE}/${l}`);
    await page.waitForTimeout(400); // LiveEngram fills its table after hydration
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 1, `${l} overflows by ${over}px`);
  }
  await open(page, `${COURSE}/multi-head-hashing#s-buckets`);
  await shot(page, "engram-mobile-hash");
  noErrors(page);
  await page.context().close();
});

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
