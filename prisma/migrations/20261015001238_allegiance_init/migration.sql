-- CreateTable
CREATE TABLE "allegiance_players" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "allegiance_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allegiance_sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allegiance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allegiance_nations" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "leader" TEXT NOT NULL,
    "ideology" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "homeName" TEXT NOT NULL,
    "homeLat" DOUBLE PRECISION NOT NULL,
    "homeLon" DOUBLE PRECISION NOT NULL,
    "foundedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "save" JSONB,
    "saveVersion" INTEGER,
    "savedAt" TIMESTAMP(3),

    CONSTRAINT "allegiance_nations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allegiance_territories" (
    "regionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "pop" DOUBLE PRECISION NOT NULL,
    "nationId" TEXT,
    "aiGovernor" TEXT NOT NULL,
    "gov" TEXT NOT NULL,
    "army" INTEGER NOT NULL DEFAULT 0,
    "support" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "takenAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "allegiance_territories_pkey" PRIMARY KEY ("regionId")
);

-- CreateTable
CREATE TABLE "allegiance_events" (
    "id" SERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "regionId" TEXT,
    "nationId" TEXT,

    CONSTRAINT "allegiance_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "allegiance_players_email_key" ON "allegiance_players"("email");

-- CreateIndex
CREATE UNIQUE INDEX "allegiance_sessions_tokenHash_key" ON "allegiance_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "allegiance_sessions_playerId_idx" ON "allegiance_sessions"("playerId");

-- CreateIndex
CREATE INDEX "allegiance_nations_playerId_active_idx" ON "allegiance_nations"("playerId", "active");

-- CreateIndex
CREATE INDEX "allegiance_territories_updatedAt_idx" ON "allegiance_territories"("updatedAt");

-- CreateIndex
CREATE INDEX "allegiance_territories_nationId_idx" ON "allegiance_territories"("nationId");

-- CreateIndex
CREATE INDEX "allegiance_events_at_idx" ON "allegiance_events"("at");

-- AddForeignKey
ALTER TABLE "allegiance_sessions" ADD CONSTRAINT "allegiance_sessions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "allegiance_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allegiance_nations" ADD CONSTRAINT "allegiance_nations_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "allegiance_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allegiance_territories" ADD CONSTRAINT "allegiance_territories_nationId_fkey" FOREIGN KEY ("nationId") REFERENCES "allegiance_nations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
