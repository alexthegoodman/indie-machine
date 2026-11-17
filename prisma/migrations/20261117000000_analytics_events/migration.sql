-- CreateTable
CREATE TABLE "analytics_events" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "entryPath" TEXT NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "device" TEXT NOT NULL,
    "browser" TEXT,
    "os" TEXT,
    "screenW" INTEGER,
    "lang" TEXT,
    "props" JSONB,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_at_idx" ON "analytics_events"("at");

-- CreateIndex
CREATE INDEX "analytics_events_name_at_idx" ON "analytics_events"("name", "at");

-- CreateIndex
CREATE INDEX "analytics_events_sessionId_at_idx" ON "analytics_events"("sessionId", "at");

-- CreateIndex
CREATE INDEX "analytics_events_visitorId_at_idx" ON "analytics_events"("visitorId", "at");

-- CreateIndex
CREATE INDEX "analytics_events_path_at_idx" ON "analytics_events"("path", "at");

