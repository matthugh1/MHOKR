-- Migration: Remove Period Model
-- Date: 2025-11-03
-- Purpose: Drop Period enum and period columns from objectives, key_results, initiatives
-- Cycle is canonical (objectives.cycleId → cycles.id)

BEGIN;

-- Step 1: Drop period column from initiatives (nullable, no constraints)
ALTER TABLE "initiatives" DROP COLUMN IF EXISTS "period";

-- Step 2: Drop period column from key_results (nullable, no constraints)
ALTER TABLE "key_results" DROP COLUMN IF EXISTS "period";

-- Step 3: Drop period column from objectives (NOT NULL, but no FK constraints)
-- Note: This will cause data loss for existing period values
ALTER TABLE "objectives" DROP COLUMN IF EXISTS "period";

-- Step 4: Drop Period enum type
-- Only drop if no other tables reference it (should be safe after dropping columns above)
DROP TYPE IF EXISTS "Period";

COMMIT;

