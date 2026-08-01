-- Rename ADMIN -> SUPER_ADMIN (Postgres updates every existing row using
-- this enum value automatically — no data migration needed).
ALTER TYPE "Role" RENAME VALUE 'ADMIN' TO 'SUPER_ADMIN';

-- Add the rest of the client's requested role set.
ALTER TYPE "Role" ADD VALUE 'DEVELOPER';
ALTER TYPE "Role" ADD VALUE 'FINANCE';
ALTER TYPE "Role" ADD VALUE 'SUPPORT';
ALTER TYPE "Role" ADD VALUE 'CONTENT';
ALTER TYPE "Role" ADD VALUE 'PARTNERS';
ALTER TYPE "Role" ADD VALUE 'AUDITOR';
