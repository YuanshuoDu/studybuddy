-- Migration: add_multi_platform_auth
-- Spec: docs/api/v1.md §3.1 + docs/architecture-v1.0.md §4 (User table)
--
-- Adds support for merging multi-platform logins (WeChat / Apple / Google /
-- Phone) into a single User record.  `openid` is relaxed to nullable so
-- users can sign up with phone/Apple/Google only and link WeChat later.
--
-- ADR-0003: https://docs.studybuddy.com/adr/0003-auth-strategy

-- 1. New enum
CREATE TYPE "AuthProvider" AS ENUM ('WECHAT', 'APPLE', 'GOOGLE', 'PHONE');

-- 2. Schema changes on users
ALTER TABLE "users"
  ADD COLUMN     "apple_sub"        TEXT,
  ADD COLUMN     "google_sub"       TEXT,
  ADD COLUMN     "primary_provider" "AuthProvider" NOT NULL DEFAULT 'WECHAT',
  ALTER COLUMN   "openid"           DROP NOT NULL;

-- 3. Unique indexes — enforce 1:1 between (provider, id) and User
CREATE UNIQUE INDEX "users_apple_sub_key"  ON "users"("apple_sub");
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");

-- 4. Lookup index for phone-first merge queries
CREATE INDEX "users_phone_idx" ON "users"("phone");
