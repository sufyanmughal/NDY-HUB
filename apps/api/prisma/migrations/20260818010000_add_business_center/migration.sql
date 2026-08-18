-- NDY Business Center v1: admin-approved workspace creation + team invites,
-- per the client's explicit 25-answer sign-off (Aug 2026 architecture
-- audit). Purely additive: two new enums, two new tables, two new columns
-- on existing Workspace/WorkspaceMembership tables.

-- CreateEnum
CREATE TYPE "BusinessWorkspaceRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WorkspaceInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "ndyBusinessId" TEXT;

-- AlterTable
ALTER TABLE "WorkspaceMembership" ADD COLUMN "department" TEXT;

-- CreateTable
CREATE TABLE "BusinessWorkspaceRequest" (
    "id" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "requestedByNdyId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "requestReason" TEXT,
    "status" "BusinessWorkspaceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedByNdyId" TEXT,
    "reviewReason" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdWorkspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessWorkspaceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceInvite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "invitedRole" "WorkspaceRole" NOT NULL,
    "invitedDepartment" TEXT,
    "invitedByUserId" TEXT NOT NULL,
    "invitedByNdyId" TEXT NOT NULL,
    "status" "WorkspaceInviteStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_ndyBusinessId_key" ON "Workspace"("ndyBusinessId");

-- CreateIndex
CREATE INDEX "BusinessWorkspaceRequest_status_idx" ON "BusinessWorkspaceRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_tokenHash_key" ON "WorkspaceInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_workspaceId_status_idx" ON "WorkspaceInvite"("workspaceId", "status");

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
