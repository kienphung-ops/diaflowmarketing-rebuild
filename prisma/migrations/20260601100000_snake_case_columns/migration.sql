-- Rename all camelCase columns to snake_case so the SQL layer is
-- uniformly snake_case while Prisma keeps its camelCase field names
-- via @map. Postgres preserves indexes + FKs across RENAME COLUMN
-- automatically, so no constraint work is required here.
--
-- Columns that were already snake_case in the DB (first_email,
-- product_reward, unlock_items) are NOT renamed — only their Prisma
-- field names changed (firstEmail / productReward / unlockItems).

-- ── users ───────────────────────────────────────────────────────────
ALTER TABLE "users" RENAME COLUMN "passwordHash"    TO "password_hash";
ALTER TABLE "users" RENAME COLUMN "emailVerified"   TO "email_verified";
ALTER TABLE "users" RENAME COLUMN "googleId"        TO "google_id";
ALTER TABLE "users" RENAME COLUMN "googleEmail"     TO "google_email";
ALTER TABLE "users" RENAME COLUMN "recommendedRole" TO "recommended_role";
ALTER TABLE "users" RENAME COLUMN "ipAddress"       TO "ip_address";
ALTER TABLE "users" RENAME COLUMN "referralCode"    TO "referral_code";
ALTER TABLE "users" RENAME COLUMN "referredByCode"  TO "referred_by_code";
ALTER TABLE "users" RENAME COLUMN "referredAt"      TO "referred_at";
ALTER TABLE "users" RENAME COLUMN "totalInvites"    TO "total_invites";
ALTER TABLE "users" RENAME COLUMN "currentFloor"    TO "current_floor";
ALTER TABLE "users" RENAME COLUMN "teamName"        TO "team_name";
ALTER TABLE "users" RENAME COLUMN "teamPurpose"     TO "team_purpose";
ALTER TABLE "users" RENAME COLUMN "publicVisible"   TO "public_visible";
ALTER TABLE "users" RENAME COLUMN "itemPositions"   TO "item_positions";
ALTER TABLE "users" RENAME COLUMN "itemPositions2D" TO "item_positions_2d";
ALTER TABLE "users" RENAME COLUMN "spinTokens"      TO "spin_tokens";
ALTER TABLE "users" RENAME COLUMN "spinCreditCents" TO "spin_credit_cents";
ALTER TABLE "users" RENAME COLUMN "lastDailySpinAt" TO "last_daily_spin_at";
ALTER TABLE "users" RENAME COLUMN "createdAt"       TO "created_at";
ALTER TABLE "users" RENAME COLUMN "updatedAt"       TO "updated_at";

-- ── auth_tokens ─────────────────────────────────────────────────────
ALTER TABLE "auth_tokens" RENAME COLUMN "userId"    TO "user_id";
ALTER TABLE "auth_tokens" RENAME COLUMN "tokenHash" TO "token_hash";
ALTER TABLE "auth_tokens" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "auth_tokens" RENAME COLUMN "usedAt"    TO "used_at";
ALTER TABLE "auth_tokens" RENAME COLUMN "ipAddress" TO "ip_address";
ALTER TABLE "auth_tokens" RENAME COLUMN "createdAt" TO "created_at";

-- ── invite_events ───────────────────────────────────────────────────
ALTER TABLE "invite_events" RENAME COLUMN "inviterUserId" TO "inviter_user_id";
ALTER TABLE "invite_events" RENAME COLUMN "invitedEmail"  TO "invited_email";
ALTER TABLE "invite_events" RENAME COLUMN "invitedUserId" TO "invited_user_id";
ALTER TABLE "invite_events" RENAME COLUMN "ipAddress"     TO "ip_address";
ALTER TABLE "invite_events" RENAME COLUMN "userAgent"     TO "user_agent";
ALTER TABLE "invite_events" RENAME COLUMN "createdAt"     TO "created_at";

-- ── floor ───────────────────────────────────────────────────────────
ALTER TABLE "floor" RENAME COLUMN "invitesRequired" TO "invites_required";
ALTER TABLE "floor" RENAME COLUMN "maxTeammates"    TO "max_teammates";

-- ── floor_items ─────────────────────────────────────────────────────
ALTER TABLE "floor_items" RENAME COLUMN "floorId" TO "floor_id";
ALTER TABLE "floor_items" RENAME COLUMN "itemId"  TO "item_id";

-- ── recruited_teammates ─────────────────────────────────────────────
ALTER TABLE "recruited_teammates" RENAME COLUMN "userId"    TO "user_id";
ALTER TABLE "recruited_teammates" RENAME COLUMN "isDefault" TO "is_default";
ALTER TABLE "recruited_teammates" RENAME COLUMN "createdAt" TO "created_at";

-- ── role_descriptions ───────────────────────────────────────────────
ALTER TABLE "role_descriptions" RENAME COLUMN "displayRole" TO "display_role";
ALTER TABLE "role_descriptions" RENAME COLUMN "createdAt"   TO "created_at";
ALTER TABLE "role_descriptions" RENAME COLUMN "updatedAt"   TO "updated_at";

-- ── spin_grants ─────────────────────────────────────────────────────
ALTER TABLE "spin_grants" RENAME COLUMN "userId"    TO "user_id";
ALTER TABLE "spin_grants" RENAME COLUMN "taskKey"   TO "task_key";
ALTER TABLE "spin_grants" RENAME COLUMN "createdAt" TO "created_at";

-- ── spin_results ────────────────────────────────────────────────────
ALTER TABLE "spin_results" RENAME COLUMN "userId"    TO "user_id";
ALTER TABLE "spin_results" RENAME COLUMN "anonId"    TO "anon_id";
ALTER TABLE "spin_results" RENAME COLUMN "cashCents" TO "cash_cents";
ALTER TABLE "spin_results" RENAME COLUMN "isRespin"  TO "is_respin";
ALTER TABLE "spin_results" RENAME COLUMN "createdAt" TO "created_at";

-- ── task_completions ────────────────────────────────────────────────
ALTER TABLE "task_completions" RENAME COLUMN "userId"      TO "user_id";
ALTER TABLE "task_completions" RENAME COLUMN "taskKey"     TO "task_key";
ALTER TABLE "task_completions" RENAME COLUMN "completedAt" TO "completed_at";

-- ── spin_wedges ─────────────────────────────────────────────────────
-- Created today with camelCase columns by the previous migration; bring
-- it in line with the new convention in the same sweep.
ALTER TABLE "spin_wedges" RENAME COLUMN "sortOrder" TO "sort_order";
ALTER TABLE "spin_wedges" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "spin_wedges" RENAME COLUMN "updatedAt" TO "updated_at";

-- ── anonymous_spins ─────────────────────────────────────────────────
ALTER TABLE "anonymous_spins" RENAME COLUMN "cookieId"         TO "cookie_id";
ALTER TABLE "anonymous_spins" RENAME COLUMN "ipAddress"        TO "ip_address";
ALTER TABLE "anonymous_spins" RENAME COLUMN "cashCents"        TO "cash_cents";
ALTER TABLE "anonymous_spins" RENAME COLUMN "teammateCount"    TO "teammate_count";
ALTER TABLE "anonymous_spins" RENAME COLUMN "migratedToUserId" TO "migrated_to_user_id";
ALTER TABLE "anonymous_spins" RENAME COLUMN "migratedAt"       TO "migrated_at";
ALTER TABLE "anonymous_spins" RENAME COLUMN "createdAt"        TO "created_at";

-- ── email_captures ──────────────────────────────────────────────────
ALTER TABLE "email_captures" RENAME COLUMN "createdAt" TO "created_at";
