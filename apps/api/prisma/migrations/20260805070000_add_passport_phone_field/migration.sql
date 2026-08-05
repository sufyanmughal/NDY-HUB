-- Passport Card "Phone" contact row (present in the user's exact
-- reference component but never previously stored anywhere) — same
-- purely-additive shape as the other Passport Card fields.
ALTER TABLE "User"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "phoneIsPublic" BOOLEAN NOT NULL DEFAULT true;
