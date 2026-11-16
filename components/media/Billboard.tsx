"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { channelOf, type MediaItem } from "@/lib/media";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/shell/icons";
import { SaveButton } from "./MediaCard";
import { Thumb } from "./Thumb";

const ROTATE_MS = 9000;

// Featured carousel at the top of the home page. Rotates on its own unless
// the pointer or focus is inside it, or the reader prefers reduced motion.
export function Billboard({ items }: { items: MediaItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = items.length;

  useEffect(() => {
    if (paused || n < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % n), ROTATE_MS);
    return () => clearTimeout(t);
  }, [index, paused, n]);

  if (!n) return null;
  const item = items[index];
  const href = `/posts/${item.slug}`;
  const verb = item.kind === "product" ? "READ REVIEW" : item.kind === "game" ? "SEE THE GAME" : "START READING";

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured posts"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="flex flex-wrap border border-line/28 bg-panel/25"
    >
      {/* A flex row so the cover stretches to the text column's height. */}
      <Link href={href} tabIndex={-1} aria-hidden="true" className="group flex min-w-0 flex-[1_1_520px]">
        <Thumb item={item} size="lg" className="w-full border-0" />
      </Link>
      <div
        className="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5 p-6 md:p-7"
        aria-roledescription="slide"
        aria-label={`${index + 1} of ${n}`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] tracking-[0.14em]">
          <span className="text-accent">// FEATURED</span>
          <span className={item.kind === "game" ? "text-badge" : "text-ink-400"}>{channelOf(item).label.toUpperCase()}</span>
        </div>
        <h2 className="line-clamp-4 font-display text-2xl leading-tight font-bold text-ink-100 md:text-[28px]">
          <Link href={href} className="text-inherit! hover:text-accent!">
            {item.title}
          </Link>
        </h2>
        <p className="line-clamp-4 font-display text-base leading-relaxed text-ink-300">{item.blurb}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-400">
          {item.score !== undefined && <span className="text-accent">SCORE {item.score.toFixed(1)}/10</span>}
          <span>{item.minutes} MIN READ</span>
          {item.badges?.slice(0, 2).map((b) => (
            <span key={b} className="text-badge uppercase">
              ◆ {b}
            </span>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={href}
            className="inline-flex h-11 items-center bg-accent px-5 font-display text-[13px] font-semibold tracking-[0.08em] text-ink! hover:bg-ink-100"
          >
            {verb}
          </Link>
          <SaveButton slug={item.slug} className="h-11! w-11!" />
          <div className="flex-1" />
          {n > 1 && (
            <>
              <button
                type="button"
                onClick={() => setIndex((index - 1 + n) % n)}
                aria-label="Previous featured post"
                className="flex h-11 w-11 cursor-pointer items-center justify-center border border-line/22 text-ink-300 hover:bg-accent/10 hover:text-ink-100"
              >
                <ChevronLeftIcon size={18} />
              </button>
              <button
                type="button"
                onClick={() => setIndex((index + 1) % n)}
                aria-label="Next featured post"
                className="flex h-11 w-11 cursor-pointer items-center justify-center border border-line/22 text-ink-300 hover:bg-accent/10 hover:text-ink-100"
              >
                <ChevronRightIcon size={18} />
              </button>
            </>
          )}
        </div>
        {n > 1 && (
          <div className="flex gap-1.5">
            {items.map((it, i) => (
              <button
                key={it.slug}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show featured post ${i + 1}`}
                aria-current={i === index}
                className={`h-2.5 cursor-pointer transition-all ${i === index ? "w-7 bg-accent" : "w-2.5 bg-line/28 hover:bg-line/50"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
