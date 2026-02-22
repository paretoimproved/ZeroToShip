CREATE TABLE IF NOT EXISTS "spec_generations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "idea_id" uuid NOT NULL REFERENCES "ideas"("id") ON DELETE CASCADE,
  "spec" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "spec_generations_user_idx" ON "spec_generations" ("user_id");
CREATE INDEX IF NOT EXISTS "spec_generations_idea_idx" ON "spec_generations" ("idea_id");
CREATE INDEX IF NOT EXISTS "spec_generations_created_at_idx" ON "spec_generations" ("created_at");
