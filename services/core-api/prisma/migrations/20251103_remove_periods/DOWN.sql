-- Rollback Migration: Restore Period Model
-- Date: 2025-11-03
-- Purpose: Restore Period enum and period columns (best-effort rollback)

BEGIN;

-- Step 1: Recreate Period enum type
CREATE TYPE "Period" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL', 'CUSTOM');

-- Step 2: Add period column back to objectives (NOT NULL, default QUARTERLY)
-- Note: Data loss occurred - existing period values cannot be recovered
ALTER TABLE "objectives" 
  ADD COLUMN "period" "Period" NOT NULL DEFAULT 'QUARTERLY';

-- Step 3: Add period column back to key_results (nullable)
ALTER TABLE "key_results" 
  ADD COLUMN "period" "Period";

-- Step 4: Add period column back to initiatives (nullable)
ALTER TABLE "initiatives" 
  ADD COLUMN "period" "Period";

-- Optional: Attempt to backfill period from cycle relationships
-- This is best-effort and may not match original period values
-- Uncomment if you want to attempt backfill:
-- UPDATE "objectives" 
-- SET "period" = CASE 
--   WHEN EXTRACT(EPOCH FROM ("endDate" - "startDate")) / 86400 BETWEEN 25 AND 35 THEN 'MONTHLY'::"Period"
--   WHEN EXTRACT(EPOCH FROM ("endDate" - "startDate")) / 86400 BETWEEN 85 AND 95 THEN 'QUARTERLY'::"Period"
--   WHEN EXTRACT(EPOCH FROM ("endDate" - "startDate")) / 86400 BETWEEN 360 AND 370 THEN 'ANNUAL'::"Period"
--   ELSE 'CUSTOM'::"Period"
-- END
-- WHERE "period" IS NULL OR "period" = 'QUARTERLY'::"Period";

COMMIT;

