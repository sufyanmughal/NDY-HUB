-- Phase A of the identity-architecture-hardening-plan.md response to the
-- client's Aug 2026 review: refresh token reuse detection. Adds
-- OAuthRefreshToken.familyId (every token descended from one original
-- grant shares this id) and a new SecurityEventType for when reuse is
-- detected. Existing rows are backfilled with familyId = their own id —
-- each becomes a family of one, correct since they were never tracked as
-- part of a rotation chain before this column existed.

-- AlterEnum
ALTER TYPE "SecurityEventType" ADD VALUE 'OAUTH_TOKEN_REUSE_DETECTED';

-- AlterTable: add nullable first so existing rows don't fail NOT NULL,
-- backfill, then enforce NOT NULL — the standard safe sequence for adding
-- a required column to a table with existing data.
ALTER TABLE "OAuthRefreshToken" ADD COLUMN "familyId" TEXT;

UPDATE "OAuthRefreshToken" SET "familyId" = "id" WHERE "familyId" IS NULL;

ALTER TABLE "OAuthRefreshToken" ALTER COLUMN "familyId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "OAuthRefreshToken_familyId_idx" ON "OAuthRefreshToken"("familyId");
