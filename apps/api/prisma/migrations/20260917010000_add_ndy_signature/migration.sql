-- NDY Signature (Phase 8, second half).
--
-- Additive: one new enum, three new tables, and one new value on the
-- existing NotificationCategory enum. No existing table is altered.
-- See docs/phase8-signature-trust-design.md and the schema comments.

-- AlterEnum
ALTER TYPE "NotificationCategory" ADD VALUE 'SIGNATURE';

-- CreateEnum
CREATE TYPE "SignatureRequestStatus" AS ENUM ('PENDING', 'SIGNED', 'DECLINED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "SignatureRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "contentRef" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByNdyId" TEXT NOT NULL,
    "status" "SignatureRequestStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureRequestSigner" (
    "id" TEXT NOT NULL,
    "signatureRequestId" TEXT NOT NULL,
    "userId" TEXT,
    "invitedEmail" TEXT,
    "tokenHash" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignatureRequestSigner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "signatureRequestId" TEXT NOT NULL,
    "signerUserId" TEXT NOT NULL,
    "signerNdyId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignatureRequest_createdByUserId_createdAt_idx" ON "SignatureRequest"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "SignatureRequest_status_idx" ON "SignatureRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SignatureRequestSigner_tokenHash_key" ON "SignatureRequestSigner"("tokenHash");

-- CreateIndex
CREATE INDEX "SignatureRequestSigner_signatureRequestId_idx" ON "SignatureRequestSigner"("signatureRequestId");

-- CreateIndex
CREATE INDEX "Signature_signatureRequestId_idx" ON "Signature"("signatureRequestId");

-- CreateIndex
CREATE INDEX "Signature_signerUserId_idx" ON "Signature"("signerUserId");

-- AddForeignKey
ALTER TABLE "SignatureRequestSigner" ADD CONSTRAINT "SignatureRequestSigner_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_signatureRequestId_fkey" FOREIGN KEY ("signatureRequestId") REFERENCES "SignatureRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
