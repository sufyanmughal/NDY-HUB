-- AlterTable
ALTER TABLE "EmailRecipient" ADD COLUMN     "isCc" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "draftToNdyIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "draftCcNdyIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "ndyId" TEXT;

-- CreateTable
CREATE TABLE "EmailAttachment" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailAttachment_emailId_idx" ON "EmailAttachment"("emailId");

-- CreateIndex
CREATE INDEX "EmailAttachment_driveFileId_idx" ON "EmailAttachment"("driveFileId");

-- AddForeignKey
ALTER TABLE "EmailAttachment" ADD CONSTRAINT "EmailAttachment_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "Email"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailAttachment" ADD CONSTRAINT "EmailAttachment_driveFileId_fkey" FOREIGN KEY ("driveFileId") REFERENCES "DriveFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
