-- Client's "NDY ID — Identity & Leadership Structure" spec: a small,
-- manually-curated set of founding/leadership NDY ID classes (CEO, EXE,
-- PRT, INV, DEV — in addition to the existing FND/BIZ/MBR) whose type
-- segment is permanent and independent of the person's Role, which keeps
-- evolving (see common/ndy-id.util.ts's ndyIdTypeForUser / User.ndyIdType
-- doc comments). Purely additive: nullable column, no backfill needed —
-- every existing user keeps deriving its type from Role exactly as before
-- (ndyIdType IS NULL means "use ndyIdTypeForRole(role)").
--
-- No data is assigned by this migration. Assignment of the specific
-- founding people to CEO-000001 / FND-000002 / etc. is a deliberate,
-- reviewed, separate step — see prisma/seed-founding-team.ts.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "ndyIdType" TEXT;
