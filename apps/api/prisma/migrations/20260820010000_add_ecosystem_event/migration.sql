-- Phase B of identity-architecture-hardening-plan.md: a generic,
-- reusable ecosystem event log ("quiz.completed", "booking.created",
-- "identity.updated", etc.), separate from NdyEconomyEventLog (which
-- stays reward-specific). Purely additive.

-- CreateTable
CREATE TABLE "EcosystemEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportedByClientId" TEXT,
    "payload" JSONB,
    "sourceEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcosystemEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EcosystemEvent_sourceEventId_key" ON "EcosystemEvent"("sourceEventId");

-- CreateIndex
CREATE INDEX "EcosystemEvent_userId_eventType_createdAt_idx" ON "EcosystemEvent"("userId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "EcosystemEvent_eventType_idx" ON "EcosystemEvent"("eventType");

-- AddForeignKey
ALTER TABLE "EcosystemEvent" ADD CONSTRAINT "EcosystemEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
