import type { ComponentProps } from "react";
import type { MDXComponents } from "mdx/types";

function H2({ id, children }: ComponentProps<"h2">) {
  return (
    <h2
      id={id}
      className="mt-14 border-t border-line/20 pt-6 font-display text-2xl font-semibold text-ink-100 md:text-3xl"
    >
      {children}
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

function P({ children }: ComponentProps<"p">) {
  return <p className="mt-5 leading-relaxed text-ink-300">{children}</p>;
}

function Ul({ children }: ComponentProps<"ul">) {
  return <ul className="mt-5 list-disc space-y-2 pl-5 text-ink-300 marker:text-accent">{children}</ul>;
}

function Ol({ children }: ComponentProps<"ol">) {
  return <ol className="mt-5 list-decimal space-y-2 pl-5 text-ink-300 marker:text-accent">{children}</ol>;
}

function Blockquote({ children }: ComponentProps<"blockquote">) {
  return (
    <blockquote className="mt-5 border-l-2 border-accent/60 pl-4 text-ink-400 italic">
      {children}
    </blockquote>
  );
}

function Pre({ children, ...props }: ComponentProps<"pre">) {
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
    <figure className="my-8 border border-line/25 p-3">
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
};
