// Server side of the reader survey: validate and store answers in survey_responses, and look up
// whether a visitor has answered. Used by the post page's actions (app/posts/[slug]/actions.ts).
import { userAgent } from "next/server";
import { db } from "@/lib/allegiance/db";
import { ID, type WireContext } from "@/lib/analytics/events";
import { device, path, str } from "@/lib/analytics/ingest";
import { asks, MAX_DETAIL, QUESTIONS, SURVEY_VERSION, validChoice } from "@/lib/survey";

export type SurveyAnswers = {
  v: string;
  s: string;
  ctx: Partial<WireContext>;
  path: string;
  version: number;
  work?: string;
  workDetail?: string;
  found: string;
  foundDetail?: string;
};

/** Per server instance: a visitor answering more than this in a window is a script. */
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX = 5;
const recent = new Map<string, number[]>();

function rateLimited(key: string, now: number): boolean {
  if (recent.size > 20_000) recent.clear();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  recent.set(key, hits);
  return hits.length > RATE_MAX;
}

export const validVisitor = (v: unknown): v is string => typeof v === "string" && ID.test(v);

/**
 * Store a visitor's answers (answering again replaces them). Returns an error message for the
 * reader, or null when stored. Bots are told it worked and nothing is written.
 */
export async function saveAnswers(a: SurveyAnswers, headers: Headers): Promise<string | null> {
  if (!a || typeof a !== "object") return "Something went wrong. Reload the page.";
  if (!validVisitor(a.v) || !validVisitor(a.s)) return "Something went wrong. Reload the page.";
  if (a.version !== SURVEY_VERSION) return "That survey has changed. Reload the page.";
  if (!QUESTIONS.every((q) => validChoice(q.id, a[q.id]))) {
    return QUESTIONS.length > 1 ? "Pick an answer for each question." : "Pick an answer.";
  }
  const p = path(a.path);
  if (!p) return "Something went wrong. Reload the page.";

  const ua = userAgent({ headers });
  if (ua.isBot) return null;
  if (rateLimited(a.v, Date.now())) return "Too many tries. Wait a few minutes.";

  const ctx = (a.ctx && typeof a.ctx === "object" ? a.ctx : {}) as Record<string, unknown>;
  const answers = {
    sessionId: a.s,
    path: p,
    // A question that isn't asked any more leaves its columns empty.
    work: asks("work") ? a.work! : null,
    workDetail: asks("work") ? (str(a.workDetail, MAX_DETAIL) ?? null) : null,
    found: a.found,
    // Free text under "found" only means something next to "other".
    foundDetail: a.found === "other" ? (str(a.foundDetail, MAX_DETAIL) ?? null) : null,
    source: str(ctx.source)?.toLowerCase() ?? "direct",
    utmSource: str(ctx.utmSource)?.toLowerCase() ?? null,
    entryPath: path(ctx.entry) ?? p,
    country: str(headers.get("x-vercel-ip-country"), 8) ?? null,
    device: device(ua.device.type),
    lang: str(ctx.lang, 16) ?? null,
  };
  await db().surveyResponse.upsert({
    where: { visitorId_version: { visitorId: a.v, version: SURVEY_VERSION } },
    create: { visitorId: a.v, version: SURVEY_VERSION, ...answers },
    update: { ...answers, at: new Date() },
  });
  return null;
}

export async function hasAnswered(visitorId: string): Promise<boolean> {
  const row = await db().surveyResponse.findUnique({
    where: { visitorId_version: { visitorId, version: SURVEY_VERSION } },
    select: { id: true },
  });
  return !!row;
}
