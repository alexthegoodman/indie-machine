"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/lib/media";
import { setPreference, useLibrary } from "@/lib/library";
import { MediaRow } from "@/components/media/MediaCard";
import { Thumb } from "@/components/media/Thumb";

const COUNTDOWN = 8;

function AutoAdvanceSwitch() {
  const on = useLibrary().autoAdvance !== false;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setPreference("autoAdvance", !on)}
      className="flex min-h-11 cursor-pointer items-center gap-2 text-[11px] tracking-[0.1em] text-ink-400 hover:text-ink-100"
    >
      AUTO-ADVANCE
      <span className={`relative h-[18px] w-[34px] border ${on ? "border-accent bg-accent/20" : "border-line/32"}`}>
        <span className={`absolute top-[3px] h-2.5 w-2.5 transition-[left] ${on ? "left-[19px] bg-accent" : "left-[3px] bg-ink-400"}`} />
      </span>
    </button>
  );
}

export function UpNextList({ items, columns = 1 }: { items: MediaItem[]; columns?: 1 | 2 }) {
  if (!items.length) return null;
  return (
    <section aria-label="Up next">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="font-display text-[17px] font-semibold text-ink-100">Up next</h2>
        <AutoAdvanceSwitch />
      </div>
      <div className={columns === 2 ? "grid gap-1 md:grid-cols-2" : "flex flex-col gap-1"}>
        {items.map((item) => (
          <MediaRow key={item.slug} item={item} />
        ))}
      </div>
    </section>
  );
}

// Card at the end of the article. With auto-advance on, it counts down once
// it scrolls into view and then opens the next post, like an autoplay queue.
export function EndCard({ next }: { next: MediaItem }) {
  const router = useRouter();
  const auto = useLibrary().autoAdvance !== false;
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [left, setLeft] = useState(COUNTDOWN);
  const running = auto && visible && !cancelled;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.9 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running) {
      setLeft(COUNTDOWN);
      return;
    }
    if (left <= 0) {
      router.push(`/posts/${next.slug}`);
      return;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [running, left, next.slug, router]);

  return (
    <div ref={ref} className="mt-12 flex flex-wrap items-center gap-4 border border-accent/40 p-4">
      <Thumb item={next} size="sm" className="w-40 shrink-0" />
      <div className="min-w-0 flex-[1_1_220px]">
        <div className="text-[11px] tracking-[0.14em] text-accent" aria-live="polite">
          {running ? `UP NEXT IN ${left}S` : "UP NEXT"}
        </div>
        <div className="mt-1.5 line-clamp-2 font-display text-[17px] leading-snug font-semibold text-ink-100">{next.title}</div>
      </div>
      <div className="flex gap-2.5">
        {running && (
          <button
            type="button"
            onClick={() => setCancelled(true)}
            className="h-11 cursor-pointer border border-line/32 px-4 text-xs tracking-[0.1em] text-ink-100 hover:bg-accent/10"
          >
            CANCEL
          </button>
        )}
        <Link
          href={`/posts/${next.slug}`}
          className="inline-flex h-11 items-center bg-accent px-5 font-display text-[13px] font-semibold tracking-[0.08em] text-ink! hover:bg-ink-100"
        >
          READ NEXT -&gt;
        </Link>
      </div>
      {running && (
        <div className="h-0.5 basis-full bg-line/10">
          <div className="h-full bg-accent transition-[width] duration-1000 ease-linear" style={{ width: `${((COUNTDOWN - left) / COUNTDOWN) * 100}%` }} />
        </div>
      )}
    </div>
  );
}
