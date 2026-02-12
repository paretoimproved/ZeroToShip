-- Migration: Hash API keys - drop plaintext key column, add key_prefix column
-- The key_hash column already exists; we just need to:
-- 1. Add key_prefix for display (e.g. "if_...xY9z")
-- 2. Drop the plaintext key column

ALTER TABLE "api_keys" ADD COLUMN "key_prefix" varchar(12) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "key";
