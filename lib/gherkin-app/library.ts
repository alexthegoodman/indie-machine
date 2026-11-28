// The boilerplate a compiled Gherkin app is built from (see plan.ts and emit.ts). Each top-level
// function does one job on the page, found by id. scripts/build-gherkin-library.mjs splits this file
// into its declarations (TypeScript and transpiled JavaScript, with the names each one uses), and an
// app copies in only the declarations its steps need. Keep every declaration top-level and
// self-contained apart from calls to its neighbours here; no imports.

type Row = Record<string, string>;
type FieldKind = "text" | "textarea" | "email" | "password" | "select" | "checkbox" | "file" | "range" | "editor";
type ListOptions = { badges: string[]; search: boolean; filter?: { key: string; options: string[] }; sorts: string[] };

/** Everything the app remembers. Reset by resetState() before a starting state is loaded. */
const state = {
  records: {} as Record<string, Row[]>,
  selected: new Set<string>(),
  current: null as Row | null,
  users: [] as { email: string; password: string }[],
  session: "" as string,
  attempts: 0,
  counters: {} as Record<string, number>,
  inventory: {} as Record<string, number>,
  status: {} as Record<string, string>,
  facts: [] as string[],
  sent: [] as string[],
  query: "",
  filter: null as null | { key: string; value: string },
  sort: null as null | { key: string; desc: boolean },
  page: 1,
  pageSize: 10,
  /** Every page's section; only the one on screen is in the document. */
  pages: new Map<string, HTMLElement>(),
  /** File names offered for download. */
  downloads: [] as string[],
  /** The page asked for before signing in. */
  wanted: "",
  /** The last text selection inside an editor, kept while toolbar fields take focus. */
  range: null as Range | null,
  /** Called after every action, to redraw lists and panels. */
  refresh: () => {},
};

export function slug(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "home";
}

export function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** The element with this id, on screen or on a page that is not. */
function find(id: string): HTMLElement | null {
  const node = document.getElementById(id);
  if (node) return node;
  for (const section of state.pages.values()) {
    if (section.id === id) return section;
    const inner = section.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (inner) return inner;
  }
  return null;
}

/** The element with this id; throws so a missing piece shows up at once. */
export function el(id: string): HTMLElement {
  const node = find(id);
  if (!node) throw new Error(`no element #${id}`);
  return node;
}

function make<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text) node.textContent = text;
  return node;
}

const STYLE = `
:root { color-scheme: light; --bg: #f6f5f2; --panel: #fff; --ink: #1d1d1f; --muted: #6b6b70; --line: #dedcd6; --accent: #2f6fde; --bad: #c4302b; }
:root[data-theme="dark"] { color-scheme: dark; --bg: #16171a; --panel: #1f2125; --ink: #ececec; --muted: #9a9aa2; --line: #34363c; --accent: #6d9cff; --bad: #ff6b63; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 system-ui, sans-serif; }
header.app-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 10px 16px; background: var(--panel); border-bottom: 1px solid var(--line); }
header.app-bar strong { font-size: 16px; margin-right: auto; }
.layout { display: flex; min-height: 60vh; }
nav.side { width: 190px; flex: none; padding: 12px; border-right: 1px solid var(--line); background: var(--panel); }
nav.side a { display: block; padding: 6px 10px; border-radius: 6px; color: var(--ink); text-decoration: none; }
nav.side a[aria-current="page"] { background: var(--accent); color: #fff; }
main { flex: 1; min-width: 0; padding: 20px; max-width: 860px; }
section.page { display: none; } section.page.shown { display: block; }
h1 { font-size: 22px; margin: 0 0 14px; }
.field { display: flex; flex-direction: column; gap: 4px; margin: 0 0 12px; max-width: 420px; }
.field.check { flex-direction: row; align-items: center; gap: 8px; }
input, select, textarea, .editor { font: inherit; padding: 7px 9px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--ink); }
.editor { min-height: 90px; }
[aria-invalid="true"] { border-color: var(--bad); outline: 1px solid var(--bad); }
.error { color: var(--bad); font-size: 13px; margin: 0; }
.error:empty { display: none; }
button { font: inherit; padding: 7px 14px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--ink); cursor: pointer; }
button:hover:not(:disabled) { border-color: var(--accent); }
button:disabled { opacity: .45; cursor: default; }
.buttons, [role="toolbar"], .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 14px; }
.actions { padding: 10px; border: 1px dashed var(--line); border-radius: 8px; }
.actions::before { content: "Actions"; width: 100%; font-size: 12px; color: var(--muted); }
#messages p { margin: 0 0 8px; padding: 8px 12px; border-radius: 6px; background: var(--panel); border-left: 3px solid var(--accent); }
#messages button { margin-left: 10px; padding: 0 6px; }
ul.records { list-style: none; padding: 0; margin: 0 0 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
ul.records:empty { display: none; }
ul.records li { display: flex; gap: 10px; align-items: center; padding: 8px 12px; border-top: 1px solid var(--line); }
ul.records li:first-child { border-top: 0; }
ul.records li button.open { border: 0; padding: 0; background: none; color: var(--accent); }
.badge { font-size: 12px; padding: 1px 8px; border-radius: 99px; background: var(--bg); color: var(--muted); }
.muted { color: var(--muted); }
.hud { display: flex; gap: 14px; font-variant-numeric: tabular-nums; }
.panel { margin: 0 0 14px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
.panel h2 { margin: 0 0 6px; font-size: 13px; color: var(--muted); font-weight: 600; }
.panel ul { margin: 0; padding-left: 18px; }
dl.panel { display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; } dl.panel dd { margin: 0; }
dialog { border: 1px solid var(--line); border-radius: 10px; background: var(--panel); color: var(--ink); padding: 18px; }
[role="tooltip"] { position: fixed; padding: 4px 8px; border-radius: 4px; background: var(--ink); color: var(--bg); font-size: 12px; }
[role="menu"] { display: flex; flex-direction: column; gap: 4px; width: max-content; }
@media (max-width: 640px) { nav.side { display: none; } nav.side.open { display: block; position: absolute; z-index: 2; top: 52px; bottom: 0; } }
`;

/**
 * Builds the shell: app bar, side navigation (when there is more than one page), one section per
 * page (id "page-<slug>"), the message area and the dialog. Pages are shown by hash ("#/<slug>").
 */
export function mountApp(title: string, pages: string[]): void {
  document.title = cap(title);
  document.head.append(make("style", {}, STYLE));
  const bar = make("header", { class: "app-bar" });
  bar.append(make("strong", {}, cap(title)));
  if (pages.length > 1) {
    const menu = make("button", { type: "button", id: "menu-button", "aria-label": "Open the main menu", "aria-controls": "nav" }, "Menu");
    menu.addEventListener("click", () => el("nav").classList.toggle("open"));
    bar.append(menu);
  }
  bar.append(make("div", { id: "hud", class: "hud" }));
  bar.append(make("div", { id: "account" }));
  document.body.append(bar);
  const layout = make("div", { class: "layout" });
  const nav = make("nav", { class: "side", id: "nav", "aria-label": "Main" });
  const main = make("main", { id: "main" });
  main.append(make("div", { id: "messages", role: "status" }));
  for (const p of pages) {
    const section = make("section", { class: "page", id: `page-${slug(p)}`, "aria-labelledby": `page-${slug(p)}-title` });
    section.append(make("h1", { id: `page-${slug(p)}-title` }, cap(p)));
    state.pages.set(section.id, section);
    nav.append(make("a", { href: `#/${slug(p)}`, id: `nav-${slug(p)}` }, cap(p)));
  }
  if (pages.length > 1) layout.append(nav);
  layout.append(main);
  document.body.append(layout);
  const dialog = make("dialog", { id: "dialog" });
  dialog.append(make("p", { id: "dialog-text" }));
  const row = make("div", { class: "buttons" });
  row.append(make("button", { id: "dialog-ok", type: "button" }, "OK"), make("button", { id: "dialog-cancel", type: "button" }, "Cancel"));
  dialog.append(row);
  document.body.append(dialog);
  document.addEventListener("selectionchange", () => {
    const sel = getSelection();
    if (sel && sel.rangeCount && sel.anchorNode?.parentElement?.closest("[contenteditable]")) state.range = sel.getRangeAt(0).cloneRange();
  });
  window.addEventListener("hashchange", () => {
    showPage(location.hash.replace(/^#\/?/, "") || pages[0]);
    el("nav").classList.remove("open");
  });
}

/**
 * Shows one page. The others leave the document (they stay in state.pages), so a label or a
 * button name only has to be unique on its own page. Unknown names get a page of their own.
 */
export function showPage(name: string): void {
  const id = `page-${slug(name)}`;
  let section = state.pages.get(id);
  if (!section) {
    section = make("section", { class: "page", id });
    section.append(make("h1", { id: `${id}-title` }, cap(name.replace(/-/g, " "))));
    state.pages.set(id, section);
  }
  for (const s of Array.from(document.querySelectorAll("section.page"))) if (s !== section) s.remove();
  section.classList.add("shown");
  if (!section.isConnected) el("main").append(section);
  for (const a of Array.from(document.querySelectorAll("nav.side a"))) {
    if (a.id === `nav-${slug(name)}`) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  try {
    if (location.hash !== `#/${slug(name)}`) history.replaceState(null, "", `#/${slug(name)}`);
  } catch {
    // An opaque-origin preview may refuse; the page is shown either way.
  }
}

/** A breadcrumb above a page's heading: links to each page in `trail`, then the last item as text. */
export function setBreadcrumb(page: string, trail: string[]): void {
  const id = `page-${slug(page)}-crumbs`;
  find(id)?.remove();
  const nav = make("nav", { id, "aria-label": "Breadcrumb", class: "muted" });
  trail.forEach((t, i) => {
    if (i) nav.append(" / ");
    nav.append(i < trail.length - 1 ? make("a", { href: `#/${slug(t)}` }, cap(t)) : make("span", {}, cap(t)));
  });
  el(`page-${slug(page)}-title`).before(nav);
}

/** Signed out, pages other than `open` show `signInPage`; signing in then returns to the page asked for. */
export function requireSignIn(signInPage: string, open: string[]): void {
  window.addEventListener("hashchange", () => {
    const want = location.hash.replace(/^#\/?/, "");
    if (state.session || open.some((p) => slug(p) === want)) return;
    state.wanted = want;
    showPage(signInPage);
  });
}

export function setHeading(page: string, text: string): void {
  el(`page-${slug(page)}-title`).textContent = cap(text);
}

/** A labelled input (or select, textarea, checkbox, range, rich text editor) on a page. */
export function addField(page: string, id: string, label: string, kind: FieldKind, options: string[] = []): void {
  const wrap = make("div", { class: kind === "checkbox" ? "field check" : "field" });
  const lab = make("label", { for: id, id: `${id}-label` }, cap(label));
  let input: HTMLElement;
  if (kind === "select") {
    input = make("select", { id });
    input.append(make("option", { value: "" }, "Choose..."));
    // Option text as the Gherkin wrote it, so a test can pick it by label.
    for (const o of options) input.append(make("option", { value: o }, o));
  } else if (kind === "textarea") {
    input = make("textarea", { id, rows: "3" });
  } else if (kind === "editor") {
    input = make("div", { id, contenteditable: "true", role: "textbox", "aria-multiline": "true", "aria-labelledby": `${id}-label`, class: "editor" });
  } else if (kind === "range") {
    input = make("input", { id, type: "range", min: "0", max: "100" });
  } else {
    input = make("input", { id, type: kind });
  }
  if (kind === "checkbox") wrap.append(input, lab);
  else wrap.append(lab, input);
  wrap.append(make("p", { id: `${id}-error`, class: "error" }));
  el(`page-${slug(page)}`).append(wrap);
}

/** A button on a page, in its toolbar or its actions panel when `region` says so. */
export function addButton(page: string, id: string, label: string, region: "" | "toolbar" | "actions" = ""): void {
  const host = `page-${slug(page)}`;
  let box = find(`${host}-${region || "buttons"}`);
  if (!box) {
    box = make("div", region === "toolbar" ? { id: `${host}-toolbar`, role: "toolbar", "aria-label": "Toolbar" } : { id: `${host}-${region || "buttons"}`, class: region || "buttons" });
    el(host).append(box);
  }
  const b = make("button", { id, type: "button" }, cap(label));
  // Formatting buttons keep the editor's selection.
  b.addEventListener("mousedown", (e) => e.preventDefault());
  box.append(b);
}

/** A link that shows another page. */
export function addLink(page: string, id: string, label: string, target: string): void {
  const p = make("p");
  p.append(make("a", { id, href: `#/${slug(target)}` }, cap(label)));
  el(`page-${slug(page)}`).append(p);
}

/** A panel with a title and a list, for inventory and other state ("<id>-items"). */
export function addPanel(page: string, id: string, title: string): void {
  const panel = make("div", { class: "panel", id, role: "region", "aria-label": cap(title) });
  panel.append(make("h2", {}, cap(title)), make("ul", { id: `${id}-items` }));
  el(page ? `page-${slug(page)}` : "main").append(panel);
}

/** Runs `handler` when the element is clicked, after clearing the last messages and errors. */
export function on(id: string, handler: () => void): void {
  el(id).addEventListener("click", () => {
    clearMessages();
    handler();
    state.refresh();
  });
}

/** Runs `handler` when a field changes (typing, picking, ticking). */
export function onChange(id: string, handler: () => void): void {
  const run = () => {
    handler();
    state.refresh();
  };
  el(id).addEventListener("input", run);
  el(id).addEventListener("change", run);
}

/** Runs `handler` each time a page is shown by its link or address. */
export function onPage(name: string, handler: () => void): void {
  window.addEventListener("hashchange", () => {
    if (location.hash.replace(/^#\/?/, "") === slug(name)) {
      clearMessages();
      handler();
      state.refresh();
    }
  });
}

/** One spelling per key: "Down arrow" and "ArrowDown" -> "arrowdown", "Esc" -> "escape", " " -> "space". */
function keyName(k: string): string {
  if (k === " ") return "space";
  const n = k.trim().toLowerCase();
  const arrow = /^(up|down|left|right) arrow$/.exec(n);
  if (arrow) return `arrow${arrow[1]}`;
  return ({ " ": "space", spacebar: "space", esc: "escape", return: "enter", ctrl: "control", cmd: "control", meta: "control", del: "delete" } as Record<string, string>)[n] ?? n;
}

/** Runs `handler` for a key or shortcut ("Escape", "ctrl+s", "down arrow"; Ctrl also matches Cmd). */
export function onKey(key: string, handler: () => void): void {
  const want = key.split("+").map(keyName);
  document.addEventListener("keydown", (e) => {
    const k = keyName(e.key);
    const mods = want.slice(0, -1);
    if (k !== want[want.length - 1]) return;
    if (mods.includes("control") !== (e.ctrlKey || e.metaKey) || mods.includes("shift") !== e.shiftKey || mods.includes("alt") !== e.altKey) return;
    e.preventDefault();
    clearMessages();
    handler();
    state.refresh();
  });
}

export function value(id: string): string {
  const node = el(id) as HTMLInputElement;
  if (node.isContentEditable) return node.textContent ?? "";
  return node.type === "checkbox" ? String(node.checked) : node.value;
}

export function setValue(id: string, v: string): void {
  const node = el(id) as HTMLInputElement;
  if (node.isContentEditable) node.textContent = v;
  else if (node.type === "checkbox") node.checked = v === "true";
  else node.value = v;
}

export function setChecked(id: string, on: boolean): void {
  (el(id) as HTMLInputElement).checked = on;
}

function labelOf(input: HTMLElement): string {
  return input.closest(".field")?.querySelector("label")?.textContent?.toLowerCase() ?? input.id;
}

function fieldsOf(page: string): HTMLInputElement[] {
  return Array.from(el(`page-${slug(page)}`).querySelectorAll<HTMLInputElement>("input:not([type=search]):not([aria-label]), select:not([id$=-filter]), textarea"));
}

/** Every field on a page, by label (lowercase), skipping passwords and files. */
export function readForm(page: string): Row {
  const row: Row = {};
  for (const input of fieldsOf(page)) {
    if (input.type === "password" || input.type === "file") continue;
    const label = labelOf(input);
    row[label] = input.type === "checkbox" ? String(input.checked) : input.value;
  }
  return row;
}

/** Fills a page's fields from a row (keys are lowercase labels). */
export function fillForm(page: string, row: Row | undefined): void {
  for (const input of fieldsOf(page)) {
    const label = labelOf(input);
    if (row && label in row) setValue(input.id, row[label]);
  }
}

export function clearForm(page: string): void {
  for (const input of fieldsOf(page)) {
    if (input.type === "checkbox") input.checked = false;
    else input.value = "";
  }
}

/** Marks a field invalid; the text goes under it and into its accessible description. */
export function setFieldError(id: string, text: string): void {
  const node = el(id);
  node.setAttribute("aria-invalid", "true");
  node.setAttribute("aria-describedby", `${id}-error`);
  el(`${id}-error`).textContent = text;
}

/** Marks a field invalid without changing its error text. */
export function markInvalid(id: string): void {
  el(id).setAttribute("aria-invalid", "true");
}

export function clearErrors(): void {
  for (const node of Array.from(document.querySelectorAll("[aria-invalid]"))) node.removeAttribute("aria-invalid");
  for (const node of Array.from(document.querySelectorAll(".error"))) node.textContent = "";
}

export function isEmpty(id: string): boolean {
  return value(id).trim() === "";
}

/** Whether a value fits a kind: email, number, date, url, tel. */
export function isValid(kind: string, v: string): boolean {
  if (kind === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if (kind === "number") return v.trim() !== "" && !Number.isNaN(Number(v));
  if (kind === "date") return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
  if (kind === "url") return /^https?:\/\/\S+\.\S+/.test(v);
  if (kind === "tel") return /^[0-9+()\-\s]{5,}$/.test(v);
  return true;
}

export function setEnabled(id: string, on: boolean): void {
  (el(id) as HTMLButtonElement).disabled = !on;
}

export function setShown(id: string, on: boolean): void {
  el(id).hidden = !on;
}

export function focusField(id: string): void {
  el(id).focus();
}

/** Shows a line in the message area; cleared when the next action starts. */
export function showMessage(text: string): void {
  const p = make("p");
  p.append(make("span", {}, text));
  const close = make("button", { type: "button", "aria-label": "Close message" }, "x");
  close.addEventListener("click", () => p.remove());
  p.append(close);
  el("messages").append(p);
}

export function hideMessage(text: string): void {
  for (const p of Array.from(el("messages").querySelectorAll("p"))) if (p.firstChild?.textContent?.toLowerCase() === text.toLowerCase()) p.remove();
}

/** Takes `text` off the screen: messages saying it, and facts or statuses that mention it. */
export function forgetText(text: string): void {
  const t = text.toLowerCase();
  hideMessage(text);
  state.facts = state.facts.filter((f) => !f.includes(t));
  for (const k of Object.keys(state.status)) if (k.includes(t) || state.status[k].toLowerCase().includes(t)) delete state.status[k];
  drawState();
}

export function clearMessages(): void {
  el("messages").textContent = "";
  clearErrors();
}

/** Asks in the dialog; its first button runs `onOk`, the second `onCancel`. */
export function confirmDialog(text: string, onOk: () => void, onCancel: () => void = () => {}, okLabel = "ok", cancelLabel = "cancel"): void {
  const dialog = el("dialog") as HTMLDialogElement;
  el("dialog-text").textContent = text;
  const ok = el("dialog-ok").cloneNode(true) as HTMLElement;
  const cancel = el("dialog-cancel").cloneNode(true) as HTMLElement;
  ok.textContent = okLabel === "ok" ? "OK" : cap(okLabel);
  cancel.textContent = cap(cancelLabel);
  el("dialog-ok").replaceWith(ok);
  el("dialog-cancel").replaceWith(cancel);
  ok.addEventListener("click", () => {
    dialog.close();
    clearMessages();
    onOk();
    state.refresh();
  });
  cancel.addEventListener("click", () => {
    dialog.close();
    clearMessages();
    onCancel();
    state.refresh();
  });
  dialog.showModal();
}

export function closeDialog(): void {
  (el("dialog") as HTMLDialogElement).close();
}

/** A menu of `items` under the element; picking one runs `onPick(item)`. */
export function showMenu(anchorId: string, items: string[], onPick: (item: string) => void = () => {}): void {
  document.getElementById(`${anchorId}-menu`)?.remove();
  const menu = make("div", { id: `${anchorId}-menu`, role: "menu", class: "panel" });
  for (const item of items) {
    const b = make("button", { type: "button", role: "menuitem" }, cap(item));
    b.addEventListener("click", () => {
      menu.remove();
      clearMessages();
      onPick(item);
      state.refresh();
    });
    menu.append(b);
  }
  el(anchorId).after(menu);
}

/** Shows `text` when the pointer is over the element. */
export function setTooltip(id: string, text: string): void {
  const node = el(id);
  node.addEventListener("mouseenter", () => {
    const tip = make("div", { id: `${id}-tip`, role: "tooltip" }, text);
    const box = node.getBoundingClientRect();
    tip.style.left = `${box.left}px`;
    tip.style.top = `${box.bottom + 6}px`;
    document.body.append(tip);
  });
  node.addEventListener("mouseleave", () => document.getElementById(`${id}-tip`)?.remove());
}

/** Bold, italic, underline or a link on the selected text of an editor. */
export function formatText(command: string, arg = ""): void {
  const sel = getSelection();
  // The live selection when it is in an editor; the saved one when a toolbar field took focus.
  const inEditor = !!sel?.rangeCount && !!sel.anchorNode?.parentElement?.closest("[contenteditable]");
  if (state.range && sel && !inEditor) {
    sel.removeAllRanges();
    sel.addRange(state.range);
  }
  document.execCommand(command, false, arg);
}

export function setTheme(theme: string): void {
  document.documentElement.dataset.theme = theme;
}

export function setTitle(title: string): void {
  document.title = title;
}

/** The values of a record, written out on its page. */
export function showDetails(page: string, row: Row | undefined): void {
  const id = `page-${slug(page)}-details`;
  let dl = find(id);
  if (!dl) {
    dl = make("dl", { id, class: "panel" });
    el(`page-${slug(page)}-title`).after(dl);
  }
  dl.textContent = "";
  for (const [k, v] of Object.entries(row ?? {})) if (v) dl.append(make("dt", { class: "muted" }, cap(k)), make("dd", {}, v));
}

/** Saves `text` as a file download (the sandboxed preview blocks it). */
export function download(file: string, text: string): void {
  state.downloads.push(file.toLowerCase());
  const a = make("a", { href: URL.createObjectURL(new Blob([text])), download: file });
  a.click();
}

// ---- records ----

export function downloaded(file: string): boolean {
  return state.downloads.includes(file.toLowerCase());
}

export function addRecord(entity: string, row: Row): void {
  (state.records[entity] ??= []).push({ ...row });
}

/** `n` numbered records ("Recipe 1", "Recipe 2", ...) with `nameKey` set. */
export function seedRecords(entity: string, nameKey: string, n: number): void {
  state.records[entity] = Array.from({ length: n }, (_, i) => ({ [nameKey]: `${cap(entity)} ${i + 1}` }));
}

export function clearRecords(entity: string): void {
  state.records[entity] = [];
}

export function findRecord(entity: string, nameKey: string, name: string): Row | undefined {
  return (state.records[entity] ?? []).find((r) => (r[nameKey] ?? "").toLowerCase() === name.toLowerCase());
}

export function removeRecord(entity: string, nameKey: string, name: string): void {
  state.records[entity] = (state.records[entity] ?? []).filter((r) => (r[nameKey] ?? "").toLowerCase() !== name.toLowerCase());
  state.selected.delete(name.toLowerCase());
}

/** Removes the selected records and returns how many went. */
export function removeSelected(entity: string, nameKey: string): number {
  const before = (state.records[entity] ?? []).length;
  state.records[entity] = (state.records[entity] ?? []).filter((r) => !state.selected.has((r[nameKey] ?? "").toLowerCase()));
  state.selected.clear();
  return before - state.records[entity].length;
}

/** Adds "<Entity> <n+1>" ("Slide 3" after two slides) and returns the name. */
export function addNumbered(entity: string, nameKey: string): string {
  const name = `${cap(entity)} ${(state.records[entity] ?? []).length + 1}`;
  addRecord(entity, { [nameKey]: name });
  return name;
}

/** Adds "<name> copy" after the record. */
export function copyRecord(entity: string, nameKey: string, name: string): void {
  const rows = state.records[entity] ?? [];
  const i = rows.findIndex((r) => (r[nameKey] ?? "").toLowerCase() === name.toLowerCase());
  if (i >= 0) rows.splice(i + 1, 0, { ...rows[i], [nameKey]: `${rows[i][nameKey]} copy` });
}

/** Moves a record to just before another. */
export function moveBefore(entity: string, nameKey: string, name: string, other: string): void {
  const rows = state.records[entity] ?? [];
  const i = rows.findIndex((r) => (r[nameKey] ?? "").toLowerCase() === name.toLowerCase());
  if (i < 0) return;
  const [row] = rows.splice(i, 1);
  const j = rows.findIndex((r) => (r[nameKey] ?? "").toLowerCase() === other.toLowerCase());
  rows.splice(j < 0 ? rows.length : j, 0, row);
}

export function recordCount(entity: string): number {
  return (state.records[entity] ?? []).length;
}

/** Copies the selected records as "<name> (copy)". */
export function duplicateSelected(entity: string, nameKey: string): void {
  for (const r of [...(state.records[entity] ?? [])]) if (state.selected.has((r[nameKey] ?? "").toLowerCase())) addRecord(entity, { ...r, [nameKey]: `${r[nameKey]} (copy)` });
  state.selected.clear();
}

export function updateRecord(entity: string, nameKey: string, name: string, row: Row): void {
  const r = findRecord(entity, nameKey, name);
  if (r) Object.assign(r, row);
}

export function selectRecord(name: string, on = true): void {
  if (on) state.selected.add(name.toLowerCase());
  else state.selected.delete(name.toLowerCase());
}

export function selectedCount(): number {
  return state.selected.size;
}

/** Remembers the record being looked at (opened from a list, or edited). */
export function openRecord(entity: string, nameKey: string, name: string): Row | undefined {
  state.current = findRecord(entity, nameKey, name) ?? null;
  return state.current ?? undefined;
}

export function currentName(nameKey: string): string {
  return state.current?.[nameKey] ?? "";
}

/**
 * Draws a list of records into `listId` (made on `page` the first time, with the controls `opts`
 * asks for: search box, filter, sort buttons; select all and the pager are always there). Each row
 * has a checkbox and an open button that calls `onOpen(name)`.
 */
export function renderList(page: string, listId: string, entity: string, nameKey: string, onOpen: (name: string) => void, onSelect: () => void, opts: ListOptions): void {
  let list = find(listId);
  if (!list) {
    const controls = make("div", { class: "buttons" });
    if (opts.search) {
      const q = make("input", { type: "search", id: `${listId}-search`, "aria-label": "Search", placeholder: "Search" });
      q.addEventListener("input", () => {
        setQuery(q.value);
        state.refresh();
      });
      controls.append(q);
    }
    if (opts.filter) {
      const f = opts.filter;
      const sel = make("select", { id: `${listId}-filter`, "aria-label": cap(f.key) });
      sel.append(make("option", { value: "" }, "All"));
      for (const o of f.options) sel.append(make("option", { value: o }, o));
      sel.addEventListener("change", () => {
        setFilter(f.key, sel.value);
        state.refresh();
      });
      controls.append(sel);
    }
    for (const key of opts.sorts) {
      const b = make("button", { type: "button" }, `Sort by ${key}`);
      b.addEventListener("click", () => {
        setSort(key, state.sort?.key === key && !state.sort.desc);
        state.refresh();
      });
      controls.append(b);
    }
    const all = make("input", { type: "checkbox", id: `${listId}-all`, "aria-label": "Select all" });
    all.addEventListener("change", () => {
      for (const r of state.records[entity] ?? []) selectRecord(r[nameKey] ?? "", all.checked);
      onSelect();
      state.refresh();
    });
    controls.append(all);
    list = make("ul", { id: listId, class: "records", "aria-label": `${cap(entity)} list` });
    el(`page-${slug(page)}`).append(controls, list, make("p", { id: `${listId}-status`, class: "muted" }), make("div", { id: `${listId}-pager`, class: "buttons" }));
  }
  let rows = [...(state.records[entity] ?? [])];
  const q = state.query.toLowerCase();
  if (q) rows = rows.filter((r) => Object.values(r).some((v) => v.toLowerCase().includes(q)));
  const filter = state.filter;
  if (filter) rows = rows.filter((r) => (r[filter.key] ?? "").toLowerCase() === filter.value.toLowerCase());
  const sort = state.sort;
  if (sort) rows.sort((a, b) => (a[sort.key] ?? "").localeCompare(b[sort.key] ?? "", undefined, { numeric: true }) * (sort.desc ? -1 : 1));
  const pages = Math.max(1, Math.ceil(rows.length / state.pageSize));
  state.page = Math.min(state.page, pages);
  list.textContent = "";
  for (const r of rows.slice((state.page - 1) * state.pageSize, state.page * state.pageSize)) {
    const name = r[nameKey] ?? "";
    const li = make("li");
    const box = make("input", { type: "checkbox", "aria-label": `Select ${name}` });
    box.checked = state.selected.has(name.toLowerCase());
    box.addEventListener("change", () => {
      selectRecord(name, box.checked);
      onSelect();
      state.refresh();
    });
    const open = make("button", { type: "button", class: "open" }, name);
    open.addEventListener("click", () => {
      clearMessages();
      onOpen(name);
      state.refresh();
    });
    li.append(box, open);
    for (const k of opts.badges) if (r[k]) li.append(make("span", { class: "badge" }, r[k]));
    list.append(li);
  }
  const total = (state.records[entity] ?? []).length;
  el(`${listId}-status`).textContent = total === 0 ? `No ${entity}s yet` : rows.length === 0 ? `No ${entity}s match your search` : pages > 1 ? `Page ${state.page} of ${pages}` : "";
  const pager = el(`${listId}-pager`);
  pager.textContent = "";
  if (pages < 2) return;
  const go = (n: number) => {
    state.page = n;
    state.refresh();
  };
  const prev = make("button", { type: "button" }, "Previous");
  prev.addEventListener("click", () => go(Math.max(1, state.page - 1)));
  pager.append(prev);
  for (let n = 1; n <= pages; n++) {
    const b = make("button", { type: "button" }, String(n));
    if (n === state.page) b.setAttribute("aria-current", "page");
    b.addEventListener("click", () => go(n));
    pager.append(b);
  }
  const next = make("button", { type: "button" }, "Next");
  next.addEventListener("click", () => go(Math.min(pages, state.page + 1)));
  pager.append(next);
}

export function setQuery(q: string): void {
  state.query = q;
  state.page = 1;
}

export function setFilter(key: string, v: string): void {
  state.filter = v ? { key, value: v } : null;
  state.page = 1;
}

export function setSort(key: string, desc: boolean): void {
  state.sort = { key, desc };
}

export function setListPage(n: number, size = state.pageSize): void {
  state.pageSize = size;
  state.page = n;
}

/** The records of an entity as CSV, for exports. */
export function recordsCsv(entity: string): string {
  const rows = state.records[entity] ?? [];
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  return [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
}

// ---- people ----

export function addUser(email: string, password: string): void {
  state.users.push({ email: email.toLowerCase(), password });
}

export function checkUser(email: string, password: string): boolean {
  return state.users.some((u) => u.email === email.toLowerCase() && u.password === password);
}

export function userExists(email: string): boolean {
  return state.users.some((u) => u.email === email.toLowerCase());
}

/** Whether any known user has this password (for "current password" checks). */
export function passwordKnown(password: string): boolean {
  return state.users.some((u) => u.password === password);
}

/** Signs someone in and shows "Signed in as ..." with a user menu holding Sign out. */
export function signIn(who: string): void {
  state.session = who;
  state.attempts = 0;
  if (state.wanted) {
    showPage(state.wanted);
    state.wanted = "";
  }
  const account = el("account");
  account.textContent = "";
  account.append(make("span", { class: "muted" }, `Signed in as ${who}`));
  const menu = make("button", { type: "button", "aria-label": "User menu", "aria-haspopup": "menu" }, "Account");
  menu.style.marginLeft = "10px";
  menu.addEventListener("click", () => showMenu("account", ["sign out"], () => signOut()));
  account.append(menu);
}

export function signOut(): void {
  state.session = "";
  const account = el("account");
  account.textContent = "";
  const button = make("button", { type: "button" }, "Sign in");
  button.addEventListener("click", () => showPage("sign in"));
  account.append(button);
}

export function sessionRole(): string {
  return state.session;
}

export function attempts(): number {
  return state.attempts;
}

export function failedAttempt(): number {
  return ++state.attempts;
}

export function setAttempts(n: number): void {
  state.attempts = n;
}

export function sendEmail(to: string): void {
  state.sent.push(to.toLowerCase());
}

export function sentTo(email: string): boolean {
  return state.sent.includes(email.toLowerCase());
}

// ---- counters, inventory and other state ----

/** A number shown in the app bar ("Gold: 96"). */
export function setCounter(name: string, n: number): void {
  state.counters[name.toLowerCase()] = n;
  drawHud();
}

export function addToCounter(name: string, d: number): void {
  setCounter(name, counter(name) + d);
}

export function hasCounter(name: string): boolean {
  return name.toLowerCase() in state.counters;
}

export function counter(name: string): number {
  return state.counters[name.toLowerCase()] ?? 0;
}

function drawHud(): void {
  const hud = el("hud");
  hud.textContent = "";
  for (const [k, v] of Object.entries(state.counters)) hud.append(make("span", { id: `counter-${slug(k)}` }, `${cap(k)}: ${v}`));
}

export function setItem(name: string, qty: number): void {
  state.inventory[name.toLowerCase()] = Math.max(0, qty);
  drawInventory();
}

export function addItem(name: string, d: number): void {
  setItem(name, itemCount(name) + d);
}

export function itemCount(name: string): number {
  return state.inventory[name.toLowerCase()] ?? 0;
}

function drawInventory(): void {
  const list = document.getElementById("inventory-items");
  if (!list) return;
  list.textContent = "";
  for (const [k, v] of Object.entries(state.inventory)) if (v > 0) list.append(make("li", {}, `${v} ${k}`));
}

/** A named value of the world ("playing: Crystal cave"), listed in the State panel. */
export function setStatus(key: string, v: string): void {
  state.status[key.toLowerCase()] = v;
  drawState();
}

export function hasStatus(key: string, v: string): boolean {
  return (state.status[key.toLowerCase()] ?? "").toLowerCase() === v.toLowerCase();
}

/**
 * A fact with no element of its own ("the game is paused", "the fox should flash for 2 seconds"),
 * listed in the State panel.
 */
export function setFact(text: string, on = true): void {
  const t = text.toLowerCase();
  state.facts = state.facts.filter((f) => f !== t);
  if (on && t) state.facts.push(t);
  drawState();
}

export function hasFact(text: string): boolean {
  return state.facts.includes(text.toLowerCase());
}

function drawState(): void {
  const list = document.getElementById("state-items");
  if (!list) return;
  list.textContent = "";
  for (const [k, v] of Object.entries(state.status)) list.append(make("li", {}, `${cap(k)}: ${v}`));
  // "the fox should flash" reads as "the fox flash", "should be" as "is".
  for (const f of state.facts) list.append(make("li", {}, cap(f.replace(/^i should /, "I ").replace(/ should not /, " does not ").replace(/ should be /, " is ").replace(/ should have /, " has ").replace(/ should /, " "))));
}

export function resetState(): void {
  state.records = {};
  state.selected.clear();
  state.current = null;
  state.users = [];
  state.attempts = 0;
  state.counters = {};
  state.inventory = {};
  state.status = {};
  state.facts = [];
  state.sent = [];
  state.downloads = [];
  state.query = "";
  state.filter = null;
  state.sort = null;
  state.page = 1;
  drawHud();
  drawInventory();
  drawState();
  state.session = "";
  state.wanted = "";
  el("account").textContent = "";
  clearMessages();
  for (const id of state.pages.keys()) clearForm(id.replace(/^page-/, ""));
}

/**
 * Starting states. `givens` holds the setup for each Given line, by its text; each scenario lists
 * its own. A bar under the app picks a scenario; `window.gherkinApp` lets tests do the same and
 * ask about state no element shows (`checks`, by Then text).
 */
export function startApp(givens: Record<string, () => void>, scenarios: { title: string; givens: string[] }[], refresh: () => void, checks: Record<string, () => boolean>, home: string): void {
  state.refresh = refresh;
  const load = (i: number): boolean => {
    const s = scenarios[i];
    if (!s) return false;
    resetState();
    showPage(home);
    for (const g of s.givens) givens[g]?.();
    refresh();
    const pick = find("scenario-pick") as HTMLSelectElement | null;
    if (pick) pick.value = String(i);
    return true;
  };
  const bar = make("div", { class: "panel", id: "scenario-bar" });
  bar.style.margin = "20px";
  const pick = make("select", { id: "scenario-pick" });
  scenarios.forEach((s, i) => pick.append(make("option", { value: String(i) }, cap(s.title))));
  pick.addEventListener("change", () => load(Number(pick.value)));
  bar.append(make("label", { for: "scenario-pick" }, "Starting state "), pick);
  document.body.append(bar);
  (window as unknown as { gherkinApp: unknown }).gherkinApp = {
    load,
    check: (text: string): boolean | null => (checks[text.toLowerCase()] ? checks[text.toLowerCase()]() : null),
  };
  load(0);
}
