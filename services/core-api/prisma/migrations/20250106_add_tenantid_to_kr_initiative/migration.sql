-- Migration: Add tenantId to KeyResult and Initiative
-- Generated: 2025-01-06
-- Purpose: Add tenantId to KeyResult and Initiative for proper tenant isolation

BEGIN;

-- ============================================================================
-- STEP 1: Add tenantId column to key_results table
-- ============================================================================
ALTER TABLE key_results ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- ============================================================================
-- STEP 2: Backfill key_results.tenantId from parent Objective
-- ============================================================================
UPDATE key_results kr
SET "tenantId" = o."tenantId"
FROM objective_key_results okr
JOIN objectives o ON okr."objectiveId" = o.id
WHERE kr.id = okr."keyResultId"
  AND kr."tenantId" IS NULL
  AND o."tenantId" IS NOT NULL;

-- ============================================================================
-- STEP 3: Quarantine any KeyResults that can't be mapped to a tenant
-- ============================================================================
UPDATE key_results
SET "tenantId" = 'tenant_quarantine_0000000000000000000000'
WHERE "tenantId" IS NULL;

-- ============================================================================
-- STEP 4: Add tenantId column to initiatives table
-- ============================================================================
ALTER TABLE initiatives ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- ============================================================================
-- STEP 5: Backfill initiatives.tenantId from parent Objective
-- ============================================================================
UPDATE initiatives i
SET "tenantId" = o."tenantId"
FROM objectives o
WHERE i."objectiveId" = o.id
  AND i."tenantId" IS NULL
  AND o."tenantId" IS NOT NULL;

-- ============================================================================
-- STEP 6: Quarantine any Initiatives that can't be mapped to a tenant
-- ============================================================================
UPDATE initiatives
SET "tenantId" = 'tenant_quarantine_0000000000000000000000'
WHERE "tenantId" IS NULL;

-- ============================================================================
-- STEP 7: Add NOT NULL constraints
-- ============================================================================
ALTER TABLE key_results ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE initiatives ALTER COLUMN "tenantId" SET NOT NULL;

-- ============================================================================
-- STEP 8: Add foreign key constraints
-- ============================================================================
ALTER TABLE key_results 
  ADD CONSTRAINT "key_results_tenantId_fkey" 
  FOREIGN KEY ("tenantId") 
  REFERENCES organizations(id) 
  ON DELETE CASCADE;

ALTER TABLE initiatives 
  ADD CONSTRAINT "initiatives_tenantId_fkey" 
  FOREIGN KEY ("tenantId") 
  REFERENCES organizations(id) 
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 9: Add indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS "key_results_tenantId_idx" ON key_results("tenantId");
CREATE INDEX IF NOT EXISTS "initiatives_tenantId_idx" ON initiatives("tenantId");

-- ============================================================================
-- STEP 10: Verify migration
-- ============================================================================
DO $$
DECLARE
  null_key_results INTEGER;
  null_initiatives INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_key_results
  FROM key_results
  WHERE "tenantId" IS NULL;

  SELECT COUNT(*) INTO null_initiatives
  FROM initiatives
  WHERE "tenantId" IS NULL;

  IF null_key_results > 0 OR null_initiatives > 0 THEN
    RAISE EXCEPTION 'Migration failed: NULL tenantId values remain. KeyResults: %, Initiatives: %', null_key_results, null_initiatives;
  END IF;

  RAISE NOTICE 'Migration successful: All KeyResults and Initiatives have tenantId';
END $$;

COMMIT;



