-- AlterTable
ALTER TABLE "OAuthAuthorizationCode" ADD COLUMN     "codeChallenge" TEXT,
ADD COLUMN     "codeChallengeMethod" TEXT;
