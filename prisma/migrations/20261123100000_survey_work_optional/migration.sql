-- The "work" question can be left out of the survey (lib/survey.ts), so its answer is optional.
ALTER TABLE "survey_responses" ALTER COLUMN "work" DROP NOT NULL;
