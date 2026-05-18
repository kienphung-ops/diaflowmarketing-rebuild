-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('MAGIC_LINK', 'OTP');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "ipAddress" TEXT,
    "referralCode" TEXT NOT NULL,
    "referredByCode" TEXT,
    "totalInvites" INTEGER NOT NULL DEFAULT 0,
    "currentFloor" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteEvent" (
    "id" TEXT NOT NULL,
    "inviterUserId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "invitedUserId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnlockedItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnlockedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecruitedTeammate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitedTeammate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_referralCode_idx" ON "User"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_userId_type_idx" ON "AuthToken"("userId", "type");

-- CreateIndex
CREATE INDEX "InviteEvent_inviterUserId_idx" ON "InviteEvent"("inviterUserId");

-- CreateIndex
CREATE INDEX "InviteEvent_invitedEmail_idx" ON "InviteEvent"("invitedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "UnlockedItem_userId_itemKey_key" ON "UnlockedItem"("userId", "itemKey");

-- CreateIndex
CREATE INDEX "RecruitedTeammate_userId_idx" ON "RecruitedTeammate"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredByCode_fkey" FOREIGN KEY ("referredByCode") REFERENCES "User"("referralCode") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteEvent" ADD CONSTRAINT "InviteEvent_inviterUserId_fkey" FOREIGN KEY ("inviterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnlockedItem" ADD CONSTRAINT "UnlockedItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecruitedTeammate" ADD CONSTRAINT "RecruitedTeammate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
