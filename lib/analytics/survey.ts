// Reports for the Survey view in /insights: answers from survey_responses, plus how many
// visitors the gate was shown to (survey_view events). Only the date range applies; the
// dashboard's event filters don't map onto responses.
import { Prisma } from "../../generated/prisma/client";
import { ts, type Query } from "./query";
import { run } from "./reports";

const sql = Prisma.sql;

export type SurveyTotals = {
  responses: number;
  withDetail: number;
  /** Distinct visitors the survey was shown to (from survey_view events). */
  shown: number;
  /** Of those, how many answered (survey_submit), and skipped (survey_skip). */
  answered: number;
  skipped: number;
};

export type Count = { key: string | null; n: number };
export type Pair = { a: string | null; b: string | null; n: number };
export type SurveyRow = {
  id: string;
  at: Date;
  visitorId: string;
  sessionId: string;
  path: string;
  work: string | null;
  workDetail: string | null;
  found: string;
  foundDetail: string | null;
  source: string;
  utmSource: string | null;
  country: string | null;
  device: string;
};

const range = (q: Query) => sql`r."at" >= ${ts(q.from)} AND r."at" < ${ts(q.to)}`;
const eventRange = (q: Query) => sql`e."at" >= ${ts(q.from)} AND e."at" < ${ts(q.to)}`;

export async function surveyTotals(q: Query): Promise<SurveyTotals> {
  const [r] = await run<SurveyTotals>(sql`
    SELECT
      (SELECT count(*) FROM survey_responses r WHERE ${range(q)})::int AS "responses",
      (SELECT count(*) FROM survey_responses r WHERE ${range(q)}
         AND (COALESCE(r."workDetail", '') <> '' OR COALESCE(r."foundDetail", '') <> ''))::int AS "withDetail",
      (SELECT count(DISTINCT e."visitorId") FROM analytics_events e WHERE ${eventRange(q)} AND e.name = 'survey_view')::int AS "shown",
      (SELECT count(DISTINCT e."visitorId") FROM analytics_events e WHERE ${eventRange(q)} AND e.name = 'survey_view'
         AND EXISTS (SELECT 1 FROM analytics_events d WHERE d."visitorId" = e."visitorId" AND d.name = 'survey_submit'))::int AS "answered",
      (SELECT count(DISTINCT e."visitorId") FROM analytics_events e WHERE ${eventRange(q)} AND e.name = 'survey_skip')::int AS "skipped"
  `);
  return r;
}

type Column = "work" | "found" | "source" | "path" | "country" | "device";
const COLUMN: Record<Column, Prisma.Sql> = {
  work: Prisma.raw(`r."work"`),
  found: Prisma.raw(`r."found"`),
  source: Prisma.raw(`r."source"`),
  path: Prisma.raw(`r."path"`),
  country: Prisma.raw(`r."country"`),
  device: Prisma.raw(`r."device"`),
};

export async function surveyCounts(q: Query, col: Column, limit = 50): Promise<Count[]> {
  return run<Count>(sql`
    SELECT ${COLUMN[col]} AS "key", count(*)::int AS "n"
    FROM survey_responses r WHERE ${range(q)}
    GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT ${limit}
  `);
}

export async function surveyPairs(q: Query, a: Column, b: Column): Promise<Pair[]> {
  return run<Pair>(sql`
    SELECT ${COLUMN[a]} AS "a", ${COLUMN[b]} AS "b", count(*)::int AS "n"
    FROM survey_responses r WHERE ${range(q)}
    GROUP BY 1, 2
  `);
}

export async function surveyResponses(q: Query, opts: { limit: number; detailOnly?: boolean }): Promise<SurveyRow[]> {
  const detail = opts.detailOnly ? sql`AND (COALESCE(r."workDetail", '') <> '' OR COALESCE(r."foundDetail", '') <> '')` : sql``;
  return run<SurveyRow>(sql`
    SELECT r."id", r."at", r."visitorId", r."sessionId", r."path", r."work", r."workDetail", r."found", r."foundDetail",
           r."source", r."utmSource", r."country", r."device"
    FROM survey_responses r WHERE ${range(q)} ${detail}
    ORDER BY r."at" DESC LIMIT ${opts.limit}
  `);
}

/** Every response in the range, oldest first, for the CSV export. */
export async function surveyExport(q: Query): Promise<SurveyRow[]> {
  return run<SurveyRow>(sql`
    SELECT r.* FROM survey_responses r WHERE ${range(q)} ORDER BY r."at"
  `);
}
