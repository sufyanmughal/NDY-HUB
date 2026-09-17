-- NDY Trust — add the numeric score.
--
-- Additive: one column on the existing TrustProfile table. Defaults to 0, so
-- every existing row stays valid and is corrected on its next recompute.
-- See docs/phase8-signature-trust-design.md and TrustService (SCORE_WEIGHTS).

-- AlterTable
ALTER TABLE "TrustProfile" ADD COLUMN "score" INTEGER NOT NULL DEFAULT 0;
