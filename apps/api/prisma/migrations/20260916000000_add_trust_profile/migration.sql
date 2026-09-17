-- Phase 8 (docs/phase8-signature-trust-design.md §3) — NDY Trust, tier
-- half only. Purely additive: a new enum and a new table, no existing
-- column touched. TrustProfile rows don't exist for any user yet — they're
-- created lazily by TrustService the first time a user's trust tier is
-- computed (on identity-verification approval, or on first GET), not
-- backfilled here, since "no row yet" and "UNVERIFIED" mean the same thing
-- and a backfill would just be redundant writes for every existing user.

-- CreateEnum
CREATE TYPE "TrustTier" AS ENUM ('UNVERIFIED', 'BASIC', 'VERIFIED', 'TRUSTED');

-- CreateTable
CREATE TABLE "TrustProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "TrustTier" NOT NULL DEFAULT 'UNVERIFIED',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrustProfile_userId_key" ON "TrustProfile"("userId");

-- AddForeignKey
ALTER TABLE "TrustProfile" ADD CONSTRAINT "TrustProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
