-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lastDailySpinAt" TIMESTAMP(3),
ADD COLUMN     "spinCreditCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "spinTokens" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "spin_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "taskKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spin_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spin_results" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonId" TEXT,
    "wedge" TEXT NOT NULL,
    "cashCents" INTEGER NOT NULL DEFAULT 0,
    "isRespin" BOOLEAN NOT NULL DEFAULT false,
    "capped" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spin_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_completions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anonymous_spins" (
    "id" TEXT NOT NULL,
    "cookieId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "wedge" TEXT NOT NULL,
    "cashCents" INTEGER NOT NULL DEFAULT 0,
    "teammateCount" INTEGER NOT NULL DEFAULT 0,
    "migratedToUserId" TEXT,
    "migratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anonymous_spins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "spin_grants_userId_idx" ON "spin_grants"("userId");

-- CreateIndex
CREATE INDEX "spin_grants_source_idx" ON "spin_grants"("source");

-- CreateIndex
CREATE INDEX "spin_results_userId_idx" ON "spin_results"("userId");

-- CreateIndex
CREATE INDEX "spin_results_anonId_idx" ON "spin_results"("anonId");

-- CreateIndex
CREATE INDEX "task_completions_userId_idx" ON "task_completions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "task_completions_userId_taskKey_key" ON "task_completions"("userId", "taskKey");

-- CreateIndex
CREATE UNIQUE INDEX "anonymous_spins_cookieId_key" ON "anonymous_spins"("cookieId");

-- CreateIndex
CREATE INDEX "anonymous_spins_ipAddress_idx" ON "anonymous_spins"("ipAddress");

-- AddForeignKey
ALTER TABLE "spin_grants" ADD CONSTRAINT "spin_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spin_results" ADD CONSTRAINT "spin_results_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
