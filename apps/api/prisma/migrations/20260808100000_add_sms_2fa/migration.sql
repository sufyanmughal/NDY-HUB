-- AlterEnum
ALTER TYPE "SecurityEventType" ADD VALUE 'SMS_2FA_ENABLED';
ALTER TYPE "SecurityEventType" ADD VALUE 'SMS_2FA_DISABLED';

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "smsPhoneE164" TEXT,
  ADD COLUMN "smsEnabledAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_smsPhoneE164_key" ON "User"("smsPhoneE164");
