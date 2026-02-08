-- Migration: Add pipeline_runs table for persisting scheduler run history
-- Date: 2026-02-08
-- Purpose: Track all pipeline runs with config, phases, stats, and brief summaries

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id SERIAL PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  config JSONB NOT NULL,
  phases JSONB NOT NULL,
  stats JSONB NOT NULL,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  total_duration INTEGER,
  errors JSONB DEFAULT '[]'::jsonb,
  api_metrics JSONB,
  brief_summaries JSONB
);

-- Index for efficient lookups by run_id (already has UNIQUE constraint)
-- Index for ordering by started_at
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started_at ON pipeline_runs(started_at DESC);

-- Index for filtering by success status
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_success ON pipeline_runs(success);

COMMENT ON TABLE pipeline_runs IS 'Persisted results of each scheduler pipeline run';
COMMENT ON COLUMN pipeline_runs.run_id IS 'Unique run identifier (e.g. run_20260208_abc12345)';
COMMENT ON COLUMN pipeline_runs.phases IS 'Phase status map: { scrape, analyze, generate, deliver } with completed/failed values';
COMMENT ON COLUMN pipeline_runs.stats IS 'Aggregate stats: { postsScraped, clustersCreated, ideasGenerated, emailsSent }';
COMMENT ON COLUMN pipeline_runs.errors IS 'Array of PipelineError objects from the run';
COMMENT ON COLUMN pipeline_runs.api_metrics IS 'API call metrics summary (token usage, costs, call counts)';
COMMENT ON COLUMN pipeline_runs.brief_summaries IS 'Summary of generated briefs: [{ name, tagline, priorityScore, effortEstimate }]';
