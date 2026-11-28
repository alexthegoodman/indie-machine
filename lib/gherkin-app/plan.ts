// Gherkin -> app plan for /free-ai/gherkin. Reads the matched steps of one feature (parseGherkin in
// lib/gherkin-ts/compile.ts) and decides what the app is made of, using the functions in library.ts:
//
//   - elements: every step implies one (a labelled field, a button, a list, a counter...), on the
//     page the scenario is on at that point. Ids are "<page>-<label>[-kind]".
//   - starting states: each Given line becomes setup code, keyed by its text; each scenario lists
//     its Givens (Background first), plus any Then checked before the first When.
//   - behaviour: the last action in each When block is a trigger (a click, a key, a change); the Then
//     lines after it become what its handler does. Rules for the same trigger from different
//     scenarios are told apart by guards read off the steps: an error under a field names its own
//     check ("is required" -> empty), a sign-in success needs known credentials, a purchase needs the
//     money, a role or a fact from the Givens separates the rest. What the steps do not say becomes
//     a fact the app records and shows.
//
// Pure: no DOM, so Node tests run it.
import { normalizeStep, type Feature, type Step } from "../gherkin-ts/compile.ts";
import { STEP_TEMPLATES } from "../gherkin-ts/templates.ts";

export type FieldKind = "text" | "textarea" | "email" | "password" | "select" | "checkbox" | "file" | "range" | "editor";
export type Element =
  | { kind: "field"; page: string; id: string; label: string; type: FieldKind; options: string[] }
  | { kind: "button"; page: string; id: string; label: string; region: "" | "toolbar" | "actions" }
  | { kind: "link"; page: string; id: string; label: string; target: string }
  | { kind: "list"; page: string; id: string; entity: string };

export type Rule = {
  scenario: string;
  guards: string[];
  effects: string[];
  /** The scenario's starting facts, counters and items, to tell rules of one trigger apart. */
  start?: { facts: string[]; counters: Map<string, number>; items: Map<string, number> };
};
export type Trigger = {
  id: string;
  /** What the trigger always does before its scenarios' outcomes (a studio action's record change). */
  does?: string[];
  /** click (button or link), key, change (a field), open (a list row), select (a list checkbox), enter (a page shown). */
  on: "click" | "key" | "change" | "open" | "select" | "enter";
  /** Element id, key name, entity or page, by `on`. */
  target: string;
  /** Validation: each failing check sets its error; any failure stops the handler. */
  checks: { cond: string; effects: string[]; scenario: string }[];
  rules: Rule[];
  /** A dialog or menu that follows this trigger in the same scenario. */
  follow?: { kind: "confirm"; text: string; ok: Rule[]; cancel: Rule[]; okLabel?: string; cancelLabel?: string } | { kind: "menu"; items: Map<string, Rule[]> };
};

export type Entity = {
  /** Items in a studio's panel (layers, slides, clips): listed on the document's page, not opened. */
  panel: boolean;
  one: string;
  many: string;
  nameKey: string;
  listPage: string;
  detailPage: string;
  newPage: string;
  /** Fields shown as badges in the list. */
  badges: string[];
  search: boolean;
  filter?: { key: string; options: string[] };
  sorts: string[];
};
export type AppPlan = {
  title: string;
  story: string[];
  pages: string[];
  elements: Element[];
  entities: Entity[];
  counters: string[];
  inventory: boolean;
  facts: boolean;
  /** Given text (lowercase) -> setup lines. */
  givens: Map<string, string[]>;
  /** Then text (lowercase) -> boolean expression, for steps with no element to look at. */
  checks: Map<string, string>;
  scenarios: { title: string; givens: string[] }[];
  triggers: Trigger[];
  /** Setup lines run once after the elements exist (tooltips, page size). */
  setup: string[];
  /** Step text (lowercase) -> label of the action button it became. */
  actions: Map<string, string>;
  notes: string[];
  /** Library functions the orchestration calls directly. */
  uses: Set<string>;
  /** A scenario visits a page signed out and signs in: pages other than sign in / sign up need a session. */
  signInFirst: boolean;
  /** Trigger id -> the page its handler shows. */
  navigation: Map<string, string>;
  /** Field label -> every value the Gherkin gives it (options of a select). */
  values: Map<string, Set<string>>;
};

const str = (s: string) => JSON.stringify(s);
const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "home";
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const SAVE = /^(save|create|add|submit|done|update|apply|save changes)$/i;
const DELETE = /^(delete|remove)$/i;
const plural = (one: string) => (/(s|x|ch|sh)$/.test(one) ? one + "es" : /[^aeiou]y$/.test(one) ? one.slice(0, -1) + "ies" : one + "s");

/** "the fox should flash for 2 seconds" -> "The fox flashes for 2 seconds"-ish text for display. */
export function factText(text: string): string {
  return text.replace(/^i should /i, "I ").replace(/ should not /i, " does not ").replace(/ should be /i, " is ").replace(/ should have /i, " has ").replace(/ should /i, " ");
}

type Ctx = {
  /** The scenario's Given keys, so an implied starting page can be added. */
  givenKeys: string[];
  /** A When has run in this scenario. */
  started: boolean;
  page: string;
  entity?: Entity;
  record?: string;
  inputs: { id: string; label: string; value: string; empty: boolean }[];
  counters: Map<string, number>;
  items: Map<string, number>;
  role?: string;
  facts: string[];
  seeded: Set<string>;
};

export function planApp(feature: Feature): AppPlan {
  // A button's page can depend on a later scenario ("Load game" shows the load game screen), so plan
  // once to learn where each trigger leads, then again with that known.
  return planOnce(feature, planOnce(feature, new Map()).navigation);
}

function planOnce(feature: Feature, hints: Map<string, string>): AppPlan {
  const plan: AppPlan = {
    title: feature.title,
    story: feature.description,
    pages: [],
    elements: [],
    entities: [],
    counters: [],
    inventory: false,
    facts: false,
    givens: new Map(),
    checks: new Map(),
    scenarios: [],
    triggers: [],
    setup: [],
    actions: new Map(),
    notes: [],
    uses: new Set(),
    signInFirst: false,
    navigation: new Map(),
    values: new Map(),
  };
  const use = (...names: string[]) => names.forEach((n) => plan.uses.add(n));
  const page = (name: string) => {
    const p = name.trim().toLowerCase();
    if (!plan.pages.includes(p)) plan.pages.push(p);
    return p;
  };
  const element = <E extends Element>(e: E): E => {
    const old = plan.elements.find((x) => x.id === e.id);
    if (old) {
      if (old.kind === "field" && e.kind === "field") {
        for (const o of e.options) if (!old.options.includes(o)) old.options.push(o);
        if (["text", "email", "password"].includes(old.type) && !["text", "email", "password"].includes(e.type)) old.type = e.type;
        if (old.type === "range" && e.type === "select") old.type = "select";
      }
      return old as E;
    }
    plan.elements.push(e);
    return e;
  };
  const entity = (one: string, many?: string): Entity => {
    one = one.toLowerCase().replace(/^(an?|the)\s+/, "");
    let e = plan.entities.find((x) => x.one === one || x.many === one);
    if (!e) {
      const m = (many ?? plural(one)).toLowerCase();
      e = { panel: false, one, many: m, nameKey: "", listPage: m, detailPage: one, newPage: `new ${one}`, badges: [], search: false, sorts: [] };
      plan.entities.push(e);
    }
    return e;
  };
  const fieldKind = (label: string, fallback: FieldKind = "text"): FieldKind => (/password/i.test(label) ? "password" : /e-?mail/i.test(label) ? "email" : fallback);
  const seen = (label: string, value: string) => {
    if (!value) return;
    const set = plan.values.get(label.toLowerCase()) ?? new Set<string>();
    set.add(value);
    plan.values.set(label.toLowerCase(), set);
  };
  const field = (p: string, label: string, type: FieldKind = "text", options: string[] = []) =>
    element({ kind: "field", page: page(p), id: `${slug(p)}-${slug(label)}`, label: label.toLowerCase(), type: type === "text" ? fieldKind(label) : type, options });
  const button = (p: string, label: string, region: "" | "toolbar" | "actions" = "") =>
    element({ kind: "button", page: page(p), id: `${slug(p)}-${slug(label)}${region === "toolbar" ? "-tb" : region === "actions" ? "-act" : "-btn"}`, label: label.toLowerCase(), region });
  const list = (e: Entity) => {
    use("renderList");
    return element({ kind: "list", page: page(e.listPage), id: `${slug(e.listPage)}-list`, entity: e.one });
  };
  const trigger = (on: Trigger["on"], target: string): Trigger => {
    const id = `${on}:${target}`;
    let t = plan.triggers.find((x) => x.id === id);
    if (!t) {
      t = { id, on, target, checks: [], rules: [] };
      plan.triggers.push(t);
    }
    return t;
  };
  const counterName = (c: string) => {
    const n = c.toLowerCase();
    if (!plan.counters.includes(n)) plan.counters.push(n);
    return n;
  };
  const nameKeyOf = (e: Entity) => e.nameKey || (e.nameKey = "name");
  /** Before the scenario's first action, start it on `p` if its Givens put it elsewhere (or nowhere). */
  const startOn = (ctx: Ctx, p: string) => {
    if (ctx.started || ctx.page === p) return;
    const key = `(start on the ${p} page)`;
    use("showPage");
    plan.givens.set(key, [`showPage(${str(page(p))});`]);
    ctx.givenKeys.push(key);
    ctx.page = p;
  };
  /** The page the last action leads to, for the next action of the scenario. */
  let nextPage = "";
  /** The trigger whose dialog the next phase answers with a button of its own ("Restore"). */
  let pendingDialog: Trigger | null = null;
  /** A studio's items ("layer", "slide") as records listed on the document's page. */
  const panelEntity = (item: string, ctx: Ctx): Entity => {
    const e = entity(singular(item));
    if (!e.panel) {
      e.panel = true;
      e.nameKey = "name";
      e.listPage = ctx.page || page(plan.pages[0] ?? "home");
    }
    ctx.entity = e;
    list(e);
    return e;
  };
  /** The trigger whose dialog a later phase answers. */
  let lastDialogTrigger: Trigger | null = null;
  /** The phase's action is built into the library (signing out from the user menu). */
  let builtin = false;

  // Pass 1: pages, entities and the name field of each entity, so later steps can refer to them.
  // Twice, so an entity named late in the feature is known for the steps before it.
  const all = [...feature.background, ...feature.scenarios.flatMap((s) => s.steps)];
  for (let round = 0; round < 2; round++) {
    let p = "";
    for (const s of all) {
      if (!s.match) continue;
      const k = s.match.template.key;
      const a = argMap(s);
      if (k === "g.on_new") {
        const e = entity(a.one);
        p = page(e.newPage);
      } else if (a.one || a.many) {
        if (/^(g|t_)\.(on_page|n_exist|none_exist|empty_state|no_results|n_in_list|store_count)$/.test(k) || k === "w.select_all") {
          if (a.many) entity(singular(a.many), a.many);
        } else if (a.one && !/^t_\.(on_page)$/.test(k)) entity(a.one, a.many || undefined);
      }
      if (k === "g.on_page" || k === "w.go_page") p = page(a.page);
      // "New ticket" opens the new-ticket page when tickets are records somewhere in the feature.
      const opens = k === "w.click_button" && /^(new|add|create) (.+)$/i.exec(a.button);
      const known = opens && plan.entities.find((x) => x.one === opens[2].toLowerCase());
      if (known) p = page(known.newPage);
      if ((k === "w.sort" || k === "w.sort_desc") && a.label) {
        const e = plan.entities.find((x) => x.listPage === p) ?? plan.entities[plan.entities.length - 1];
        if (e && !e.nameKey) e.nameKey = a.label.toLowerCase();
      }
      if ((k === "w.fill" || k === "w.date" || k === "w.select") && p) {
        const e = plan.entities.find((x) => x.newPage === p || x.detailPage === p);
        if (e && !e.nameKey) e.nameKey = a.label.toLowerCase();
      }
    }
  }

  const titles = new Map<string, number>();
  const scenarios = feature.scenarios.length ? feature.scenarios : [{ title: feature.title, line: 0, steps: [], outline: false }];
  for (const sc of scenarios) {
    let title = cap(sc.title);
    const seen = titles.get(title.toLowerCase()) ?? 0;
    titles.set(title.toLowerCase(), seen + 1);
    if (seen) title += ` (${seen + 1})`;
    const givenKeys: string[] = [];
    nextPage = "";
    const ctx: Ctx = { givenKeys, started: false, page: "", inputs: [], counters: new Map(), items: new Map(), facts: [], seeded: new Set() };
    const steps = [...feature.background, ...sc.steps];
    // Split into phases: Givens, then (When+ Then+)+. A Then before any When describes the start.
    let phase: { whens: Step[]; thens: Step[] } | null = null;
    const phases: { whens: Step[]; thens: Step[] }[] = [];
    for (const s of steps) {
      const kind = s.match ? s.match.template.kind : s.keyword === "Then" ? "t" : s.keyword === "When" ? "w" : s.keyword === "Given" ? "g" : phase ? (phase.thens.length ? "t" : "w") : "g";
      if (kind === "g" || (kind === "t" && !phase)) {
        const text = s.text.toLowerCase();
        givenKeys.push(text);
        if (!plan.givens.has(text)) plan.givens.set(text, given(s, ctx));
        else replayContext(s, ctx);
        continue;
      }
      if (kind === "w") {
        if (!phase || phase.thens.length) {
          phase = { whens: [], thens: [] };
          phases.push(phase);
        }
        phase.whens.push(s);
      } else phase!.thens.push(s);
    }
    for (const ph of phases) doPhase(ph, ctx, title);
    plan.scenarios.push({ title, givens: givenKeys });
  }

  // ---- Givens ----------------------------------------------------------------------------------
  function replayContext(s: Step, ctx: Ctx) {
    given(s, ctx);
  }

  function given(s: Step, ctx: Ctx): string[] {
    const text = s.text.toLowerCase();
    if (!s.match) return givenFact(text, ctx);
    const k = s.match.template.key;
    const a = argMap(s);
    switch (k) {
      case "g.logged_in":
      case "g.api_auth":
        ctx.role = a.role.toLowerCase();
        use("signIn");
        return [`signIn(${str(a.role.toLowerCase())});`];
      case "g.logged_in_viewer":
      case "g.api_viewer":
        ctx.role = "viewer";
        use("signIn");
        return [`signIn("viewer");`];
      case "g.logged_in_editor":
        ctx.role = "editor";
        use("signIn");
        return [`signIn("editor");`];
      case "g.not_logged_in":
      case "g.session_expired":
        ctx.role = undefined;
        use("signOut");
        return ["signOut();"];
      case "g.on_page":
      case "g.on_signin":
      case "g.on_settings":
      case "g.on_signup":
      case "g.g_menu": {
        const name = k === "g.on_page" ? a.page : k === "g.on_signin" ? "sign in" : k === "g.on_settings" ? "settings" : k === "g.on_signup" ? "sign up" : "main menu";
        ctx.page = page(name);
        const e = plan.entities.find((x) => x.listPage === ctx.page);
        if (e) {
          ctx.entity = e;
          list(e);
        }
        use("showPage");
        return [`showPage(${str(ctx.page)});`];
      }
      case "g.on_new": {
        const e = entity(a.one);
        ctx.entity = e;
        ctx.page = page(e.newPage);
        use("showPage");
        return [`showPage(${str(ctx.page)});`];
      }
      case "g.exists":
      case "g.exists_field":
      case "g.editing":
      case "g.selected": {
        const e = entity(a.one);
        ctx.entity = e;
        const key = nameKeyOf(e);
        ctx.seeded.add(a.name.toLowerCase());
        list(e);
        const row = k === "g.exists_field" ? `{ ${str(key)}: ${str(a.name)}, ${str(a.label.toLowerCase())}: ${str(a.value)} }` : `{ ${str(key)}: ${str(a.name)} }`;
        if (k === "g.exists_field" && a.label.toLowerCase() !== key && !e.badges.includes(a.label.toLowerCase())) e.badges.push(a.label.toLowerCase());
        if (k === "g.exists_field") seen(a.label, a.value);
        use("addRecord");
        const out = [`addRecord(${str(e.one)}, ${row});`];
        if (k === "g.editing") {
          ctx.page = page(e.detailPage);
          ctx.record = a.name;
          out.push(`open${pascal(e.one)}(${str(a.name)});`);
        }
        if (k === "g.selected") {
          use("selectRecord");
          out.push(`selectRecord(${str(a.name)});`);
        }
        return out;
      }
      case "g.n_exist": {
        const e = entity(singular(a.many), a.many);
        ctx.entity = e;
        list(e);
        use("seedRecords");
        return [`seedRecords(${str(e.one)}, ${str(nameKeyOf(e))}, ${a.n});`];
      }
      case "g.none_exist": {
        const e = entity(singular(a.many), a.many);
        ctx.entity = e;
        list(e);
        use("clearRecords");
        return [`clearRecords(${str(e.one)});`];
      }
      case "g.none_selected":
        return [];
      case "g.user":
        use("addUser");
        return [`addUser(${str(a.email)}, ${str(a.password)});`];
      case "g.failed_n":
        use("setAttempts");
        return [`setAttempts(${a.n});`];
      case "g.message_shown":
        use("showMessage");
        return [`showMessage(${str(a.text)});`];
      case "g.toggle_on": {
        const f = field(ctx.page || "settings", a.label, "checkbox");
        use("setChecked");
        return [`setChecked(${str(f.id)}, true);`];
      }
      case "g.g_counter": {
        const c = counterName(a.counter);
        ctx.counters.set(c, Number(a.n));
        use("setCounter");
        return [`setCounter(${str(c)}, ${a.n});`];
      }
      case "g.g_have": {
        const q = Number(a.qty);
        if (Number.isNaN(q)) return fact(text);
        plan.inventory = true;
        ctx.items.set(a.thing.toLowerCase(), q);
        use("setItem");
        return [`setItem(${str(a.thing.toLowerCase())}, ${q});`];
      }
      case "g.g_playing":
        use("setStatus");
        ctx.page = page(ctx.page || "game");
        return [`setStatus("playing", ${str(a.level)});`, `showPage(${str(ctx.page)});`];
      case "g.c_items":
      case "g.c_item":
      case "g.c_item_prop":
      case "g.c_locked":
      case "g.c_selected": {
        const e = panelEntity(a.items ?? a.item, ctx);
        const names = k === "g.c_items" ? (a.list.match(/"([^"]+)"/g)?.map((x) => x.slice(1, -1)) ?? a.list.split(/,\s*|\s+and\s+/)) : [a.itemName];
        use("addRecord");
        const out = names.map((n) => `addRecord(${str(e.one)}, { name: ${str(n)}${k === "g.c_item_prop" ? `, ${str(a.prop.toLowerCase())}: ${str(a.value)}` : ""} });`);
        for (const n of names) ctx.seeded.add(n.toLowerCase());
        if (k === "g.c_locked" || k === "g.c_selected") out.push(...fact(text));
        return out;
      }
      case "g.g_option": {
        const f = field(ctx.page || "options", a.setting, /^\d+$/.test(a.value) ? "range" : "select", /^\d+$/.test(a.value) ? [] : [a.value]);
        use("setValue");
        return [`setValue(${str(f.id)}, ${str(a.value)});`];
      }
      case "g.c_app":
        ctx.page = page(ctx.page || a.app);
        use("showPage");
        return [`showPage(${str(ctx.page)});`];
      case "g.c_open":
        ctx.page = page(ctx.page || a.doc);
        use("setStatus", "showPage");
        return [`setStatus(${str(a.doc)}, ${str(a.name)});`, `showPage(${str(ctx.page)});`];
      default:
        // Thens describing the start ("the "save" button should be disabled") set it up.
        if (s.match.template.kind === "t") return effects([s], ctx, null);
        return givenFact(text, ctx);
    }
  }

  function givenFact(text: string, ctx: Ctx): string[] {
    if (!ctx.facts.includes(text)) ctx.facts.push(text);
    return fact(text);
  }

  function fact(text: string): string[] {
    plan.facts = true;
    use("setFact");
    return [`setFact(${str(text)});`];
  }

  // ---- Whens and Thens -------------------------------------------------------------------------
  function doPhase(ph: { whens: Step[]; thens: Step[] }, ctx: Ctx, title: string) {
    ctx.inputs = [];
    builtin = false;
    const answering = pendingDialog;
    pendingDialog = null;
    let current: Trigger | null = null;
    let prev: Trigger | null = null;
    let follow: { kind: "ok" | "cancel" | "menu"; item?: string } | null = null;
    for (const w of ph.whens) {
      // The dialog the last phase opened is answered with one of its buttons.
      if (answering?.follow?.kind === "confirm" && !current && w.match?.template.key === "w.click_button") {
        const label = argMap(w).button.toLowerCase();
        const cancel = /^(cancel|no|stay|keep editing|go back)$/.test(label);
        follow = { kind: cancel ? "cancel" : "ok" };
        answering.follow[cancel ? "cancelLabel" : "okLabel"] = label;
        lastDialogTrigger = answering;
        continue;
      }
      // Where the last action leads (learned in the first pass) is where the next one happens.
      if (nextPage) ctx.page = page(nextPage);
      nextPage = "";
      const t = when(w, ctx);
      ctx.started = true;
      if (t && typeof t === "object" && "id" in t && t.on === "click" && hints.has(t.id)) nextPage = hints.get(t.id)!;
      if (!t) {
        // A built-in action (breadcrumb, main menu, sign out) answers the Thens itself.
        if (builtin) current = prev = null;
        continue;
      }
      if (t === "ok" || t === "cancel") {
        follow = { kind: t };
        continue;
      }
      if (typeof t === "object" && "menu" in t) {
        follow = { kind: "menu", item: t.menu };
        continue;
      }
      prev = current;
      current = t;
      follow = null;
    }
    // A phase of inputs only: the last input is the trigger (its change event).
    if (!current && !follow && ctx.inputs.length) current = trigger("change", ctx.inputs[ctx.inputs.length - 1].id);
    if (!current && !prev && follow) {
      // A dialog answered in a later phase belongs to the trigger that opened it.
      current = lastDialogTrigger;
    }
    if (!current) {
      effects(ph.thens, ctx, null);
      if (ph.thens.length && !builtin && !ph.whens.some((w) => w.match?.template.key === "w.tb_hover")) plan.notes.push(`${title}: Then steps with no action before them were left out.`);
      return;
    }
    const rule: Rule = { scenario: title, guards: [], effects: [], start: { facts: [...ctx.facts], counters: new Map(ctx.counters), items: new Map(ctx.items) } };
    const dialog = ph.thens.find((t) => t.match?.template.key === "t_.dialog");
    if (follow && (follow.kind === "ok" || follow.kind === "cancel")) {
      const owner = current;
      if (!owner.follow || owner.follow.kind !== "confirm") owner.follow = { kind: "confirm", text: "Are you sure?", ok: [], cancel: [] };
      const r = { ...rule, effects: crud(owner, ctx, follow.kind === "ok" ? "ok" : "cancel").concat(effects(ph.thens, ctx, owner)) };
      (follow.kind === "ok" ? owner.follow.ok : owner.follow.cancel).push(r);
      lastDialogTrigger = owner;
      return;
    }
    if (follow && follow.kind === "menu") {
      if (!current.follow || current.follow.kind !== "menu") current.follow = { kind: "menu", items: new Map() };
      const items = current.follow.items;
      items.set(follow.item!, [...(items.get(follow.item!) ?? []), { ...rule, effects: effects(ph.thens, ctx, current) }]);
      return;
    }
    if (dialog) {
      // The trigger asks first; the answer comes in the next phase.
      current.follow = current.follow?.kind === "confirm" ? current.follow : { kind: "confirm", text: argMap(dialog).text, ok: [], cancel: [] };
      if (current.follow.kind === "confirm") current.follow.text = argMap(dialog).text;
      lastDialogTrigger = current;
      pendingDialog = current;
      const rest = ph.thens.filter((t) => t !== dialog);
      if (rest.length) current.rules.push({ ...rule, effects: effects(rest, ctx, current) });
      return;
    }
    validation(ph.thens, ctx, current, title);
    const failed = ph.thens.some((t) => t.match && ["t_.field_error", "t_.highlighted", "t_.not_saved"].includes(t.match.template.key));
    const outcome = ph.thens.filter((t) => !(t.match && ["t_.field_error", "t_.highlighted", "t_.not_saved"].includes(t.match.template.key)));
    if (failed) {
      // Everything else in a failing scenario happens inside its check (see validation()).
      return;
    }
    rule.guards = guards(ph.thens, ctx, current);
    rule.effects = [...crud(current, ctx, "click"), ...effects(outcome, ctx, current)];
    // A title made from a typed name needs the name; without it another scenario's title applies.
    for (const e of rule.effects) {
      const m = /^setTitle\(value\("(.+?)"\)/.exec(e);
      if (m) rule.guards.push(`!isEmpty(${str(m[1])})`);
    }
    if (ctx.role && ["viewer", "editor"].includes(ctx.role)) rule.guards.push(`sessionRole() === ${str(ctx.role)}`), use("sessionRole");
    current.rules.push(rule);
    const shows = rule.effects.map((e) => /^showPage\("(.+)"\);$/.exec(e)).filter(Boolean).pop();
    if (shows && !plan.navigation.has(current.id)) plan.navigation.set(current.id, shows[1]);
    if (current.on === "click") {
      const el = plan.elements.find((e) => e.id === current!.target);
      if (el && el.kind === "button" && el.region === "actions") purchase(current, el.label, ctx, rule);
    }
  }

  /** The trigger for a When step, after declaring what it needs. Inputs return null. */
  function when(s: Step, ctx: Ctx): Trigger | "ok" | "cancel" | { menu: string } | null {
    const p = () => ctx.page || page(plan.pages[0] ?? "home");
    if (!s.match) return action(s.text, ctx);
    const k = s.match.template.key;
    const a = argMap(s);
    const input = (label: string, value: string, type: FieldKind = "text", options: string[] = []) => {
      const f = field(p(), label, type, options);
      seen(label, value);
      ctx.inputs.push({ id: f.id, label: label.toLowerCase(), value, empty: value === "" });
      return null;
    };
    switch (k) {
      case "w.fill":
      case "w.change":
      case "w.date":
        return input(a.label, a.value);
      case "w.leave_empty":
      case "w.clear":
        return input(a.label, "");
      case "w.select":
        return input(a.label, a.value, "select", [a.value]);
      case "w.check":
        return input(a.label, "true", "checkbox");
      case "w.uncheck":
      case "w.toggle_off":
        return input(a.label, "false", "checkbox");
      case "w.attach":
        return input(a.label, a.file, "file");
      case "w.type_editor":
        return input("editor", a.text, "editor");
      case "w.select_text":
        return null;
      case "w.link_url":
        return input("link url", a.url);
      case "w.g_slider":
        return input(a.setting, a.value, "range");
      case "w.c_set":
        return input(a.prop, a.value);
      case "w.c_name":
        return input("name", a.name);
      case "w.signin_as": {
        if (ctx.page && !/sign|log/.test(ctx.page) && ctx.role === undefined) plan.signInFirst = true;
        if (!ctx.page) startOn(ctx, "sign in");
        const sp = ctx.page && /sign|log/.test(ctx.page) ? ctx.page : page("sign in");
        ctx.page = sp;
        field(sp, "email", "email");
        field(sp, "password", "password");
        ctx.inputs.push({ id: `${slug(sp)}-email`, label: "email", value: a.email, empty: false }, { id: `${slug(sp)}-password`, label: "password", value: a.password, empty: false });
        return trigger("click", button(sp, "sign in").id);
      }
      case "w.signin_empty": {
        if (!ctx.page) startOn(ctx, "sign in");
        const sp = ctx.page && /sign|log/.test(ctx.page) ? ctx.page : page("sign in");
        ctx.page = sp;
        field(sp, "email", "email");
        field(sp, "password", "password");
        ctx.inputs.push({ id: `${slug(sp)}-email`, label: "email", value: "", empty: true }, { id: `${slug(sp)}-password`, label: "password", value: "", empty: true });
        return trigger("click", button(sp, "sign in").id);
      }
      case "w.click_button":
      case "w.next_page":
      case "w.g_select":
      case "w.g_answer": {
        const label = k === "w.next_page" ? "next" : k === "w.g_select" ? a.item : k === "w.g_answer" ? a.text : a.button;
        if (ctx.entity && ctx.page === ctx.entity.listPage && /^(next|previous)$/i.test(label)) return null;
        const t = trigger("click", button(p(), label).id);
        const opens = /^(new|add|create) (.+)$/i.exec(label);
        const e = opens && plan.entities.find((x) => x.one === opens[2].toLowerCase());
        if (e && !t.does) {
          use("showPage");
          t.does = [`showPage(${str(e.newPage)});`];
        }
        if (e) {
          ctx.entity = e;
          ctx.page = page(e.newPage);
        }
        return t;
      }
      case "w.submit":
        return trigger("click", button(p(), "save").id);
      case "w.tb_click":
      case "w.tb_hover":
        if (k === "w.tb_hover") {
          button(p(), a.button, "toolbar");
          return null;
        }
        return trigger("click", button(p(), a.button, "toolbar").id);
      case "w.tb_menu":
        return trigger("click", button(p(), "more", "toolbar").id);
      case "w.menu_choose":
        return { menu: a.item };
      case "w.confirm":
        return "ok";
      case "w.cancel_dialog":
        return "cancel";
      case "w.click_link":
      case "w.sidebar":
      case "w.breadcrumb": {
        const label = a.link ?? a.item ?? a.text;
        const id = `${slug(p())}-${slug(label)}-link`;
        if (!plan.elements.some((e) => e.id === id) && k === "w.click_link") element({ kind: "link", page: page(p()), id, label: label.toLowerCase(), target: label.toLowerCase() });
        ctx.page = page(label);
        if (k === "w.breadcrumb") {
          builtin = true;
          return null;
        }
        return trigger("enter", ctx.page);
      }
      case "w.c_select":
        return action(s.text, ctx, s);
      case "w.open":
      case "w.select_row": {
        const e = entity(a.one ?? a.item);
        startOn(ctx, e.listPage);
        ctx.entity = e;
        list(e);
        if (k === "w.select_row") return trigger("select", e.one);
        ctx.record = a.name ?? a.itemName;
        ctx.page = page(e.detailPage);
        return trigger("open", e.one);
      }
      case "w.select_all": {
        const e = entity(singular(a.many), a.many);
        list(e);
        return trigger("select", e.one);
      }
      case "w.search":
      case "w.filter":
      case "w.sort":
      case "w.sort_desc":
      case "w.page_n": {
        const e = ctx.entity ?? plan.entities.find((x) => x.listPage === ctx.page);
        if (!e) return action(s.text, ctx);
        list(e);
        if (k === "w.search") e.search = true;
        if (k === "w.filter") {
          e.filter ??= { key: a.label.toLowerCase(), options: [] };
          if (!e.filter.options.includes(a.value)) e.filter.options.push(a.value);
        }
        if ((k === "w.sort" || k === "w.sort_desc") && !e.sorts.includes(a.label.toLowerCase())) e.sorts.push(a.label.toLowerCase());
        return null;
      }
      case "w.go_page":
      case "w.go_url": {
        ctx.page = page(k === "w.go_page" ? a.page : a.url.replace(/^\/+|\/+$/g, "").replace(/\//g, " ") || "home");
        const e = plan.entities.find((x) => x.listPage === ctx.page);
        if (e) list(e);
        return trigger("enter", ctx.page);
      }
      case "w.press":
      case "w.g_press":
        if (/^tab$/i.test(a.key)) return null;
        return trigger("key", a.key.toLowerCase());
      case "w.open_menu":
        builtin = true;
        return null;
      case "w.leave_page":
        return trigger("click", button(p(), "back").id);
      case "w.signout":
        // The user menu signs out by itself.
        builtin = true;
        return null;
      default:
        return action(s.text, ctx, s);
    }
  }

  /** A When with no element of its own becomes a button in the page's actions panel. */
  function action(text: string, ctx: Ctx, s?: Step): Trigger {
    const label = cap(text.replace(/^i\s+/i, ""));
    const b = button(ctx.page || page(plan.pages[0] ?? "home"), label, "actions");
    plan.actions.set(text.toLowerCase(), cap(b.label));
    const t = trigger("click", b.id);
    if (s?.match && !t.does) t.does = panelAction(s, ctx);
    return t;
  }

  /** What a studio item action does to the panel's records. */
  function panelAction(s: Step, ctx: Ctx): string[] | undefined {
    const k = s.match!.template.key;
    const a = argMap(s);
    if (!/^w\.c_(add_item|rename|delete|dup|drag)$/.test(k)) return undefined;
    const e = panelEntity(a.item, ctx);
    const one = str(e.one);
    if (k === "w.c_add_item") return use("addNumbered"), [`addNumbered(${one}, "name");`];
    if (k === "w.c_rename") return use("updateRecord"), [`updateRecord(${one}, "name", ${str(a.itemName)}, { name: ${str(a.newName)} });`];
    if (k === "w.c_delete") return use("removeRecord"), [`removeRecord(${one}, "name", ${str(a.itemName)});`];
    if (k === "w.c_dup") return use("copyRecord"), [`copyRecord(${one}, "name", ${str(a.itemName)});`];
    return use("moveBefore"), [`moveBefore(${one}, "name", ${str(a.itemName)}, ${str(a.other)});`];
  }

  /** Record changes a trigger makes by what it is: Save on a new page adds, on a detail page updates... */
  function crud(t: Trigger, ctx: Ctx, phase: "click" | "ok" | "cancel"): string[] {
    const el = plan.elements.find((x) => x.id === t.target);
    const e = ctx.entity;
    if (!e || phase === "cancel") return [];
    const label = el && el.kind === "button" ? el.label : "";
    const pageName = el ? el.page : ctx.page;
    if (SAVE.test(label) && pageName === e.newPage) {
      use("addRecord", "readForm", "clearForm");
      return [`addRecord(${str(e.one)}, readForm(${str(pageName)}));`, `clearForm(${str(pageName)});`];
    }
    if (SAVE.test(label) && pageName === e.detailPage) {
      use("updateRecord", "readForm", "currentName", "showDetails", "findRecord");
      const key = nameKeyOf(e);
      return [
        `const name = currentName(${str(key)});`,
        `updateRecord(${str(e.one)}, ${str(key)}, name, readForm(${str(pageName)}));`,
        `showDetails(${str(pageName)}, findRecord(${str(e.one)}, ${str(key)}, readForm(${str(pageName)})[${str(key)}] ?? name));`,
      ];
    }
    if (DELETE.test(label) && pageName === e.detailPage && (phase === "ok" || !t.follow)) {
      use("removeRecord", "currentName");
      return [`removeRecord(${str(e.one)}, ${str(nameKeyOf(e))}, currentName(${str(nameKeyOf(e))}));`];
    }
    if (el && el.kind === "button" && el.region === "toolbar" && pageName === e.listPage) {
      if (DELETE.test(label) || /^archive$/i.test(label)) {
        use("removeSelected");
        return [`const count = removeSelected(${str(e.one)}, ${str(nameKeyOf(e))});`];
      }
      if (/^duplicate$/i.test(label)) {
        use("duplicateSelected");
        return [`duplicateSelected(${str(e.one)}, ${str(nameKeyOf(e))});`];
      }
    }
    return [];
  }

  /** Error lines under fields name their own check; each becomes part of the trigger's validation. */
  function validation(thens: Step[], ctx: Ctx, t: Trigger, title: string) {
    const errors = thens.filter((s) => s.match?.template.key === "t_.field_error");
    const others = thens.filter((s) => s.match && !["t_.field_error", "t_.highlighted", "t_.not_saved"].includes(s.match.template.key));
    const highlighted = thens.filter((s) => s.match?.template.key === "t_.highlighted").map((s) => argMap(s).label.toLowerCase());
    // "The ticket should not be saved": no record has the name that was typed.
    const notSaved = thens.find((s) => s.match?.template.key === "t_.not_saved");
    if (notSaved) {
      const e = entity(argMap(notSaved).one);
      const nameField = plan.elements.find((x) => x.kind === "field" && x.page === ctx.page && x.label === nameKeyOf(e));
      use("findRecord", "value");
      plan.checks.set(notSaved.text.toLowerCase(), nameField ? `findRecord(${str(e.one)}, ${str(nameKeyOf(e))}, value(${str(nameField.id)})) === undefined` : "true");
    }
    for (const err of errors) {
      const a = argMap(err);
      const f = field(plan.elements.find((x) => x.id === t.target)?.page ?? ctx.page, a.label);
      const cond = errorCheck(a.text, f.id, a.label, ctx);
      use("setFieldError");
      const extra = highlighted.includes(a.label.toLowerCase()) ? [] : [];
      t.checks.push({ cond, effects: [`setFieldError(${str(f.id)}, ${str(a.text)});`, ...extra, ...effects(others, ctx, t)], scenario: title });
    }
    if (!errors.length && highlighted.length) {
      for (const label of highlighted) {
        const f = field(ctx.page, label);
        const input = ctx.inputs.find((i) => i.id === f.id);
        use("markInvalid", "isEmpty", "value");
        const cond = input && !input.empty ? `value(${str(f.id)}) === ${str(input.value)}` : `isEmpty(${str(f.id)})`;
        t.checks.push({ cond, effects: [`markInvalid(${str(f.id)});`, ...effects(others, ctx, t)], scenario: title });
      }
    }
  }

  function errorCheck(text: string, id: string, label: string, ctx: Ctx): string {
    const input = ctx.inputs.find((i) => i.id === id);
    use("value");
    if (/required|can'?t be (blank|empty)|must not be empty|enter (a|an|your)\b(?!.*valid)/i.test(text)) return use("isEmpty"), `isEmpty(${str(id)})`;
    const kind = /e-?mail/i.test(text) ? "email" : /number/i.test(text) ? "number" : /date/i.test(text) ? "date" : /url|web ?site|link/i.test(text) ? "url" : /phone/i.test(text) ? "tel" : "";
    if (kind && /valid|must be|invalid/i.test(text)) return use("isValid"), `!isValid(${str(kind)}, value(${str(id)}))`;
    const min = /at least (\d+) (characters|letters)/i.exec(text);
    if (min) return `value(${str(id)}).length < ${min[1]}`;
    if (/do(es)? not match|don'?t match|must match/i.test(text)) {
      const other = plan.elements.find((e) => e.kind === "field" && e.page === ctx.page && e.type === "password" && e.id !== id);
      return other ? `value(${str(id)}) !== value(${str(other.id)})` : "false";
    }
    if (/already|taken|in use|registered|exists/i.test(text)) {
      if (/e-?mail/i.test(label)) return use("userExists"), `userExists(value(${str(id)}))`;
      if (ctx.entity) return use("findRecord"), `findRecord(${str(ctx.entity.one)}, ${str(label.toLowerCase())}, value(${str(id)})) !== undefined`;
    }
    if (/incorrect|wrong|does not match our records/i.test(text) && /password/i.test(label) && [...plan.givens.keys()].some((g) => /^a user ".+" exists with password/.test(g)))
      return use("passwordKnown"), `!passwordKnown(value(${str(id)}))`;
    // No rule in the text: the value the scenario typed is the bad one.
    return input ? `value(${str(id)}) === ${str(input.value)}` : `isEmpty(${str(id)})`;
  }

  /** Guards a rule needs besides validation: known credentials for a sign-in, a lockout. */
  function guards(thens: Step[], ctx: Ctx, t: Trigger): string[] {
    const out: string[] = [];
    const keys = thens.map((s) => s.match?.template.key);
    const email = ctx.inputs.find((i) => i.label === "email");
    const password = ctx.inputs.find((i) => i.label === "password");
    const target = plan.elements.find((e) => e.id === t.target);
    if (email && password && !email.empty && target?.kind === "button" && /^(sign|log) ?in$/.test(target.label)) {
      const users = [...plan.givens.keys()].map((g) => /^a user "(.+)" exists with password "(.+)"$/.exec(g)).filter(Boolean) as RegExpExecArray[];
      const known = users.some((u) => u[1] === email.value.toLowerCase() && u[2] === password.value.toLowerCase());
      if (keys.includes("t_.signed_in") || known) out.push(`checkUser(value(${str(email.id)}), value(${str(password.id)}))`);
      else if (users.length) out.push(`!checkUser(value(${str(email.id)}), value(${str(password.id)}))`);
      use("checkUser", "value");
    }
    const locked = email && thens.find((s) => s.match && /\b(account is locked|locked out|locked for)\b/i.test(argMap(s).text ?? ""));
    if (locked) {
      const n = [...plan.givens.entries()].find(([k]) => /wrong password (\d+) times/.test(k));
      const times = n ? /(\d+)/.exec(n[0])![1] : "3";
      out.push(`attempts() >= ${times}`);
      use("attempts");
    }
    void t;
    return out;
  }

  /** "Buy X for N gold" and "Craft X" with a "You need N Y" message get the real rule, not the example. */
  function purchase(t: Trigger, label: string, ctx: Ctx, rule: Rule) {
    const buy = /^buy (?:an? |the )?(.+?) for (\d+) (.+)$/i.exec(label);
    const need = rule.effects.map((e) => /showMessage\("you need (\d+) (.+?)"\)/i.exec(e)).find(Boolean);
    const craft = /^craft (?:an? |the )?(.+)$/i.exec(label);
    if (buy) {
      const [, thing, cost, currency] = buy;
      plan.inventory = true;
      // Money is a counter ("my gold is 96") or something carried ("I have 218 coins").
      const carried = ctx.items.has(currency.toLowerCase()) && !ctx.counters.has(currency.toLowerCase());
      const cur = carried ? currency.toLowerCase() : counterName(currency);
      const have = carried ? `itemCount(${str(cur)})` : `counter(${str(cur)})`;
      const spend = carried ? `addItem(${str(cur)}, -${cost});` : `addToCounter(${str(cur)}, -${cost});`;
      const failMsg = rule.effects.find((e) => e.startsWith("showMessage(") && !/bought|purchased/i.test(e));
      const ok = !rule.effects.some((e) => /^showMessage/.test(e)) || rule.effects.some((e) => /addItem|addToCounter/.test(e));
      t.rules = [];
      t.checks.push({ cond: `${have} < ${cost}`, effects: [ok || !failMsg ? `showMessage(${str(`You need more ${currency}`)});` : failMsg], scenario: rule.scenario });
      t.rules.push({ scenario: "otherwise the purchase goes through", guards: [], effects: [spend, `addItem(${str(thing.toLowerCase())}, 1);`, ...rule.effects.filter((e) => !/addToCounter|addItem|showMessage\("you need/i.test(e))] });
      return;
    }
    if (craft && need) {
      const [, n, mat] = need;
      plan.inventory = true;
      use("itemCount", "addItem");
      t.rules = t.rules.filter((r) => r !== rule);
      t.checks.push({ cond: `itemCount(${str(mat.toLowerCase())}) < ${n}`, effects: rule.effects, scenario: rule.scenario });
      t.rules.push({ scenario: "otherwise it is crafted", guards: [], effects: [`addItem(${str(mat.toLowerCase())}, -${n});`, `addItem(${str(craft[1].toLowerCase())}, 1);`] });
    }
  }

  /** What a handler does for each Then line. */
  function effects(thens: Step[], ctx: Ctx, t: Trigger | null): string[] {
    const out: string[] = [];
    const typed = (v: string) => ctx.inputs.find((i) => i.value.toLowerCase() === v.toLowerCase());
    for (const s of thens) {
      const text = s.text.toLowerCase();
      if (!s.match) {
        out.push(...fact(text));
        continue;
      }
      const k = s.match.template.key;
      const a = argMap(s);
      const here = ctx.page || page(plan.pages[0] ?? "home");
      switch (k) {
        case "t_.message":
        case "t_.see":
        case "t_.g_popup":
        case "t_.denied": {
          const msg = k === "t_.denied" ? "You do not have permission to do that" : a.text;
          if (k === "t_.see" && typed(msg) && ctx.entity) break; // a saved value: showDetails puts it on the page
          use("showMessage");
          const count = /^(\d+) /.exec(msg);
          if (count && out.some((o) => o.startsWith("const count"))) out.push(`showMessage(\`\${count}${msg.slice(count[1].length).replace(/[`$\\]/g, "\\$&")}\`);`);
          else out.push(`showMessage(${str(msg)});`);
          break;
        }
        case "t_.not_see":
        case "t_.message_gone":
          use("forgetText");
          out.push(`forgetText(${str(a.text)});`);
          break;
        case "t_.signed_in": {
          use("signIn", "value");
          const email = ctx.inputs.find((i) => i.label === "email");
          out.push(email ? `signIn(value(${str(email.id)}));` : `signIn(${str(a.email)});`);
          break;
        }
        case "t_.signed_out":
          use("signOut");
          out.push("signOut();");
          break;
        case "t_.on_page":
        case "t_.g_screen": {
          const name = k === "t_.g_screen" ? `${a.screen} screen` : a.page;
          ctx.page = page(name);
          const e = plan.entities.find((x) => x.listPage === ctx.page);
          if (e) list(e);
          use("showPage");
          out.push(`showPage(${str(ctx.page)});`);
          break;
        }
        case "t_.on_one":
        case "t_.heading": {
          use("setHeading", "showPage");
          if (k === "t_.on_one") {
            const e = entity(a.one);
            ctx.page = page(e.detailPage);
            out.push(`showPage(${str(ctx.page)});`, `setHeading(${str(ctx.page)}, ${str(a.name)});`);
          } else out.push(`setHeading(${str(here)}, ${str(a.text)});`);
          break;
        }
        case "t_.btn_disabled":
        case "t_.btn_enabled":
        case "t_.tb_disabled":
        case "t_.tb_enabled": {
          const b = button(here, a.button, k.startsWith("t_.tb") ? "toolbar" : "");
          use("setEnabled");
          const on = k.endsWith("enabled");
          if (t?.on === "select") use("selectedCount"), out.push(`setEnabled(${str(b.id)}, selectedCount() > 0);`);
          else if (t?.on === "change" && on) {
            use("isEmpty");
            out.push(`setEnabled(${str(b.id)}, !isEmpty(${str(t.target)}));`);
          } else out.push(`setEnabled(${str(b.id)}, ${on});`);
          break;
        }
        case "t_.btn_hidden":
        case "t_.btn_visible":
        case "t_.signed_out_btn": {
          const b = button(here, a.button);
          use("setShown");
          out.push(`setShown(${str(b.id)}, ${k === "t_.btn_visible"});`);
          break;
        }
        case "t_.field_value":
        case "t_.field_empty":
        case "t_.g_option": {
          const label = k === "t_.g_option" ? a.setting : a.label;
          const value = k === "t_.field_empty" ? "" : a.value;
          const f = field(here, label, k === "t_.g_option" ? (/^\d+$/.test(value) ? "range" : "select") : "text", k === "t_.g_option" && !/^\d+$/.test(value) ? [value] : []);
          use("setValue");
          out.push(`setValue(${str(f.id)}, ${str(k === "t_.field_empty" ? "" : a.value)});`);
          break;
        }
        case "t_.focus": {
          const f = field(here, a.label);
          use("focusField");
          out.push(`focusField(${str(f.id)});`);
          break;
        }
        case "t_.in_list": {
          const e = entity(a.one);
          ctx.entity = e;
          list(e);
          if (here !== e.listPage) use("showPage"), out.push(`showPage(${str(e.listPage)});`), (ctx.page = e.listPage);
          const known = ctx.seeded.has(a.name.toLowerCase()) || typed(a.name);
          if (!known && !out.some((o) => o.startsWith("duplicateSelected"))) {
            use("addRecord");
            out.push(`addRecord(${str(e.one)}, { ${str(nameKeyOf(e))}: ${str(a.name)} });`);
          }
          break;
        }
        case "t_.not_in_list": {
          const e = entity(a.one);
          list(e);
          if (here !== e.listPage) use("showPage"), out.push(`showPage(${str(e.listPage)});`), (ctx.page = e.listPage);
          if (ctx.seeded.has(a.name.toLowerCase()) && !out.some((o) => /removeRecord|removeSelected/.test(o)) && t && !(t.follow && t.follow.kind === "confirm")) {
            use("removeRecord");
            out.push(`removeRecord(${str(e.one)}, ${str(nameKeyOf(e))}, ${str(a.name)});`);
          }
          break;
        }
        case "t_.c_item":
        case "t_.c_copy": {
          const e = panelEntity(a.item, ctx);
          const name = k === "t_.c_copy" ? `${a.itemName} copy` : a.itemName;
          const made = [...(t?.does ?? []), ...out].some((o) => /addNumbered|copyRecord|updateRecord/.test(o));
          if (!made && !ctx.seeded.has(name.toLowerCase())) use("addRecord"), out.push(`addRecord(${str(e.one)}, { name: ${str(name)} });`);
          break;
        }
        case "t_.c_no_item": {
          const e = panelEntity(a.item, ctx);
          if (![...(t?.does ?? []), ...out].some((o) => /removeRecord|updateRecord/.test(o))) use("removeRecord"), out.push(`removeRecord(${str(e.one)}, "name", ${str(a.itemName)});`);
          break;
        }
        case "t_.c_items": {
          const e = panelEntity(a.items, ctx);
          use("recordCount");
          plan.checks.set(text, `recordCount(${str(e.one)}) === ${a.n}`);
          break;
        }
        case "t_.status_badge": {
          const e = entity(a.one);
          use("updateRecord");
          const f = plan.elements.find((x) => x.kind === "field" && x.page === here && x.type === "select");
          const key = f && f.kind === "field" ? f.label : "status";
          if (!e.badges.includes(key)) e.badges.push(key);
          out.push(`updateRecord(${str(e.one)}, ${str(nameKeyOf(e))}, ${str(a.name)}, { ${str(key)}: ${str(a.value)} });`);
          list(e);
          if (here !== e.listPage) use("showPage"), out.push(`showPage(${str(e.listPage)});`), (ctx.page = e.listPage);
          break;
        }
        case "t_.dialog_closed":
          use("closeDialog");
          out.push("closeDialog();");
          break;
        case "t_.downloaded":
        case "t_.c_exported":
          use("download", "recordsCsv", "downloaded");
          out.push(`download(${str(a.file)}, recordsCsv(${str(ctx.entity?.one ?? "")}));`);
          plan.checks.set(text, `downloaded(${str(a.file)})`);
          break;
        case "t_.bold":
        case "t_.italic":
        case "t_.underlined":
          use("formatText");
          out.push(`formatText(${str(k === "t_.bold" ? "bold" : k === "t_.italic" ? "italic" : "underline")});`);
          break;
        case "t_.linked":
          use("formatText");
          out.push(`formatText("createLink", ${str(a.url)});`);
          break;
        case "t_.tooltip": {
          const tb = t && plan.elements.find((x) => x.id === t.target);
          const hovered = plan.elements.filter((x) => x.kind === "button" && x.region === "toolbar" && x.page === here).pop();
          const target = tb ?? hovered;
          if (target) use("setTooltip"), plan.setup.push(`setTooltip(${str(target.id)}, ${str(a.text)});`);
          break;
        }
        case "t_.in_menu": {
          use("showMenu");
          const more = button(here, "more", "toolbar");
          out.push(`showMenu(${str(more.id)}, [${str(a.item)}]);`);
          break;
        }
        case "t_.not_in_toolbar": {
          const b = button(here, a.item, "toolbar");
          use("setShown");
          out.push(`setShown(${str(b.id)}, false);`);
          break;
        }
        case "t_.toggle_off": {
          const f = field(here, a.label, "checkbox");
          use("setChecked");
          out.push(`setChecked(${str(f.id)}, false);`);
          break;
        }
        case "t_.dark":
          use("setTheme");
          out.push(`setTheme("dark");`);
          break;
        case "t_.email_sent": {
          use("sendEmail");
          const email = ctx.inputs.find((i) => i.label === "email");
          out.push(email ? `sendEmail(value(${str(email.id)}));` : `sendEmail(${str(a.email)});`);
          plan.checks.set(text, `sentTo(${str(a.email)})`);
          break;
        }
        case "t_.c_title": {
          use("setTitle");
          const typedName = typed(a.name);
          if (typedName) use("value", "isEmpty"), out.push(`setTitle(value(${str(typedName.id)}) + ${str(` - ${a.app}`)});`);
          else out.push(`setTitle(${str(`${a.name} - ${a.app}`)});`);
          break;
        }
        case "t_.g_counter": {
          const c = counterName(a.counter);
          const before = ctx.counters.get(c);
          use(before === undefined ? "setCounter" : "addToCounter");
          out.push(before === undefined ? `setCounter(${str(c)}, ${a.n});` : `addToCounter(${str(c)}, ${Number(a.n) - before});`);
          ctx.counters.set(c, Number(a.n));
          plan.checks.set(text, `counter(${str(c)}) === ${a.n}`);
          use("counter");
          break;
        }
        case "t_.g_have": {
          const q = Number(a.qty);
          if (Number.isNaN(q)) {
            out.push(...fact(text));
            break;
          }
          plan.inventory = true;
          const thing = a.thing.toLowerCase();
          const before = ctx.items.get(thing) ?? 0;
          use("addItem", "itemCount");
          if (q !== before) out.push(`addItem(${str(thing)}, ${q - before});`);
          ctx.items.set(thing, q);
          plan.checks.set(text, `itemCount(${str(thing)}) === ${q}`);
          break;
        }
        case "t_.g_not_inv": {
          const thing = a.thing.toLowerCase();
          plan.inventory = true;
          use("itemCount");
          const had = ctx.items.get(thing) ?? 0;
          if (had > 0 && t) out.push(`addItem(${str(thing)}, -${had});`), ctx.items.set(thing, 0);
          plan.checks.set(text, `itemCount(${str(thing)}) === 0`);
          break;
        }
        case "t_.g_at":
          use("setStatus", "hasStatus");
          out.push(`setStatus("playing", ${str(a.level)});`);
          plan.checks.set(text, `hasStatus("playing", ${str(a.level)})`);
          break;
        case "t_.g_quest":
          use("setStatus", "hasStatus");
          out.push(`setStatus(${str(`quest ${a.quest}`)}, ${str(a.state)});`);
          plan.checks.set(text, `hasStatus(${str(`quest ${a.quest}`)}, ${str(a.state)})`);
          break;
        case "t_.breadcrumb":
          use("setBreadcrumb");
          if (!plan.setup.some((l) => l.startsWith(`setBreadcrumb(${str(here)}`))) plan.setup.push(`setBreadcrumb(${str(here)}, [${[...new Set([plan.pages[0], here])].map(str).join(", ")}]);`);
          break;
        case "t_.no_errors":
        case "t_.not_saved":
        case "t_.field_error":
        case "t_.highlighted":
        case "t_.dialog":
        case "t_.n_in_list":
        case "t_.first_in_list":
        case "t_.all_have":
        case "t_.empty_state":
        case "t_.no_results":
        case "t_.page_of":
        case "t_.file_listed":
        case "t_.sidebar_active":
          // Shown by the list, the form or the navigation as they are drawn.
          break;
        default:
          out.push(...fact(text));
          use("hasFact");
          plan.checks.set(text, `hasFact(${str(text)})`);
      }
    }
    return out;
  }

  // Lists that a page with records needs, and page size from a paging scenario.
  for (const e of plan.entities) if (!e.nameKey) e.nameKey = "name";
  for (const s of all) {
    if (s.match?.template.key !== "t_.page_of") continue;
    const sc = feature.scenarios.find((x) => x.steps.includes(s));
    const n = sc?.steps.map((x) => (x.match?.template.key === "g.n_exist" ? Number(x.match.args[0]) : 0)).find((x) => x > 0);
    const shown = sc?.steps.find((x) => x.match?.template.key === "t_.n_in_list");
    const pages = Number(s.match.args[1]);
    if (n && shown) {
      const k = Number(shown.match!.args[0]);
      const size = pages === 2 ? n - k : k;
      if (size > 0) use("setListPage"), plan.setup.push(`setListPage(1, ${size});`);
    }
  }
  if (!plan.pages.length) page("home");
  for (const t of plan.triggers) disambiguate(t);
  return plan;

  /**
   * Rules of one trigger with different outcomes and nothing yet to choose between them: a rule whose
   * scenario has too little of a counter or item that another rule spends gets that check
   * ("Not enough mana": mana 2, playing costs 3); otherwise a fact only its scenario starts with.
   */
  function disambiguate(t: Trigger) {
    const plain = t.rules.filter((r) => !r.guards.length);
    const differs = (r: Rule) => plain.some((o) => o !== r && o.effects.join("\n") !== r.effects.join("\n"));
    if (plain.length < 2 || !plain.some(differs)) return;
    const spends: { kind: "counter" | "item"; name: string; cost: number }[] = [];
    for (const r of plain) {
      for (const e of r.effects) {
        const m = /^(addToCounter|addItem)\("(.+?)", -(\d+)\);$/.exec(e);
        if (m) spends.push({ kind: m[1] === "addToCounter" ? "counter" : "item", name: m[2], cost: Number(m[3]) });
      }
    }
    for (const r of plain) {
      if (!r.start || r.effects.some((e) => spends.some((x) => e.startsWith(`${x.kind === "counter" ? "addToCounter" : "addItem"}(${str(x.name)}, -`)))) continue;
      const short = spends.find((x) => {
        const have = (x.kind === "counter" ? r.start!.counters : r.start!.items).get(x.name);
        return have !== undefined && have < x.cost;
      });
      if (short) {
        use(short.kind === "counter" ? "counter" : "itemCount");
        t.rules = t.rules.filter((x) => x !== r);
        const effects = r.effects.filter((e) => !/^(addToCounter|addItem)\(".+?", 0\);$/.test(e));
        if (short.kind === "counter") use("hasCounter");
        const cond = short.kind === "counter" ? `hasCounter(${str(short.name)}) && counter(${str(short.name)}) < ${short.cost}` : `itemCount(${str(short.name)}) < ${short.cost}`;
        t.checks.push({ cond, effects, scenario: r.scenario });
      }
    }
    const left = t.rules.filter((r) => !r.guards.length);
    if (left.length < 2) return;
    for (const r of left) {
      const own = (r.start?.facts ?? []).filter((f) => !left.every((o) => o.start?.facts.includes(f)));
      if (own.length && differs(r)) {
        use("hasFact");
        r.guards = own.map((f) => `hasFact(${str(f)})`);
      }
    }
  }
}

/** Template slot values by parameter name. */
export function argMap(s: Step): Record<string, string> {
  const out: Record<string, string> = {};
  if (!s.match) return out;
  s.match.template.params.forEach((p, i) => (out[p.name] = String(s.match!.args[i])));
  return out;
}

function singular(many: string): string {
  const m = many.toLowerCase();
  if (/ies$/.test(m)) return m.slice(0, -3) + "y";
  if (/(ses|xes|ches|shes)$/.test(m)) return m.slice(0, -2);
  if (/s$/.test(m) && !/ss$/.test(m)) return m.slice(0, -1);
  return m;
}

export function pascal(s: string): string {
  return s
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

export { normalizeStep, STEP_TEMPLATES };
