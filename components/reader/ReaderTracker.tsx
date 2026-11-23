"use client";

import { useEffect, useState } from "react";
import { recordProgress, recordVisit } from "@/lib/library";
import { track } from "@/lib/analytics/client";

const MILESTONES = [25, 50, 75, 100];

export const ARTICLE_ID = "post-body";
/** Window event: the article's content changed (the rest of the post arrived after the survey). */
export const ARTICLE_CHANGED = "im-article-change";
/** Attribute on the placeholder or survey standing in for the rest of the post (PostRest). */
export const POST_REST_PENDING = "data-post-rest-pending";

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
    let reached = 0;
    const update = () => {
      frame = 0;
      // Until the rest of the post arrives, the intro alone would read as the whole post.
      if (document.querySelector(`[${POST_REST_PENDING}]`)) return;
      const p = articleProgress();
      setPct(p);
      recordProgress(slug, p);
      // Each milestone once per view; 100 means the end of the article came into view.
      for (const m of MILESTONES) {
        if (m > reached && p >= (m === 100 ? 99 : m)) {
          reached = m;
          track("read_depth", { pct: m });
        }
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener(ARTICLE_CHANGED, onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener(ARTICLE_CHANGED, onScroll);
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
