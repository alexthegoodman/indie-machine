// Drives tests/insights-map.feature with the system Chrome. No server: WorldMap.tsx and the
// modules it needs are transpiled to a temp folder (next/link stubbed as a plain <a>), rendered
// with react-dom/server, and the markup is loaded into a page for geometry and hover checks.
// Usage:
//   PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core SCREENSHOT_DIR=/tmp/im-shots node tests/insights-map.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = process.env.SCREENSHOT_DIR;
const pwPath = process.env.PLAYWRIGHT_CORE;
const { chromium } = await import(pwPath ? pathToFileURL(path.join(pwPath, "index.mjs")).href : "playwright-core");
const require = createRequire(path.join(ROOT, "package.json"));

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

// ---- Transpile the component and its imports ----------------------------------------------

const OUT = await fs.mkdtemp(path.join(os.tmpdir(), "im-insights-map-"));
const FILES = {
  "world-map": "lib/analytics/world-map.ts",
  geo: "lib/analytics/geo.ts",
  format: "lib/analytics/format.ts",
  MapHover: "components/insights/MapHover.tsx",
  WorldMap: "components/insights/WorldMap.tsx",
};
const SPEC = {
  "@/lib/analytics/geo": "./geo.mjs",
  "@/lib/analytics/format": "./format.mjs",
  "@/lib/analytics/world-map": "./world-map.mjs",
  "./world-map.ts": "./world-map.mjs",
  "./MapHover": "./MapHover.mjs",
  "next/link": "./link.mjs",
  react: pathToFileURL(require.resolve("react")).href,
  "react/jsx-runtime": pathToFileURL(require.resolve("react/jsx-runtime")).href,
};
for (const [name, rel] of Object.entries(FILES)) {
  let js = ts.transpileModule(await fs.readFile(path.join(ROOT, rel), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  js = js.replace(/from "([^"]+)"/g, (m, s) => {
    if (SPEC[s]) return `from "${SPEC[s]}"`;
    if (s.startsWith("@/") || s.startsWith(".")) throw new Error(`${rel}: unmapped import ${s}`);
    return m;
  });
  await fs.writeFile(path.join(OUT, `${name}.mjs`), js);
}
await fs.writeFile(
  path.join(OUT, "link.mjs"),
  `import { createElement } from "${SPEC.react}";\nexport default function Link({ href, prefetch, ...rest }) { return createElement("a", { href, ...rest }); }\n`,
);

const { renderToStaticMarkup } = await import(pathToFileURL(require.resolve("react-dom/server")).href);
const { createElement } = await import(SPEC.react);
const { WorldMap } = await import(pathToFileURL(path.join(OUT, "WorldMap.mjs")).href);
const { COUNTRIES, MAP_W } = await import(pathToFileURL(path.join(OUT, "world-map.mjs")).href);
const { project } = await import(pathToFileURL(path.join(OUT, "geo.mjs")).href);

/** Stand-in for lib/analytics/links.ts, which pulls in the Prisma client. */
const links = { filter: (dim, value) => `/insights?f=${encodeURIComponent(`${dim}:${value}`)}` };
const row = (key, visitors) => ({ key, visitors, sessions: visitors, events: visitors });

function markup(countries, cities) {
  return renderToStaticMarkup(createElement(WorldMap, { countries, cities, links }));
}

const CSS = `html,body{margin:0;background:#0a0a0a;color:#b9d2e6;font:12px ui-monospace,monospace}
:root{--color-ink:#0a0a0a;--color-badge:#ffc857}.wrap{width:1000px;padding:16px}a{color:inherit}
.mt-2{margin-top:8px}.flex{display:flex;gap:8px;align-items:center}.h-2{height:8px}.w-24{width:96px}.w-2{width:8px}
.rounded-full{border-radius:9999px}.block{display:block}.w-full{width:100%}.h-auto{height:auto}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });

async function open(html) {
  const page = await browser.newPage({ viewport: { width: 1032, height: 560 } });
  await page.setContent(`<!doctype html><html><head><style>${CSS}</style></head><body><div class="wrap">${html}</div></body></html>`);
  return page;
}

const SAMPLE_COUNTRIES = [row("US", 40), row("GB", 12), row("DE", 9), row("IN", 5), row("BR", 1)];
const SAMPLE_CITIES = [
  { city: "San Francisco", country: "US", lat: 37.77, lon: -122.42, visitors: 14 },
  { city: "London", country: "GB", lat: 51.51, lon: -0.13, visitors: 7 },
  { city: "Berlin", country: "DE", lat: 52.52, lon: 13.4, visitors: 4 },
  { city: "Mumbai", country: "IN", lat: 19.08, lon: 72.88, visitors: 3 },
  { city: "Sao Paulo", country: "BR", lat: -23.55, lon: -46.63, visitors: 1 },
];

// ---- Scenarios --------------------------------------------------------------------------------

await scenario("The country codes Vercel sends find their shapes", async () => {
  const counts = new Map();
  for (const c of COUNTRIES) {
    assert.match(c.a2 ?? "", /^[A-Z]{2}$/, `${c.name} has no code`);
    counts.set(c.a2, [...(counts.get(c.a2) ?? []), c.name]);
  }
  const shared = [...counts.entries()].filter(([, v]) => v.length > 1);
  assert.deepEqual(shared.map(([k]) => k).sort(), ["CY", "SO"], `shared codes: ${JSON.stringify(shared)}`);
  for (const code of "US GB DE FR IN BR CN JP CA AU RU NG ZA MX ID XK SO".split(" ")) assert.ok(counts.has(code), `no shape for ${code}`);
});

await scenario("City dots land inside their own country", async () => {
  const cities = [
    ["San Francisco", "US", 37.77, -122.42],
    ["London", "GB", 51.51, -0.13],
    ["Tokyo", "JP", 35.68, 139.69],
    ["Sao Paulo", "BR", -23.55, -46.63],
    ["Sydney", "AU", -33.87, 151.21],
    ["Lagos", "NG", 6.52, 3.38],
    ["Berlin", "DE", 52.52, 13.4],
    ["Mumbai", "IN", 19.08, 72.88],
  ].map(([city, country, lat, lon]) => ({ city, country, lat, lon, visitors: 1 }));
  const page = await open(markup(cities.map((c) => row(c.country, 1)), cities));
  const misses = await page.evaluate(() => {
    const out = [];
    const shapes = [...document.querySelectorAll("path[data-label]")];
    for (const dot of document.querySelectorAll("circle[data-label]")) {
      const [place] = dot.dataset.label.split(":");
      const code = place.split(", ")[1];
      const pt = new DOMPoint(Number(dot.getAttribute("cx")), Number(dot.getAttribute("cy")));
      const own = shapes.filter((s) => s.closest("a")?.getAttribute("href")?.endsWith(encodeURIComponent(`country:${code}`)));
      if (!own.some((s) => s.isPointInFill(pt))) out.push(place);
    }
    return out;
  });
  await page.close();
  assert.deepEqual(misses, []);
});

await scenario("Countries with visitors are shaded links, the rest are not", async () => {
  const page = await open(markup(SAMPLE_COUNTRIES, SAMPLE_CITIES));
  const r = await page.evaluate(() => {
    const linked = [...document.querySelectorAll("a > path")].map((p) => ({
      href: decodeURIComponent(p.parentElement.getAttribute("href")),
      alpha: Number(p.getAttribute("fill").match(/\/ ([\d.]+)\)/)[1]),
    }));
    const dots = [...document.querySelectorAll("a > circle")].map((c) => decodeURIComponent(c.parentElement.getAttribute("href")));
    return { linked, dots, legend: document.body.innerText };
  });
  await page.close();
  const codes = r.linked.map((l) => l.href.split("country:")[1]).sort();
  assert.deepEqual(codes, ["BR", "DE", "GB", "IN", "US"]);
  const alpha = Object.fromEntries(r.linked.map((l) => [l.href.split("country:")[1], l.alpha]));
  assert.equal(Math.max(...Object.values(alpha)), alpha.US);
  assert.equal(Math.min(...Object.values(alpha)), alpha.BR);
  assert.equal(r.dots.length, 5);
  for (const c of SAMPLE_CITIES) assert.ok(r.dots.some((d) => d.endsWith(`city:${c.city}`)), `no dot link for ${c.city}`);
  assert.match(r.legend, /40 visitors \/ country/);
});

await scenario("Hovering names the place", async () => {
  // MapHover is client state and this markup isn't hydrated, so the same data-label lookup it
  // does is attached here; the pointer events and labels are the real ones.
  const page = await open(markup(SAMPLE_COUNTRIES, SAMPLE_CITIES));
  await page.evaluate(() => {
    const status = document.querySelector("[role=status]");
    const root = status.parentElement;
    root.addEventListener("pointerover", (e) => {
      const el = e.target.closest("[data-label]");
      status.textContent = el?.getAttribute("data-label") ?? "";
    });
  });
  // Kansas: a multipolygon's box centre (Alaska, Hawaii) isn't on land.
  const box = await page.locator("svg").boundingBox();
  const [kx, ky] = project(38.5, -98).map((v) => (v * box.width) / MAP_W);
  await page.mouse.move(box.x + kx, box.y + ky);
  const first = await page.locator("[role=status]").innerText();
  await page.locator('a[href$="city%3ALondon"] circle').hover({ force: true });
  const second = await page.locator("[role=status]").innerText();
  if (SHOTS) {
    await fs.mkdir(SHOTS, { recursive: true });
    await page.locator(".wrap").screenshot({ path: path.join(SHOTS, "insights-map.png") });
  }
  await page.close();
  assert.equal(first, "United States of America: 40 visitors");
  assert.equal(second, "London, GB: 7 visitors");
});

await scenario("No data still draws the map", async () => {
  const page = await open(markup([], []));
  const r = await page.evaluate(() => ({
    shapes: document.querySelectorAll("path[data-label]").length,
    links: document.querySelectorAll("a").length,
    dots: document.querySelectorAll("circle").length,
    fills: new Set([...document.querySelectorAll("path[data-label]")].map((p) => p.getAttribute("fill"))).size,
  }));
  await page.close();
  assert.equal(r.shapes, COUNTRIES.length);
  assert.equal(r.links, 0);
  assert.equal(r.dots, 0);
  assert.equal(r.fills, 1);
});

await browser.close();
await fs.rm(OUT, { recursive: true, force: true });
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} scenarios passed`);
process.exit(failed ? 1 : 0);
