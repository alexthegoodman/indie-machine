"use client";

import { useSyncExternalStore } from "react";

// Per-browser course progress: finished lessons, the last slide seen and quiz answers. Lives
// in localStorage only, and every access is guarded so blocked storage just starts empty.

export type CourseProgress = {
  done: Record<string, true>; // "course/lesson"
  slide: Record<string, number>; // "course/lesson" -> last slide index
  answers: Record<string, number>; // "course/lesson/slide" -> chosen option
};

const KEY = "im-courses-v1";
const EMPTY: CourseProgress = { done: {}, slide: {}, answers: {} };

let state: CourseProgress = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    state = EMPTY;
  }
}

function commit(next: CourseProgress) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: keep the in-memory copy for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    loaded = false;
    load();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCourseProgress(): CourseProgress {
  return useSyncExternalStore(
    subscribe,
    () => (load(), state),
    () => EMPTY,
  );
}

export function markDone(key: string) {
  load();
  if (!state.done[key]) commit({ ...state, done: { ...state.done, [key]: true } });
}

export function saveSlide(key: string, index: number) {
  load();
  if (state.slide[key] !== index) commit({ ...state, slide: { ...state.slide, [key]: index } });
}

export function saveAnswer(key: string, choice: number) {
  load();
  commit({ ...state, answers: { ...state.answers, [key]: choice } });
}

export function resetCourse(course: string) {
  load();
  const keep = <T,>(r: Record<string, T>) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith(`${course}/`)));
  commit({ done: keep(state.done), slide: keep(state.slide), answers: keep(state.answers) });
}
