"use client";

import { resetCourse, useCourseProgress } from "@/lib/courses/progress";

/** "3 / 6 LESSONS DONE" plus a reset link, for the course page. */
export function CourseProgressBar({ course, lessons }: { course: string; lessons: string[] }) {
  const { done } = useCourseProgress();
  const n = lessons.filter((l) => done[`${course}/${l}`]).length;
  return (
    <div className="flex flex-col gap-2" data-course-progress={n}>
      <div className="flex items-center justify-between text-[11px] tracking-[0.12em] text-ink-400">
        <span>
          {n} / {lessons.length} LESSONS DONE
        </span>
        {n > 0 && (
          <button type="button" onClick={() => resetCourse(course)} className="text-ink-500 hover:text-accent">
            RESET PROGRESS
          </button>
        )}
      </div>
      <div className="flex gap-1">
        {lessons.map((l) => (
          <span key={l} className={`h-1.5 flex-1 ${done[`${course}/${l}`] ? "bg-accent" : "bg-line/14"}`} />
        ))}
      </div>
    </div>
  );
}

/** A check mark on a lesson card once it is finished in this browser. */
export function LessonDoneMark({ id }: { id: string }) {
  const done = useCourseProgress().done[id];
  return done ? (
    <span className="text-[10px] tracking-[0.14em] text-emerald-300" data-done>
      ✓ DONE
    </span>
  ) : null;
}
