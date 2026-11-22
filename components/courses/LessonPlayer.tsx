"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { markDone, saveSlide, useCourseProgress } from "@/lib/courses/progress";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/shell/icons";

export interface PlayerSlide {
  id: string;
  title: string;
  quizAnswer?: number; // set on quiz slides
  body: ReactNode;
}

// Slide-by-slide lesson. Every slide is in the server HTML (crawlable, readable without JS);
// only the current one is shown. Arrow keys and the segment bar move between them, the hash
// (#s-<id>) deep-links one, and reaching the last slide marks the lesson done.
export function LessonPlayer({
  course,
  lesson,
  slides,
  finale,
}: {
  course: string;
  lesson: string;
  slides: PlayerSlide[];
  finale: ReactNode;
}) {
  const key = `${course}/${lesson}`;
  const progress = useCourseProgress();
  const [index, setIndex] = useState(0);
  const top = useRef<HTMLDivElement>(null);
  const last = slides.length - 1;

  // Start at the hash's slide, else where this browser left off; follow later #s-<id> links.
  useEffect(() => {
    const fromHash = () => slides.findIndex((s) => `#s-${s.id}` === window.location.hash);
    const saved = progress.slide[key];
    if (fromHash() >= 0) setIndex(fromHash());
    else if (saved && saved <= last) setIndex(saved);
    const onHash = () => {
      if (fromHash() >= 0) setIndex(fromHash());
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // Only on mount: later progress changes come from this player itself.
  }, []);

  const go = useCallback(
    (next: number, scroll = true) => {
      const i = Math.max(0, Math.min(last, next));
      setIndex(i);
      saveSlide(key, i);
      window.history.replaceState(null, "", `#s-${slides[i].id}`);
      if (scroll && top.current && top.current.getBoundingClientRect().top < 0) top.current.scrollIntoView({ block: "start" });
    },
    [key, last, slides],
  );

  // However the last slide was reached (buttons, keys, a #hash link), the lesson is done.
  useEffect(() => {
    if (index === last) markDone(key);
  }, [index, last, key]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowRight") go(index + 1, false);
      else if (e.key === "ArrowLeft") go(index - 1, false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  const quizzes = slides.filter((s) => s.quizAnswer !== undefined);
  const correct = quizzes.filter((s) => progress.answers[`${key}/${s.id}`] === s.quizAnswer).length;

  return (
    <div ref={top} className="scroll-mt-4" data-lesson-player={key} data-index={index}>
      <div className="mb-3 flex items-center justify-between gap-4 text-[11px] tracking-[0.12em] text-ink-400">
        <span data-slide-count>
          SLIDE {index + 1} / {slides.length}
        </span>
        {quizzes.length > 0 && (
          <span>
            QUIZ {correct} / {quizzes.length}
          </span>
        )}
      </div>
      <nav aria-label="Slides" className="mb-5 flex gap-1">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(i)}
            aria-label={`Slide ${i + 1}: ${s.title}`}
            aria-current={i === index ? "step" : undefined}
            className="group h-6 flex-1 py-2"
          >
            <span
              className={`block h-full transition-colors ${
                i === index
                  ? "bg-accent"
                  : i < index
                    ? "bg-accent/45 group-hover:bg-accent/70"
                    : s.quizAnswer !== undefined
                      ? "bg-badge/35 group-hover:bg-badge/60"
                      : "bg-line/16 group-hover:bg-line/30"
              }`}
            />
          </button>
        ))}
      </nav>

      {slides.map((s, i) => (
        <section
          key={s.id}
          id={`s-${s.id}`}
          hidden={i !== index}
          aria-labelledby={`h-${s.id}`}
          className="course-slide min-h-[min(62vh,560px)] border border-line/22 bg-panel/20 p-5 sm:p-8"
          data-slide={s.id}
        >
          <div className={`mb-3 text-[11px] tracking-[0.16em] ${s.quizAnswer !== undefined ? "text-badge" : "text-accent"}`}>
            {s.quizAnswer !== undefined ? "CHECK YOURSELF" : `${String(i + 1).padStart(2, "0")} /`}
          </div>
          <h2 id={`h-${s.id}`} className="mb-5 font-display text-2xl leading-tight font-bold text-ink-100 md:text-3xl">
            {s.title}
          </h2>
          {s.body}
          {i === last && <div className="mt-8">{finale}</div>}
        </section>
      ))}

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="inline-flex h-11 items-center gap-2 border border-line/28 px-4 text-xs tracking-[0.1em] text-ink-100 hover:border-accent disabled:opacity-30 disabled:hover:border-line/28"
        >
          <ChevronLeftIcon size={16} /> BACK
        </button>
        <span className="hidden text-[11px] text-ink-500 sm:inline">← → keys work too</span>
        {index < last && (
          <button
            type="button"
            onClick={() => go(index + 1)}
            data-next
            className="inline-flex h-11 items-center gap-2 bg-accent px-5 font-display text-[13px] font-semibold tracking-[0.08em] text-ink hover:bg-ink-100"
          >
            NEXT <ChevronRightIcon size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
