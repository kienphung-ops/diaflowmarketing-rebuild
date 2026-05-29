-- Spin wheel wedge catalogue (admin-editable). Backend reads via the
-- cached loader in lib/spin/wedgesApi.ts so reward amounts + odds can
-- be tuned without code changes. See schema.prisma → SpinWedge for
-- field semantics.

-- CreateTable
CREATE TABLE "spin_wedges" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'credit',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "weight" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spin_wedges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spin_wedges_key_key" ON "spin_wedges"("key");
