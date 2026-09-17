-- Phase A of docs/ndymail-architecture-design.md — NDY Mail Core, the
-- provider-independent data model for the real NDYMAIL platform (Microsoft
-- Graph first, Gmail/IMAP/future NDY-native as additional adapters, never
-- referenced by these tables directly). Purely additive: no existing table
-- is touched, the old internal Email/EmailRecipient model (NDYSPACE
-- Messages) is untouched and coexists.

-- AlterEnum
-- SecurityEvent's self-service "what happened on my account" timeline
-- (not AuditLogEntry, which requires an adminUserId acting on a target —
-- wrong shape for a user connecting their own mailbox).
ALTER TYPE "SecurityEventType" ADD VALUE 'MAIL_ACCOUNT_CONNECTED';
ALTER TYPE "SecurityEventType" ADD VALUE 'MAIL_ACCOUNT_DISCONNECTED';
ALTER TYPE "SecurityEventType" ADD VALUE 'MAIL_ACCOUNT_REAUTH_REQUIRED';

-- CreateEnum
CREATE TYPE "MailProviderType" AS ENUM ('MICROSOFT_GRAPH', 'GOOGLE_WORKSPACE', 'IMAP_SMTP', 'NDY_NATIVE');

-- CreateEnum
CREATE TYPE "MailAccountStatus" AS ENUM ('CONNECTED', 'REAUTH_REQUIRED', 'DISABLED');

-- CreateEnum
CREATE TYPE "MailFolderKind" AS ENUM ('INBOX', 'SENT', 'DRAFTS', 'SPAM', 'TRASH', 'ARCHIVE', 'CUSTOM');

-- CreateTable
CREATE TABLE "MailAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "MailProviderType" NOT NULL,
    "address" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "MailAccountStatus" NOT NULL DEFAULT 'CONNECTED',
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "webhookSubscriptionId" TEXT,
    "webhookExpiresAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailFolder" (
    "id" TEXT NOT NULL,
    "mailAccountId" TEXT NOT NULL,
    "kind" "MailFolderKind" NOT NULL,
    "name" TEXT NOT NULL,
    "providerFolderId" TEXT,

    CONSTRAINT "MailFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailThread" (
    "id" TEXT NOT NULL,
    "mailAccountId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "providerThreadId" TEXT,
    "subject" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "fromAddress" TEXT NOT NULL,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bccAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subject" TEXT NOT NULL,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageRef" TEXT NOT NULL,

    CONSTRAINT "MailAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mailAccountId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "sourceEventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MailAccount_address_key" ON "MailAccount"("address");
CREATE INDEX "MailAccount_userId_idx" ON "MailAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MailFolder_mailAccountId_providerFolderId_key" ON "MailFolder"("mailAccountId", "providerFolderId");
CREATE INDEX "MailFolder_mailAccountId_kind_idx" ON "MailFolder"("mailAccountId", "kind");

-- CreateIndex
CREATE INDEX "MailThread_mailAccountId_folderId_lastMessageAt_idx" ON "MailThread"("mailAccountId", "folderId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "MailMessage_threadId_providerMessageId_key" ON "MailMessage"("threadId", "providerMessageId");
CREATE INDEX "MailMessage_threadId_sentAt_idx" ON "MailMessage"("threadId", "sentAt");

-- CreateIndex
CREATE INDEX "MailAttachment_messageId_idx" ON "MailAttachment"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MailEvent_sourceEventId_key" ON "MailEvent"("sourceEventId");
CREATE INDEX "MailEvent_userId_eventType_createdAt_idx" ON "MailEvent"("userId", "eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "MailAccount" ADD CONSTRAINT "MailAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailFolder" ADD CONSTRAINT "MailFolder_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "MailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailThread" ADD CONSTRAINT "MailThread_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "MailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailThread" ADD CONSTRAINT "MailThread_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "MailFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailAttachment" ADD CONSTRAINT "MailAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "MailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailEvent" ADD CONSTRAINT "MailEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
