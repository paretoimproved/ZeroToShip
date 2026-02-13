ALTER TABLE "pipeline_runs"
ADD COLUMN IF NOT EXISTS "generation_mode" varchar(20) DEFAULT 'legacy' NOT NULL;

ALTER TABLE "pipeline_runs"
ADD COLUMN IF NOT EXISTS "generation_diagnostics" jsonb;
