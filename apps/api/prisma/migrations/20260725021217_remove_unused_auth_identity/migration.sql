/*
  Warnings:

  - You are about to drop the `AuthIdentity` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AuthIdentity" DROP CONSTRAINT "AuthIdentity_userId_fkey";

-- DropTable
DROP TABLE "AuthIdentity";
