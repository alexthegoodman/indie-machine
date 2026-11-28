// Drives tests/gherkin-app.feature: Gherkin -> app (lib/gherkin-app) -> the tests compiled from the
// same Gherkin, run against that app in Chrome. No Next server: the apps are static pages served by a
// throwaway node:http server for the length of the run.
//
//   node tests/gherkin-app.test.mjs
//
// CORPUS: yumon-pet training-cache/gherkin-proc-1024/units.jsonl (default ../yumon-pet/...).
// PER_KIND: features per feature kind (default 2; 33 kinds). KINDS: comma list to limit kinds.
// PLAYWRIGHT_MODULES: node_modules with @playwright/test (default ../hyperfield/node_modules).
// OUT: working folder (default <tmp>/gherkin-app-e2e), left in place for a look at the apps.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { buildApp } from "../lib/gherkin-app/emit.ts";
import { compileGherkin } from "../lib/gherkin-ts/compile.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const CORPUS = process.env.CORPUS ?? path.join(ROOT, "..", "yumon-pet", "training-cache", "gherkin-proc-1024", "units.jsonl");
const PW = process.env.PLAYWRIGHT_MODULES ?? path.join(ROOT, "..", "hyperfield", "node_modules");
const PER_KIND = Number(process.env.PER_KIND ?? 2);
const ONLY = process.env.KINDS ? new Set(process.env.KINDS.split(",")) : null;
const OUT = process.env.OUT ?? path.join(os.tmpdir(), "gherkin-app-e2e");

const results = [];
async function scenario(name, fn) {
  const start = performance.now();
  try {
    const skipped = await fn();
    results.push({ name, ok: true });
    console.log(`  [${skipped ? "SKIP" : "PASS"}] ${name} (${(performance.now() - start).toFixed(0)}ms)${skipped ? ` - ${skipped}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false });
    console.error(`  [FAIL] ${name}\n`, err);
  }
}

if (!fs.existsSync(CORPUS)) {
  console.log(`  [SKIP] no corpus at ${CORPUS}`);
  process.exit(0);
}
const corpus = fs.readFileSync(CORPUS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
// A spread of each kind: shortest, middle, ... so long and short features both show up.
const byKind = new Map();
for (const u of corpus) if (!ONLY || ONLY.has(u.kind)) (byKind.get(u.kind) ?? byKind.set(u.kind, []).get(u.kind)).push(u);
const sample = [];
for (const [kind, us] of [...byKind].sort()) {
  us.sort((a, b) => a.tokens - b.tokens);
  for (let i = 0; i < PER_KIND; i++) sample.push({ ...us[Math.floor(((i + 0.5) * us.length) / PER_KIND)], id: `${kind}-${i}` });
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "apps"), { recursive: true });
fs.mkdirSync(path.join(OUT, "specs"), { recursive: true });
fs.mkdirSync(path.join(OUT, "node_modules"), { recursive: true });
fs.symlinkSync(path.join(PW, "@playwright"), path.join(OUT, "node_modules", "@playwright"), "junction");

const built = [];
await scenario(`Every sampled feature builds an app and its tests (${sample.length} features)`, () => {
  for (const u of sample) {
    const text = u.text.toLowerCase();
    const app = buildApp(text);
    assert.ok(app, u.id);
    new Function(app.js); // parses
    const spec = compileGherkin(text, { checks: app.plan.checks, actions: app.plan.actions });
    fs.mkdirSync(path.join(OUT, "apps", u.id), { recursive: true });
    fs.writeFileSync(path.join(OUT, "apps", u.id, "index.html"), app.html);
    fs.writeFileSync(path.join(OUT, "apps", u.id, "app.ts"), app.ts);
    fs.writeFileSync(path.join(OUT, "apps", u.id, "feature.feature"), u.text);
    fs.writeFileSync(path.join(OUT, "specs", `${u.id}.spec.ts`), spec.code);
    built.push({ ...u, app, report: spec.report });
  }
  const steps = built.reduce((n, b) => n + b.report.steps, 0);
  const pending = built.reduce((n, b) => n + b.report.pending, 0);
  console.log(`      ${steps} steps, ${pending} pending (${((100 * pending) / steps).toFixed(1)}%); app.ts ${Math.round(built.reduce((n, b) => n + b.app.ts.length, 0) / built.length / 1024)} KB on average`);
});

await scenario("The apps and their tests type-check (tsc --strict)", () => {
  const dir = path.join(OUT, "typecheck");
  fs.mkdirSync(dir, { recursive: true });
  // Each app.ts is a script; `export {}` makes it a module so they do not share globals here.
  for (const b of built) fs.writeFileSync(path.join(dir, `${b.id}.app.ts`), b.app.ts + "\nexport {};\n");
  fs.writeFileSync(
    path.join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { target: "ES2022", module: "esnext", moduleResolution: "bundler", strict: true, noEmit: true, lib: ["ES2022", "DOM", "DOM.Iterable"], types: [], skipLibCheck: true },
      include: ["*.app.ts", "../specs/*.spec.ts"],
    }),
  );
  try {
    execFileSync(process.execPath, [path.join(ROOT, "node_modules", "typescript", "bin", "tsc"), "-p", dir], { encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    throw new Error(`tsc:\n${(e.stdout || "").split("\n").slice(0, 40).join("\n")}`);
  }
});

let summary = null;
await scenario("The compiled tests pass against their apps in Chrome", async () => {
  const server = http.createServer((req, res) => {
    const file = path.join(OUT, "apps", decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
    if (!file.startsWith(path.join(OUT, "apps")) || !fs.existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const projects = built.map((b) => ({ name: b.id, testMatch: `${b.id}.spec.ts`, use: { baseURL: `http://127.0.0.1:${port}/${b.id}/` } }));
  fs.writeFileSync(
    path.join(OUT, "playwright.config.mjs"),
    `import { defineConfig } from "@playwright/test";\nexport default defineConfig(${JSON.stringify({
      testDir: "./specs",
      timeout: 15000,
      expect: { timeout: 2000 },
      workers: 4,
      reporter: [["json", { outputFile: "results.json" }]],
      use: { channel: "chrome", headless: true },
      projects,
    })});\n`,
  );
  // The server lives in this process, so the runner must not block it: spawn and wait asynchronously.
  const run = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(PW, "@playwright", "test", "cli.js"), "test", "-c", "playwright.config.mjs"], { cwd: OUT, stdio: "pipe" });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => resolve({ code, out }));
  });
  server.close();
  const json = JSON.parse(fs.readFileSync(path.join(OUT, "results.json"), "utf8"));
  const tests = [];
  const walk = (suite, file) => {
    for (const s of suite.specs ?? []) for (const t of s.tests) tests.push({ project: t.projectName, title: s.title, status: t.results.at(-1)?.status ?? t.status, error: t.results.at(-1)?.error?.message ?? "", annotations: t.annotations });
    for (const c of suite.suites ?? []) walk(c, file);
  };
  for (const s of json.suites) walk(s);
  const by = (st) => tests.filter((t) => t.status === st).length;
  summary = { total: tests.length, passed: by("passed"), failed: by("failed") + by("timedOut"), skipped: by("skipped") };
  console.log(`      ${summary.total} tests: ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} fixme (pending steps)`);
  const kinds = new Map();
  for (const t of tests) {
    const k = t.project.replace(/-\d+$/, "");
    const v = kinds.get(k) ?? { passed: 0, failed: 0, skipped: 0 };
    v[t.status === "passed" ? "passed" : t.status === "skipped" ? "skipped" : "failed"]++;
    kinds.set(k, v);
  }
  console.log("      by kind (passed/failed/fixme): " + [...kinds].map(([k, v]) => `${k} ${v.passed}/${v.failed}/${v.skipped}`).join(", "));
  const failures = tests.filter((t) => t.status === "failed" || t.status === "timedOut");
  fs.writeFileSync(path.join(OUT, "failures.txt"), failures.map((f) => `${f.project} :: ${f.title}\n${f.error.replace(/\u001b\[\d+m/g, "").split("\n").slice(0, 6).join("\n")}\n`).join("\n"));
  if (failures.length) console.log(`      failures written to ${path.join(OUT, "failures.txt")}`);
  if (!tests.length) throw new Error(`no tests ran:\n${run.out.slice(-3000)}`);
});

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} scenarios passed`);
if (summary) fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
process.exit(failed ? 1 : 0);
