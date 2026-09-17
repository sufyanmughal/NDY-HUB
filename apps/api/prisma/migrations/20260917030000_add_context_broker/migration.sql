-- Context Broker — AI external-service permission layer.
--
-- Additive: one new enum value on OAuthClientType, one new enum, one new table.
-- No existing table is altered. See ContextBrokerService and the schema
-- comments.

-- AlterEnum
ALTER TYPE "OAuthClientType" ADD VALUE 'AI_AGENT';

-- CreateEnum
CREATE TYPE "AiAgentConsentScope" AS ENUM ('CALENDAR', 'CONTACTS', 'TASKS', 'NOTES', 'ECONOMY_READ');

-- CreateTable
CREATE TABLE "AiAgentConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oauthClientId" TEXT NOT NULL,
    "scopes" "AiAgentConsentScope"[],
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AiAgentConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiAgentConsent_userId_oauthClientId_key" ON "AiAgentConsent"("userId", "oauthClientId");

-- CreateIndex
CREATE INDEX "AiAgentConsent_userId_idx" ON "AiAgentConsent"("userId");

-- CreateIndex
CREATE INDEX "AiAgentConsent_oauthClientId_idx" ON "AiAgentConsent"("oauthClientId");

-- AddForeignKey
ALTER TABLE "AiAgentConsent" ADD CONSTRAINT "AiAgentConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
