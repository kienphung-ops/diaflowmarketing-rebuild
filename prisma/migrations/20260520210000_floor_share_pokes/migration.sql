-- Floor sharing + default-teammate persistence.
--
-- 1. User.publicVisible — opt-in flag so /floor/<referralCode> can
--    show a user's floor + accept pokes from random visitors.
-- 2. RecruitedTeammate.slug + isDefault — represent the 3 hard-coded
--    NPCs (Iris/Mia/Leo) as DB rows so poke counters work uniformly.
-- 3. Backfill: every existing user gets seeded with 3 default rows.

ALTER TABLE "User"
  ADD COLUMN "publicVisible" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "RecruitedTeammate"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Postgres treats NULL slugs as distinct, so user-recruited rows
-- (slug IS NULL) can repeat freely; only the 3 default slugs are
-- forced unique per user.
CREATE UNIQUE INDEX "RecruitedTeammate_userId_slug_key"
  ON "RecruitedTeammate" ("userId", "slug");

-- Backfill defaults for every existing user. Uses ON CONFLICT so the
-- migration is safe to re-run.
INSERT INTO "RecruitedTeammate" (id, "userId", slug, name, role, pokes, "isDefault", "createdAt")
SELECT
  'def_' || slug_t.slug || '_' || u.id,
  u.id,
  slug_t.slug,
  slug_t.display_name,
  slug_t.display_role,
  0,
  true,
  NOW()
FROM "User" u
CROSS JOIN (VALUES
  ('iris', 'Iris', 'AI Recruiter'),
  ('mia',  'Mia',  'Assistant'),
  ('leo',  'Leo',  'Demo Specialist')
) AS slug_t(slug, display_name, display_role)
ON CONFLICT ("userId", "slug") DO NOTHING;
