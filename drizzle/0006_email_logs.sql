CREATE TABLE IF NOT EXISTS "email_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "run_id" text,
  "user_id" uuid NOT NULL,
  "recipient_email" varchar(255) NOT NULL,
  "subject" varchar(500) NOT NULL,
  "message_id" varchar(255),
  "status" varchar(20) NOT NULL DEFAULT 'sent',
  "error" text,
  "sent_at" timestamp DEFAULT now() NOT NULL,
  "delivered_at" timestamp,
  "opened_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_run_id_idx" ON "email_logs" ("run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_user_id_idx" ON "email_logs" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_logs_message_id_unique_idx" ON "email_logs" ("message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_status_idx" ON "email_logs" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_logs_sent_at_idx" ON "email_logs" ("sent_at");
