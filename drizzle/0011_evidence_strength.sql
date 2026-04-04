-- Evidence-first briefs: add evidence metadata and embedding columns to ideas table
-- All columns are nullable for backward compatibility with existing briefs

ALTER TABLE "ideas" ADD COLUMN IF NOT EXISTS "evidence_strength" VARCHAR(20);
ALTER TABLE "ideas" ADD COLUMN IF NOT EXISTS "brief_type" VARCHAR(20) DEFAULT 'full';
ALTER TABLE "ideas" ADD COLUMN IF NOT EXISTS "source_count" INTEGER;
ALTER TABLE "ideas" ADD COLUMN IF NOT EXISTS "total_engagement" INTEGER;
ALTER TABLE "ideas" ADD COLUMN IF NOT EXISTS "platform_count" INTEGER;
ALTER TABLE "ideas" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

CREATE INDEX IF NOT EXISTS "ideas_evidence_strength_idx" ON "ideas" ("evidence_strength");
