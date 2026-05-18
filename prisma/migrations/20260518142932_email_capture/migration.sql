-- CreateTable
CREATE TABLE "EmailCapture" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCapture_pkey" PRIMARY KEY ("id")
);
