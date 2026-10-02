-- NDYRA Phase 1 — user-controlled personal memory.
--
-- Additive. A new, standalone table — explicitly separate from PassportClaim
-- (verified facts) and from any conversational/ephemeral context, per the
-- client's instruction. No existing table is touched.

-- CreateEnum
CREATE TYPE "UserMemoryType" AS ENUM ('PREFERENCE', 'GOAL');

-- CreateTable
CREATE TABLE "UserMemory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserMemoryType" NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserMemory_userId_type_idx" ON "UserMemory"("userId", "type");

-- AddForeignKey
ALTER TABLE "UserMemory" ADD CONSTRAINT "UserMemory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
