-- Adds OAuth 2.1 / RFC 8252 "public client" support so native/mobile apps
-- (Flutter, Android, iOS) can register as OAuth clients without a
-- client_secret baked into their binary — a secret inside an APK isn't a
-- secret. Existing rows all become CONFIDENTIAL (unchanged behavior,
-- clientSecretHash stays required for them); clientSecretHash itself
-- becomes nullable so PUBLIC clients can omit it entirely.

-- CreateEnum
CREATE TYPE "OAuthClientType" AS ENUM ('CONFIDENTIAL', 'PUBLIC');

-- AlterTable
ALTER TABLE "OAuthClient" ADD COLUMN "clientType" "OAuthClientType" NOT NULL DEFAULT 'CONFIDENTIAL';
ALTER TABLE "OAuthClient" ALTER COLUMN "clientSecretHash" DROP NOT NULL;
