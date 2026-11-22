import type { ReactNode } from "react";

export type LessonKind = "concept" | "math" | "code";

export interface QuizData {
  question: string;
  options: string[];
  answer: number; // index into options
  explain: string;
}

export interface Slide {
  id: string; // unique within the lesson, used for #hash links
  title: string;
  body?: ReactNode;
  quiz?: QuizData;
}

export interface Lesson {
  slug: string;
  title: string;
  kind: LessonKind;
  minutes: number;
  summary: string; // meta description and card blurb
  takeaways: string[];
  slides: Slide[];
}

export interface Course {
  slug: string;
  title: string;
  tagline: string;
  description: string; // meta description
  intro: ReactNode;
  level: string;
  prerequisites: string[];
  teaches: string[];
  updated: string; // YYYY-MM-DD
  lessons: Lesson[];
}
