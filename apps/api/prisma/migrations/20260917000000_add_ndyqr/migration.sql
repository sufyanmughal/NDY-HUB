-- NDYQR™ — central dynamic QR service.
--
-- Purely additive: one new enum + two new tables. No existing table is
-- touched. See prisma/schema.prisma's NdyQrCode/NdyQrScan models and
-- docs/ndyqr.md for the design.

-- CreateEnum
CREATE TYPE "NdyQrType" AS ENUM ('LINK', 'PASSPORT', 'NDYSTAYS', 'NDYCONNECT', 'NDYQUIZ', 'NDYVIXIT', 'NDYXTRA', 'NDYPAY', 'LOGIN');

-- CreateTable
CREATE TABLE "NdyQrCode" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "NdyQrType" NOT NULL DEFAULT 'LINK',
    "destination" TEXT NOT NULL,
    "campaign" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "brandStyle" TEXT NOT NULL DEFAULT 'ndy-gradient',
    "colorFrom" TEXT,
    "colorTo" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NdyQrCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NdyQrScan" (
    "id" TEXT NOT NULL,
    "qrCodeId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "location" TEXT,
    "deviceType" TEXT,

    CONSTRAINT "NdyQrScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NdyQrCode_slug_key" ON "NdyQrCode"("slug");

-- CreateIndex
CREATE INDEX "NdyQrCode_ownerId_createdAt_idx" ON "NdyQrCode"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "NdyQrCode_slug_idx" ON "NdyQrCode"("slug");

-- CreateIndex
CREATE INDEX "NdyQrScan_qrCodeId_scannedAt_idx" ON "NdyQrScan"("qrCodeId", "scannedAt");

-- AddForeignKey
ALTER TABLE "NdyQrCode" ADD CONSTRAINT "NdyQrCode_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NdyQrScan" ADD CONSTRAINT "NdyQrScan_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "NdyQrCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
