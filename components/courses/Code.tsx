import fs from "node:fs";
import path from "node:path";
import { codeToHtml } from "shiki";

// Server-only: highlighted at build time with the same theme as the post pages.
export async function CodeBlock({ code, lang, label, source }: { code: string; lang: string; label: string; source?: string }) {
  const html = await codeToHtml(code.trim(), { lang, theme: "poimandres" });
  return (
    <div className="min-w-0 border border-line/20">
      <div className="flex items-baseline justify-between gap-3 border-b border-line/14 bg-panel/50 px-3 py-1.5 text-[10px] tracking-[0.14em]">
        <span className="text-accent">{label}</span>
        {source && <span className="truncate text-ink-500">{source}</span>}
      </div>
      <div className="course-code overflow-x-auto text-[12.5px] leading-relaxed [&_pre]:p-3" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

export function CodeCompare({ children }: { children: React.ReactNode }) {
  return <div className="my-4 grid gap-3 min-[1800px]:grid-cols-2">{children}</div>;
}

/**
 * Lines of a lib/courses file between a line starting with `from` and the first later line equal
 * to `to`, so a code slide shows the exact source the page runs. Scoped to lib/courses so file
 * tracing doesn't pull in the whole project.
 */
export function courseSnippet(file: string, from: string, to = "}"): string {
  const lines = fs.readFileSync(path.join(process.cwd(), "lib", "courses", file), "utf8").split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith(from));
  if (start < 0) throw new Error(`${from} not found in ${file}`);
  const end = lines.findIndex((l, i) => i > start && l === to);
  return lines.slice(start, end + 1).join("\n");
}
