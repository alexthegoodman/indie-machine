-- CreateTable
CREATE TABLE "survey_responses" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "work" TEXT NOT NULL,
    "workDetail" TEXT,
    "found" TEXT NOT NULL,
    "foundDetail" TEXT,
    "source" TEXT NOT NULL,
    "utmSource" TEXT,
    "entryPath" TEXT NOT NULL,
    "country" TEXT,
    "device" TEXT NOT NULL,
    "lang" TEXT,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_visitorId_version_key" ON "survey_responses"("visitorId", "version");

-- CreateIndex
CREATE INDEX "survey_responses_at_idx" ON "survey_responses"("at");
