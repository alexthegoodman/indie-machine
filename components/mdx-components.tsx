import { Children, isValidElement, type ComponentProps, type CSSProperties } from "react";
import type { MDXComponents } from "mdx/types";
import { MermaidBlock } from "./MermaidBlock";
import { fnv1a, rng } from "@/lib/experience";

function extractText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: React.ReactNode } }).props;
    return extractText(props?.children);
  }
  return "";
}

// Section heads are display-sized, numbered by a CSS counter, with a giant
// outlined copy of the heading drifting behind them (::after, data-ghost, so
// it stays out of the heading's text for the chapter list and screen readers).
function H2({ id, children }: ComponentProps<"h2">) {
  return (
    <h2 id={id} data-scroll-p data-ghost={extractText(children)} className="exp-h2">
      <span className="exp-h2-text">{children}</span>
    </h2>
  );
}

function H3({ id, children }: ComponentProps<"h3">) {
  return (
    <h3 id={id} className="mt-10 font-display text-xl font-semibold text-ink-100">
      {children}
    </h3>
  );
}

// Markdown wraps a lone image in a paragraph, but Img renders a <figure>,
// which can't live inside <p> - the browser re-nests it and React reports a
// hydration mismatch. Paragraphs holding an image render as a div instead.
// The lede (marked by lib/rehype-experience) is set large and fills in as it's read.
function P({ children, ...props }: ComponentProps<"p">) {
  const hasImage = Children.toArray(children).some((c) => isValidElement(c) && c.type === Img);
  if ("data-lede" in props && !hasImage) {
    return (
      <p data-scroll-p className="exp-lede">
        {children}
      </p>
    );
  }
  const Tag = hasImage ? "div" : "p";
  return <Tag className="mt-5 leading-relaxed text-ink-300">{children}</Tag>;
}

function Ul({ children }: ComponentProps<"ul">) {
  return <ul className="mt-5 list-disc space-y-2 pl-5 text-ink-300 marker:text-accent">{children}</ul>;
}

function Ol({ children }: ComponentProps<"ol">) {
  return <ol className="mt-5 list-decimal space-y-2 pl-5 text-ink-300 marker:text-accent">{children}</ol>;
}

function Blockquote({ children }: ComponentProps<"blockquote">) {
  return (
    <blockquote className="exp-quote">
      {children}
    </blockquote>
  );
}

function Pre({ children, ...props }: ComponentProps<"pre">) {
  const dataLang = (props as Record<string, any>)["data-language"];
  const className = props.className ?? "";
  const isMermaid = dataLang === "mermaid" || className.includes("language-mermaid");

  if (isMermaid) {
    const chart = extractText(children);
    return <MermaidBlock chart={chart} />;
  }

  return (
    <div className="mt-6 overflow-x-auto border border-line/25">
      <pre {...props} className="p-4 text-[13px] leading-relaxed">
        {children}
      </pre>
    </div>
  );
}

function Img({ src, alt }: ComponentProps<"img">) {
  return (
    <figure className="exp-figure my-10 border border-line/25 p-3">
      {/* post images are static assets from /public, plain <img> keeps this simple */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt ?? ""} loading="lazy" className="block w-full" />
      {alt && (
        <figcaption className="mt-3 font-mono text-[11px] tracking-wide text-ink-500">{alt}</figcaption>
      )}
    </figure>
  );
}

function Table({ children }: ComponentProps<"table">) {
  return (
    <div className="mt-6 overflow-x-auto border border-line/25">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

function Th({ children }: ComponentProps<"th">) {
  return (
    <th className="border-b border-line/25 bg-panel px-3 py-2 text-left text-[11px] tracking-[0.08em] text-ink-500">
      {children}
    </th>
  );
}

function Td({ children }: ComponentProps<"td">) {
  return <td className="border-b border-line/15 px-3 py-2 text-ink-300">{children}</td>;
}

function Hr() {
  return <hr className="my-10 border-t border-dashed border-line/25" />;
}

// Interludes inserted by lib/rehype-experience between sections: a stat or a
// sentence from the section, set large with its words floating at different
// depths as the page scrolls. They repeat article text, so they're hidden from
// assistive tech.
function Aside({ children, ...props }: ComponentProps<"aside">) {
  const p = props as Record<string, string | undefined>;
  const kind = p["data-interlude"];
  if (!kind) return <aside {...props}>{children}</aside>;
  const text = p["data-text"] ?? "";
  const value = p["data-value"];
  const index = Number(p["data-index"] ?? 1);
  const next = rng(fnv1a(text));
  const words = text.split(/\s+/).filter(Boolean);
  const [num, ...unit] = (value ?? "").split(/(?<=\d)(?=[^\d.,])/);
  return (
    <aside data-scroll-p data-interlude={kind} aria-hidden="true" className={`exp-interlude exp-interlude--${index % 2 ? "left" : "right"}`}>
      <div className="exp-interlude-index">
        <span className="h-px w-8 bg-accent" />
        INTERLUDE {String(index).padStart(2, "0")}
      </div>
      {kind === "stat" && value && (
        <div className="exp-interlude-stat" data-ghost={num}>
          <span>{num}</span>
          <span className="exp-interlude-unit">{unit.join("").trim()}</span>
        </div>
      )}
      <p className={`exp-interlude-text ${kind === "stat" ? "exp-interlude-text--small" : ""}`}>
        {words.map((w, i) => {
          const r = next();
          const style = r < 0.14 ? "exp-float--outline" : r < 0.26 ? "exp-float--serif" : "";
          return (
            <span key={i}>
              <span
                className={`exp-float ${style}`}
                style={{ "--depth": Math.round((next() - 0.5) * 2 * 20), "--rot": Math.round((next() - 0.5) * 8) } as CSSProperties}
              >
                {w}
              </span>{" "}
            </span>
          );
        })}
      </p>
    </aside>
  );
}

export const mdxComponents: MDXComponents = {
  h2: H2,
  h3: H3,
  p: P,
  ul: Ul,
  ol: Ol,
  blockquote: Blockquote,
  pre: Pre,
  img: Img,
  table: Table,
  th: Th,
  td: Td,
  hr: Hr,
  aside: Aside,
  Mermaid: MermaidBlock,
};
