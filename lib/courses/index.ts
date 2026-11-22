import type { Course, Lesson } from "./types";
import { nGrammerCourse } from "./n-grammer";

export const COURSES: Course[] = [nGrammerCourse];

export const KIND_LABEL: Record<Lesson["kind"], string> = { concept: "CONCEPT", math: "MATH", code: "CODE" };

export function getCourse(slug: string): Course | undefined {
  return COURSES.find((c) => c.slug === slug);
}

export function getLesson(course: string, lesson: string): { course: Course; lesson: Lesson; index: number } | undefined {
  const c = getCourse(course);
  const index = c?.lessons.findIndex((l) => l.slug === lesson) ?? -1;
  return c && index >= 0 ? { course: c, lesson: c.lessons[index], index } : undefined;
}

export const courseMinutes = (c: Course) => c.lessons.reduce((n, l) => n + l.minutes, 0);
export const quizCount = (l: Lesson) => l.slides.filter((s) => s.quiz).length;
