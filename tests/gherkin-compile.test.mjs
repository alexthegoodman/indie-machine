// Drives tests/gherkin-compile.feature: the Gherkin -> TypeScript compiler in lib/gherkin-ts, under
// Node (no server, no browser).
//
//   node tests/gherkin-compile.test.mjs
//
// CORPUS: yumon-pet's procedural training set (default ../yumon-pet/training-cache/gherkin-proc-1024/
//   units.jsonl, written by scripts/gherkin/generate.mjs). Skipped scenarios say so when it is missing.
// PLAYWRIGHT_TYPES: a node_modules holding @playwright/test, for the type check (default
//   ../hyperfield/node_modules). Indie Machine itself does not depend on Playwright Test.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { compileGherkin, matchStep, templates } from "../lib/gherkin-ts/compile.ts";
import { BODIES } from "../lib/gherkin-ts/bodies.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const CORPUS = process.env.CORPUS ?? path.join(ROOT, "..", "yumon-pet", "training-cache", "gherkin-proc-1024", "units.jsonl");
const PW = process.env.PLAYWRIGHT_TYPES ?? path.join(ROOT, "..", "hyperfield", "node_modules");
const TYPECHECK_SAMPLE = Number(process.env.TYPECHECK_SAMPLE ?? 300);

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

const corpus = fs.existsSync(CORPUS)
  ? fs.readFileSync(CORPUS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : null;

await scenario("Every step template compiles to a unique method", () => {
  const ts = templates();
  assert.equal(ts.length, 316);
  const names = new Set(ts.map((t) => t.method));
  assert.equal(names.size, ts.length, "method names collide");
  for (const t of ts) assert.match(t.method, /^[a-z][A-Za-z0-9]*$/, t.key);
  for (const key of Object.keys(BODIES)) assert.ok(ts.some((t) => t.key === key), `body for unknown template ${key}`);
});

await scenario("Lowercase lines match their templates with typed arguments", () => {
  const cases = [
    ['i fill in "title" with "write the weekly report"', "w.fill", ["title", "write the weekly report"]],
    ['i click the "next" button', "w.next_page", []],
    ['i click the "save" button', "w.click_button", ["save"]],
    ["there is 1 task", "g.n_exist", [1, "task"]],
    ["there are 12 invoices", "g.n_exist", [12, "invoices"]],
    ['an invoice "inv-1001" exists with status "paid"', "g.exists_field", ["invoice", "inv-1001", "status", "paid"]],
    ['i should see "no tasks yet"', "t_.empty_state", ["tasks"]],
    ["the response status should be 404", "t_.status", [404]],
    ["i undo 1 time", "w.c_undo", [1]],
    ["my race position is 4", "g.g_counter", ["race position", 4]],
    ["i build an archer tower at c4", "w.g_place", ["archer tower", "c4"]],
    ["I should see the “Sign in” button.", "t_.signed_out", []],
  ];
  for (const [line, key, args] of cases) {
    const m = matchStep(line);
    assert.ok(m, `no match: ${line}`);
    assert.equal(m.template.key, key, line);
    assert.deepEqual(m.args, args, line);
  }
  assert.equal(matchStep("i frobnicate the widget"), null);
});

await scenario("The training corpus compiles with every step matched", () => {
  if (!corpus) return `no corpus at ${CORPUS}`;
  let steps = 0;
  let matched = 0;
  let implemented = 0;
  const misses = new Map();
  const usedKeys = new Set();
  const t0 = performance.now();
  for (const u of corpus) {
    // Yumon's tokenizer lowercases, so this is what the model writes.
    const { report } = compileGherkin(u.text.toLowerCase());
    steps += report.steps;
    matched += report.matched;
    implemented += report.implemented;
    for (const n of report.notes) if (n.message.startsWith("No template")) misses.set(n.text, (misses.get(n.text) ?? 0) + 1);
  }
  const ms = performance.now() - t0;
  for (const u of corpus.slice(0, 2000)) {
    for (const line of u.text.toLowerCase().split("\n")) {
      const m = /^\s*(given|when|then|and|but)\s+(.*)$/.exec(line);
      const hit = m && matchStep(m[2]);
      if (hit) usedKeys.add(hit.template.key);
    }
  }
  console.log(
    `      ${corpus.length} features, ${steps} steps, ${matched} matched (${((100 * matched) / steps).toFixed(3)}%), ` +
      `${implemented} with a Playwright body (${((100 * implemented) / steps).toFixed(1)}%), ${(ms / corpus.length).toFixed(2)} ms/feature`,
  );
  console.log(`      templates hit in the first 2,000 features: ${usedKeys.size} of ${templates().length}`);
  if (misses.size) console.log("      top misses:", [...misses].sort((a, b) => b[1] - a[1]).slice(0, 10));
  assert.equal(matched, steps);
});

await scenario("Compiled features type-check against @playwright/test", () => {
  if (!corpus) return `no corpus at ${CORPUS}`;
  if (!fs.existsSync(path.join(PW, "@playwright", "test"))) return `no @playwright/test in ${PW}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gherkin-ts-"));
  // Spread the sample over the corpus so every feature kind shows up.
  const step = Math.max(1, Math.floor(corpus.length / TYPECHECK_SAMPLE));
  const files = [];
  for (let i = 0; i < corpus.length && files.length < TYPECHECK_SAMPLE; i += step) {
    const f = path.join(dir, `f${i}.spec.ts`);
    fs.writeFileSync(f, compileGherkin(corpus[i].text.toLowerCase()).code);
    files.push(f);
  }
  // Two features in one file, and an unmatched line.
  fs.writeFileSync(
    path.join(dir, "multi.spec.ts"),
    compileGherkin(corpus[0].text + "\n\n" + corpus[1].text + "\n    And i frobnicate the widget\n").code,
  );
  fs.writeFileSync(
    path.join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022", module: "esnext", moduleResolution: "bundler", strict: true, noEmit: true,
        lib: ["ES2022", "DOM"], types: [], skipLibCheck: true, typeRoots: [], baseUrl: ".",
        paths: { "@playwright/test": [path.join(PW, "@playwright", "test").replace(/\\/g, "/")] },
      },
      include: ["*.spec.ts"],
    }),
  );
  const tsc = path.join(ROOT, "node_modules", "typescript", "bin", "tsc");
  try {
    execFileSync(process.execPath, [tsc, "-p", dir], { encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    throw new Error(`tsc failed in ${dir}:\n${(e.stdout || "").slice(0, 4000)}`);
  }
  console.log(`      ${files.length + 1} compiled files, tsc clean`);
  fs.rmSync(dir, { recursive: true, force: true });
});

await scenario("Repeated scenario titles get numbered and Background becomes beforeEach", () => {
  const src = [
    "feature: sign in",
    "  background:",
    "    given i am on the sign in page",
    "  scenario: sign in with a wrong password",
    '    when i sign in as "ada@example.com" with password "nope"',
    '    then i should see the message "wrong email or password"',
    "  scenario: sign in with a wrong password",
    "    when i click the \"sign in\" button without entering anything",
    "    then i should see \"email is required\"",
  ].join("\n");
  const { code, report } = compileGherkin(src);
  assert.equal(report.scenarios, 2);
  assert.equal(report.matched, 5);
  assert.match(code, /test\.beforeEach\(async \(\{ steps \}\) => \{\n {4}\/\/ Given i am on the sign in page\n {4}await steps\.amOnSignInPage\(\);/);
  assert.match(code, /test\("Sign in with a wrong password", /);
  assert.match(code, /test\("Sign in with a wrong password \(2\)", /);
  assert.match(code, /class SignInSteps \{/);
  assert.match(code, /urlFor\(page: string\)/);
});

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} scenarios passed`);
process.exit(failed ? 1 : 0);
