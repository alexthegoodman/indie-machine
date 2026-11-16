-- CreateTable
CREATE TABLE "visitor_launches" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT,
    "imageUrl" TEXT,
    "iconUrl" TEXT,
    "ipHash" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitor_launches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visitor_launches_key_key" ON "visitor_launches"("key");

-- CreateIndex
CREATE INDEX "visitor_launches_createdAt_idx" ON "visitor_launches"("createdAt");

-- CreateIndex
CREATE INDEX "visitor_launches_ipHash_createdAt_idx" ON "visitor_launches"("ipHash", "createdAt");
