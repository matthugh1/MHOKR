-- Migration: Add metadata fields for Viva Goals data preservation
-- This migration adds JSONB metadata fields to store Viva Goals data
-- until features are fully implemented

-- Add metadata field to objectives
ALTER TABLE "objectives" ADD COLUMN "metadata" JSONB;

-- Add metadata field to key_results
ALTER TABLE "key_results" ADD COLUMN "metadata" JSONB;

-- Add metadata field to check_ins
ALTER TABLE "check_ins" ADD COLUMN "metadata" JSONB;

-- Add GIN indexes for efficient JSONB queries (optional, for future use)
CREATE INDEX "objectives_metadata_idx" ON "objectives" USING GIN ("metadata");
CREATE INDEX "key_results_metadata_idx" ON "key_results" USING GIN ("metadata");
CREATE INDEX "check_ins_metadata_idx" ON "check_ins" USING GIN ("metadata");

