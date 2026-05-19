/*
  Warnings:

  - Added the required column `first_email` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RecruitedTeammate" ADD COLUMN     "pokes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "country" TEXT,
ADD COLUMN     "first_email" TEXT NOT NULL,
ADD COLUMN     "passwordHash" TEXT;
