"use client";

import { useEffect, useState } from "react";
import { ARTICLE_ID, articleProgress } from "./ReaderTracker";

type Chapter = { id: string; label: string; minute: number };

const WORDS_PER_MINUTE = 230;
const ACTIVE_OFFSET = 120;

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

// Builds the chapter list from the rendered article's h2s (ids come from
// rehype-slug), with a read-time marker from the word count before each.
function readChapters(): Chapter[] {
  const article = document.getElementById(ARTICLE_ID);
  if (!article) return [];
  const chapters: Chapter[] = [];
  let words = 0;
  let sawHeading = false;
  for (const node of Array.from(article.children)) {
    if (node.tagName === "H2" && node.id) {
      if (!sawHeading && words > 40) chapters.push({ id: "", label: "Intro", minute: 0 });
      sawHeading = true;
      chapters.push({ id: node.id, label: node.textContent ?? "", minute: Math.round(words / WORDS_PER_MINUTE) });
    }
    if (node.tagName !== "PRE" && !node.querySelector?.("pre")) words += countWords(node.textContent ?? "");
  }
  return chapters;
}

export function Chapters({ variant }: { variant: "panel" | "collapsible" }) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [active, setActive] = useState(0);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const list = readChapters();
    setChapters(list);
    if (!list.length) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = 0;
      list.forEach((c, i) => {
        const el = c.id ? document.getElementById(c.id) : null;
        if (el && el.getBoundingClientRect().top < ACTIVE_OFFSET) current = i;
      });
      setActive(current);
      setPct(Math.round(articleProgress()));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (chapters.length < 2) return null;

  const list = (
    <ol className="py-1">
      {chapters.map((c, i) => (
        <li key={c.id || "intro"}>
          <a
            href={c.id ? `#${c.id}` : `#${ARTICLE_ID}`}
            aria-current={i === active ? "location" : undefined}
            className={`flex min-h-11 items-start gap-3 px-3.5 py-2.5 font-display text-sm leading-snug hover:bg-panel/55 ${
              i === active
                ? "bg-accent/10 text-ink-100! shadow-[inset_2px_0_0_var(--color-accent)]"
                : i < active
                  ? "text-ink-500!"
                  : "text-ink-300!"
            }`}
          >
            <span className="w-12 shrink-0 pt-px font-mono text-[11px] text-accent">{c.minute ? `${c.minute} MIN` : "START"}</span>
            <span className="min-w-0">{c.label}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  if (variant === "collapsible") {
    return (
      <details className="group border border-line/22">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3.5 text-[11px] tracking-[0.14em] text-accent">
          <span>CHAPTERS · {chapters.length}</span>
          <span className="text-ink-400">{pct}% READ</span>
        </summary>
        <div className="border-t border-line/18">{list}</div>
      </details>
    );
  }

  return (
    <section aria-label="Chapters" className="border border-line/22">
      <div className="flex items-center justify-between border-b border-line/18 px-3.5 py-3 text-[11px] tracking-[0.14em]">
        <span className="text-accent">CHAPTERS</span>
        <span className="text-ink-400">{pct}% READ</span>
      </div>
      <div className="max-h-[42vh] overflow-y-auto [scrollbar-width:thin]">{list}</div>
    </section>
  );
}
