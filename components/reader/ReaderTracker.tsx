"use client";

import { useEffect, useState } from "react";
import { recordProgress, recordVisit } from "@/lib/library";

export const ARTICLE_ID = "post-body";

// How far through the article body the bottom of the viewport is, 0-100.
export function articleProgress(): number {
  const el = document.getElementById(ARTICLE_ID);
  if (!el) return 0;
  const rect = el.getBoundingClientRect();
  const read = window.innerHeight - rect.top;
  return Math.max(0, Math.min(100, (read / rect.height) * 100));
}

// Logs the visit, keeps this browser's reading progress for the post, and
// draws the thin progress bar under the top bar.
export function ReaderTracker({ slug }: { slug: string }) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    recordVisit(slug);
    let frame = 0;
    const update = () => {
      frame = 0;
      const p = articleProgress();
      setPct(p);
      recordProgress(slug, p);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [slug]);

  return (
    <div
      className="fixed inset-x-0 top-16 z-40 h-0.5 bg-line/8"
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${pct}%` }} />
    </div>
  );
}
