-- Migration: Update RLS policies to use tenantId instead of organizationId
-- Generated: 2025-01-06
-- Purpose: Update existing RLS policies to reference tenantId column and app.current_tenant_id session variable

BEGIN;

-- ============================================================================
-- STEP 1: Drop existing RLS policies (they reference organizationId)
-- ============================================================================

-- Objectives policies
DROP POLICY IF EXISTS objectives_superuser_select ON objectives;
DROP POLICY IF EXISTS objectives_tenant_select ON objectives;
DROP POLICY IF EXISTS objectives_superuser_write ON objectives;
DROP POLICY IF EXISTS objectives_tenant_write ON objectives;

-- Key Results policies
DROP POLICY IF EXISTS key_results_superuser_select ON key_results;
DROP POLICY IF EXISTS key_results_tenant_select ON key_results;
DROP POLICY IF EXISTS key_results_superuser_write ON key_results;
DROP POLICY IF EXISTS key_results_tenant_write ON key_results;

-- Workspaces policies
DROP POLICY IF EXISTS workspaces_superuser_select ON workspaces;
DROP POLICY IF EXISTS workspaces_tenant_select ON workspaces;
DROP POLICY IF EXISTS workspaces_superuser_write ON workspaces;
DROP POLICY IF EXISTS workspaces_tenant_write ON workspaces;

-- Teams policies
DROP POLICY IF EXISTS teams_superuser_select ON teams;
DROP POLICY IF EXISTS teams_tenant_select ON teams;
DROP POLICY IF EXISTS teams_superuser_write ON teams;
DROP POLICY IF EXISTS teams_tenant_write ON teams;

-- Cycles policies
DROP POLICY IF EXISTS cycles_superuser_select ON cycles;
DROP POLICY IF EXISTS cycles_tenant_select ON cycles;
DROP POLICY IF EXISTS cycles_superuser_write ON cycles;
DROP POLICY IF EXISTS cycles_tenant_write ON cycles;

-- Strategic Pillars policies
DROP POLICY IF EXISTS strategic_pillars_superuser_select ON strategic_pillars;
DROP POLICY IF EXISTS strategic_pillars_tenant_select ON strategic_pillars;
DROP POLICY IF EXISTS strategic_pillars_superuser_write ON strategic_pillars;
DROP POLICY IF EXISTS strategic_pillars_tenant_write ON strategic_pillars;

-- Check-In Requests policies
DROP POLICY IF EXISTS check_in_requests_superuser_select ON check_in_requests;
DROP POLICY IF EXISTS check_in_requests_tenant_select ON check_in_requests;
DROP POLICY IF EXISTS check_in_requests_superuser_write ON check_in_requests;
DROP POLICY IF EXISTS check_in_requests_tenant_write ON check_in_requests;

-- Organizations policies
DROP POLICY IF EXISTS organizations_superuser_select ON organizations;
DROP POLICY IF EXISTS organizations_tenant_select ON organizations;
DROP POLICY IF EXISTS organizations_superuser_write ON organizations;
DROP POLICY IF EXISTS organizations_tenant_write ON organizations;

-- ============================================================================
-- STEP 2: Recreate RLS policies with tenantId and app.current_tenant_id
-- ============================================================================

-- ==========================================
-- Objectives Policies
-- ==========================================

CREATE POLICY objectives_superuser_select ON objectives
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

CREATE POLICY objectives_tenant_select ON objectives
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY objectives_superuser_write ON objectives
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY objectives_tenant_write ON objectives
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

-- ==========================================
-- Key Results Policies
-- ==========================================

CREATE POLICY key_results_superuser_select ON key_results
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

CREATE POLICY key_results_tenant_select ON key_results
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND EXISTS (
      SELECT 1 FROM objectives
      WHERE objectives.id IN (
        SELECT "objectiveId" FROM objective_key_results
        WHERE "keyResultId" = key_results.id
      )
      AND objectives."tenantId" = current_setting('app.current_tenant_id', true)
    )
  );

CREATE POLICY key_results_superuser_write ON key_results
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY key_results_tenant_write ON key_results
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND EXISTS (
      SELECT 1 FROM objectives
      WHERE objectives.id IN (
        SELECT "objectiveId" FROM objective_key_results
        WHERE "keyResultId" = key_results.id
      )
      AND objectives."tenantId" = current_setting('app.current_tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND EXISTS (
      SELECT 1 FROM objectives
      WHERE objectives.id IN (
        SELECT "objectiveId" FROM objective_key_results
        WHERE "keyResultId" = key_results.id
      )
      AND objectives."tenantId" = current_setting('app.current_tenant_id', true)
    )
  );

-- ==========================================
-- Workspaces Policies
-- ==========================================

CREATE POLICY workspaces_superuser_select ON workspaces
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

CREATE POLICY workspaces_tenant_select ON workspaces
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY workspaces_superuser_write ON workspaces
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY workspaces_tenant_write ON workspaces
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

-- ==========================================
-- Teams Policies
-- ==========================================

CREATE POLICY teams_superuser_select ON teams
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

CREATE POLICY teams_tenant_select ON teams
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = teams."workspaceId"
      AND workspaces."tenantId" = current_setting('app.current_tenant_id', true)
    )
  );

CREATE POLICY teams_superuser_write ON teams
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY teams_tenant_write ON teams
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = teams."workspaceId"
      AND workspaces."tenantId" = current_setting('app.current_tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = teams."workspaceId"
      AND workspaces."tenantId" = current_setting('app.current_tenant_id', true)
    )
  );

-- ==========================================
-- Cycles Policies
-- ==========================================

CREATE POLICY cycles_superuser_select ON cycles
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

CREATE POLICY cycles_tenant_select ON cycles
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY cycles_superuser_write ON cycles
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY cycles_tenant_write ON cycles
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

-- ==========================================
-- Strategic Pillars Policies
-- ==========================================

CREATE POLICY strategic_pillars_superuser_select ON strategic_pillars
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

CREATE POLICY strategic_pillars_tenant_select ON strategic_pillars
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY strategic_pillars_superuser_write ON strategic_pillars
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY strategic_pillars_tenant_write ON strategic_pillars
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

-- ==========================================
-- Check-In Requests Policies
-- ==========================================

CREATE POLICY check_in_requests_superuser_select ON check_in_requests
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

CREATE POLICY check_in_requests_tenant_select ON check_in_requests
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY check_in_requests_superuser_write ON check_in_requests
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY check_in_requests_tenant_write ON check_in_requests
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "tenantId" = current_setting('app.current_tenant_id', true)
  );

-- ==========================================
-- Organizations Policies
-- ==========================================

CREATE POLICY organizations_superuser_select ON organizations
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

CREATE POLICY organizations_tenant_select ON organizations
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND id = current_setting('app.current_tenant_id', true)
  );

CREATE POLICY organizations_superuser_write ON organizations
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE POLICY organizations_tenant_write ON organizations
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND id = current_setting('app.current_tenant_id', true)
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND id = current_setting('app.current_tenant_id', true)
  );

COMMIT;

