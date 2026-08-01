-- AlterTable
ALTER TABLE "NdybitsLedgerEntry" ADD COLUMN "sourceEventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "NdybitsLedgerEntry_sourceEventId_key" ON "NdybitsLedgerEntry"("sourceEventId");

-- CreateTable
CREATE TABLE "ProcessedStripeEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedStripeEvent_eventId_key" ON "ProcessedStripeEvent"("eventId");
