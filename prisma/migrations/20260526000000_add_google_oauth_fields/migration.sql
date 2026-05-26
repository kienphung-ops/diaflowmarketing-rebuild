-- Google OAuth2 — add columns to the User table so accounts created
-- via "Continue with Google" can be looked up by their immutable
-- Google `sub` claim. Both columns are nullable so existing
-- password-only accounts keep working unchanged.

ALTER TABLE "users"
  ADD COLUMN "googleId" TEXT,
  ADD COLUMN "googleEmail" TEXT;

-- Unique constraint on googleId — a single Google account can link to
-- exactly one Diaflow user. Nullable + unique = "at most one user per
-- non-null googleId" in Postgres, which is what we want.
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
