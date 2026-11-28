// Gherkin -> TypeScript (Playwright Test) for /free-ai/gherkin.
//
// Yumon was fine-tuned on features built from a closed set of step templates (templates.ts, copied
// from yumon-pet's procedural generator), so most of its step lines are one of them with the slots
// filled in. Each step line is matched against every template (case-insensitive: the tokenizer
// lowercases); the match names the method and its arguments. Output, per feature:
//
//   - a steps class with one method per template used (its body from bodies.ts, or a stub that
//     marks the test fixme) plus the helpers those bodies call. A class because API steps share
//     state across a scenario: the request body and headers being built, the last response;
//   - a `test` extended with a `steps` fixture, so each test gets a fresh instance;
//   - test.describe(feature) with Background as beforeEach and one test per scenario.
//
// Lines no template matches still compile, to `steps.pending(...)` with the line as written.
// Pure and synchronous; no DOM, so tests can run it under Node.
import { BODIES, HELPERS } from "./bodies.ts";
import { SINGULAR, STEP_TEMPLATES } from "./templates.ts";

const NUMERIC = new Set(["n", "m", "id", "status", "w", "h", "bpm"]);

type Param = { name: string; numeric: boolean };
type Template = {
  key: string;
  text: string;
  kind: "g" | "w" | "t";
  method: string;
  params: Param[];
  /** Compiled pattern for the plural form and, where the generator has one, the singular form. */
  patterns: RegExp[];
  /** Literal characters (no slots, no spaces): more means more specific. */
  weight: number;
};

/** `{a_one}` -> `one`, `{label_lc}` -> `label`, `{Label}` -> `label`, `{item_name}` -> `itemName`. */
export function paramName(slot: string): string {
  const s = slot.replace(/^a_/, "").replace(/_lc$/, "");
  const camel = s.replace(/_(\w)/g, (_, c: string) => c.toUpperCase());
  return camel[0].toLowerCase() + camel.slice(1);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function compilePattern(text: string, params: Param[]): RegExp {
  let re = "^";
  let quotes = 0;
  const seen = new Set<string>();
  for (const part of text.split(/(\{\w+\})/)) {
    const slot = /^\{(\w+)\}$/.exec(part);
    if (!slot) {
      re += escapeRe(part).replace(/ +/g, "\\s+");
      quotes += (part.match(/"/g) ?? []).length;
      continue;
    }
    const name = paramName(slot[1]);
    if (seen.has(name)) {
      re += `\\k<${name}>`;
      continue;
    }
    seen.add(name);
    const p = params.find((x) => x.name === name)!;
    // Quoted slots can hold quotes of their own ("the layer "ink" is locked"), so both kinds are lazy.
    const body = p.numeric ? "-?\\d+" : quotes % 2 === 1 ? ".*?" : ".+?";
    re += `(?<${name}>${body})`;
  }
  return new RegExp(re + "$", "i");
}

/**
 * Words of a method name. Literal words only ("I fill in "{label}" with "{value}"" -> fill in with),
 * or with `slots` the slot names too, numbers left out ("my {counter} is {n}" -> my counter is).
 */
function nameWords(text: string, slots: boolean): string[] {
  const words = text
    .replace(/\{(\w+)\}/g, (_, s: string) => (slots && !NUMERIC.has(s) ? ` ${paramName(s).replace(/([A-Z])/g, " $1")} ` : " "))
    .replace(/'/g, "")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
  if (words[0] === "i") words.shift();
  return words.filter((w, i) => !/^(the|a|an)$/.test(w) && w !== words[i - 1]);
}
const camel = (words: string[]) => words.map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join("") || "step";
/** Words that do not say what a step does ("my {counter} is {n}" -> myIs says nothing). */
const FILLER = new Set(["am", "is", "are", "be", "my", "should", "have", "has", "there", "no", "not", "to", "for", "of", "in", "on", "at", "with", "as", "by"]);
/** Where the word rules give a clash or an unclear name. */
const NAMES: Record<string, string> = {
  "w.page_n": "goToPageNumber",
  "w.c_menu": "chooseItemFromNamedMenu",
  "w.select_row": "selectRow",
  "t_.c_split": "shouldSeeSplitItems",
  "t_.empty_state": "shouldSeeEmptyState",
  "g.g_achievement": "haveProgressToward",
};

const RESERVED = new Set(["constructor", "page", "request", "response", "data", "headers", "downloads", "pending", ...HELPERS.map((h) => h.name)]);

let cache: Template[] | null = null;
/** Every step template, compiled once. */
export function templates(): Template[] {
  if (cache) return cache;
  // Short names from the literal words; a name that two templates share, or that says nothing
  // ("myIs"), takes the slot names too ("myCounterIs").
  const short = new Map(Object.entries(STEP_TEMPLATES).map(([k, t]) => [k, camel(nameWords(t, false))]));
  const count = new Map<string, number>();
  for (const n of short.values()) count.set(n, (count.get(n) ?? 0) + 1);
  const names = new Map<string, string>();
  for (const [k, t] of Object.entries(STEP_TEMPLATES)) {
    const n = short.get(k)!;
    const vague = nameWords(t, false).filter((w) => !FILLER.has(w)).length < 1;
    let name = NAMES[k] ?? (count.get(n)! > 1 || vague || RESERVED.has(n) ? camel(nameWords(t, true)) : n);
    if (RESERVED.has(name)) name += "Step";
    names.set(k, name);
  }
  const used = new Set<string>();
  cache = Object.entries(STEP_TEMPLATES).map(([key, text]) => {
    const params: Param[] = [];
    for (const m of text.matchAll(/\{(\w+)\}/g)) {
      const name = paramName(m[1]);
      // Save slots are numbered, except the autosave slot "A".
      const numeric = NUMERIC.has(m[1]) && !text.includes("save slot {");
      if (!params.some((p) => p.name === name)) params.push({ name, numeric });
    }
    // The generator's singular form keeps the same slots; only the literal words change.
    const forms = [text];
    for (const [many, one] of SINGULAR) {
      if (!text.includes(many)) continue;
      const slotted = one.replace("{one}", "{many}").replace("{item}", "{items}");
      const alt = text.replace(many, slotted);
      if (!forms.includes(alt)) forms.push(alt);
    }
    let method = names.get(key)!;
    for (let i = 2; used.has(method); i++) method = names.get(key)! + i;
    used.add(method);
    const kind = key.startsWith("g.") ? "g" : key.startsWith("w.") ? "w" : "t";
    const weight = text.replace(/\{\w+\}/g, "").replace(/\s/g, "").length;
    return { key, text, kind, method, params, patterns: forms.map((f) => compilePattern(f, params)), weight };
  });
  return cache;
}

export type StepMatch = { template: Template; args: (string | number)[] };

const KIND_OF: Record<string, Template["kind"]> = { given: "g", when: "w", then: "t" };

/** Normalizes a step body (no keyword) for matching: straight quotes, single spaces, no final period. */
export function normalizeStep(s: string): string {
  return s
    .replace(/[“”„″]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;]$/, "");
}

/** The best template for a step body. `kind` (from Given/When/Then) breaks ties. */
export function matchStep(body: string, kind?: Template["kind"]): StepMatch | null {
  const line = normalizeStep(body);
  let best: { t: Template; groups: Record<string, string>; score: number } | null = null;
  for (const t of templates()) {
    for (const re of t.patterns) {
      const m = re.exec(line);
      if (!m) continue;
      const score = t.weight * 10 + (t.kind === kind ? 5 : 0) - t.params.length;
      if (!best || score > best.score) best = { t, groups: m.groups ?? {}, score };
      break;
    }
  }
  if (!best) return null;
  const { t, groups } = best;
  const args = t.params.map((p) => {
    const raw = groups[p.name] ?? "";
    if (p.numeric) return Number(raw);
    // {a_x} slots hold "a thing" / "an item": the parameter is the noun.
    return STEP_TEMPLATES[t.key].includes(`{a_${p.name}}`) ? raw.replace(/^(an?|the)\s+/i, "") : raw;
  });
  return { template: t, args };
}

// ---------------------------------------------------------------------------------------------
// Parsing

export type Step = { keyword: string; text: string; line: number; match: StepMatch | null };
export type Scenario = { title: string; line: number; steps: Step[]; outline: boolean };
export type Feature = { title: string; line: number; description: string[]; background: Step[]; scenarios: Scenario[] };
export type Note = { line: number; text: string; message: string };

const STEP_RE = /^(given|when|then|and|but|\*)\s+(.*)$/i;
const HEADER_RE = /^(feature|background|scenario outline|scenario template|scenario|example|examples|scenarios|rule)\s*:\s*(.*)$/i;

export function parseGherkin(src: string): { features: Feature[]; notes: Note[] } {
  const features: Feature[] = [];
  const notes: Note[] = [];
  let feature: Feature | null = null;
  let target: Step[] | null = null;
  let scenario: Scenario | null = null;
  let lastKind: Template["kind"] | undefined;
  let inDocString = false;
  const lines = src.replace(/\r\n?/g, "\n").split("\n");

  const ensureFeature = (line: number) => {
    if (!feature) {
      feature = { title: "Untitled feature", line, description: [], background: [], scenarios: [] };
      features.push(feature);
      notes.push({ line, text: "", message: "No Feature: line before the first scenario or step; using \"Untitled feature\"." });
    }
    return feature;
  };

  lines.forEach((raw, i) => {
    const line = i + 1;
    const text = raw.trim();
    if (inDocString) {
      if (text.startsWith('"""') || text.startsWith("```")) inDocString = false;
      return;
    }
    if (!text || text.startsWith("#")) return;
    if (text.startsWith('"""') || text.startsWith("```")) {
      inDocString = true;
      notes.push({ line, text, message: "Doc strings are not compiled; the block is skipped." });
      return;
    }
    if (text.startsWith("@")) {
      notes.push({ line, text, message: "Tags are not compiled." });
      return;
    }
    if (text.startsWith("|")) {
      notes.push({ line, text, message: "Tables are not compiled." });
      return;
    }
    const header = HEADER_RE.exec(text);
    if (header) {
      const kw = header[1].toLowerCase();
      const title = header[2].trim();
      if (kw === "feature") {
        feature = { title: title || "Untitled feature", line, description: [], background: [], scenarios: [] };
        features.push(feature);
        target = null;
        scenario = null;
      } else if (kw === "background") {
        target = ensureFeature(line).background;
        scenario = null;
      } else if (kw === "rule") {
        notes.push({ line, text, message: "Rule: is flattened; its scenarios join the feature." });
      } else if (kw === "examples" || kw === "scenarios") {
        notes.push({ line, text, message: "Examples tables are not compiled; the outline runs once with its <placeholders> as written." });
        target = null;
      } else {
        const outline = kw.startsWith("scenario outline") || kw.startsWith("scenario template");
        scenario = { title: title || "Untitled scenario", line, steps: [], outline };
        ensureFeature(line).scenarios.push(scenario);
        target = scenario.steps;
      }
      lastKind = undefined;
      return;
    }
    const step = STEP_RE.exec(text);
    if (step) {
      const keyword = step[1][0].toUpperCase() + step[1].slice(1).toLowerCase();
      const kind = KIND_OF[keyword.toLowerCase()] ?? lastKind;
      lastKind = kind;
      if (!target) {
        notes.push({ line, text, message: "Step outside a Background or Scenario; it is added to the Background." });
        target = ensureFeature(line).background;
      }
      const match = matchStep(step[2], kind);
      if (!match) notes.push({ line, text, message: "No template matches this step; it compiles to steps.pending()." });
      target.push({ keyword, text: normalizeStep(step[2]), line, match });
      return;
    }
    if (feature && !target && !scenario) {
      feature.description.push(text);
      return;
    }
    notes.push({ line, text, message: "Not a Gherkin keyword line; it is left out." });
  });
  return { features, notes };
}

// ---------------------------------------------------------------------------------------------
// Code generation

export type CompileReport = {
  features: number;
  scenarios: number;
  steps: number;
  /** Steps that matched a template. */
  matched: number;
  /** Matched steps whose template has a Playwright body (the rest are fixme stubs). */
  implemented: number;
  /** Distinct step methods emitted, and how many of them are stubs. */
  methods: number;
  stubs: number;
  notes: Note[];
};

const pascal = (s: string) =>
  s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join("");
const capFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** JS string literal. */
const str = (s: string) => JSON.stringify(s);
/** Body of a template literal (between backticks) for literal text. */
const tplText = (s: string) => s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

function indent(code: string, by: string): string {
  return code
    .split("\n")
    .map((l) => (l ? by + l : l))
    .join("\n");
}

function stubBody(t: Template): string {
  const msg = t.text.split(/(\{\w+\})/).map((part) => {
    const slot = /^\{(\w+)\}$/.exec(part);
    return slot ? "${" + paramName(slot[1]) + "}" : tplText(part);
  });
  return "this.pending(`" + msg.join("") + "`);";
}

function methodCode(t: Template): string {
  const sig = t.params.map((p) => `${p.name}: ${p.numeric ? "number" : "string"}`).join(", ");
  const body = BODIES[t.key] ?? stubBody(t);
  return [`/** ${t.text} */`, `async ${t.method}(${sig}): Promise<void> {`, indent(body, "  "), `}`].join("\n");
}

function callCode(s: Step, by: string): string {
  const comment = `${by}// ${s.keyword} ${s.text}`;
  if (!s.match) return `${comment}\n${by}steps.pending(${str(`${s.keyword} ${s.text}`)});`;
  const args = s.match.args.map((a) => (typeof a === "number" ? String(a) : str(a))).join(", ");
  return `${comment}\n${by}await steps.${s.match.template.method}(${args});`;
}

function featureCode(f: Feature, className: string, testName: string): { code: string; used: Template[]; types: Set<string> } {
  const all = [...f.background, ...f.scenarios.flatMap((s) => s.steps)];
  const used: Template[] = [];
  for (const s of all) if (s.match && !used.includes(s.match.template)) used.push(s.match.template);
  const methods = used.map(methodCode);
  const bodies = methods.join("\n");
  const api = /this\.(response|request|data|headers)\b|this\.(res|json|items)\(/.test(bodies);
  const downloads = /this\.downloads\b/.test(bodies);

  // Helpers can call each other (item -> rows, exactly -> escape): resolve to a fixed point.
  let helperText = bodies;
  const helpers = new Set<string>();
  for (let grew = true; grew; ) {
    grew = false;
    for (const h of HELPERS) {
      if (!helpers.has(h.name) && h.uses.test(helperText)) {
        helpers.add(h.name);
        helperText += "\n" + h.code.join("\n");
        grew = true;
      }
    }
  }
  const types = new Set<string>(["Page", "APIRequestContext"]);
  const helperCode = HELPERS.filter((h) => helpers.has(h.name)).map((h) => {
    for (const n of h.needs ?? []) types.add(n);
    return h.code.join("\n");
  });
  if (api) types.add("APIResponse");

  const fields: string[] = ["readonly page: Page;", "readonly request: APIRequestContext;"];
  if (api) fields.push("/** Body and headers of the next request, and the last response. */", "data: Record<string, string> = {};", "headers: Record<string, string> = {};", "response?: APIResponse;");
  if (downloads) fields.push("/** Suggested file names of every download so far. */", "downloads: string[] = [];");
  const ctor = ["constructor(page: Page, request: APIRequestContext) {", "  this.page = page;", "  this.request = request;"];
  if (downloads) ctor.push(`  page.on("download", (d) => this.downloads.push(d.suggestedFilename()));`);
  ctor.push("}");

  const pending = [
    "/** Marks the running test fixme: the step needs your app's data or state. */",
    "pending(step: string): never {",
    "  base.fixme(true, `Step not implemented: ${step}`);",
    "  throw new Error(`Step not implemented: ${step}`);",
    "}",
  ];

  const classParts = [fields.join("\n"), ctor.join("\n"), ...methods, ...helperCode, pending.join("\n")];
  const cls = [`/** Steps for "${capFirst(f.title).replace(/\*\//g, "* /")}". */`, `class ${className} {`, indent(classParts.join("\n\n"), "  "), `}`].join("\n");

  const fixture = [
    `const ${testName} = base.extend<{ steps: ${className} }>({`,
    `  steps: async ({ page, request }, use) => {`,
    `    await use(new ${className}(page, request));`,
    `  },`,
    `});`,
  ].join("\n");

  const body: string[] = [];
  if (f.description.length) body.push(f.description.map((d) => `// ${d}`).join("\n"));
  if (f.background.length) {
    body.push(`${testName}.beforeEach(async ({ steps }) => {\n${f.background.map((s) => callCode(s, "  ")).join("\n")}\n});`);
  }
  const titles = new Map<string, number>();
  for (const s of f.scenarios) {
    let title = capFirst(s.title);
    // Playwright refuses two tests with the same title in one describe.
    const seen = titles.get(title.toLowerCase()) ?? 0;
    titles.set(title.toLowerCase(), seen + 1);
    if (seen) title += ` (${seen + 1})`;
    const steps = s.steps.length ? s.steps.map((st) => callCode(st, "  ")).join("\n") : "  // No steps.";
    const note = s.outline ? "// Scenario Outline: compiled once, without its Examples.\n" : "";
    body.push(`${note}${testName}(${str(title)}, async ({ steps }) => {\n${steps}\n});`);
  }
  const describe = `${testName}.describe(${str(capFirst(f.title))}, () => {\n${indent(body.join("\n\n"), "  ")}\n});`;
  return { code: [cls, fixture, describe].join("\n\n"), used, types };
}

export function compileGherkin(src: string): { code: string; report: CompileReport } {
  const { features, notes } = parseGherkin(src);
  const report: CompileReport = { features: features.length, scenarios: 0, steps: 0, matched: 0, implemented: 0, methods: 0, stubs: 0, notes };
  if (!features.length) {
    return { code: "// Nothing to compile: write or generate a Feature first.\n", report };
  }
  const classNames = new Set<string>();
  const parts: string[] = [];
  const types = new Set<string>();
  features.forEach((f) => {
    let base = pascal(f.title) || "Feature";
    if (/^\d/.test(base)) base = "F" + base;
    let className = base + "Steps";
    for (let i = 2; classNames.has(className); i++) className = `${base}${i}Steps`;
    classNames.add(className);
    const testName = features.length === 1 ? "test" : className[0].toLowerCase() + className.slice(1, -"Steps".length) + "Test";
    const out = featureCode(f, className, testName);
    parts.push(out.code);
    for (const t of out.types) types.add(t);
    const steps = [...f.background, ...f.scenarios.flatMap((s) => s.steps)];
    report.scenarios += f.scenarios.length;
    report.steps += steps.length;
    report.matched += steps.filter((s) => s.match).length;
    report.implemented += steps.filter((s) => s.match && BODIES[s.match.template.key]).length;
    report.methods += out.used.length;
    report.stubs += out.used.filter((t) => !BODIES[t.key]).length;
  });
  const typeList = ["Page", "APIRequestContext", "APIResponse", "Locator"].filter((t) => types.has(t)).map((t) => `type ${t}`);
  const header = [
    "// Compiled from Gherkin by the Yumon Gherkin compiler (indie-machine.com/free-ai/gherkin).",
    "// Playwright Test: save as tests/<name>.spec.ts and run `npx playwright test`.",
    "// Steps marked pending() need your app's data or state; their tests run as fixme until filled in.",
    `import { test as base, expect, ${typeList.join(", ")} } from "@playwright/test";`,
  ].join("\n");
  return { code: `${header}\n\n${parts.join("\n\n")}\n`, report };
}
