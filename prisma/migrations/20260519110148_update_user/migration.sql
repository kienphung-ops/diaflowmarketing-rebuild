-- AlterTable
ALTER TABLE "RecruitedTeammate" ADD COLUMN     "pokes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "country" TEXT,
ADD COLUMN     "first_email" TEXT,
ADD COLUMN     "passwordHash" TEXT;
