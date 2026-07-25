-- AlterTable
ALTER TABLE "ExternalAuthState" ADD COLUMN     "linkUserId" TEXT;

-- AddForeignKey
ALTER TABLE "ExternalAuthState" ADD CONSTRAINT "ExternalAuthState_linkUserId_fkey" FOREIGN KEY ("linkUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
