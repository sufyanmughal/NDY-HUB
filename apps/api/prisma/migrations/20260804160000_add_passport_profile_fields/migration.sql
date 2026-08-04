-- Passport Card fields: all new columns are nullable String? or Boolean
-- with a default, so this is purely additive — no data loss, no rewrite
-- of existing rows beyond backfilling the five *IsPublic defaults.
ALTER TABLE "User"
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "country" TEXT,
  ADD COLUMN "website" TEXT,
  ADD COLUMN "linkedinUrl" TEXT,
  ADD COLUMN "instagramUrl" TEXT,
  ADD COLUMN "xUrl" TEXT,
  ADD COLUMN "businessName" TEXT,
  ADD COLUMN "businessRole" TEXT,
  ADD COLUMN "bioIsPublic" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "countryIsPublic" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "websiteIsPublic" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "socialsIsPublic" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "businessIsPublic" BOOLEAN NOT NULL DEFAULT true;
