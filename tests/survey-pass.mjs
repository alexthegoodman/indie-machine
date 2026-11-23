// For suites that read whole posts: past the reader survey (tests/survey.feature). The server
// only sends the rest of a post to a visitor with a stored response, so this stores one for the
// visitor id and marks the browser as answered. Without DATABASE_URL (or with the database
// down) the post page opens posts anyway, so nothing is stored.
import pg from "pg";

export const SURVEY_PASS_VISITOR = "bddtest-survey-pass";

try { process.loadEnvFile(".env"); } catch { /* environment provides DATABASE_URL, or there's none */ }

/** Store a survey response for each visitor id (kept until tests/survey.test.mjs clears bddtest rows). */
export async function storeSurveyPass(...visitors) {
  if (!process.env.DATABASE_URL) return;
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    for (const v of visitors.length ? visitors : [SURVEY_PASS_VISITOR]) {
      await client.query(
        `INSERT INTO survey_responses (id, version, "visitorId", "sessionId", path, work, found, source, "entryPath", device)
         VALUES ($1, 1, $2, 'bddtest-session', '/', 'other', 'other', 'direct', '/', 'desktop')
         ON CONFLICT ("visitorId", version) DO NOTHING`,
        [`${v}-pass`, v],
      );
    }
  } catch (e) {
    console.warn(`  (survey pass not stored: ${e.message})`);
  } finally {
    await client.end().catch(() => {});
  }
}

/** Mark the context's browser as answered; `visitor` also pins its analytics visitor id. */
export async function allowPosts(context, visitor = SURVEY_PASS_VISITOR) {
  await context.addInitScript((v) => {
    try {
      localStorage.setItem("im_survey_done", "1");
      if (v) localStorage.setItem("im_vid", v);
    } catch {
      // about:blank has no storage
    }
  }, visitor);
}
