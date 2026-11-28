// App plan (plan.ts) -> the app's source: TypeScript for reading and downloading, JavaScript and a
// standalone HTML page for the preview. The orchestration is written here; the functions it calls
// come from library.ts (via library.gen.ts), copied in with whatever they use, in library order.
import { LIBRARY } from "./library.gen.ts";
import { pascal, planApp, type AppPlan, type Element, type Rule, type Trigger } from "./plan.ts";
import { parseGherkin, type Feature } from "../gherkin-ts/compile.ts";

const str = (s: string) => JSON.stringify(s);
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export type BuiltApp = {
  plan: AppPlan;
  feature: Feature;
  ts: string;
  js: string;
  html: string;
  /** Library declarations copied in. */
  functions: string[];
  notes: string[];
};

function indent(lines: string[], by = "  "): string[] {
  return lines.flatMap((l) => l.split("\n")).map((l) => (l ? by + l : l));
}

/** Lines of a handler: validation, then guarded rules, then the rest merged, then any dialog or menu. */
function handlerBody(t: Trigger): string[] {
  const out: string[] = [...(t.does ?? [])];
  if (t.checks.length) {
    out.push("let failed = false;");
    for (const c of t.checks) out.push(`// Scenario: ${c.scenario}`, `if (${c.cond}) {`, ...indent([...dedupe(c.effects), "failed = true;"]), "}");
    out.push("if (failed) return;");
  }
  const guarded = t.rules.filter((r) => r.guards.length);
  const plain = t.rules.filter((r) => !r.guards.length);
  for (const r of mergeByGuards(guarded)) out.push(`// Scenario: ${r.scenario}`, `if (${r.guards.join(" && ")}) {`, ...indent([...dedupe(r.effects), ...(plain.length || t.follow ? ["return;"] : [])]), "}");
  if (plain.length) out.push(`// Scenario: ${unique(plain.map((r) => r.scenario)).join("; ")}`, ...dedupe(plain.flatMap((r) => r.effects)));
  if (t.follow?.kind === "confirm") {
    const ok = dedupe(t.follow.ok.flatMap((r) => r.effects));
    const cancel = dedupe(t.follow.cancel.flatMap((r) => r.effects));
    const labels = t.follow.okLabel || t.follow.cancelLabel ? `, ${str(t.follow.okLabel ?? "ok")}, ${str(t.follow.cancelLabel ?? "cancel")}` : "";
    out.push(`confirmDialog(${str(t.follow.text)}, () => {`, ...indent(ok), `}, () => {`, ...indent(cancel), `}${labels});`);
  }
  if (t.follow?.kind === "menu") {
    const items = [...t.follow.items.keys()];
    out.push(`showMenu(${str(t.target)}, [${items.map(str).join(", ")}], (item) => {`);
    for (const item of items) out.push(...indent([`if (item === ${str(item)}) {`, ...indent(dedupe(t.follow.items.get(item)!.flatMap((r) => r.effects))), "}"]));
    out.push("});");
  }
  return out;
}

function mergeByGuards(rules: Rule[]): Rule[] {
  const out: Rule[] = [];
  for (const r of rules) {
    const same = out.find((o) => o.guards.join("&&") === r.guards.join("&&"));
    if (same) {
      same.scenario += `; ${r.scenario}`;
      same.effects.push(...r.effects);
    } else out.push({ ...r, effects: [...r.effects] });
  }
  return out;
}

const dedupe = (lines: string[]) => lines.filter((l, i) => lines.indexOf(l) === i);
const unique = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) === i);

function elementLine(e: Element, values: Map<string, Set<string>>): string {
  if (e.kind === "field") {
    // A select offers every value the Gherkin gives its label.
    const options = e.type === "select" ? [...new Set([...e.options, ...(values.get(e.label) ?? [])])] : [];
    return `addField(${str(e.page)}, ${str(e.id)}, ${str(e.label)}, ${str(e.type)}${options.length ? `, [${options.map(str).join(", ")}]` : ""});`;
  }
  if (e.kind === "button") return `addButton(${str(e.page)}, ${str(e.id)}, ${str(e.label)}${e.region ? `, ${str(e.region)}` : ""});`;
  if (e.kind === "link") return `addLink(${str(e.page)}, ${str(e.id)}, ${str(e.label)}, ${str(e.target)});`;
  return "";
}

function orchestration(plan: AppPlan, mode: "ts" | "js"): string[] {
  const T = (s: string) => (mode === "ts" ? s : "");
  const out: string[] = [];
  out.push("// ---- Pages and elements ----", `mountApp(${str(plan.title)}, [${plan.pages.map(str).join(", ")}]);`);
  const rank = { field: 0, list: 1, button: 2, link: 3 };
  const els = [...plan.elements].sort((a, b) => plan.pages.indexOf(a.page) - plan.pages.indexOf(b.page) || rank[a.kind] - rank[b.kind]);
  for (const e of els) if (e.kind !== "list") out.push(elementLine(e, plan.values));
  if (plan.inventory) out.push(`addPanel("", "inventory", "Inventory");`);
  if (plan.facts || plan.givens.size && [...plan.givens.values()].flat().some((l) => l.includes("setStatus"))) out.push(`addPanel("", "state", "State");`);

  // Records: open and select functions, and refresh() drawing every list.
  const refresh: string[] = [];
  if (plan.entities.length) out.push("", "// ---- Records ----");
  for (const e of plan.entities) {
    const listEl = plan.elements.find((x) => x.kind === "list" && x.entity === e.one);
    const open = plan.triggers.find((t) => t.on === "open" && t.target === e.one);
    const select = plan.triggers.find((t) => t.on === "select" && t.target === e.one);
    const P = pascal(e.one);
    const usedOpen = open || !!listEl || [...plan.givens.values()].flat().some((l) => l.includes(`open${P}(`));
    if (usedOpen && e.panel) {
      out.push(`/** Picks a ${e.one} in the panel. */`, `function open${P}(name${T(": string")}) {`, ...indent([`openRecord(${str(e.one)}, ${str(e.nameKey)}, name);`, `setFact(\`the ${e.one} "\${name}" is selected\`);`, ...(open ? handlerBody(open) : [])]), "}");
    } else if (usedOpen) {
      out.push(
        `/** Shows a ${e.one} on its own page. */`,
        `function open${P}(name${T(": string")}) {`,
        ...indent([
          `const row = openRecord(${str(e.one)}, ${str(e.nameKey)}, name);`,
          `showPage(${str(e.detailPage)});`,
          `setHeading(${str(e.detailPage)}, name);`,
          `fillForm(${str(e.detailPage)}, row);`,
          `setBreadcrumb(${str(e.detailPage)}, [${str(e.listPage)}, name]);`,
          `showDetails(${str(e.detailPage)}, row);`,
          ...(open ? handlerBody(open) : []),
        ]),
        "}",
      );
    }
    if (listEl) {
      out.push(`function selected${P}() {`, ...indent(select ? handlerBody(select) : ["// Nothing depends on the selection."]), "}");
      const opts = `{ badges: [${e.badges.map(str).join(", ")}], search: ${e.search}, ${e.filter ? `filter: { key: ${str(e.filter.key)}, options: [${e.filter.options.map(str).join(", ")}] }, ` : ""}sorts: [${e.sorts.map(str).join(", ")}] }`;
      refresh.push(`renderList(${str(listEl.page)}, ${str(listEl.id)}, ${str(e.one)}, ${str(e.nameKey)}, ${usedOpen ? `open${P}` : "() => {}"}, selected${P}, ${opts});`);
    }
  }
  out.push("", "/** Redraws what depends on state; runs after every action. */", "function refresh() {", ...indent(refresh.length ? refresh : ["// Nothing to redraw."]), "}");

  out.push("", "// ---- Behaviour: When -> Then ----");
  for (const t of plan.triggers) {
    if (t.on === "open" || t.on === "select") continue;
    const body = handlerBody(t);
    if (!body.length) continue;
    if (t.on === "click") out.push(`on(${str(t.target)}, () => {`, ...indent(body), "});");
    else if (t.on === "key") out.push(`onKey(${str(t.target)}, () => {`, ...indent(body), "});");
    else if (t.on === "change") out.push(`onChange(${str(t.target)}, () => {`, ...indent(body), "});");
    else if (t.on === "enter") out.push(`onPage(${str(t.target)}, () => {`, ...indent(body), "});");
  }

  out.push("", "// ---- Starting states: Given ----", "const GIVENS = {");
  for (const [text, lines] of plan.givens) {
    out.push(lines.length === 1 ? `  ${str(text)}: () => ${lines[0].replace(/;$/, "")},` : `  ${str(text)}: () => {`, ...(lines.length === 1 ? [] : [...indent(lines, "    "), "  },"]));
  }
  out.push("};", "", "const SCENARIOS = [");
  for (const s of plan.scenarios) out.push(`  { title: ${str(s.title)}, givens: [${s.givens.map(str).join(", ")}] },`);
  out.push("];", "", "/** Then lines no element shows, checked by the tests through window.gherkinApp. */", "const CHECKS = {");
  for (const [text, expr] of plan.checks) out.push(`  ${str(text)}: () => ${expr},`);
  out.push("};");
  if (plan.signInFirst) out.push("", `// Pages other than signing in need a session; signing in returns to the page asked for.`, `requireSignIn(${str(plan.pages.find((p) => /sign in|log in/.test(p)) ?? "sign in")}, [${plan.pages.filter((p) => /sign|log|password|reset/.test(p)).map(str).join(", ")}]);`);
  if (plan.setup.length) out.push("", ...plan.setup);
  out.push("", `startApp(GIVENS, SCENARIOS, refresh, CHECKS, ${str(plan.pages[0])});`);
  return out;
}

/** Library declarations the code calls, plus their dependencies, in library order. */
function pick(code: string): string[] {
  const want = new Set<string>();
  const add = (name: string) => {
    if (want.has(name)) return;
    want.add(name);
    for (const d of LIBRARY[name].deps) add(d);
  };
  for (const name of Object.keys(LIBRARY)) if (new RegExp(`\\b${name}\\(`).test(code)) add(name);
  return Object.keys(LIBRARY).filter((n) => want.has(n));
}

export function buildApp(src: string): BuiltApp | null {
  const { features } = parseGherkin(src);
  if (!features.length) return null;
  const feature = features[0];
  const plan = planApp(feature);
  const notes = [...plan.notes];
  if (features.length > 1) notes.push(`Only the first feature ("${feature.title}") is built into the app; the tests cover all ${features.length}.`);
  const tsCode = orchestration(plan, "ts").join("\n");
  const jsCode = orchestration(plan, "js").join("\n");
  const functions = pick(tsCode);
  const header = [
    `// ${cap(feature.title)}: an app compiled from Gherkin by Yumon's Gherkin compiler`,
    "// (indie-machine.com/free-ai/gherkin). The functions below are reusable boilerplate; the part after",
    "// \"Pages and elements\" is this feature: the elements its steps need, a handler for each action",
    "// (When) doing what the scenarios expect (Then), and each scenario's starting state (Given).",
    "// Build: npx esbuild app.ts --outfile=app.js, then open an HTML page with <script src=\"app.js\"> in its body.",
  ];
  const ts = [...header, "", functions.map((n) => LIBRARY[n].ts).join("\n\n"), "", tsCode, ""].join("\n");
  const js = [...functions.map((n) => LIBRARY[n].js).filter(Boolean), jsCode].join("\n\n");
  return { plan, feature, ts, js, html: page(cap(feature.title), js), functions, notes };
}

/**
 * A standalone page for the app. Inside the preview it runs in a sandboxed iframe (scripts only,
 * opaque origin); the CSP also blocks every network request, so the app can only touch itself.
 */
export function page(title: string, js: string): string {
  const safeTitle = title.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
  const script = js.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${safeTitle}</title>`,
    "</head>",
    "<body>",
    `<script>\n${script}\n</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
