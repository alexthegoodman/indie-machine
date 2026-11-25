// The reader survey: the questions that open the rest of a post. Shared by the gate
// (components/reader/PostRest.tsx), the post page's actions and the Survey view in /insights,
// so no Node or DOM APIs here.
//
// To make it optional, set SURVEY_MODE to "optional" (adds a Skip button); "off" removes it.
// Changing the questions? Bump SURVEY_VERSION, so everyone is asked the new ones once. Removing
// one (commenting it out of QUESTIONS) needs no bump: everything below follows QUESTIONS, and
// its column is left empty on new responses.

export type SurveyMode = "required" | "optional" | "off";
export const SURVEY_MODE: SurveyMode = "off";
export const SURVEY_VERSION = 1;

/** localStorage key holding the version this browser answered (or skipped). */
export const SURVEY_DONE_KEY = "im_survey_done";

export const MAX_DETAIL = 500;

export type Choice = { key: string; label: string };
export type Question = {
  id: "work" | "found";
  label: string;
  choices: Choice[];
  /** Placeholder of the free-text box; always shown under "work", only for "other" under "found". */
  detail: string;
};

export const QUESTIONS: Question[] = [
  // does not apply to all visitors
  // {
  //   id: "work",
  //   label: "What are you working on right now?",
  //   choices: [
  //     { key: "game", label: "A game" },
  //     { key: "desktop", label: "A desktop or native app" },
  //     { key: "web", label: "A web app or SaaS" },
  //     { key: "ai", label: "AI / ML models or agents" },
  //     { key: "graphics", label: "Graphics, engines or GPU code" },
  //     { key: "tools", label: "Dev tools or infrastructure" },
  //     { key: "learning", label: "Learning, no project yet" },
  //     { key: "other", label: "Something else" },
  //   ],
  //   detail: "Tell us more, or what you hoped to find here (optional)",
  // },
  {
    id: "found",
    label: "How did you find Indie Machine?",
    choices: [
      { key: "search", label: "Google or another search engine" },
      { key: "ai", label: "ChatGPT, Claude or another AI assistant" },
      { key: "reddit", label: "Reddit" },
      { key: "hn", label: "Hacker News" },
      { key: "social", label: "X, Bluesky, LinkedIn or Mastodon" },
      { key: "github", label: "GitHub" },
      { key: "launch", label: "Product Hunt or a launch site" },
      { key: "friend", label: "A friend or colleague" },
      { key: "other", label: "Somewhere else" },
    ],
    detail: "Where? (optional)",
  },
];

export function choiceLabel(question: Question["id"], key: string | null): string {
  if (key === null) return "(none)";
  return QUESTIONS.find((q) => q.id === question)?.choices.find((c) => c.key === key)?.label ?? key;
}

export function validChoice(question: Question["id"], key: unknown): key is string {
  return typeof key === "string" && !!QUESTIONS.find((q) => q.id === question)?.choices.some((c) => c.key === key);
}


/** Whether a question is currently asked (commented-out questions are not). */
export function asks(question: Question["id"]): boolean {
  return QUESTIONS.some((q) => q.id === question);
}
