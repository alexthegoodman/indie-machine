"use client";

import { useEffect, useState } from "react";
import { identity, track } from "@/lib/analytics/client";
import { MAX_DETAIL, QUESTIONS, SURVEY_DONE_KEY, SURVEY_MODE, SURVEY_VERSION } from "@/lib/survey";
import { answerSurvey, readRest } from "@/app/posts/[slug]/actions";
import { ARTICLE_CHANGED, POST_REST_PENDING } from "./ReaderTracker";

// Everything in a post after its intro. The page only sends the intro; this asks the survey
// questions (lib/survey.ts) and puts the rest of the article in place once they're answered, or
// right away (one round trip) for a browser that answered before.

type State = { kind: "checking" } | { kind: "survey" } | { kind: "open"; rest: React.ReactNode };

function answeredBefore(): boolean {
  try {
    return localStorage.getItem(SURVEY_DONE_KEY) === String(SURVEY_VERSION);
  } catch {
    return false;
  }
}

function remember(done: boolean) {
  try {
    if (done) localStorage.setItem(SURVEY_DONE_KEY, String(SURVEY_VERSION));
    else localStorage.removeItem(SURVEY_DONE_KEY);
  } catch {
    // storage blocked: they'll be asked again next post
  }
}

const PILL =
  "flex min-h-11 cursor-pointer items-center gap-2.5 border border-line/22 px-3 py-2 text-[13px] leading-snug text-ink-300 hover:border-accent/60 has-[:checked]:border-accent has-[:checked]:bg-accent/12 has-[:checked]:text-ink-100 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent";
const TEXT =
  "mt-2.5 h-11 w-full border border-line/28 bg-ink px-3 text-[13px] text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none";

export function PostRest({ slug }: { slug: string }) {
  const [state, setState] = useState<State>({ kind: "checking" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function open(rest: React.ReactNode) {
    setState({ kind: "open", rest });
  }

  useEffect(() => {
    let live = true;
    if (!answeredBefore()) {
      setState({ kind: "survey" });
      return;
    }
    readRest(slug, identity().v)
      .then((r) => {
        if (!live) return;
        if (r.ok) return open(r.rest);
        // Not on record (another device's answer, or the data was reset): ask again.
        remember(false);
        setState({ kind: "survey" });
      })
      .catch(() => live && setState({ kind: "survey" }));
    return () => {
      live = false;
    };
  }, [slug]);

  useEffect(() => {
    if (state.kind === "survey") track("survey_view", { version: SURVEY_VERSION });
    // The article changed size: reading progress, chapters and scroll effects measure again.
    window.dispatchEvent(new Event(ARTICLE_CHANGED));
  }, [state.kind]);

  if (state.kind === "open") return <>{state.rest}</>;
  if (state.kind === "checking") {
    return <div {...{ [POST_REST_PENDING]: "" }} aria-busy="true" className="min-h-[40vh]" />;
  }

  const ready = QUESTIONS.every((q) => !!answers[q.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    const { v, s, ctx } = identity();
    const props = {
      version: SURVEY_VERSION,
      work: answers.work,
      found: answers.found,
      detail: !!(answers.workDetail?.trim() || answers.foundDetail?.trim()),
    };
    try {
      const r = await answerSurvey(slug, {
        v,
        s,
        ctx,
        path: location.pathname,
        version: SURVEY_VERSION,
        work: answers.work,
        workDetail: answers.workDetail,
        found: answers.found,
        foundDetail: answers.foundDetail,
      });
      track("survey_submit", { ...props, ok: r.ok });
      if (r.ok) {
        remember(true);
        open(r.rest);
      } else setError(r.error ?? "Something went wrong. Try again.");
    } catch {
      track("survey_submit", { ...props, ok: false });
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    track("survey_skip", { version: SURVEY_VERSION });
    const r = await readRest(slug, identity().v, true).catch(() => null);
    if (r?.ok) {
      remember(true);
      open(r.rest);
    }
  }

  return (
    <section aria-labelledby="im-survey-title" data-track-area="Survey" {...{ [POST_REST_PENDING]: "" }} className="relative mt-2">
      {/* the intro fades into the survey */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 h-24 bg-linear-to-b from-transparent to-ink" />
      <form onSubmit={submit} className="border border-accent/40 bg-panel/45 px-4 py-5 sm:px-6 sm:py-6">
        <div className="text-[11px] tracking-[0.14em] text-accent">
          {QUESTIONS.length === 1 ? "ONE QUESTION" : "TWO QUESTIONS"} TO KEEP READING
        </div>
        <p id="im-survey-title" className="mt-2 font-display text-xl font-semibold text-ink-100 sm:text-2xl">
          Help us write for you
        </p>
        <p className="mt-2 max-w-[60ch] text-[13px] leading-relaxed text-ink-400">
          Indie Machine is a small independent blog, and we are looking to learn more about our readers. Answer once and every
          post opens up. No email or account required.
        </p>

        {QUESTIONS.map((q) => (
          <fieldset key={q.id} className="mt-6">
            <legend className="font-display text-base font-medium text-ink-100">{q.label}</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {q.choices.map((c) => (
                <label key={c.key} className={PILL}>
                  <input
                    type="radio"
                    name={`survey-${q.id}`}
                    value={c.key}
                    required
                    checked={answers[q.id] === c.key}
                    onChange={() => setAnswers((a) => ({ ...a, [q.id]: c.key }))}
                    className="size-4 shrink-0 accent-[var(--color-accent)]"
                  />
                  {c.label}
                </label>
              ))}
            </div>
            {(q.id === "work" || answers[q.id] === "other") && (
              <input
                type="text"
                name={`survey-${q.id}-detail`}
                aria-label={q.detail}
                placeholder={q.detail}
                maxLength={MAX_DETAIL}
                value={answers[`${q.id}Detail`] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [`${q.id}Detail`]: e.target.value }))}
                className={TEXT}
              />
            )}
          </fieldset>
        ))}

        {error && (
          <p role="alert" className="mt-5 text-[13px] text-badge">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={!ready || busy}
            className="h-11 cursor-pointer bg-accent px-6 font-display text-xs font-semibold tracking-[0.1em] text-ink hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "SAVING..." : "CONTINUE READING"}
          </button>
          {SURVEY_MODE === "optional" && (
            <button type="button" onClick={skip} className="h-11 cursor-pointer px-2 text-xs tracking-[0.1em] text-ink-400 hover:text-accent">
              SKIP
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
