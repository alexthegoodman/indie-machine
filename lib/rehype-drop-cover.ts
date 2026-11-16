// The reader shows a post's cover image in its stage above the title, so the
// same image appearing again in the opening paragraphs is dropped. Only the
// first match before the first h2 goes; later uses of the image stay.
export function rehypeDropCover(options: { src?: string }) {
  return (tree: unknown) => {
    if (!options.src) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const root = tree as any;
    if (!Array.isArray(root?.children)) return;
    for (let i = 0; i < root.children.length; i++) {
      const node = root.children[i];
      if (node?.type === "element" && node.tagName === "h2") return;
      if (isCover(node, options.src)) {
        root.children.splice(i, 1);
        return;
      }
      if (node?.type === "element" && node.tagName === "p" && Array.isArray(node.children)) {
        const j = node.children.findIndex((c: unknown) => isCover(c, options.src!));
        if (j === -1) continue;
        node.children.splice(j, 1);
        const empty = node.children.every((c: { type: string; value?: string }) => c.type === "text" && !c.value?.trim());
        if (empty) root.children.splice(i, 1);
        return;
      }
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isCover(node: any, src: string): boolean {
  return node?.type === "element" && node.tagName === "img" && node.properties?.src === src;
}
