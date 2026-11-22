"use client";

import type { QuizData } from "@/lib/courses/types";
import { saveAnswer, useCourseProgress } from "@/lib/courses/progress";

export function Quiz({ quiz, storeKey }: { quiz: QuizData; storeKey: string }) {
  const chosen = useCourseProgress().answers[storeKey];
  const answered = chosen !== undefined && chosen >= 0; // -1 = cleared by "try again"
  const right = chosen === quiz.answer;

  return (
    <div className="flex flex-col gap-4" data-quiz={storeKey} data-answered={answered || undefined} data-correct={answered ? String(right) : undefined}>
      <p className="font-display text-xl leading-snug text-ink-100 md:text-2xl">{quiz.question}</p>
      <div role="radiogroup" aria-label={quiz.question} className="grid gap-2.5 sm:grid-cols-2">
        {quiz.options.map((opt, i) => {
          const state = !answered ? "idle" : i === quiz.answer ? "right" : i === chosen ? "wrong" : "dim";
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={chosen === i}
              disabled={answered}
              onClick={() => saveAnswer(storeKey, i)}
              className={`flex min-h-12 items-center gap-3 border px-4 py-3 text-left text-sm transition-colors ${
                state === "idle"
                  ? "border-line/28 text-ink-100 hover:border-accent hover:bg-accent/10"
                  : state === "right"
                    ? "border-emerald-400 bg-emerald-400/10 text-ink-100"
                    : state === "wrong"
                      ? "border-rose-400 bg-rose-400/10 text-ink-100"
                      : "border-line/14 text-ink-500"
              }`}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center border border-current text-[11px]">
                {state === "right" ? "✓" : state === "wrong" ? "×" : String.fromCharCode(65 + i)}
              </span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div aria-live="polite" className={`border-l-2 pl-4 text-sm leading-relaxed ${right ? "border-emerald-400" : "border-rose-400"}`}>
          <div className={`mb-1 text-[11px] tracking-[0.14em] ${right ? "text-emerald-300" : "text-rose-300"}`}>
            {right ? "CORRECT" : "NOT QUITE"}
          </div>
          <p className="text-ink-300">{quiz.explain}</p>
          {!right && (
            <button type="button" onClick={() => saveAnswer(storeKey, -1)} className="mt-2 text-[11px] tracking-[0.12em] text-accent hover:text-ink-100">
              TRY AGAIN
            </button>
          )}
        </div>
      )}
    </div>
  );
}
