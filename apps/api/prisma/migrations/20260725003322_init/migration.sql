-- CreateEnum
CREATE TYPE "VerificationLevel" AS ENUM ('LEVEL_0', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3');

-- CreateEnum
CREATE TYPE "LoginRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LoginRequestMethod" AS ENUM ('QR', 'DEEP_LINK');

-- CreateEnum
CREATE TYPE "CryndyPurchaseStatus" AS ENUM ('PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'UNDER_REVIEW', 'VERIFIED', 'ALLOCATED', 'LOCKED', 'AVAILABLE', 'DISTRIBUTED_ON_CHAIN', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "ndyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "fullName" TEXT,
    "profilePhotoUrl" TEXT,
    "verificationLevel" "VerificationLevel" NOT NULL DEFAULT 'LEVEL_0',
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "identityVerifiedAt" TIMESTAMP(3),
    "ndyappsConnected" BOOLEAN NOT NULL DEFAULT false,
    "ndyappsConnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginRequest" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "method" "LoginRequestMethod" NOT NULL,
    "status" "LoginRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestingIp" TEXT,
    "requestingDevice" TEXT,
    "requestingBrowser" TEXT,
    "requestingLocation" TEXT,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "deniedAt" TIMESTAMP(3),
    "sessionIssuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryndyPurchase" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountPaid" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "cryndyAmount" DECIMAL(28,8) NOT NULL,
    "bonusAmount" DECIMAL(28,8) NOT NULL DEFAULT 0,
    "packageName" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "status" "CryndyPurchaseStatus" NOT NULL DEFAULT 'PAYMENT_PENDING',
    "providerTransactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "allocatedAt" TIMESTAMP(3),

    CONSTRAINT "CryndyPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NdybitsLedgerEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NdybitsLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_ndyId_key" ON "User"("ndyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_ndyId_idx" ON "User"("ndyId");

-- CreateIndex
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_providerId_key" ON "AuthIdentity"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "LoginRequest_token_key" ON "LoginRequest"("token");

-- CreateIndex
CREATE INDEX "LoginRequest_token_idx" ON "LoginRequest"("token");

-- CreateIndex
CREATE INDEX "LoginRequest_status_idx" ON "LoginRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CryndyPurchase_reference_key" ON "CryndyPurchase"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "CryndyPurchase_providerTransactionId_key" ON "CryndyPurchase"("providerTransactionId");

-- CreateIndex
CREATE INDEX "CryndyPurchase_userId_idx" ON "CryndyPurchase"("userId");

-- CreateIndex
CREATE INDEX "CryndyPurchase_status_idx" ON "CryndyPurchase"("status");

-- CreateIndex
CREATE INDEX "NdybitsLedgerEntry_userId_idx" ON "NdybitsLedgerEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginRequest" ADD CONSTRAINT "LoginRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryndyPurchase" ADD CONSTRAINT "CryndyPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NdybitsLedgerEntry" ADD CONSTRAINT "NdybitsLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
