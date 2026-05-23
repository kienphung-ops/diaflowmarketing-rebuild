-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('MAGIC_LINK', 'OTP', 'EMAIL_VERIFY', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "email_captures" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_captures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_email" TEXT,
    "passwordHash" TEXT,
    "emailVerified" TIMESTAMP(3),
    "recommendedRole" TEXT,
    "reason" TEXT,
    "ipAddress" TEXT,
    "country" TEXT,
    "referralCode" TEXT NOT NULL,
    "referredByCode" TEXT,
    "referredAt" TIMESTAMP(3),
    "totalInvites" INTEGER NOT NULL DEFAULT 0,
    "currentFloor" INTEGER NOT NULL DEFAULT 1,
    "teamName" TEXT,
    "teamPurpose" TEXT,
    "publicVisible" BOOLEAN NOT NULL DEFAULT false,
    "itemPositions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_events" (
    "id" TEXT NOT NULL,
    "inviterUserId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "invitedUserId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floor" (
    "id" INTEGER NOT NULL,
    "invitesRequired" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "maxTeammates" INTEGER NOT NULL,
    "product_reward" TEXT,
    "unlock_items" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floor_items" (
    "id" SERIAL NOT NULL,
    "floorId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "floor_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruited_teammates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "pokes" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruited_teammates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

-- CreateIndex
CREATE INDEX "users_referralCode_idx" ON "users"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_tokenHash_key" ON "auth_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "auth_tokens_userId_type_idx" ON "auth_tokens"("userId", "type");

-- CreateIndex
CREATE INDEX "invite_events_inviterUserId_idx" ON "invite_events"("inviterUserId");

-- CreateIndex
CREATE INDEX "invite_events_invitedEmail_idx" ON "invite_events"("invitedEmail");

-- CreateIndex
CREATE UNIQUE INDEX "items_key_key" ON "items"("key");

-- CreateIndex
CREATE INDEX "floor_items_floorId_idx" ON "floor_items"("floorId");

-- CreateIndex
CREATE UNIQUE INDEX "floor_items_floorId_itemId_key" ON "floor_items"("floorId", "itemId");

-- CreateIndex
CREATE INDEX "recruited_teammates_userId_idx" ON "recruited_teammates"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "recruited_teammates_userId_slug_key" ON "recruited_teammates"("userId", "slug");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referredByCode_fkey" FOREIGN KEY ("referredByCode") REFERENCES "users"("referralCode") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_currentFloor_fkey" FOREIGN KEY ("currentFloor") REFERENCES "floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_events" ADD CONSTRAINT "invite_events_inviterUserId_fkey" FOREIGN KEY ("inviterUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_items" ADD CONSTRAINT "floor_items_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_items" ADD CONSTRAINT "floor_items_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruited_teammates" ADD CONSTRAINT "recruited_teammates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
