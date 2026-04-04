-- Migration: Drop users.tier column
-- Tier is now derived from subscriptions.plan (single source of truth)
ALTER TABLE "users" DROP COLUMN IF EXISTS "tier";
