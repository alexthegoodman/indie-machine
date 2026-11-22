"use client";

import { useEffect } from "react";

// Drives the post page's scroll-linked styles. Every element marked
// `data-scroll-p` gets three custom properties, updated once per frame while
// scrolling, and the CSS does the rest (globals.css, "Post experience"):
//   --p     0 when its top meets the bottom of the viewport, 1 when its bottom
//           leaves the top - for parallax and drift.
//   --exit  how far it has scrolled up out of view, 0-1 - for the intro.
//   --read  how much of it has passed the reading line, 0-1 - for the lede.
// Under reduced motion nothing is set, and the CSS fallbacks (rest state) apply.
export function ScrollFx({ slug }: { slug: string }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-p]"));
    if (!els.length) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const vh = window.innerHeight;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        // Far away elements keep their last (clamped) values.
        if (r.bottom < -vh && el.dataset.fxDone === "past") continue;
        if (r.top > 2 * vh && el.dataset.fxDone === "ahead") continue;
        const h = Math.max(r.height, 1);
        const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + h)));
        const exit = Math.min(1, Math.max(0, -r.top / h));
        const read = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (h + vh * 0.3)));
        el.style.setProperty("--p", p.toFixed(4));
        el.style.setProperty("--exit", exit.toFixed(4));
        el.style.setProperty("--read", read.toFixed(4));
        el.dataset.fxDone = r.bottom < -vh ? "past" : r.top > 2 * vh ? "ahead" : "";
      }
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

  return null;
}
