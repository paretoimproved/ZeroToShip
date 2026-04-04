ALTER TABLE "pipeline_runs" ADD COLUMN "status" varchar(20) DEFAULT 'running' NOT NULL;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD COLUMN "phase_results" jsonb;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD COLUMN "phase_stats" jsonb;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD COLUMN "last_completed_phase" text;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
