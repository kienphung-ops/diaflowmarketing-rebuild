-- Inviter lock — track when a user's referredByCode was first sealed.
-- Once set, neither referredByCode nor referredAt may be overwritten by
-- a later invite link (enforced in src/app/api/auth/{request,signup}).
ALTER TABLE "User" ADD COLUMN "referredAt" TIMESTAMP(3);

-- Backfill: any user that already has a referredByCode gets their
-- createdAt copied into referredAt so the "invited X ago" UI works
-- for accounts that existed before this column was added.
UPDATE "User"
SET "referredAt" = "createdAt"
WHERE "referredByCode" IS NOT NULL;
