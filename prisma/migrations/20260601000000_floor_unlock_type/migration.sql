-- AlterTable: add per-floor unlock requirement type.
-- "invite" (default) keeps the existing invite-threshold gate;
-- "share" gates the floor behind the user having shared at least once.
ALTER TABLE "floor" ADD COLUMN "unlock_type" TEXT NOT NULL DEFAULT 'invite';

-- Floor 2 is now unlocked by sharing instead of by invites.
UPDATE "floor" SET "unlock_type" = 'share' WHERE "id" = 2;
