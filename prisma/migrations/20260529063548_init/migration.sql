-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('MAGIC_LINK', 'OTP', 'EMAIL_VERIFY', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "email_captures" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_captures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_email" TEXT,
    "password_hash" TEXT,
    "email_verified" TIMESTAMP(3),
    "google_id" TEXT,
    "google_email" TEXT,
    "recommended_role" TEXT,
    "reason" TEXT,
    "ip_address" TEXT,
    "country" TEXT,
    "referral_code" TEXT NOT NULL,
    "referred_by_code" TEXT,
    "referred_at" TIMESTAMP(3),
    "total_invites" INTEGER NOT NULL DEFAULT 0,
    "current_floor" INTEGER NOT NULL DEFAULT 1,
    "team_name" TEXT,
    "team_purpose" TEXT,
    "public_visible" BOOLEAN NOT NULL DEFAULT false,
    "item_positions" JSONB,
    "item_positions_2d" JSONB,
    "spin_tokens" INTEGER NOT NULL DEFAULT 0,
    "spin_credit_cents" INTEGER NOT NULL DEFAULT 0,
    "last_daily_spin_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "TokenType" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_events" (
    "id" TEXT NOT NULL,
    "inviter_user_id" TEXT NOT NULL,
    "invited_email" TEXT NOT NULL,
    "invited_user_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floor" (
    "id" INTEGER NOT NULL,
    "invites_required" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "max_teammates" INTEGER NOT NULL,
    "product_reward" TEXT,
    "unlock_items" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floor_items" (
    "id" SERIAL NOT NULL,
    "floor_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "floor_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruited_teammates" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "slug" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "pokes" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recruited_teammates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_descriptions" (
    "role" TEXT NOT NULL,
    "display_role" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_descriptions_pkey" PRIMARY KEY ("role")
);

-- CreateTable
CREATE TABLE "spin_grants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "task_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spin_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spin_results" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "anon_id" TEXT,
    "wedge" TEXT NOT NULL,
    "cash_cents" INTEGER NOT NULL DEFAULT 0,
    "is_respin" BOOLEAN NOT NULL DEFAULT false,
    "capped" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spin_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_completions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "task_key" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spin_wedges" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'credit',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "weight" INTEGER NOT NULL,
    "first_weight" INTEGER,
    "color" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spin_wedges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anonymous_spins" (
    "id" TEXT NOT NULL,
    "cookie_id" TEXT NOT NULL,
    "ip_address" TEXT,
    "wedge" TEXT NOT NULL,
    "cash_cents" INTEGER NOT NULL DEFAULT 0,
    "teammate_count" INTEGER NOT NULL DEFAULT 0,
    "migrated_to_user_id" TEXT,
    "migrated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anonymous_spins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE INDEX "users_referral_code_idx" ON "users"("referral_code");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_tokens_user_id_type_idx" ON "auth_tokens"("user_id", "type");

-- CreateIndex
CREATE INDEX "invite_events_inviter_user_id_idx" ON "invite_events"("inviter_user_id");

-- CreateIndex
CREATE INDEX "invite_events_invited_email_idx" ON "invite_events"("invited_email");

-- CreateIndex
CREATE UNIQUE INDEX "items_key_key" ON "items"("key");

-- CreateIndex
CREATE INDEX "floor_items_floor_id_idx" ON "floor_items"("floor_id");

-- CreateIndex
CREATE UNIQUE INDEX "floor_items_floor_id_item_id_key" ON "floor_items"("floor_id", "item_id");

-- CreateIndex
CREATE INDEX "recruited_teammates_user_id_idx" ON "recruited_teammates"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "recruited_teammates_user_id_slug_key" ON "recruited_teammates"("user_id", "slug");

-- CreateIndex
CREATE INDEX "spin_grants_user_id_idx" ON "spin_grants"("user_id");

-- CreateIndex
CREATE INDEX "spin_grants_source_idx" ON "spin_grants"("source");

-- CreateIndex
CREATE INDEX "spin_results_user_id_idx" ON "spin_results"("user_id");

-- CreateIndex
CREATE INDEX "spin_results_anon_id_idx" ON "spin_results"("anon_id");

-- CreateIndex
CREATE INDEX "task_completions_user_id_idx" ON "task_completions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_completions_user_id_task_key_key" ON "task_completions"("user_id", "task_key");

-- CreateIndex
CREATE UNIQUE INDEX "spin_wedges_key_key" ON "spin_wedges"("key");

-- CreateIndex
CREATE UNIQUE INDEX "anonymous_spins_cookie_id_key" ON "anonymous_spins"("cookie_id");

-- CreateIndex
CREATE INDEX "anonymous_spins_ip_address_idx" ON "anonymous_spins"("ip_address");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_code_fkey" FOREIGN KEY ("referred_by_code") REFERENCES "users"("referral_code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_current_floor_fkey" FOREIGN KEY ("current_floor") REFERENCES "floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_events" ADD CONSTRAINT "invite_events_inviter_user_id_fkey" FOREIGN KEY ("inviter_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_items" ADD CONSTRAINT "floor_items_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_items" ADD CONSTRAINT "floor_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruited_teammates" ADD CONSTRAINT "recruited_teammates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spin_grants" ADD CONSTRAINT "spin_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spin_results" ADD CONSTRAINT "spin_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
