-- Migration: Add Viva Goals Feature Gaps
-- Date: 2025-01-27
-- Purpose: Add GoalType, createdBy, teamId (for KRs/Initiatives), progress (for Initiatives), and NOT_STARTED status
-- Phase: Phase 1 - Database Changes

-- ==========================================
-- 1. Add GoalType enum
-- ==========================================
CREATE TYPE "GoalType" AS ENUM ('ASPIRATIONAL', 'COMMITTED');

-- ==========================================
-- 2. Add NOT_STARTED to OKRStatus enum
-- ==========================================
-- Note: PostgreSQL doesn't support adding enum values in the middle, so we add it at the beginning
-- The enum order in Prisma will be: NOT_STARTED, ON_TRACK, AT_RISK, OFF_TRACK, COMPLETED, CANCELLED
ALTER TYPE "OKRStatus" ADD VALUE IF NOT EXISTS 'NOT_STARTED';

-- ==========================================
-- 3. Add goalType fields to objectives, key_results, and initiatives
-- ==========================================
ALTER TABLE "objectives" ADD COLUMN "goalType" "GoalType" DEFAULT 'ASPIRATIONAL';
ALTER TABLE "key_results" ADD COLUMN "goalType" "GoalType" DEFAULT 'ASPIRATIONAL';
ALTER TABLE "initiatives" ADD COLUMN "goalType" "GoalType" DEFAULT 'ASPIRATIONAL';

-- ==========================================
-- 4. Add createdBy fields to objectives, key_results, and initiatives
-- ==========================================
ALTER TABLE "objectives" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "key_results" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "initiatives" ADD COLUMN "createdBy" TEXT;

-- ==========================================
-- 5. Add teamId fields to key_results and initiatives
-- ==========================================
ALTER TABLE "key_results" ADD COLUMN "teamId" TEXT;
ALTER TABLE "initiatives" ADD COLUMN "teamId" TEXT;

-- ==========================================
-- 6. Add progress field to initiatives
-- ==========================================
ALTER TABLE "initiatives" ADD COLUMN "progress" DOUBLE PRECISION;

-- ==========================================
-- 7. Add foreign key constraints
-- ==========================================

-- createdBy foreign keys
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_createdBy_fkey" 
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_createdBy_fkey" 
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_createdBy_fkey" 
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL;

-- teamId foreign keys
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_teamId_fkey" 
  FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL;
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_teamId_fkey" 
  FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL;

-- ==========================================
-- 8. Add indexes
-- ==========================================

-- GoalType indexes
CREATE INDEX "objectives_goalType_idx" ON "objectives"("goalType");
CREATE INDEX "key_results_goalType_idx" ON "key_results"("goalType");
CREATE INDEX "initiatives_goalType_idx" ON "initiatives"("goalType");

-- createdBy indexes
CREATE INDEX "objectives_createdBy_idx" ON "objectives"("createdBy");
CREATE INDEX "key_results_createdBy_idx" ON "key_results"("createdBy");
CREATE INDEX "initiatives_createdBy_idx" ON "initiatives"("createdBy");

-- teamId indexes
CREATE INDEX "key_results_teamId_idx" ON "key_results"("teamId");
CREATE INDEX "initiatives_teamId_idx" ON "initiatives"("teamId");

-- progress index
CREATE INDEX "initiatives_progress_idx" ON "initiatives"("progress");

-- ==========================================
-- 9. Backfill createdBy from activities table
-- ==========================================
-- Backfill objectives.createdBy from activities where action = 'CREATED'
UPDATE "objectives" o
SET "createdBy" = a."userId"
FROM "activities" a
WHERE a."entityType" = 'OBJECTIVE' 
  AND a."entityId" = o.id 
  AND a."action" = 'CREATED'
  AND o."createdBy" IS NULL;

-- Backfill key_results.createdBy from activities where action = 'CREATED'
UPDATE "key_results" kr
SET "createdBy" = a."userId"
FROM "activities" a
WHERE a."entityType" = 'KEY_RESULT' 
  AND a."entityId" = kr.id 
  AND a."action" = 'CREATED'
  AND kr."createdBy" IS NULL;

-- Backfill initiatives.createdBy from activities where action = 'CREATED'
UPDATE "initiatives" i
SET "createdBy" = a."userId"
FROM "activities" a
WHERE a."entityType" = 'INITIATIVE' 
  AND a."entityId" = i.id 
  AND a."action" = 'CREATED'
  AND i."createdBy" IS NULL;

-- ==========================================
-- 10. Fallback: Set createdBy = ownerId where still null
-- ==========================================
UPDATE "objectives" SET "createdBy" = "ownerId" WHERE "createdBy" IS NULL;
UPDATE "key_results" SET "createdBy" = "ownerId" WHERE "createdBy" IS NULL;
UPDATE "initiatives" SET "createdBy" = "ownerId" WHERE "createdBy" IS NULL;

-- ==========================================
-- 11. Inherit teamId for Key Results from parent Objective
-- ==========================================
UPDATE "key_results" kr
SET "teamId" = o."teamId"
FROM "objective_key_results" okr
JOIN "objectives" o ON okr."objectiveId" = o.id
WHERE okr."keyResultId" = kr.id 
  AND kr."teamId" IS NULL 
  AND o."teamId" IS NOT NULL;

-- ==========================================
-- 12. Inherit teamId for Initiatives from parent Objective/KeyResult
-- ==========================================
-- Inherit from parent Objective
UPDATE "initiatives" i
SET "teamId" = o."teamId"
FROM "objectives" o
WHERE i."objectiveId" = o.id 
  AND i."teamId" IS NULL 
  AND o."teamId" IS NOT NULL;

-- Inherit from parent KeyResult (if Objective doesn't have teamId)
UPDATE "initiatives" i
SET "teamId" = kr."teamId"
FROM "key_results" kr
WHERE i."keyResultId" = kr.id 
  AND i."teamId" IS NULL 
  AND kr."teamId" IS NOT NULL;

-- ==========================================
-- Migration Complete
-- ==========================================
-- Summary:
-- ✅ Added GoalType enum (ASPIRATIONAL, COMMITTED)
-- ✅ Added NOT_STARTED to OKRStatus enum
-- ✅ Added goalType fields to objectives, key_results, initiatives (default: ASPIRATIONAL)
-- ✅ Added createdBy fields to objectives, key_results, initiatives
-- ✅ Added teamId fields to key_results, initiatives
-- ✅ Added progress field to initiatives
-- ✅ Added foreign key constraints
-- ✅ Added indexes for performance
-- ✅ Backfilled createdBy from activities table
-- ✅ Fallback: Set createdBy = ownerId where activities not found
-- ✅ Inherited teamId for Key Results from parent Objectives
-- ✅ Inherited teamId for Initiatives from parent Objectives/KeyResults

