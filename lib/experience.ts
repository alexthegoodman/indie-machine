import type { Post } from "@/lib/posts";

// Art direction for the post page: every post gets its own procedural intro
// (a shader program + palette + parameters) derived from its slug, so a post
// always looks the same on every visit and no two neighbours look alike.

export const PROGRAMS = ["contour", "nebula", "ridgelines", "cells", "interference", "halftone"] as const;
export type ProgramName = (typeof PROGRAMS)[number];

export type Palette = { name: string; accent: string; second: string; deep: string };

export const PALETTES: Palette[] = [
  { name: "cyan", accent: "#4fd8ff", second: "#9d8cff", deep: "#0f2847" },
  { name: "amber", accent: "#ffc857", second: "#ff7a59", deep: "#2b1b07" },
  { name: "lime", accent: "#b8ff5c", second: "#4fd8ff", deep: "#0c2414" },
  { name: "magenta", accent: "#ff6fb5", second: "#ffc857", deep: "#2a0c22" },
  { name: "violet", accent: "#a99bff", second: "#4fd8ff", deep: "#170f3a" },
  { name: "coral", accent: "#ff8a65", second: "#ffd166", deep: "#2b120c" },
  { name: "mint", accent: "#5cffc8", second: "#a99bff", deep: "#082621" },
];

// Palettes each kind of post draws from (indices into PALETTES).
const KIND_PALETTES: Record<Post["kind"], number[]> = {
  dev: [0, 1, 2, 3, 4, 5, 6],
  product: [0, 4, 6, 2, 3],
  game: [1, 3, 5, 2, 4],
};

export type IntroScene = {
  seed: number; // 32-bit FNV-1a of the slug
  program: ProgramName;
  palette: Palette;
  params: [number, number, number, number];
};

export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Small deterministic stream of [0, 1) values from a seed (mulberry32).
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Per-program parameter ranges: [scale, warp/detail, density, speed].
const PARAM_RANGES: Record<ProgramName, [number, number][]> = {
  contour: [[1.4, 2.6], [0.8, 1.8], [10, 18], [0.6, 1.2]],
  nebula: [[1.2, 2.2], [3, 4.5], [0.4, 1], [0.6, 1.2]],
  ridgelines: [[2.5, 5], [26, 40], [0.16, 0.26], [0.6, 1.2]],
  cells: [[2.5, 5], [0.02, 0.05], [0.2, 0.6], [0.6, 1.2]],
  interference: [[18, 36], [2, 4], [3, 4.99], [0.6, 1.2]],
  halftone: [[9, 15], [1.8, 3], [0.3, 0.7], [0.6, 1.2]],
};

export function introScene(post: Pick<Post, "slug" | "kind">): IntroScene {
  const seed = fnv1a(post.slug);
  const next = rng(seed);
  const program = PROGRAMS[Math.floor(next() * PROGRAMS.length)];
  const choices = KIND_PALETTES[post.kind];
  const palette = PALETTES[choices[Math.floor(next() * choices.length)]];
  const params = PARAM_RANGES[program].map(([lo, hi]) => lo + (hi - lo) * next()) as IntroScene["params"];
  return { seed, program, palette, params };
}

// Splits a title into a lead and a tail ("Kiri Review" / "a lightweight
// container runtime") so the tail can be set in a different face.
export function splitTitle(title: string): { lead: string; tail?: string } {
  const m = /^(.{3,}?)(?::\s+|\s+[-–—]\s+)(.+)$/.exec(title);
  return m ? { lead: m[1], tail: m[2] } : { lead: title };
}

// Size step for the display title, by length, so short titles get huge and
// long review titles still fit on a few lines.
// The longest word matters too: it can't wrap, so it has to fit the column.
export function titleScale(title: string): "xl" | "lg" | "md" {
  const lead = splitTitle(title).lead;
  const longest = Math.max(...lead.split(/\s+/).map((w) => w.length));
  if (lead.length <= 22 && longest <= 9) return "xl";
  if (lead.length <= 48 && longest <= 13) return "lg";
  return "md";
}

// Crate / package names from `crate_versions` entries like 'wgpu = "27.0.1"'.
// The keys are free-form groupings ("engine", "os", "tooling"), so only the
// pinned names count.
function crateNames(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    const m = /^\s*([A-Za-z][\w-]*)\s*=\s*"/.exec(value);
    if (m && m[1] !== "rust" && m[1] !== "rustc") out.push(m[1]);
  } else if (Array.isArray(value)) {
    value.forEach((v) => crateNames(v, out));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((v) => crateNames(v, out));
  }
  return out;
}

// Words for the scrolling marquee band under the intro.
export function marqueeWords(post: Post): string[] {
  const words = new Set<string>();
  if (post.series) words.add(post.series);
  words.add(post.kind === "product" ? "Review" : post.kind === "game" ? "Game drop" : "Dev log");
  if (post.product) words.add(post.product.name);
  for (const name of crateNames(post.crate_versions)) words.add(name);
  for (const tag of post.product?.tags ?? []) words.add(tag);
  for (const badge of post.badges ?? []) words.add(badge);
  return [...words].filter((w) => w.length <= 28).slice(0, 10);
}
