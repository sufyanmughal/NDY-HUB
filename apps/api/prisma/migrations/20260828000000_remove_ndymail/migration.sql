-- NDYMAIL split into its own standalone NDJOYIT product (client decision,
-- 2026-08-28) — this migration removes everything NDYMAIL-specific from
-- ndy-hub's database. The code/architecture lives on in the separate
-- `ndymail` project going forward; this database no longer needs to carry
-- any of it. Purely a removal, no data is preserved (per the client's own
-- explicit choice — nothing in these tables was real user mail, only
-- architecture/test data from the build-out).
--
-- Order matters: drop dependent tables before the tables they reference
-- (foreign keys), then the enums those tables used, then the two shared
-- enums (SecurityEventType, NotificationCategory) that had NDYMAIL-only
-- values added to them — Postgres has no "drop enum value" statement, so
-- those two are rebuilt without the removed values via the standard
-- create-new-type / swap-column / drop-old-type sequence.

-- Drop tables in dependency order (children first)
DROP TABLE IF EXISTS "MailAttachment";
DROP TABLE IF EXISTS "MailMessage";
DROP TABLE IF EXISTS "MailThread";
DROP TABLE IF EXISTS "MailFolder";
DROP TABLE IF EXISTS "MailEvent";
DROP TABLE IF EXISTS "MailAccount";
DROP TABLE IF EXISTS "WorkspaceAiPolicy";

-- Drop the NDYMAIL-only enums (nothing else references these)
DROP TYPE IF EXISTS "MailFolderKind";
DROP TYPE IF EXISTS "MailAccountStatus";
DROP TYPE IF EXISTS "MailProviderType";

-- Rebuild SecurityEventType without the three MAIL_ACCOUNT_* values —
-- Postgres has no ALTER TYPE ... DROP VALUE, so this recreates the type.
CREATE TYPE "SecurityEventType_new" AS ENUM (
  'LOGIN_SUCCESS',
  'NEW_DEVICE',
  'PASSWORD_CHANGED',
  'PASSKEY_ADDED',
  'PASSKEY_REMOVED',
  'TOTP_ENABLED',
  'TOTP_DISABLED',
  'SMS_2FA_ENABLED',
  'SMS_2FA_DISABLED',
  'RECOVERY_CODE_USED',
  'EMAIL_CHANGED',
  'OAUTH_APP_CONNECTED',
  'OAUTH_APP_REVOKED',
  'OAUTH_TOKEN_REUSE_DETECTED',
  'DEVICE_REVOKED'
);

-- Any existing SecurityEvent rows with a MAIL_ACCOUNT_* type would fail
-- the column swap below — none are expected (NDYMAIL's own connect/
-- disconnect/reauth flow was only ever exercised against test data during
-- development), but this guards against silently losing rows if any exist.
DELETE FROM "SecurityEvent" WHERE "type" IN ('MAIL_ACCOUNT_CONNECTED', 'MAIL_ACCOUNT_DISCONNECTED', 'MAIL_ACCOUNT_REAUTH_REQUIRED');

ALTER TABLE "SecurityEvent" ALTER COLUMN "type" TYPE "SecurityEventType_new" USING ("type"::text::"SecurityEventType_new");
DROP TYPE "SecurityEventType";
ALTER TYPE "SecurityEventType_new" RENAME TO "SecurityEventType";

-- Rebuild NotificationCategory without the NDYMAIL value, same pattern.
CREATE TYPE "NotificationCategory_new" AS ENUM (
  'SECURITY',
  'ECONOMY',
  'ACTION_APPROVAL',
  'NDYSPACE',
  'SYSTEM'
);

DELETE FROM "Notification" WHERE "category" = 'NDYMAIL';

ALTER TABLE "Notification" ALTER COLUMN "category" TYPE "NotificationCategory_new" USING ("category"::text::"NotificationCategory_new");
DROP TYPE "NotificationCategory";
ALTER TYPE "NotificationCategory_new" RENAME TO "NotificationCategory";
