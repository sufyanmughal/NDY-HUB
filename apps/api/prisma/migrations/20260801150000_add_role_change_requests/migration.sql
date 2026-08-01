-- CreateEnum
CREATE TYPE "RoleChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "RoleChangeRequest" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetNdyId" TEXT NOT NULL,
    "requestedRole" "Role" NOT NULL,
    "previousRole" "Role" NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "requestedByNdyId" TEXT NOT NULL,
    "requestReason" TEXT,
    "status" "RoleChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedByNdyId" TEXT,
    "reviewReason" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleChangeRequest_status_idx" ON "RoleChangeRequest"("status");

-- CreateIndex
CREATE INDEX "RoleChangeRequest_targetUserId_idx" ON "RoleChangeRequest"("targetUserId");
