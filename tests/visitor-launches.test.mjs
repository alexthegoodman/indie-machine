// Drives tests/visitor-launches.feature against a running build with the system Chrome.
// Needs network access (it launches example.com and a GitHub repo) and DATABASE_URL for the
// local database, which it uses to clear the test products first. Usage:
//   npx next build && npx next start -p 3123
//   BASE_URL=http://localhost:3123 PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core \
//     SCREENSHOT_DIR=/tmp/im-shots node tests/visitor-launches.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3123";
const SHOTS = process.env.SCREENSHOT_DIR;
const pwPath = process.env.PLAYWRIGHT_CORE;
const { chromium } = await import(pwPath ? pathToFileURL(path.join(pwPath, "index.mjs")).href : "playwright-core");
try { process.loadEnvFile(".env"); } catch { /* environment provides DATABASE_URL */ }

const TEST_KEYS = ["example.com", "github.com/vercel/next.js"];
async function resetTestProducts() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  // Deleting them also frees the per-visitor daily limit the browser scenarios share.
  await client.query(`DELETE FROM visitor_launches WHERE key = ANY($1)`, [TEST_KEYS]);
  await client.end();
}

const results = [];
async function scenario(name, fn) {
  const start = performance.now();
  try {
    await resetTestProducts();
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

// Each API call claims its own client IP so the per-visitor daily limit doesn't trip mid-suite.
let ipSeq = 1;
async function post(body, headers = {}) {
  const res = await fetch(BASE_URL + "/api/launches", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-real-ip": `203.0.113.${ipSeq++}`, ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
async function newPage(viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  // Vercel Analytics only exists on Vercel; the duplicate scenario expects its own 409.
  page.on("response", (r) => r.status() >= 400 && !r.url().includes("/_vercel/") && !r.url().endsWith("/api/launches") && page.errors.push(`${r.status()} ${r.url()}`));
  page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && page.errors.push(m.text()));
  return page;
}
const bar = (page) => page.getByRole("region", { name: "Visitor launches" });

console.log(`\nVisitor Launches BDD suite against ${BASE_URL}\n`);

await scenario("A visitor launches a product from the bar", async () => {
  const page = await newPage();
  await page.goto(BASE_URL + "/");
  await bar(page).getByRole("button", { name: /LAUNCH YOURS/ }).click();
  await page.getByLabel("Your product's URL").fill("example.com");
  await shot(page, "launches-01-form");
  const started = performance.now();
  await bar(page).getByRole("button", { name: "LAUNCH", exact: true }).click();
  const first = bar(page).locator("a[data-launch]").first();
  await first.filter({ hasText: "JUST LAUNCHED" }).waitFor({ timeout: 30_000 });
  console.log(`      live in ${(performance.now() - started).toFixed(0)}ms`);
  assert.match(await first.innerText(), /Example Domain/);
  assert.equal(await first.getAttribute("href"), "https://example.com/");
  assert.match(await first.getAttribute("rel"), /nofollow/);
  assert.match(await first.getAttribute("rel"), /ugc/);
  await shot(page, "launches-02-launched");
  await page.goto(BASE_URL + "/dev");
  await bar(page).locator('a[data-launch="example.com"]').waitFor();
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

await scenario("The same product can't be launched twice", async () => {
  assert.equal((await post({ url: "example.com" })).status, 201);
  const dup = await post({ url: "http://www.example.com/pricing?ref=ph" });
  assert.equal(dup.status, 409);
  assert.equal(dup.data.error.code, "duplicate");
  const page = await newPage();
  await page.goto(BASE_URL + "/");
  await bar(page).getByRole("button", { name: /LAUNCH YOURS/ }).click();
  await page.getByLabel("Your product's URL").fill("https://example.com/about");
  await bar(page).getByRole("button", { name: "LAUNCH", exact: true }).click();
  await bar(page).getByRole("status").filter({ hasText: "already launched" }).waitFor();
  await shot(page, "launches-03-duplicate");
  await page.context().close();
});

await scenario("Shared hosts key on the path", async () => {
  const a = await post({ url: "github.com/vercel/next.js" });
  assert.equal(a.status, 201, JSON.stringify(a.data));
  assert.equal(a.data.launch.host, "github.com");
  console.log(`      github title: ${a.data.launch.title} | icon: ${a.data.launch.iconUrl}`);
  const b = await post({ url: "https://github.com/vercel/next.js/" });
  assert.equal(b.status, 409);
});

await scenario("Unsafe and junk URLs are refused before anything is stored", async () => {
  const cases = [
    ["http://127.0.0.1/admin", "invalid"],
    ["http://localhost:3000", "invalid"],
    ["localtest.me", "invalid"],
    ["https://bit.ly/abc", "blocked"],
    ["ftp://example.org", "invalid"],
    ["no-such-host.invalid", "unreachable"],
  ];
  for (const [url, code] of cases) {
    const r = await post({ url });
    assert.equal(r.status, 400, `${url}: ${JSON.stringify(r.data)}`);
    assert.equal(r.data.error.code, code, `${url}: ${r.data.error.message}`);
    console.log(`      ${url} -> ${r.data.error.message}`);
  }
  assert.equal((await post({ url: "example.com" }, { Origin: "https://evil.example" })).status, 403);
  assert.equal((await post({ url: "example.com", website: "http://spam" })).status, 400);
});

await scenario("The bar can be hidden and stays hidden", async () => {
  const page = await newPage();
  await page.goto(BASE_URL + "/");
  await bar(page).getByRole("button", { name: "Hide visitor launches" }).click();
  assert.equal(await bar(page).getAttribute("data-launch-bar"), "hidden");
  await shot(page, "launches-04-hidden");
  await page.reload();
  await bar(page).getByRole("button", { name: "Show visitor launches" }).waitFor();
  await bar(page).getByRole("button", { name: "Show visitor launches" }).click();
  assert.equal(await bar(page).getAttribute("data-launch-bar"), "open");
  await page.context().close();
});

await scenario("The bar fits a phone", async () => {
  await post({ url: "example.com" });
  const page = await newPage({ width: 390, height: 844 });
  await page.goto(BASE_URL + "/");
  await bar(page).locator("a[data-launch]").first().waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `page overflows by ${overflow}px`);
  await shot(page, "launches-05-phone");
  await page.context().close();
});

await resetTestProducts();
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} scenarios passed\n`);
process.exit(failed ? 1 : 0);
