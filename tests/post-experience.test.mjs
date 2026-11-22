// Drives tests/post-experience.feature against a running build with the
// system Chrome. Usage:
//   npx next build && npx next start -p 3123
//   BASE_URL=http://localhost:3123 PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core \
//     SCREENSHOT_DIR=/tmp/im-shots node tests/post-experience.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3123";
const SHOTS = process.env.SCREENSHOT_DIR;
const pwPath = process.env.PLAYWRIGHT_CORE;
const { chromium } = await import(pwPath ? pathToFileURL(path.join(pwPath, "index.mjs")).href : "playwright-core");

const DEV = "/posts/fft-ocean-water";
const REVIEW = "/posts/kiri-lightweight-container-runtime-docker-alternative-review";
const GAME = "/posts/bankster-game-announcement";

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

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist"] });
async function newPage({ viewport = { width: 1440, height: 900 }, reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  page.on("response", (r) => r.status() >= 400 && !r.url().includes("/_vercel/") && page.errors.push(`${r.status()} ${r.url()}`));
  page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && page.errors.push(m.text()));
  return page;
}

async function openPost(page, url) {
  await page.goto(BASE_URL + url);
  await page.locator("canvas.exp-canvas[data-ready]").waitFor({ timeout: 15000 });
}

const frames = (page) => page.locator("canvas.exp-canvas").evaluate((c) => Number(c.dataset.frames ?? 0));
const scrollTo = async (page, y) => {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(400);
};

console.log(`\nPost experience BDD suite against ${BASE_URL}\n`);

await scenario("Each post gets its own procedural intro", async () => {
  const seen = [];
  for (const [url, name] of [[DEV, "dev"], [REVIEW, "review"], [GAME, "game"]]) {
    const page = await newPage();
    await openPost(page, url);
    const intro = page.locator("header.exp-intro");
    const program = await intro.getAttribute("data-intro");
    const accent = await page.locator("div.px-4").first().evaluate((el) => el.style.getPropertyValue("--color-accent"));
    const h1 = page.locator("header.exp-intro h1");
    const size = await h1.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    assert.ok(size >= 56, `${name} title is display size (${size}px)`);
    const firstWord = (await page.title()).split(/\s+/)[0].toLowerCase();
    assert.ok((await h1.innerText()).toLowerCase().startsWith(firstWord), `${name} h1 is the post title`);
    const before = await frames(page);
    await page.mouse.move(900, 400);
    await page.waitForTimeout(1500);
    const after = await frames(page);
    assert.ok(after > before + 10, `${name} scene animates (${before} -> ${after} frames)`);
    // Frame pacing over a second, for the record (not a pass/fail bar).
    const ms = await page.evaluate(
      () =>
        new Promise((res) => {
          const ts = [];
          const tick = (t) => {
            ts.push(t);
            if (ts.length < 61) requestAnimationFrame(tick);
            else res((ts[60] - ts[0]) / 60);
          };
          requestAnimationFrame(tick);
        }),
    );
    console.log(`    ${name}: program=${program} accent=${accent} title=${size}px frame=${ms.toFixed(1)}ms`);
    seen.push(`${program}/${accent}`);
    await shot(page, `exp-01-intro-${name}`);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  }
  assert.equal(new Set(seen).size, 3, `distinct scenes: ${seen.join(", ")}`);
});

await scenario("The intro scrolls away into the article", async () => {
  const page = await newPage();
  await openPost(page, DEV);
  const offsets = () =>
    page.locator("header.exp-intro .exp-word").evaluateAll((els) => els.map((e) => new DOMMatrix(getComputedStyle(e).transform).m42));
  await page.waitForTimeout(1600);
  const rest = await offsets();
  await scrollTo(page, 500);
  const moved = await offsets();
  assert.ok(rest.every((y) => Math.abs(y) < 1), "words at rest before scrolling");
  assert.ok(new Set(moved.map((y) => Math.round(y))).size > 1, `words drift by different amounts: ${moved.map(Math.round)}`);
  await shot(page, "exp-02-intro-leaving");
  await scrollTo(page, 3000);
  const a = await frames(page);
  await page.waitForTimeout(800);
  assert.equal(await frames(page), a, "no frames drawn off screen");
  await page.context().close();
});

await scenario("Section heads are large and numbered", async () => {
  const page = await newPage();
  await openPost(page, DEV);
  const heads = page.locator("#post-body h2");
  const sizes = await heads.evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
  assert.ok(sizes.length >= 3 && sizes.every((s) => s >= 36), `h2 sizes ${sizes}`);
  const num = await heads.first().evaluate((e) => getComputedStyle(e, "::before").content);
  assert.match(num, /counter\(exp-ch, decimal-leading-zero\)/, "numbered by the chapter counter");
  assert.equal(await page.locator("#post-body").evaluate((a) => getComputedStyle(a).counterReset), "exp-ch 0");
  const ghost = await heads.first().evaluate((e) => getComputedStyle(e, "::after").content);
  const text = await heads.first().innerText();
  assert.equal(ghost, JSON.stringify(text), "ghost repeats the heading");
  const chapters = page.locator("details").filter({ hasText: "CHAPTERS" });
  await chapters.locator("summary").click();
  assert.ok(await chapters.locator("li", { hasText: text }).count(), "chapter label is the plain heading");
  await heads.nth(1).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -200));
  await page.waitForTimeout(500);
  await shot(page, "exp-03-section-head");
  await page.context().close();
});

await scenario("Interludes float text pulled from the article", async () => {
  const page = await newPage();
  await openPost(page, DEV);
  const interludes = page.locator("#post-body aside[data-interlude]");
  const count = await interludes.count();
  assert.ok(count >= 1, `interludes: ${count}`);
  assert.equal(await interludes.first().getAttribute("aria-hidden"), "true");
  const first = interludes.first();
  const top = await first.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  const words = () => first.locator(".exp-float").evaluateAll((els) => els.map((e) => new DOMMatrix(getComputedStyle(e).transform).m42));
  await scrollTo(page, top - 850);
  const entering = await words();
  await scrollTo(page, top - 150);
  const leaving = await words();
  const deltas = entering.map((y, i) => Math.round(leaving[i] - y));
  assert.ok(new Set(deltas).size > 2, `words move by different amounts: ${deltas}`);
  await scrollTo(page, top - 350);
  await shot(page, "exp-04-interlude");
  console.log(`    ${count} interludes; first: ${await first.getAttribute("data-interlude")} "${(await first.innerText()).replace(/\s+/g, " ").slice(0, 80)}"`);
  await page.context().close();
});

await scenario("The lede fills in as it's read", async () => {
  const page = await newPage();
  await openPost(page, DEV);
  const lede = page.locator("#post-body p.exp-lede");
  const top = await lede.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  const read = () => lede.evaluate((el) => Number(el.style.getPropertyValue("--read")));
  await scrollTo(page, top - 700);
  const early = await read();
  await shot(page, "exp-05-lede-filling");
  await scrollTo(page, top);
  const late = await read();
  assert.ok(early < 1 && late === 1, `read ${early} -> ${late}`);
  await page.context().close();
});

await scenario("Reduced motion gets a still, readable page", async () => {
  const page = await newPage({ reducedMotion: "reduce" });
  await openPost(page, DEV);
  await page.waitForTimeout(300);
  const still = await frames(page);
  await page.waitForTimeout(1000);
  assert.ok(still <= 2 && (await frames(page)) === still, `still frame only (${still})`);
  await scrollTo(page, 500);
  const ys = await page.locator("header.exp-intro .exp-word").evaluateAll((els) => els.map((e) => new DOMMatrix(getComputedStyle(e).transform).m42));
  assert.ok(ys.every((y) => Math.abs(y) < 1), "words at rest");
  assert.equal(await page.locator("#post-body p.exp-lede").evaluate((el) => el.style.getPropertyValue("--read")), "", "no scroll vars set");
  await page.context().close();
});

await scenario("Chat keeps its 30% column on wide screens", async () => {
  const page = await newPage();
  await openPost(page, DEV);
  const chat = await page.getByRole("region", { name: "Chat with Yumon" }).boundingBox();
  const column = await page.locator("header.exp-intro h1").evaluate((h) => {
    const r = h.closest("div.min-w-0").getBoundingClientRect();
    return { width: r.width };
  });
  const share = chat.width / (chat.width + column.width);
  assert.ok(share > 0.27 && share < 0.33, `chat share ${share.toFixed(2)}`);
  await page.context().close();
});

await scenario("Narrow screens get the intro under the chat bar", async () => {
  const page = await newPage({ viewport: { width: 390, height: 844 } });
  await openPost(page, REVIEW);
  await page.waitForTimeout(1600);
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(scrollW <= 390, `no horizontal scroll (${scrollW})`);
  await shot(page, "exp-06-mobile-intro");
  await scrollTo(page, 2400);
  await shot(page, "exp-07-mobile-article");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} scenarios passed\n`);
process.exit(failed ? 1 : 0);
