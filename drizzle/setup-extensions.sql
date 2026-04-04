-- Enable pgvector extension for future embedding search
-- Run this in Supabase SQL Editor

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Future: Add embedding column to ideas table
-- ALTER TABLE ideas ADD COLUMN IF NOT EXISTS embedding vector(1536);
-- CREATE INDEX IF NOT EXISTS ideas_embedding_idx ON ideas USING ivfflat (embedding vector_cosine_ops);
