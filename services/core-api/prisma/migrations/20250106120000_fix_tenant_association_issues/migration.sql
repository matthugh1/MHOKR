-- ============================================================================
-- Database Schema Tenant Association Fixes
-- ============================================================================
-- 
-- This script addresses critical tenant association issues identified in
-- DATABASE_SCHEMA_TENANT_ANALYSIS.md
--
-- IMPORTANT: Run these migrations in order, and verify data integrity
-- between each step.
--
-- ============================================================================
-- Note: Prisma automatically wraps migrations in transactions
-- ============================================================================
-- FIX 1: Make objectives.tenantId NOT NULL
-- ============================================================================
-- Priority: P0 - CRITICAL
-- Issue: objectives.tenantId is nullable, allowing data integrity violations

-- Step 1: Verify no NULL values exist
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM objectives
  WHERE "tenantId" IS NULL;
  
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Cannot proceed: Found % objectives with NULL tenantId. Backfill required.', null_count;
  END IF;
END $$;

-- Step 2: Add NOT NULL constraint
ALTER TABLE objectives ALTER COLUMN "tenantId" SET NOT NULL;

DO $$ BEGIN RAISE NOTICE 'Fix 1 complete: objectives.tenantId is now NOT NULL'; END $$;

-- ============================================================================
-- FIX 2: Add tenantId to activities table
-- ============================================================================
-- Priority: P0 - CRITICAL
-- Issue: activities table has no tenant association, creating security risk

-- Step 1: Add tenantId column
ALTER TABLE activities ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- Step 2: Backfill tenantId from entity relationships
UPDATE activities a
SET "tenantId" = (
  CASE a."entityType"
    WHEN 'OBJECTIVE' THEN (
      SELECT o."tenantId" 
      FROM objectives o 
      WHERE o.id = a."entityId"
      LIMIT 1
    )
    WHEN 'KEY_RESULT' THEN (
      SELECT kr."tenantId" 
      FROM key_results kr 
      WHERE kr.id = a."entityId"
      LIMIT 1
    )
    WHEN 'INITIATIVE' THEN (
      SELECT i."tenantId" 
      FROM initiatives i 
      WHERE i.id = a."entityId"
      LIMIT 1
    )
    WHEN 'CHECK_IN' THEN (
      SELECT kr."tenantId" 
      FROM check_ins ci
      JOIN key_results kr ON ci."keyResultId" = kr.id
      WHERE ci.id = a."entityId"
      LIMIT 1
    )
    ELSE NULL
  END
)
WHERE a."tenantId" IS NULL;

-- Step 3: Quarantine any activities that can't be mapped
UPDATE activities
SET "tenantId" = 'tenant_quarantine_0000000000000000000000'
WHERE "tenantId" IS NULL;

-- Step 4: Add NOT NULL constraint
ALTER TABLE activities ALTER COLUMN "tenantId" SET NOT NULL;

-- Step 5: Add foreign key constraint
ALTER TABLE activities 
  ADD CONSTRAINT "activities_tenantId_fkey" 
  FOREIGN KEY ("tenantId") 
  REFERENCES organizations(id) 
  ON DELETE CASCADE;

-- Step 6: Add index
CREATE INDEX IF NOT EXISTS "activities_tenantId_idx" ON activities("tenantId");

DO $$ BEGIN RAISE NOTICE 'Fix 2 complete: activities table now has tenantId'; END $$;

-- ============================================================================
-- FIX 3: Add tenantId to user_layouts table
-- ============================================================================
-- Priority: P1 - HIGH
-- Issue: user_layouts table has no tenant association

-- Step 1: Add tenantId column
ALTER TABLE user_layouts ADD COLUMN IF NOT EXISTS "tenantId" TEXT;

-- Step 2: Backfill tenantId from entity relationships
UPDATE user_layouts ul
SET "tenantId" = (
  CASE ul."entityType"
    WHEN 'OBJECTIVE' THEN (
      SELECT o."tenantId" 
      FROM objectives o 
      WHERE o.id = ul."entityId"
      LIMIT 1
    )
    WHEN 'KEY_RESULT' THEN (
      SELECT kr."tenantId" 
      FROM key_results kr 
      WHERE kr.id = ul."entityId"
      LIMIT 1
    )
    WHEN 'INITIATIVE' THEN (
      SELECT i."tenantId" 
      FROM initiatives i 
      WHERE i.id = ul."entityId"
      LIMIT 1
    )
    ELSE NULL
  END
)
WHERE ul."tenantId" IS NULL;

-- Step 3: Quarantine any layouts that can't be mapped
UPDATE user_layouts
SET "tenantId" = 'tenant_quarantine_0000000000000000000000'
WHERE "tenantId" IS NULL;

-- Step 4: Add NOT NULL constraint
ALTER TABLE user_layouts ALTER COLUMN "tenantId" SET NOT NULL;

-- Step 5: Add foreign key constraint
ALTER TABLE user_layouts 
  ADD CONSTRAINT "user_layouts_tenantId_fkey" 
  FOREIGN KEY ("tenantId") 
  REFERENCES organizations(id) 
  ON DELETE CASCADE;

-- Step 6: Add index
CREATE INDEX IF NOT EXISTS "user_layouts_tenantId_idx" ON user_layouts("tenantId");

DO $$ BEGIN RAISE NOTICE 'Fix 3 complete: user_layouts table now has tenantId'; END $$;

-- ============================================================================
-- FIX 4: Enable RLS on initiatives table
-- ============================================================================
-- Priority: P1 - HIGH
-- Issue: initiatives has tenantId but no RLS policies

ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS initiatives_superuser_select ON initiatives;
DROP POLICY IF EXISTS initiatives_tenant_select ON initiatives;
DROP POLICY IF EXISTS initiatives_superuser_write ON initiatives;
DROP POLICY IF EXISTS initiatives_tenant_write ON initiatives;

-- Policy: SUPERUSER can see all initiatives (read-only)
CREATE POLICY initiatives_superuser_select ON initiatives
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

-- Policy: Normal users can only see initiatives in their organization
CREATE POLICY initiatives_tenant_select ON initiatives
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

-- Policy: SUPERUSER cannot modify (read-only)
CREATE POLICY initiatives_superuser_write ON initiatives
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Policy: Normal users can modify only their organization's initiatives
CREATE POLICY initiatives_tenant_write ON initiatives
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

DO $$ BEGIN RAISE NOTICE 'Fix 4 complete: RLS enabled on initiatives'; END $$;

-- ============================================================================
-- FIX 5: Enable RLS on activities table
-- ============================================================================
-- Priority: P0 - CRITICAL (after adding tenantId)

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS activities_superuser_select ON activities;
DROP POLICY IF EXISTS activities_tenant_select ON activities;
DROP POLICY IF EXISTS activities_superuser_write ON activities;
DROP POLICY IF EXISTS activities_tenant_write ON activities;

-- Policy: SUPERUSER can see all activities (read-only)
CREATE POLICY activities_superuser_select ON activities
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

-- Policy: Normal users can only see activities in their organization
CREATE POLICY activities_tenant_select ON activities
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

-- Policy: SUPERUSER cannot modify (read-only)
CREATE POLICY activities_superuser_write ON activities
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Policy: Normal users can modify only their organization's activities
CREATE POLICY activities_tenant_write ON activities
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

DO $$ BEGIN RAISE NOTICE 'Fix 5 complete: RLS enabled on activities'; END $$;

-- ============================================================================
-- FIX 6: Enable RLS on user_layouts table
-- ============================================================================
-- Priority: P1 - HIGH (after adding tenantId)

ALTER TABLE user_layouts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS user_layouts_superuser_select ON user_layouts;
DROP POLICY IF EXISTS user_layouts_tenant_select ON user_layouts;
DROP POLICY IF EXISTS user_layouts_superuser_write ON user_layouts;
DROP POLICY IF EXISTS user_layouts_tenant_write ON user_layouts;

-- Policy: SUPERUSER can see all layouts (read-only)
CREATE POLICY user_layouts_superuser_select ON user_layouts
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

-- Policy: Normal users can only see layouts in their organization
CREATE POLICY user_layouts_tenant_select ON user_layouts
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

-- Policy: SUPERUSER cannot modify (read-only)
CREATE POLICY user_layouts_superuser_write ON user_layouts
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Policy: Normal users can modify only their organization's layouts
CREATE POLICY user_layouts_tenant_write ON user_layouts
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

DO $$ BEGIN RAISE NOTICE 'Fix 6 complete: RLS enabled on user_layouts'; END $$;

-- ============================================================================
-- FIX 7: Optimize key_results RLS policies to use direct tenantId
-- ============================================================================
-- Priority: P1 - HIGH
-- Issue: Current policies use indirect checks via objectives join

-- Drop existing policies
DROP POLICY IF EXISTS key_results_superuser_select ON key_results;
DROP POLICY IF EXISTS key_results_tenant_select ON key_results;
DROP POLICY IF EXISTS key_results_superuser_write ON key_results;
DROP POLICY IF EXISTS key_results_tenant_write ON key_results;

-- Create optimized policies using direct tenantId
CREATE POLICY key_results_superuser_select ON key_results
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

CREATE POLICY key_results_tenant_select ON key_results
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY key_results_superuser_write ON key_results
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY key_results_tenant_write ON key_results
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

DO $$ BEGIN RAISE NOTICE 'Fix 7 complete: key_results RLS policies optimized'; END $$;

-- ============================================================================
-- Verification Queries
-- ============================================================================

DO $$
DECLARE
  null_objectives INTEGER;
  null_activities INTEGER;
  null_layouts INTEGER;
BEGIN
  -- Check objectives
  SELECT COUNT(*) INTO null_objectives
  FROM objectives
  WHERE "tenantId" IS NULL;
  
  IF null_objectives > 0 THEN
    RAISE WARNING 'Found % objectives with NULL tenantId', null_objectives;
  END IF;
  
  -- Check activities
  SELECT COUNT(*) INTO null_activities
  FROM activities
  WHERE "tenantId" IS NULL;
  
  IF null_activities > 0 THEN
    RAISE WARNING 'Found % activities with NULL tenantId', null_activities;
  END IF;
  
  -- Check user_layouts
  SELECT COUNT(*) INTO null_layouts
  FROM user_layouts
  WHERE "tenantId" IS NULL;
  
  IF null_layouts > 0 THEN
    RAISE WARNING 'Found % user_layouts with NULL tenantId', null_layouts;
  END IF;
  
  RAISE NOTICE 'Verification complete. All critical fixes applied successfully.';
END $$;

-- ============================================================================
-- Notes:
-- ============================================================================
-- 
-- 1. This script addresses P0 and P1 issues from the analysis
-- 2. P2 issues (audit_logs, permission_audits) are deferred to Phase 3
-- 3. Additional RLS policies for indirect associations (check_ins, etc.) 
--    should be added in a separate migration
-- 4. Always backup database before running migrations
-- 5. Test in staging environment first
-- 6. Monitor query performance after enabling RLS
--

