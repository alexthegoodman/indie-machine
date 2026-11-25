"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { markDone, readProgress, saveSlide, useCourseProgress } from "@/lib/courses/progress";

export interface PlayerSlide {
  id: string;
  title: string;
  quizAnswer?: number; // set on quiz steps
  body: ReactNode;
}

// The line (as a fraction of the viewport height) a step's top must cross to become current.
const FOCUS_LINE = 0.42;

// A lesson as one vertical sequence of steps. Everything is in the server HTML and readable top
// to bottom; once hydrated, the step under the focus line is current and the others dim (hover
// or focus restores them). The sticky rail jumps between steps, the hash (#s-<id>) deep-links
// one, and reaching the last step marks the lesson done.
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
  const [ready, setReady] = useState(false);
  const [resume, setResume] = useState<number | null>(null);
  const last = slides.length - 1;

  const scrollTo = useCallback(
    (i: number) => {
      const s = slides[Math.max(0, Math.min(last, i))];
      document.getElementById(`s-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#s-${s.id}`);
    },
    [last, slides],
  );

  // Without a hash, offer to jump back to where this browser left off (no surprise scrolling).
  useEffect(() => {
    setReady(true);
    const saved = readProgress().slide[key]; // not `progress`: on this render it is still the server snapshot
    if (!window.location.hash && saved && saved > 0 && saved <= last) setResume(saved);
    // Only on mount: later progress changes come from this player itself.
  }, []);

  // Track the current step from the scroll position.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight * FOCUS_LINE;
      let i = 0;
      slides.forEach((s, j) => {
        const el = document.getElementById(`s-${s.id}`);
        if (el && el.getBoundingClientRect().top <= line) i = j;
      });
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      setIndex(atBottom ? last : i);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [last, slides]);

  useEffect(() => {
    if (!ready) return;
    saveSlide(key, index);
    if (index > 0) setResume(null);
    if (index === last) markDone(key);
  }, [index, last, key, ready]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key === "ArrowRight") scrollTo(index + 1);
      else if (e.key === "ArrowLeft") scrollTo(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scrollTo, index]);

  const quizzes = slides.filter((s) => s.quizAnswer !== undefined);
  const correct = quizzes.filter((s) => progress.answers[`${key}/${s.id}`] === s.quizAnswer).length;

  return (
    <div data-lesson-player={key} data-index={index}>
      <div className="sticky top-16 z-30 -mx-1 mb-6 border-b border-line/14 bg-ink/94 px-1 pt-3 pb-1 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4 text-[11px] tracking-[0.12em] text-ink-400">
          <span data-slide-count className="truncate">
            STEP {index + 1} / {slides.length}
            <span className="hidden text-ink-500 sm:inline"> · {slides[index].title}</span>
          </span>
          {quizzes.length > 0 && (
            <span className="shrink-0">
              QUIZ {correct} / {quizzes.length}
            </span>
          )}
        </div>
        <nav aria-label="Steps" className="flex gap-1">
          {slides.map((s, i) => (
            <a
              key={s.id}
              href={`#s-${s.id}`}
              onClick={(e) => {
                e.preventDefault();
                scrollTo(i);
              }}
              aria-label={`Step ${i + 1}: ${s.title}`}
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
            </a>
          ))}
        </nav>
      </div>

      {resume !== null && (
        <button
          type="button"
          onClick={() => scrollTo(resume)}
          data-resume={resume}
          className="mb-6 inline-flex h-10 items-center border border-accent/50 px-4 text-xs tracking-[0.1em] text-accent hover:border-accent"
        >
          CONTINUE AT STEP {resume + 1}: {slides[resume].title.toUpperCase()}
        </button>
      )}

      <div className="flex flex-col gap-8">
        {slides.map((s, i) => (
          <section
            key={s.id}
            id={`s-${s.id}`}
            aria-labelledby={`h-${s.id}`}
            aria-current={ready && i === index ? "step" : undefined}
            className={`course-slide scroll-mt-32 border p-5 transition-[opacity,border-color] duration-300 motion-reduce:transition-none sm:p-8 ${
              ready && i !== index ? "border-line/14 opacity-40 hover:opacity-90 focus-within:opacity-100" : "border-line/22 bg-panel/20"
            }`}
            data-slide={s.id}
          >
            <div className={`mb-3 text-[11px] tracking-[0.16em] ${s.quizAnswer !== undefined ? "text-badge" : "text-accent"}`}>
              {String(i + 1).padStart(2, "0")} / {s.quizAnswer !== undefined ? "CHECK YOURSELF" : ""}
            </div>
            <h2 id={`h-${s.id}`} className="mb-5 font-display text-2xl leading-tight font-bold text-ink-100 md:text-3xl">
              {s.title}
            </h2>
            {s.body}
          </section>
        ))}
        <div>{finale}</div>
      </div>
    </div>
  );
}
