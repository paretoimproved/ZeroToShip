CREATE TABLE IF NOT EXISTS "onboarding_emails" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email_type" varchar(20) NOT NULL,
  "sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "onboarding_emails_user_idx" ON "onboarding_emails" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_user_email_type_idx" ON "onboarding_emails" ("user_id", "email_type");
