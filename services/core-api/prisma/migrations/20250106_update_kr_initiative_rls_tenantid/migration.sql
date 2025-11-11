-- Migration: Update KeyResult and Initiative RLS policies to use direct tenantId
-- Generated: 2025-01-06
-- Purpose: Update KeyResult and Initiative RLS policies to use direct tenantId field instead of checking through Objective

BEGIN;

-- ============================================================================
-- STEP 1: Drop existing KeyResult RLS policies (they check via Objective relationship)
-- ============================================================================

DROP POLICY IF EXISTS key_results_superuser_select ON key_results;
DROP POLICY IF EXISTS key_results_tenant_select ON key_results;
DROP POLICY IF EXISTS key_results_superuser_write ON key_results;
DROP POLICY IF EXISTS key_results_tenant_write ON key_results;

-- ============================================================================
-- STEP 2: Create new KeyResult RLS policies using direct tenantId
-- ============================================================================

-- Policy: SUPERUSER can see all key results (read-only)
CREATE POLICY key_results_superuser_select ON key_results
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

-- Policy: Normal users can only see key results in their tenant
CREATE POLICY key_results_tenant_select ON key_results
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

-- Policy: SUPERUSER cannot modify (read-only)
CREATE POLICY key_results_superuser_write ON key_results
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Policy: Normal users can modify only key results in their tenant
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

-- ============================================================================
-- STEP 3: Enable RLS on initiatives table (if not already enabled)
-- ============================================================================

ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 4: Create Initiative RLS policies using direct tenantId
-- ============================================================================

-- Policy: SUPERUSER can see all initiatives (read-only)
CREATE POLICY initiatives_superuser_select ON initiatives
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

-- Policy: Normal users can only see initiatives in their tenant
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

-- Policy: Normal users can modify only initiatives in their tenant
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

COMMIT;



