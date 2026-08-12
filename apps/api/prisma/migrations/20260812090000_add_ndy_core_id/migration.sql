-- Step 1 of the NDY ID redesign: adds the permanent core-identity column
-- as nullable first, since existing rows have no value for it yet. A
-- follow-up migration (see the next migration folder) tightens this to
-- NOT NULL after apps/api/scripts/migrate-ndy-ids.ts has backfilled every
-- existing row -- do not run that follow-up migration before running the
-- backfill script, or it will fail on the still-null rows.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "ndyCoreId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_ndyCoreId_key" ON "User"("ndyCoreId");
