// Drives tests/mascot.feature with the system Chrome. The render scenarios need no server: the
// scene module (transpiled from lib/mascot/scene.ts), three.js and the GLBs are served from disk
// through page.route. The page scenarios run only when BASE_URL is set.
// Usage:
//   PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core SCREENSHOT_DIR=/tmp/im-shots node tests/mascot.test.mjs
//   npx next build && npx next start -p 3123
//   BASE_URL=http://localhost:3123 PLAYWRIGHT_CORE=... node tests/mascot.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = process.env.BASE_URL;
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

async function shot(page, name, el) {
  if (!SHOTS) return;
  await fs.mkdir(SHOTS, { recursive: true });
  await (el ?? page).screenshot({ path: path.join(SHOTS, `${name}.png`), omitBackground: true });
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

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist"] });

// ---- Render scenarios: lib/mascot/scene.ts on its own -------------------------------------

const HOST = "http://mascot.test";
const sceneJs = ts.transpileModule(await fs.readFile(path.join(ROOT, "lib/mascot/scene.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const HARNESS = `<!doctype html><html><head><style>html,body{margin:0;background:transparent}canvas{display:block;width:360px;height:240px}</style>
<script type="importmap">{"imports":{"three":"${HOST}/three/build/three.module.js","three/addons/":"${HOST}/three/examples/jsm/"}}</script>
</head><body><canvas id="c"></canvas></body></html>`;

async function renderPage(opts = {}) {
  const context = await browser.newContext({ viewport: { width: 360, height: 240 }, reducedMotion: opts.still ? "reduce" : "no-preference" });
  await context.route(`${HOST}/**`, async (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/") return route.fulfill({ contentType: "text/html", body: HARNESS });
    if (p === "/scene.js") return route.fulfill({ contentType: "text/javascript", body: sceneJs });
    if (p.startsWith("/three/")) return route.fulfill({ contentType: "text/javascript", path: path.join(ROOT, "node_modules", p) });
    if (p.startsWith("/models/")) return route.fulfill({ contentType: "model/gltf-binary", path: path.join(ROOT, "public", p) });
    return route.fulfill({ status: 404 });
  });
  // Keep WebGL frames readable after they are presented, for the pixel checks.
  await context.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, attrs) {
      return get.call(this, type, type.startsWith("webgl") ? { ...attrs, preserveDrawingBuffer: true } : attrs);
    };
  });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && page.errors.push(m.text()));
  await page.goto(`${HOST}/`);
  return { context, page };
}

/** Alpha coverage of the canvas: share of opaque pixels in the middle and in the bottom corners. */
function coverage(page) {
  return page.evaluate(() => {
    const src = document.getElementById("c");
    const c = document.createElement("canvas");
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext("2d");
    g.drawImage(src, 0, 0);
    const { data, width: w, height: h } = g.getImageData(0, 0, c.width, c.height);
    const share = (x0, y0, x1, y1) => {
      let on = 0;
      let n = 0;
      for (let y = Math.floor(y0); y < y1; y++)
        for (let x = Math.floor(x0); x < x1; x++, n++) if (data[(y * w + x) * 4 + 3] > 40) on++;
      return on / n;
    };
    const k = Math.round(w * 0.08);
    return {
      middle: share(w / 3, h / 4, (2 * w) / 3, (3 * h) / 4),
      corners: Math.max(share(0, h - k, k, h), share(w - k, h - k, w, h)),
    };
  });
}

const CLIPS = ["idle", "doze", "think", "talk", "wave", "cheer"];
for (const variant of ["bot", "mech"]) {
  for (const clip of CLIPS) {
    await scenario(`Each robot renders each clip: ${variant} / ${clip}`, async () => {
      const { context, page } = await renderPage();
      try {
        const ms = await page.evaluate(
          async ({ variant, clip }) => {
            const { createMascot } = await import("/scene.js");
            const t0 = performance.now();
            const m = await createMascot(document.getElementById("c"), variant, { still: false, base: clip === "wave" || clip === "cheer" ? "idle" : clip });
            const loadMs = performance.now() - t0;
            if (clip === "wave" || clip === "cheer") m.play(clip);
            m.setActive(true);
            window.__m = m;
            return loadMs;
          },
          { variant, clip },
        );
        await page.waitForTimeout(1000);
        const cov = await coverage(page);
        await shot(page, `mascot-${variant}-${clip}`);
        console.log(`        load+setup ${ms.toFixed(0)} ms, middle ${(cov.middle * 100).toFixed(1)}%, corners ${(cov.corners * 100).toFixed(1)}%`);
        assert.ok(cov.middle > 0.08, `robot pixels in the middle (${cov.middle})`);
        assert.ok(cov.corners < 0.01, `transparent bottom corners (${cov.corners})`);
        assert.deepEqual(page.errors, []);
      } finally {
        await context.close();
      }
    });
  }
}

await scenario("Reduced motion draws one still frame", async () => {
  const { context, page } = await renderPage({ still: true });
  try {
    await page.evaluate(async () => {
      const { createMascot } = await import("/scene.js");
      window.__m = await createMascot(document.getElementById("c"), "bot", { still: true, base: "idle" });
      window.__m.setActive(true);
    });
    const cov = await coverage(page);
    assert.ok(cov.middle > 0.08, `robot pixels in the middle (${cov.middle})`);
    // Count rAF callbacks the page asks for over half a second; three's loop would ask ~30.
    const frames = await page.evaluate(
      () =>
        new Promise((r) => {
          let n = 0;
          const orig = window.requestAnimationFrame;
          window.requestAnimationFrame = (cb) => {
            n++;
            return orig(cb);
          };
          setTimeout(() => r(n), 500);
        }),
    );
    assert.equal(frames, 0, "no animation loop");
    await shot(page, "mascot-bot-still");
  } finally {
    await context.close();
  }
});

// ---- Page scenarios: the production build ---------------------------------------------------

const POST = "/posts/kiri-lightweight-container-runtime-docker-alternative-review";
const pageScenarios = [
  "The post chat stage sleeps until Yumon wakes and loads nothing off screen",
  "Picking SOFT swaps the model and is remembered",
  "The mascot follows a reply on /free-ai",
];

if (!BASE_URL) {
  for (const name of pageScenarios) console.log(`  [SKIP] ${name} (no BASE_URL)`);
} else {
  const { allowPosts, storeSurveyPass } = await import("./survey-pass.mjs");
  await storeSurveyPass();

  async function site(viewport) {
    const context = await browser.newContext({ viewport });
    await allowPosts(context);
    context.requests = [];
    await context.route("**/api/events", (route) => route.fulfill({ status: 204 }));
    context.on("request", (r) => context.requests.push(r.url()));
    const page = await context.newPage();
    page.errors = [];
    page.on("pageerror", (e) => page.errors.push(String(e)));
    return { context, page };
  }
  const stage = (page) => page.locator('[data-testid="yumon-mascot"]').first();
  const attr = (page, a) => stage(page).getAttribute(a);
  const models = (context, v) => context.requests.filter((u) => u.endsWith(`/models/mascot/yumon-${v}.glb`));

  await scenario(pageScenarios[0], async () => {
    let { context, page } = await site({ width: 1440, height: 900 });
    try {
      await page.goto(`${BASE_URL}${POST}`);
      const chat = page.locator('section[aria-label="Chat with Yumon"]');
      assert.equal(await chat.locator('[data-testid="yumon-mascot"]').count(), 1);
      await waitFor(async () => (await attr(page, "data-ready")) !== null, "mascot ready");
      assert.equal(await attr(page, "data-clip"), "doze");
      assert.equal(models(context, "mech").length, 1);
      await shot(page, "mascot-post-wide", chat);
    } finally {
      await context.close();
    }
    ({ context, page } = await site({ width: 390, height: 844 }));
    try {
      await page.goto(`${BASE_URL}${POST}`);
      await page.waitForTimeout(2000);
      assert.equal(models(context, "bot").length + models(context, "mech").length, 0);
    } finally {
      await context.close();
    }
  });

  await scenario(pageScenarios[1], async () => {
    const { context, page } = await site({ width: 1440, height: 900 });
    try {
      await page.goto(`${BASE_URL}${POST}`);
      await stage(page).getByRole("button", { name: "SOFT" }).click();
      await waitFor(async () => (await attr(page, "data-ready")) !== null && models(context, "bot").length === 1, "bot model");
      assert.equal(await attr(page, "data-variant"), "bot");
      await shot(page, "mascot-post-soft", page.locator('section[aria-label="Chat with Yumon"]'));
      await page.reload();
      await waitFor(async () => (await attr(page, "data-variant")) === "bot", "variant remembered");
    } finally {
      await context.close();
    }
  });

  await scenario(pageScenarios[2], async () => {
    const { context, page } = await site({ width: 1440, height: 900 });
    try {
      await page.goto(`${BASE_URL}/free-ai`);
      const panel = page.locator('aside[aria-label="Agent"]');
      await panel.getByRole("button", { name: /WAKE YUMON/ }).click();
      await waitFor(async () => (await attr(page, "data-clip")) === "idle", "awake", 90_000);
      await page.getByRole("button", { name: "Hi Yumon!" }).click();
      const seen = new Set();
      await waitFor(async () => {
        const c = await attr(page, "data-clip");
        seen.add(c);
        return seen.size > 1 && c === "idle";
      }, "reply finished", 60_000);
      assert.ok(seen.has("think") || seen.has("talk"), `clips seen: ${[...seen]}`);
      await shot(page, "mascot-free-ai", panel);
    } finally {
      await context.close();
    }
  });
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} scenarios passed`);
process.exit(failed ? 1 : 0);
