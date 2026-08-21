-- Phase D of identity-architecture-hardening-plan.md: central,
-- ecosystem-wide device management, per the client's explicit sign-off.
-- New Device table both Session and OAuthRefreshToken FK into (nullable
-- deviceId on both — older clients that haven't started sending
-- x-device-id yet simply aren't attached to a Device, nothing breaks).
-- Purely additive.

-- AlterEnum
ALTER TYPE "SecurityEventType" ADD VALUE 'DEVICE_REVOKED';

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_userId_deviceId_key" ON "Device"("userId", "deviceId");

-- CreateIndex
CREATE INDEX "Device_userId_idx" ON "Device"("userId");

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "deviceId" TEXT;

-- AlterTable
ALTER TABLE "OAuthRefreshToken" ADD COLUMN "deviceId" TEXT;

-- CreateIndex
CREATE INDEX "Session_deviceId_idx" ON "Session"("deviceId");

-- CreateIndex
CREATE INDEX "OAuthRefreshToken_deviceId_idx" ON "OAuthRefreshToken"("deviceId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthRefreshToken" ADD CONSTRAINT "OAuthRefreshToken_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
