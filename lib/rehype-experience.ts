// Marks up a post's body for the post page's scroll experience, without
// touching the MDX files:
// - the first real paragraph becomes the lede (large type that fills in as
//   it's read),
// - after every other section, an interlude is inserted: a large floating
//   text chunk pulled from that section - the first measured number
//   ("16 ms/token") with the sentence it came from, or a short sentence.
// Interludes render through the `aside` MDX component and are aria-hidden,
// since they repeat text that's already in the article.

const MAX_INTERLUDES = 4;
const MIN_SECTION_CHARS = 280;

// A number with a unit, so years, versions and counts don't qualify.
const STAT_RE =
  /(?<![\w.])(\d[\d,]*(?:\.\d+)?)\s?(ms\/token|ms\/frame|steps\/s|tok\/s|ms|µs|MB|KB|kB|GB|fps|FPS|%|x|×|M params|M)(?![\w/])/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any;

function toText(node: Node): string {
  if (!node) return "";
  if (node.type === "text") return node.value ?? "";
  if (Array.isArray(node.children)) return node.children.map(toText).join("");
  return "";
}

function isElement(node: Node, tag: string) {
  return node?.type === "element" && node.tagName === tag;
}

function hasImage(node: Node): boolean {
  if (isElement(node, "img")) return true;
  return Array.isArray(node?.children) && node.children.some(hasImage);
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9`"(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type Interlude = { kind: "stat" | "quote"; value?: string; text: string };

const MAX_TEXT = 150;

// Technical sentences run long, so pulled text is cut back to whole clauses
// (split at , ; : and spaced dashes) around the part that matters.
function clauses(sentence: string): string[] {
  return sentence.split(/(?<=[,;:])\s+|\s+(?=[-–]\s)/).filter(Boolean);
}

function excerptAround(sentence: string, at: number): string {
  if (sentence.length <= MAX_TEXT) return sentence;
  const parts = clauses(sentence);
  let pos = 0;
  let hit = 0;
  parts.forEach((part, i) => {
    if (at >= pos) hit = i;
    pos += part.length + 1;
  });
  let from = hit;
  let to = hit + 1;
  const len = () => parts.slice(from, to).join(" ").length;
  while (to < parts.length && len() + parts[to].length < MAX_TEXT) to++;
  while (from > 0 && len() + parts[from - 1].length < MAX_TEXT) from--;
  let text = parts.slice(from, to).join(" ").replace(/^[-–]\s+/, "").replace(/[,;:]$/, "");
  if (text.length > MAX_TEXT + 40) return "";
  if (from > 0) text = "…" + text;
  if (to < parts.length) text += "…";
  return text;
}

// Sentences that lean on the one before them read badly out of context.
const DANGLING = /^(that|this|it|these|those|they|so|but|and|which|here|there)\b/i;

function pickInterlude(paragraphs: string[]): Interlude | undefined {
  const all = paragraphs.flatMap(sentences).filter((s) => !s.endsWith(":") && !s.startsWith("|") && !/[$\\]/.test(s));
  for (const s of all) {
    const m = STAT_RE.exec(s);
    if (!m || Number(m[1].replace(/,/g, "")) === 0) continue;
    const text = excerptAround(s, m.index);
    if (text) {
      const tight = m[2] === "%" || m[2] === "x" || m[2] === "×" || m[2] === "M";
      return { kind: "stat", value: `${m[1]}${tight ? "" : " "}${m[2]}`, text };
    }
  }
  const standalone = all.filter((s) => !DANGLING.test(s));
  for (const pool of [standalone, all]) {
    const whole = pool.find((s) => s.length >= 50 && s.length <= MAX_TEXT);
    if (whole) return { kind: "quote", text: whole };
    for (const s of pool) {
      const text = excerptAround(s, 0);
      if (text.length >= 50) return { kind: "quote", text };
    }
  }
  return undefined;
}

function interludeNode(interlude: Interlude, index: number): Node {
  return {
    type: "element",
    tagName: "aside",
    properties: {
      dataInterlude: interlude.kind,
      dataValue: interlude.value ?? "",
      dataText: interlude.text,
      dataIndex: String(index),
    },
    children: [],
  };
}

export function rehypeExperience() {
  return (tree: unknown) => {
    const root = tree as Node;
    if (!Array.isArray(root?.children)) return;
    const children: Node[] = root.children;

    // Lede: first substantial paragraph before the first h2.
    for (const node of children) {
      if (isElement(node, "h2")) break;
      if (isElement(node, "p") && !hasImage(node) && toText(node).trim().length >= 60) {
        node.properties = { ...node.properties, dataLede: "" };
        break;
      }
    }

    // Sections: [start, end) ranges of top-level nodes split at each h2.
    const starts = children.map((n, i) => (isElement(n, "h2") ? i : -1)).filter((i) => i >= 0);
    const inserts: { at: number; node: Node }[] = [];
    let made = 0;
    for (let s = 0; s < starts.length - 1 && made < MAX_INTERLUDES; s += 2) {
      const from = starts[s];
      const to = starts[s + 1];
      const paragraphs = children
        .slice(from + 1, to)
        .filter((n) => isElement(n, "p") && !hasImage(n))
        .map(toText);
      if (paragraphs.join(" ").length < MIN_SECTION_CHARS) continue;
      const interlude = pickInterlude(paragraphs);
      if (!interlude) continue;
      made += 1;
      inserts.push({ at: to, node: interludeNode(interlude, made) });
    }
    for (const { at, node } of inserts.reverse()) children.splice(at, 0, node);
  };
}
