-- Add cryptographic unsubscribe token to user_preferences
-- Fixes IDOR vulnerability: previously used predictable user UUID for unsubscribe

ALTER TABLE "user_preferences"
  ADD COLUMN "unsubscribe_token" varchar(64) UNIQUE;

CREATE UNIQUE INDEX IF NOT EXISTS "user_prefs_unsub_token_idx"
  ON "user_preferences" ("unsubscribe_token");

-- Backfill existing rows with random tokens
UPDATE "user_preferences"
SET "unsubscribe_token" = encode(gen_random_bytes(32), 'hex')
WHERE "unsubscribe_token" IS NULL;
