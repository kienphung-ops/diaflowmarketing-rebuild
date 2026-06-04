/*
  Warnings:

  - You are about to drop the column `ip_address` on the `anonymous_spins` table. All the data in the column will be lost.
  - You are about to drop the column `ip_address` on the `auth_tokens` table. All the data in the column will be lost.
  - You are about to drop the column `ip_address` on the `invite_events` table. All the data in the column will be lost.
  - You are about to drop the column `ip_address` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "anonymous_spins_ip_address_idx";

-- AlterTable
ALTER TABLE "anonymous_spins" DROP COLUMN "ip_address";

-- AlterTable
ALTER TABLE "auth_tokens" DROP COLUMN "ip_address";

-- AlterTable
ALTER TABLE "invite_events" DROP COLUMN "ip_address";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "ip_address";
