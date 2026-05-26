-- Add the "launch-day promise" description column to existing
-- teammates. Nullable so we can backfill lazily (existing rows stay
-- null until next edit; new rows get populated by the Diaflow API
-- call inside /api/recruit POST and /api/recruit/[id] PATCH).
ALTER TABLE "recruited_teammates"
  ADD COLUMN "description" TEXT;

-- Per-role cache table. Primary key is the lowercased role text so
-- "CEO" / "ceo" / "Ceo" all hit the same row — bulk adds with mixed
-- casing don't double-bill the upstream Diaflow API.
CREATE TABLE "role_descriptions" (
  "role"         TEXT NOT NULL,
  "displayRole"  TEXT NOT NULL,
  "description"  TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "role_descriptions_pkey" PRIMARY KEY ("role")
);
