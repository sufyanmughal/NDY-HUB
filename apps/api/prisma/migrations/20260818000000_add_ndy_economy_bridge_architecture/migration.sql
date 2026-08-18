-- NDY Economy: Reward Engine + Bridge architecture, per the client's full
-- "EARN -> CONVERT -> USE -> BUILD -> UPGRADE" specification, built as
-- real but genuinely unactivated infrastructure. RewardRule and
-- ConversionPolicy both default enabled=false; no real money moves as a
-- result of this migration. Purely additive: two new columns and a new
-- enum on the existing NdybitsLedgerEntry table, five new tables.

-- CreateEnum
CREATE TYPE "NdybitsRiskFlag" AS ENUM ('NONE', 'FLAGGED_VELOCITY', 'FLAGGED_DUPLICATE', 'FLAGGED_MANUAL_REVIEW');

-- AlterTable
ALTER TABLE "NdybitsLedgerEntry" ADD COLUMN "campaignId" TEXT;
ALTER TABLE "NdybitsLedgerEntry" ADD COLUMN "riskFlag" "NdybitsRiskFlag" NOT NULL DEFAULT 'NONE';
ALTER TABLE "NdybitsLedgerEntry" ADD COLUMN "redeemedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "NdybitsLedgerEntry_campaignId_idx" ON "NdybitsLedgerEntry"("campaignId");

-- CreateTable
CREATE TABLE "RewardRule" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "maxPerUserPerDay" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RewardRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NdyEconomyEventLog" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportedByClientId" TEXT,
    "sourceEventId" TEXT NOT NULL,
    "denied" BOOLEAN NOT NULL DEFAULT false,
    "denyReason" TEXT,
    "ledgerEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NdyEconomyEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateEnum
CREATE TYPE "BridgeRequestStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'INELIGIBLE', 'COOLING_OFF', 'APPROVED', 'EXECUTED', 'REJECTED');

-- CreateTable
CREATE TABLE "BridgeRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "sourceAmount" DECIMAL(28,8) NOT NULL,
    "quotedRate" DECIMAL(18,8) NOT NULL,
    "status" "BridgeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "eligibilityNote" TEXT,
    "coolingOffUntil" TIMESTAMP(3),
    "bridgeTransactionRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "BridgeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionPolicy" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "minBridgeAmount" DECIMAL(28,8),
    "dailyCapPerUser" DECIMAL(28,8),
    "reserveBalance" DECIMAL(28,8) NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RewardRule_eventKey_key" ON "RewardRule"("eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "NdyEconomyEventLog_sourceEventId_key" ON "NdyEconomyEventLog"("sourceEventId");

-- CreateIndex
CREATE UNIQUE INDEX "NdyEconomyEventLog_ledgerEntryId_key" ON "NdyEconomyEventLog"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "NdyEconomyEventLog_userId_createdAt_idx" ON "NdyEconomyEventLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NdyEconomyEventLog_eventKey_idx" ON "NdyEconomyEventLog"("eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "BridgeRequest_bridgeTransactionRef_key" ON "BridgeRequest"("bridgeTransactionRef");

-- CreateIndex
CREATE INDEX "BridgeRequest_userId_status_idx" ON "BridgeRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "BridgeRequest_direction_idx" ON "BridgeRequest"("direction");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionPolicy_direction_key" ON "ConversionPolicy"("direction");

-- AddForeignKey
ALTER TABLE "NdyEconomyEventLog" ADD CONSTRAINT "NdyEconomyEventLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeRequest" ADD CONSTRAINT "BridgeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
