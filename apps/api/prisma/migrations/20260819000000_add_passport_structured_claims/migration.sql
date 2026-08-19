-- Phase 7: Passport structured claims + LEVEL_3 identity verification
-- review flow, per the client's explicit sign-off (Aug 2026 architecture
-- audit answer #10: new dedicated reviewer permission) and the follow-up
-- clarification that NDY HUB owns request/status/approval/audit trail but
-- does NOT store identity document bytes. Purely additive: two new enums,
-- two new tables.

-- CreateEnum
CREATE TYPE "ClaimProvenance" AS ENUM ('SELF_ASSERTED', 'NDY_VERIFIED', 'THIRD_PARTY_CREDENTIAL');

-- CreateEnum
CREATE TYPE "IdentityVerificationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "PassportClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimKey" TEXT NOT NULL,
    "provenance" "ClaimProvenance" NOT NULL,
    "issuer" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassportClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityVerificationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "evidenceNote" TEXT,
    "status" "IdentityVerificationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedByNdyId" TEXT,
    "reviewReason" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityVerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PassportClaim_userId_claimKey_key" ON "PassportClaim"("userId", "claimKey");

-- CreateIndex
CREATE INDEX "IdentityVerificationRequest_status_idx" ON "IdentityVerificationRequest"("status");

-- CreateIndex
CREATE INDEX "IdentityVerificationRequest_userId_idx" ON "IdentityVerificationRequest"("userId");

-- AddForeignKey
ALTER TABLE "PassportClaim" ADD CONSTRAINT "PassportClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityVerificationRequest" ADD CONSTRAINT "IdentityVerificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
