// Keeps one side of a post body split at the end of its intro, so the post page can send only
// the intro until the reader answers the survey (lib/survey.ts). The intro ends after the lede
// rehype-experience marks, or else after the first paragraph, or else before the first h2.
// Runs after rehypeExperience, so interludes are numbered over the whole post either way.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = any;

const isElement = (node: Node, tag?: string) => node?.type === "element" && (!tag || node.tagName === tag);

export function introEnd(children: Node[]): number {
  const lede = children.findIndex((n) => isElement(n) && n.properties?.dataLede !== undefined);
  if (lede !== -1) return lede + 1;
  const h2 = children.findIndex((n) => isElement(n, "h2"));
  const p = children.findIndex((n) => isElement(n, "p"));
  if (p !== -1 && (h2 === -1 || p < h2)) return p + 1;
  return h2 === -1 ? children.length : h2;
}

export function rehypeSplitIntro(options: { part: "all" | "intro" | "rest" }) {
  return (tree: unknown) => {
    const root = tree as Node;
    if (options.part === "all" || !Array.isArray(root?.children)) return;
    // MDX import/export statements stay in both halves, so each compiles on its own.
    const esm = root.children.filter((n: Node) => n.type === "mdxjsEsm");
    const body = root.children.filter((n: Node) => n.type !== "mdxjsEsm");
    const end = introEnd(body);
    root.children = [...esm, ...(options.part === "intro" ? body.slice(0, end) : body.slice(end))];
  };
}
