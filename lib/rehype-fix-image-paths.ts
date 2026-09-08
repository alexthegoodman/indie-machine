// The .mdx posts reference images with paths relative to the post file
// (e.g. "images/foo.png"), but the files themselves live in /public/images.
// This rewrites any non-absolute, non-external <img src> to an absolute
// "/images/foo.png" path Next can actually resolve.
export function rehypeFixImagePaths() {
  return (tree: unknown) => {
    walk(tree);
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function walk(node: any) {
  if (node && node.type === "element" && node.tagName === "img" && node.properties) {
    const src = node.properties.src;
    if (typeof src === "string" && !/^([a-z]+:)?\/\//i.test(src) && !src.startsWith("/")) {
      node.properties.src = "/" + src.replace(/^\.?\/*/, "");
    }
  }
  if (node && Array.isArray(node.children)) {
    for (const child of node.children) walk(child);
  }
}
