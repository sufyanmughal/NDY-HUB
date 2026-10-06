-- Adds the "disable without deleting" toggle Teun asked for on the
-- memory control centre. Additive — defaults every existing row to
-- enabled=true, preserving current behavior for all pre-existing memory.

-- AlterTable
ALTER TABLE "UserMemory" ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;
