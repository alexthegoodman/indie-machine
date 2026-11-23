"use server";

// The rest of a post, after its intro, only goes to readers who answered the survey
// (lib/survey.ts). The page sends the intro; these return the rendered remainder.
import { headers } from "next/headers";
import { compilePost } from "@/lib/post-content";
import { getAllPosts } from "@/lib/posts";
import { SURVEY_MODE } from "@/lib/survey";
import { hasAnswered, saveAnswers, validVisitor, type SurveyAnswers } from "@/lib/survey-store";

type Rest = { ok: true; rest: React.ReactNode } | { ok: false; error?: string };

async function rest(slug: string): Promise<Rest> {
  const post = getAllPosts().find((p) => p.slug === slug);
  if (!post) return { ok: false, error: "That post no longer exists." };
  return { ok: true, rest: await compilePost(post, "rest") };
}

/** For a visitor who answered on an earlier visit. `skipped` only counts while the survey is optional. */
export async function readRest(slug: string, visitorId: string, skipped = false): Promise<Rest> {
  if (SURVEY_MODE !== "required" && skipped) return rest(slug);
  if (!validVisitor(visitorId)) return { ok: false };
  try {
    if (!(await hasAnswered(visitorId))) return { ok: false };
  } catch (e) {
    // The database being down shouldn't lock out readers who already answered.
    console.error("[survey] lookup failed", e);
  }
  return rest(slug);
}

/** Store the answers, then send the rest of the post. */
export async function answerSurvey(slug: string, answers: SurveyAnswers): Promise<Rest> {
  try {
    const error = await saveAnswers(answers, await headers());
    if (error) return { ok: false, error };
  } catch (e) {
    // Lost answers are better than a reader stuck at the gate after doing their part.
    console.error("[survey] save failed", e);
  }
  return rest(slug);
}
