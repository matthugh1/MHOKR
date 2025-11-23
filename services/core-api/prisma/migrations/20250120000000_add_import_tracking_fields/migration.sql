-- Migration: Add Import Tracking Fields for Viva Goals Import
-- This migration adds:
-- 1. externalId, source, importedAt, importedBy fields to Objective model
-- 2. externalId, source, importedAt, importedBy fields to KeyResult model
-- 3. Indexes for deduplication queries
-- 4. Unique constraints for tenant+source+externalId combination

-- Add import tracking fields to objectives table
ALTER TABLE "objectives" ADD COLUMN "externalId" TEXT;
ALTER TABLE "objectives" ADD COLUMN "source" TEXT;
ALTER TABLE "objectives" ADD COLUMN "importedAt" TIMESTAMP(3);
ALTER TABLE "objectives" ADD COLUMN "importedBy" TEXT;

-- Add foreign key constraint for importedBy
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_importedBy_fkey" 
  FOREIGN KEY ("importedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for import tracking
CREATE INDEX "objectives_source_externalId_idx" ON "objectives"("source", "externalId");

-- Add unique constraint: externalId + source must be unique per tenant
CREATE UNIQUE INDEX "objectives_tenantId_source_externalId_key" 
  ON "objectives"("tenantId", "source", "externalId") 
  WHERE "source" IS NOT NULL AND "externalId" IS NOT NULL;

-- Add import tracking fields to key_results table
ALTER TABLE "key_results" ADD COLUMN "externalId" TEXT;
ALTER TABLE "key_results" ADD COLUMN "source" TEXT;
ALTER TABLE "key_results" ADD COLUMN "importedAt" TIMESTAMP(3);
ALTER TABLE "key_results" ADD COLUMN "importedBy" TEXT;

-- Add foreign key constraint for importedBy
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_importedBy_fkey" 
  FOREIGN KEY ("importedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for import tracking
CREATE INDEX "key_results_source_externalId_idx" ON "key_results"("source", "externalId");

-- Add unique constraint: externalId + source must be unique per tenant
CREATE UNIQUE INDEX "key_results_tenantId_source_externalId_key" 
  ON "key_results"("tenantId", "source", "externalId") 
  WHERE "source" IS NOT NULL AND "externalId" IS NOT NULL;


