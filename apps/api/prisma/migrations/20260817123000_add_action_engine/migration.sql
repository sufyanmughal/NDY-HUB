-- Phase 3 of the post-vision-documents architecture plan: Action Engine
-- v1, built exactly per docs/action-engine-design.md. Purely additive --
-- three new tables, no changes to any existing one.

-- CreateEnum
CREATE TYPE "ActionRiskTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ActionApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ActionExecutionStatus" AS ENUM ('REJECTED', 'PENDING_APPROVAL', 'EXECUTED', 'DENIED');

-- CreateTable
CREATE TABLE "ActionDefinition" (
    "id" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "riskTier" "ActionRiskTier" NOT NULL,
    "requiredScopes" TEXT[],
    "reversible" BOOLEAN NOT NULL DEFAULT false,
    "reverseActionKey" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionLogEntry" (
    "id" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "requestedByNdyId" TEXT NOT NULL,
    "origin" JSONB NOT NULL,
    "params" JSONB NOT NULL,
    "status" "ActionExecutionStatus" NOT NULL,
    "riskTier" "ActionRiskTier" NOT NULL,
    "reason" TEXT,
    "resultSummary" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionApproval" (
    "id" TEXT NOT NULL,
    "actionLogId" TEXT NOT NULL,
    "riskTier" "ActionRiskTier" NOT NULL,
    "status" "ActionApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requiresStrongAuth" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActionDefinition_actionKey_key" ON "ActionDefinition"("actionKey");

-- CreateIndex
CREATE INDEX "ActionDefinition_domain_idx" ON "ActionDefinition"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "ActionLogEntry_idempotencyKey_key" ON "ActionLogEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ActionLogEntry_workspaceId_createdAt_idx" ON "ActionLogEntry"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "ActionLogEntry_requestedByUserId_idx" ON "ActionLogEntry"("requestedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ActionApproval_actionLogId_key" ON "ActionApproval"("actionLogId");

-- CreateIndex
CREATE INDEX "ActionApproval_status_idx" ON "ActionApproval"("status");

-- AddForeignKey
ALTER TABLE "ActionApproval" ADD CONSTRAINT "ActionApproval_actionLogId_fkey" FOREIGN KEY ("actionLogId") REFERENCES "ActionLogEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
