// Drives tests/media-center.feature against a running build with the
// system Chrome. Usage:
//   npx next build && npx next start -p 3123
//   BASE_URL=http://localhost:3123 PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core \
//     SCREENSHOT_DIR=/tmp/im-shots node tests/media-center.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { allowPosts, storeSurveyPass } from "./survey-pass.mjs";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3123";
const SHOTS = process.env.SCREENSHOT_DIR;
const pwPath = process.env.PLAYWRIGHT_CORE;
const { chromium } = await import(pwPath ? pathToFileURL(path.join(pwPath, "index.mjs")).href : "playwright-core");

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

await storeSurveyPass();
const browser = await chromium.launch({ channel: "chrome", headless: true });
async function newPage(viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  // Past the reader survey (tests/survey.feature), which would stop posts after their intro.
  await allowPosts(context);
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  // Vercel Analytics' script only exists on Vercel, so its 404 is expected locally.
  page.on("response", (r) => r.status() >= 400 && !r.url().includes("/_vercel/") && page.errors.push(`${r.status()} ${r.url()}`));
  page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && page.errors.push(m.text()));
  return page;
}

// Scrolls so the given fraction of the article body is above the fold.
async function scrollArticle(page, fraction) {
  await page.evaluate((f) => {
    const el = document.getElementById("post-body");
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + el.offsetHeight * f - window.innerHeight);
  }, fraction);
  await page.waitForTimeout(250);
}

console.log(`\nMedia-center BDD suite against ${BASE_URL}\n`);

await scenario("Home renders the shell, featured carousel and feed", async () => {
  const page = await newPage();
  await page.goto(BASE_URL + "/");
  await page.getByRole("button", { name: /Search reviews/ }).waitFor();
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  for (const href of ["/", "/products", "/dev", "/announcements", "/games", "/free-ai", "/library"]) {
    assert.ok(await nav.locator(`a[href="${href}"]`).count(), `sidebar links to ${href}`);
  }
  const carousel = page.getByRole("region", { name: "Featured posts" });
  const first = await carousel.locator("h2").innerText();
  await carousel.getByRole("button", { name: "Next featured post" }).click();
  assert.notEqual(await carousel.locator("h2").innerText(), first, "carousel advanced");
  const cards = await page.locator('section[aria-label="All posts"] article').count();
  assert.ok(cards >= 12, `feed shows cards (${cards})`);
  await shot(page, "01-home-desktop");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

await scenario("A Free AI banner tops the home page and opens /free-ai", async () => {
  const page = await newPage();
  await page.goto(BASE_URL + "/");
  const banner = page.getByRole("link", { name: /^Free AI: chat with Yumon/ });
  await banner.waitFor();
  const carousel = page.getByRole("region", { name: "Featured posts" });
  const [b, c] = [await banner.boundingBox(), await carousel.boundingBox()];
  assert.ok(b.y + b.height <= c.y, "banner sits above the carousel");
  assert.ok(b.y < 900, "banner is above the fold");
  const color = await banner.evaluate((el) => getComputedStyle(el.closest("section")).borderTopColor);
  assert.equal(color, "rgb(255, 200, 87)", "banner border is the gold badge color");
  // The mascot mounts after load + idle and then fetches its model.
  const mascot = page.getByRole("region", { name: "Free AI banner" }).getByTestId("yumon-mascot");
  await mascot.and(page.locator("[data-ready]")).waitFor({ timeout: 30_000 });
  const m = await mascot.boundingBox();
  assert.ok(m.x + m.width <= (await banner.boundingBox()).x, "mascot sits left of the banner text");
  assert.equal(await mascot.getByRole("group", { name: "Yumon's look" }).count(), 0, "no MECH / SOFT toggle in the banner");
  await shot(page, "01b-home-free-ai-banner");
  await banner.click();
  await page.waitForURL(/\/free-ai$/);
  assert.deepEqual(page.errors, []);
  await page.context().close();

  const phone = await newPage({ width: 390, height: 844 });
  await phone.goto(BASE_URL + "/");
  await phone.getByRole("link", { name: /^Free AI: chat with Yumon/ }).waitFor();
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `no sideways scroll (${overflow}px)`);
  await phone.waitForTimeout(4000);
  const glb = await phone.evaluate(() => performance.getEntriesByType("resource").filter((r) => r.name.endsWith(".glb")).length);
  assert.equal(glb, 0, "phone never downloads the mascot model");
  await shot(phone, "01c-home-free-ai-banner-phone");
  await phone.context().close();
});

await scenario("Feed chips filter the home feed", async () => {
  const page = await newPage();
  await page.goto(BASE_URL + "/");
  const feed = page.locator('section[aria-label="All posts"]');
  await feed.getByRole("button", { name: "Game drops" }).click();
  const channels = await feed.locator("article").evaluateAll((els) =>
    els.map((e) => e.querySelector("h3 + div")?.textContent ?? ""),
  );
  assert.ok(channels.length > 0, "some games shown");
  assert.ok(channels.every((c) => /game announcements/i.test(c)), `all games: ${channels.join(" | ")}`);
  await page.context().close();
});

await scenario("Search palette opens with the keyboard and navigates", async () => {
  const page = await newPage();
  await page.goto(BASE_URL + "/");
  await page.locator("body").click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox", { name: "Search Indie Machine" });
  await input.waitFor();
  await input.fill("kiri");
  await page.getByRole("option").first().waitFor();
  await shot(page, "02-search-palette");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/posts\/kiri/);
  assert.match(await page.locator("h1").first().innerText(), /Kiri/);
  await page.context().close();
});

await scenario("Reader shows chapters, progress and save", async () => {
  const page = await newPage();
  await page.goto(BASE_URL + "/posts/kiri-lightweight-container-runtime-docker-alternative-review");
  // Chapters sit in the article column as a collapsible list (no right-hand sidebar).
  const chapters = page.locator("details").filter({ hasText: "CHAPTERS" });
  await chapters.waitFor();
  await chapters.locator("summary").click();
  const count = await chapters.locator("li").count();
  assert.ok(count >= 5, `chapters listed (${count})`);
  await shot(page, "03-reader-top");
  await scrollArticle(page, 0.5);
  const now = Number(await page.getByRole("progressbar", { name: "Reading progress" }).getAttribute("aria-valuenow"));
  assert.ok(now > 30 && now < 70, `progress near half (${now})`);
  assert.ok(await chapters.locator('a[aria-current="location"]').count(), "a chapter is marked current");
  await shot(page, "04-reader-midway");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: "SAVE", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Saved to your library" }).waitFor();
  await page.goto(BASE_URL + "/library");
  const saved = page.locator('section[aria-labelledby="saved-heading"]');
  await saved.getByText(/Kiri Review/).waitFor();
  await shot(page, "05-library");
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

await scenario("Continue-reading dock follows the reader around", async () => {
  const page = await newPage();
  await page.goto(BASE_URL + "/posts/orca-agentic-ide-parallel-worktrees-review");
  await page.locator("#post-body").waitFor();
  await scrollArticle(page, 0.4);
  await page.getByRole("link", { name: "Indie Machine home" }).or(page.locator('header a[href="/"]')).first().click();
  await page.waitForURL(BASE_URL + "/");
  const dock = page.getByText("CONTINUE READING", { exact: true }).locator("xpath=ancestor::div[contains(@class,'border-accent')][1]");
  await dock.waitFor();
  assert.match(await dock.innerText(), /Orca/);
  const shelf = page.getByRole("region", { name: "Continue reading" });
  assert.match(await shelf.innerText(), /Orca/);
  await shot(page, "06-continue-dock");
  await page.getByRole("button", { name: "Dismiss continue reading" }).click();
  await page.getByText("CONTINUE READING", { exact: true }).waitFor({ state: "detached" });
  await page.context().close();
});

await scenario("Auto-advance counts down at the end of a post and can be cancelled", async () => {
  const page = await newPage();
  await page.goto(BASE_URL + "/posts/entropy-daw-arrangement-view");
  await page.getByText("READ NEXT ->").scrollIntoViewIfNeeded();
  await page.getByText(/UP NEXT IN \d+S/).waitFor({ timeout: 4000 });
  await shot(page, "07-end-card");
  await page.getByRole("button", { name: "CANCEL" }).click();
  await page.waitForTimeout(1500);
  assert.equal(await page.getByText(/UP NEXT IN \d+S/).count(), 0, "countdown stopped");
  assert.match(page.url(), /entropy-daw-arrangement-view/);
  await page.context().close();
});

await scenario("Sidebar collapses and the choice persists", async () => {
  const page = await newPage();
  await page.goto(BASE_URL + "/");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.reload();
  await page.waitForTimeout(300);
  const width = await page.locator("aside").first().evaluate((el) => el.getBoundingClientRect().width);
  assert.ok(width < 100, `compact rail (${width}px)`);
  await shot(page, "08-rail-compact");
  await page.context().close();
});

await scenario("Phone layout uses a drawer and never scrolls sideways", async () => {
  const page = await newPage({ width: 390, height: 844 });
  for (const url of ["/", "/posts/kiri-lightweight-container-runtime-docker-alternative-review", "/products"]) {
    await page.goto(BASE_URL + url);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `${url} overflows by ${overflow}px`);
  }
  await page.goto(BASE_URL + "/");
  await shot(page, "09-phone-home");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Close navigation" }).first().waitFor();
  await shot(page, "10-phone-drawer");
  await page.context().close();
});

await scenario("Every index route renders its channel page without errors", async () => {
  const page = await newPage();
  const routes = ["/products", "/dev", "/announcements", "/series", "/series/Entropy", "/archive", "/library", "/games", "/free-ai", "/promote", "/about"];
  for (const route of routes) {
    page.errors = [];
    const res = await page.goto(BASE_URL + route);
    assert.equal(res.status(), 200, `${route} status`);
    assert.ok(await page.locator("h1").count(), `${route} has an h1`);
    assert.deepEqual(page.errors, [], `${route} console errors`);
    if (route === "/products") await shot(page, "11-products");
  }
  await page.context().close();
});

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} scenarios passed\n`);
process.exit(failed ? 1 : 0);
