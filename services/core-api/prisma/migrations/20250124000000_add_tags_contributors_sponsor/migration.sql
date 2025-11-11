-- Migration: Add Tags, Contributors, and Sponsor support
-- This migration adds:
-- 1. Tag model (tenant-scoped)
-- 2. Tag junction tables (ObjectiveTag, KeyResultTag, InitiativeTag)
-- 3. Contributor junction tables (ObjectiveContributor, KeyResultContributor, InitiativeContributor)
-- 4. sponsorId field on Objective
-- 5. tenantId field on ObjectiveKeyResult (for consistency)

-- Add tenantId to ObjectiveKeyResult junction table
ALTER TABLE "objective_key_results" ADD COLUMN "tenantId" TEXT;
-- Update existing records: set tenantId from parent Objective
UPDATE "objective_key_results" okr
SET "tenantId" = o."tenantId"
FROM "objectives" o
WHERE okr."objectiveId" = o."id";
-- Make tenantId NOT NULL after backfill
ALTER TABLE "objective_key_results" ALTER COLUMN "tenantId" SET NOT NULL;
-- Add foreign key constraint
ALTER TABLE "objective_key_results" ADD CONSTRAINT "objective_key_results_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Add index
CREATE INDEX "objective_key_results_tenantId_idx" ON "objective_key_results"("tenantId");

-- Create Tag table
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint: tag names must be unique per tenant
CREATE UNIQUE INDEX "tags_tenantId_name_key" ON "tags"("tenantId", "name");
CREATE INDEX "tags_tenantId_idx" ON "tags"("tenantId");

-- Add foreign key constraint for Tag.tenantId
ALTER TABLE "tags" ADD CONSTRAINT "tags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create ObjectiveTag junction table
CREATE TABLE "objective_tags" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "objective_tags_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint: prevent duplicate tags on same objective
CREATE UNIQUE INDEX "objective_tags_tenantId_objectiveId_tagId_key" ON "objective_tags"("tenantId", "objectiveId", "tagId");
CREATE INDEX "objective_tags_objectiveId_idx" ON "objective_tags"("objectiveId");
CREATE INDEX "objective_tags_tagId_idx" ON "objective_tags"("tagId");
CREATE INDEX "objective_tags_tenantId_idx" ON "objective_tags"("tenantId");

-- Add foreign key constraints for ObjectiveTag
ALTER TABLE "objective_tags" ADD CONSTRAINT "objective_tags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "objective_tags" ADD CONSTRAINT "objective_tags_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "objective_tags" ADD CONSTRAINT "objective_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create KeyResultTag junction table
CREATE TABLE "key_result_tags" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keyResultId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "key_result_tags_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint: prevent duplicate tags on same key result
CREATE UNIQUE INDEX "key_result_tags_tenantId_keyResultId_tagId_key" ON "key_result_tags"("tenantId", "keyResultId", "tagId");
CREATE INDEX "key_result_tags_keyResultId_idx" ON "key_result_tags"("keyResultId");
CREATE INDEX "key_result_tags_tagId_idx" ON "key_result_tags"("tagId");
CREATE INDEX "key_result_tags_tenantId_idx" ON "key_result_tags"("tenantId");

-- Add foreign key constraints for KeyResultTag
ALTER TABLE "key_result_tags" ADD CONSTRAINT "key_result_tags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "key_result_tags" ADD CONSTRAINT "key_result_tags_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "key_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "key_result_tags" ADD CONSTRAINT "key_result_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create InitiativeTag junction table
CREATE TABLE "initiative_tags" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "initiative_tags_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint: prevent duplicate tags on same initiative
CREATE UNIQUE INDEX "initiative_tags_tenantId_initiativeId_tagId_key" ON "initiative_tags"("tenantId", "initiativeId", "tagId");
CREATE INDEX "initiative_tags_initiativeId_idx" ON "initiative_tags"("initiativeId");
CREATE INDEX "initiative_tags_tagId_idx" ON "initiative_tags"("tagId");
CREATE INDEX "initiative_tags_tenantId_idx" ON "initiative_tags"("tenantId");

-- Add foreign key constraints for InitiativeTag
ALTER TABLE "initiative_tags" ADD CONSTRAINT "initiative_tags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "initiative_tags" ADD CONSTRAINT "initiative_tags_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "initiative_tags" ADD CONSTRAINT "initiative_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create ObjectiveContributor junction table
CREATE TABLE "objective_contributors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CONTRIBUTOR',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "objective_contributors_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint: prevent duplicate contributors on same objective
CREATE UNIQUE INDEX "objective_contributors_tenantId_objectiveId_userId_key" ON "objective_contributors"("tenantId", "objectiveId", "userId");
CREATE INDEX "objective_contributors_objectiveId_idx" ON "objective_contributors"("objectiveId");
CREATE INDEX "objective_contributors_userId_idx" ON "objective_contributors"("userId");
CREATE INDEX "objective_contributors_tenantId_idx" ON "objective_contributors"("tenantId");

-- Add foreign key constraints for ObjectiveContributor
ALTER TABLE "objective_contributors" ADD CONSTRAINT "objective_contributors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "objective_contributors" ADD CONSTRAINT "objective_contributors_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "objective_contributors" ADD CONSTRAINT "objective_contributors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create KeyResultContributor junction table
CREATE TABLE "key_result_contributors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keyResultId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CONTRIBUTOR',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "key_result_contributors_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint: prevent duplicate contributors on same key result
CREATE UNIQUE INDEX "key_result_contributors_tenantId_keyResultId_userId_key" ON "key_result_contributors"("tenantId", "keyResultId", "userId");
CREATE INDEX "key_result_contributors_keyResultId_idx" ON "key_result_contributors"("keyResultId");
CREATE INDEX "key_result_contributors_userId_idx" ON "key_result_contributors"("userId");
CREATE INDEX "key_result_contributors_tenantId_idx" ON "key_result_contributors"("tenantId");

-- Add foreign key constraints for KeyResultContributor
ALTER TABLE "key_result_contributors" ADD CONSTRAINT "key_result_contributors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "key_result_contributors" ADD CONSTRAINT "key_result_contributors_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "key_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "key_result_contributors" ADD CONSTRAINT "key_result_contributors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create InitiativeContributor junction table
CREATE TABLE "initiative_contributors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "initiativeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CONTRIBUTOR',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "initiative_contributors_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint: prevent duplicate contributors on same initiative
CREATE UNIQUE INDEX "initiative_contributors_tenantId_initiativeId_userId_key" ON "initiative_contributors"("tenantId", "initiativeId", "userId");
CREATE INDEX "initiative_contributors_initiativeId_idx" ON "initiative_contributors"("initiativeId");
CREATE INDEX "initiative_contributors_userId_idx" ON "initiative_contributors"("userId");
CREATE INDEX "initiative_contributors_tenantId_idx" ON "initiative_contributors"("tenantId");

-- Add foreign key constraints for InitiativeContributor
ALTER TABLE "initiative_contributors" ADD CONSTRAINT "initiative_contributors_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "initiative_contributors" ADD CONSTRAINT "initiative_contributors_initiativeId_fkey" FOREIGN KEY ("initiativeId") REFERENCES "initiatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "initiative_contributors" ADD CONSTRAINT "initiative_contributors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add sponsorId to Objective table
ALTER TABLE "objectives" ADD COLUMN "sponsorId" TEXT;
-- Add foreign key constraint for sponsorId
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Add index for sponsorId
CREATE INDEX "objectives_sponsorId_idx" ON "objectives"("sponsorId");

-- Update ActivityAction enum to include new actions
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TAG_ADDED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'TAG_REMOVED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'CONTRIBUTOR_ADDED';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'CONTRIBUTOR_REMOVED';

