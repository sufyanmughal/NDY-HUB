-- Adds rpId to Passkey and WebauthnChallenge so passkeys are scoped to
-- the specific origin (ndyhub.com, ndymail.com, future products) they
-- were registered for — see Passkey.rpId's schema doc comment for why
-- this is required by the WebAuthn spec itself, not a product choice.
--
-- Nullable-then-backfill-then-NOT-NULL, not a single NOT NULL ADD COLUMN:
-- existing Passkey/WebauthnChallenge rows predate this column and must be
-- backfilled to NDYHUB's own hostname (every one of them was, by
-- construction, an NDYHUB passkey) before the NOT NULL constraint can be
-- added without failing on existing data.

ALTER TABLE "Passkey" ADD COLUMN "rpId" TEXT;
UPDATE "Passkey" SET "rpId" = 'ndyhub.com' WHERE "rpId" IS NULL;
ALTER TABLE "Passkey" ALTER COLUMN "rpId" SET NOT NULL;
CREATE INDEX "Passkey_rpId_idx" ON "Passkey"("rpId");

ALTER TABLE "WebauthnChallenge" ADD COLUMN "rpId" TEXT;
UPDATE "WebauthnChallenge" SET "rpId" = 'ndyhub.com' WHERE "rpId" IS NULL;
ALTER TABLE "WebauthnChallenge" ALTER COLUMN "rpId" SET NOT NULL;
