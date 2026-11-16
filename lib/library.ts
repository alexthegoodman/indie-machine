"use client";

import { useSyncExternalStore } from "react";

// Per-browser reading state: saved posts, history and how far each post was
// read. Lives in localStorage only - nothing is sent anywhere - and every
// access is guarded so private windows and blocked storage just start empty.

export type LibraryState = {
  saved: string[];
  // Most recent first.
  history: string[];
  // 0-100 per slug.
  progress: Record<string, number>;
  // Slug whose "continue reading" dock the reader closed.
  dismissed?: string;
  railCompact?: boolean;
  // Visitor Launches bar folded down to its one-line header.
  launchesHidden?: boolean;
  autoAdvance?: boolean;
};

const KEY = "im-library-v1";
const HISTORY_LIMIT = 60;
const EMPTY: LibraryState = { saved: [], history: [], progress: {}, autoAdvance: true };

let state: LibraryState = EMPTY;
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

function commit(next: LibraryState) {
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

function snapshot() {
  load();
  return state;
}

// Server render and the first client render both see EMPTY, so library-driven
// UI (saved marks, progress bars, the dock) appears right after hydration.
export function useLibrary(): LibraryState {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

export function toggleSaved(slug: string): boolean {
  load();
  const has = state.saved.includes(slug);
  commit({ ...state, saved: has ? state.saved.filter((s) => s !== slug) : [slug, ...state.saved] });
  return !has;
}

export function recordVisit(slug: string) {
  load();
  const history = [slug, ...state.history.filter((s) => s !== slug)].slice(0, HISTORY_LIMIT);
  const kept = new Set(history);
  const progress: Record<string, number> = {};
  for (const [k, v] of Object.entries(state.progress)) if (kept.has(k)) progress[k] = v;
  commit({ ...state, history, progress, dismissed: state.dismissed === slug ? undefined : state.dismissed });
}

export function recordProgress(slug: string, pct: number) {
  load();
  const value = Math.max(0, Math.min(100, Math.round(pct)));
  // Only ever move forward, and skip tiny changes to keep writes cheap.
  const prev = state.progress[slug] ?? 0;
  if (value <= prev || (value - prev < 2 && value < 100)) return;
  commit({ ...state, progress: { ...state.progress, [slug]: value } });
}

export function dismissDock(slug: string) {
  load();
  commit({ ...state, dismissed: slug });
}

export function clearHistory() {
  load();
  commit({ ...state, history: [], progress: {} });
}

export function setPreference(key: "railCompact" | "autoAdvance" | "launchesHidden", value: boolean) {
  load();
  commit({ ...state, [key]: value });
}
