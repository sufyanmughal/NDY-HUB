-- NDYQR — scoped service credentials.
--
-- Lets a registered OAuthClient create codes on its own behalf, with no
-- logged-in user (scope ndyqr:create), so other NDY products consume NDYQR
-- centrally instead of each building their own QR implementation.
--
-- Additive and non-destructive: ownerId becomes nullable (every existing row
-- keeps its owner), and a service-owner column + indexes are added. A CHECK
-- constraint guarantees exactly one owner is always set, so the invariant is
-- enforced by the database rather than only by application code.

-- AlterTable
ALTER TABLE "NdyQrCode" ADD COLUMN "oauthClientId" TEXT;

-- AlterTable
ALTER TABLE "NdyQrCode" ALTER COLUMN "ownerId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "NdyQrCode_oauthClientId_createdAt_idx" ON "NdyQrCode"("oauthClientId", "createdAt");

-- Exactly one owner: a member OR a service client, never both, never neither.
ALTER TABLE "NdyQrCode" ADD CONSTRAINT "NdyQrCode_owner_exactly_one_check" CHECK ((("ownerId" IS NOT NULL)::int + ("oauthClientId" IS NOT NULL)::int) = 1);
