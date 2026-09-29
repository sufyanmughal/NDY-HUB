-- NDY Signature — explicit attestation status + audited retry trail.
--
-- Additive. Implements the client's instruction that a signature must never be
-- PRESENTED as cryptographically verified until the proof exists and has been
-- validated, and that a failed proof has a recoverable, audited path.
--
-- Existing rows default to PENDING, which is the honest reading: they were
-- recorded before proofs were validated, so they are not asserted to be verified.

-- CreateEnum
CREATE TYPE "SignatureAttestationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- AlterTable
ALTER TABLE "Signature" ADD COLUMN "attestationStatus" "SignatureAttestationStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Signature" ADD COLUMN "attestationAttempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Signature" ADD COLUMN "attestationLastError" TEXT;

-- AlterTable
ALTER TABLE "Signature" ADD COLUMN "attestedAt" TIMESTAMP(3);
