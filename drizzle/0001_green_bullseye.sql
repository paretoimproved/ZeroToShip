CREATE TABLE IF NOT EXISTS "pipeline_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"config" jsonb NOT NULL,
	"phases" jsonb NOT NULL,
	"stats" jsonb NOT NULL,
	"success" boolean DEFAULT false NOT NULL,
	"total_duration" integer,
	"errors" jsonb DEFAULT '[]'::jsonb,
	"api_metrics" jsonb,
	"brief_summaries" jsonb,
	CONSTRAINT "pipeline_runs_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"fresh_briefs_used" integer DEFAULT 0 NOT NULL,
	"validation_requests_used" integer DEFAULT 0 NOT NULL,
	"overage_briefs" integer DEFAULT 0 NOT NULL,
	"overage_amount_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "sources" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usage_user_date_idx" ON "usage_tracking" ("user_id","date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usage_tracking_user_idx" ON "usage_tracking" ("user_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_tracking" ADD CONSTRAINT "usage_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
