-- docs/ndymail-architecture-design.md §10.3 (client-locked decision):
-- "Organization Policy -> User Permission -> NDYTREXX AI Access."
-- Purely additive — no enforcement code exists yet (NDYTREXX itself isn't
-- integrated), this only locks the shape. MailAccount.aiAccessEnabled
-- defaults false (opt-in, per the client's explicit "off by default"
-- requirement); WorkspaceAiPolicy rows are created on demand, none exist
-- yet, so no BUSINESS workspace currently has a ceiling configured.

-- AlterTable
ALTER TABLE "MailAccount" ADD COLUMN "aiAccessEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "WorkspaceAiPolicy" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowSummaries" BOOLEAN NOT NULL DEFAULT false,
    "allowDrafting" BOOLEAN NOT NULL DEFAULT false,
    "allowAutoReply" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceAiPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceAiPolicy_workspaceId_key" ON "WorkspaceAiPolicy"("workspaceId");

-- AddForeignKey
ALTER TABLE "WorkspaceAiPolicy" ADD CONSTRAINT "WorkspaceAiPolicy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
