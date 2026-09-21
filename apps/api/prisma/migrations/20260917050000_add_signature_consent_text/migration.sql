-- NDY Signature — store the exact consent wording shown at signing time.
--
-- Additive: one nullable column. Existing signature rows keep NULL, which is
-- accurate — they were recorded before a consent statement was captured.
-- See SignatureService.SIGNATURE_CONSENT_TEXT for why the wording is
-- server-owned rather than supplied by the caller.

-- AlterTable
ALTER TABLE "Signature" ADD COLUMN "consentText" TEXT;
