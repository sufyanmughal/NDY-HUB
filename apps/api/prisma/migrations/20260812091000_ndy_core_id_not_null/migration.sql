-- Step 2 of the NDY ID redesign. Only run this AFTER
-- apps/api/scripts/migrate-ndy-ids.ts has been run against the same
-- database and every "User" row has a non-null "ndyCoreId" -- this will
-- fail loudly (a NOT NULL violation) if any row is still unpopulated,
-- which is the correct, safe failure mode here.

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "ndyCoreId" SET NOT NULL;
