-- Enable Row-Level Security (RLS) for Tenant Isolation
-- 
-- This migration enables PostgreSQL Row-Level Security as defense-in-depth
-- to protect against SQL injection attacks and direct database access.
-- 
-- RLS policies filter data by organizationId based on session variables:
-- - app.current_organization_id: Current user's organization ID (string or null for SUPERUSER)
-- - app.user_is_superuser: Boolean flag for SUPERUSER (true/false)
-- 
-- These session variables are set by Prisma middleware before queries execute.

-- ==========================================
-- Step 1: Enable RLS on tenant-scoped tables
-- ==========================================

ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategic_pillars ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- Step 2: Create RLS policies for Objectives
-- ==========================================

-- Policy: SUPERUSER can see all objectives (read-only)
CREATE POLICY objectives_superuser_select ON objectives
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

-- Policy: Normal users can only see objectives in their organization
CREATE POLICY objectives_tenant_select ON objectives
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "organizationId" = current_setting('app.current_organization_id', true)
  );

-- Policy: SUPERUSER cannot modify (read-only)
CREATE POLICY objectives_superuser_write ON objectives
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Policy: Normal users can modify only their organization's objectives
CREATE POLICY objectives_tenant_write ON objectives
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "organizationId" = current_setting('app.current_organization_id', true)
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "organizationId" = current_setting('app.current_organization_id', true)
  );

-- ==========================================
-- Step 3: Create RLS policies for Key Results
-- ==========================================

-- Key Results are accessed via objectives, so we check the parent objective's organizationId
-- Policy: SUPERUSER can see all key results (read-only)
CREATE POLICY key_results_superuser_select ON key_results
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM objectives
      WHERE objectives.id IN (
        SELECT "objectiveId" FROM objective_key_results
        WHERE "keyResultId" = key_results.id
      )
      AND (
        objectives."organizationId" IS NULL
        OR current_setting('app.user_is_superuser', true) = 'true'
      )
    )
  );

-- Policy: Normal users can only see key results linked to objectives in their organization
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
      AND objectives."organizationId" = current_setting('app.current_organization_id', true)
    )
  );

-- Policy: SUPERUSER cannot modify (read-only)
CREATE POLICY key_results_superuser_write ON key_results
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Policy: Normal users can modify only key results linked to their organization's objectives
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
      AND objectives."organizationId" = current_setting('app.current_organization_id', true)
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
      AND objectives."organizationId" = current_setting('app.current_organization_id', true)
    )
  );

-- ==========================================
-- Step 4: Create RLS policies for Workspaces
-- ==========================================

-- Policy: SUPERUSER can see all workspaces (read-only)
CREATE POLICY workspaces_superuser_select ON workspaces
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

-- Policy: Normal users can only see workspaces in their organization
CREATE POLICY workspaces_tenant_select ON workspaces
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "organizationId" = current_setting('app.current_organization_id', true)
  );

-- Policy: SUPERUSER cannot modify (read-only)
CREATE POLICY workspaces_superuser_write ON workspaces
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Policy: Normal users can modify only their organization's workspaces
CREATE POLICY workspaces_tenant_write ON workspaces
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "organizationId" = current_setting('app.current_organization_id', true)
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "organizationId" = current_setting('app.current_organization_id', true)
  );

-- ==========================================
-- Step 5: Create RLS policies for Teams
-- ==========================================

-- Teams are accessed via workspaces, so we check the workspace's organizationId
-- Policy: SUPERUSER can see all teams (read-only)
CREATE POLICY teams_superuser_select ON teams
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = teams."workspaceId"
      AND (
        workspaces."organizationId" IS NULL
        OR current_setting('app.user_is_superuser', true) = 'true'
      )
    )
  );

-- Policy: Normal users can only see teams in workspaces belonging to their organization
CREATE POLICY teams_tenant_select ON teams
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = teams."workspaceId"
      AND workspaces."organizationId" = current_setting('app.current_organization_id', true)
    )
  );

-- Policy: SUPERUSER cannot modify (read-only)
CREATE POLICY teams_superuser_write ON teams
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Policy: Normal users can modify only teams in their organization's workspaces
CREATE POLICY teams_tenant_write ON teams
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = teams."workspaceId"
      AND workspaces."organizationId" = current_setting('app.current_organization_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = teams."workspaceId"
      AND workspaces."organizationId" = current_setting('app.current_organization_id', true)
    )
  );

-- ==========================================
-- Step 6: Create RLS policies for Cycles
-- ==========================================

-- Policy: SUPERUSER can see all cycles (read-only)
CREATE POLICY cycles_superuser_select ON cycles
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

-- Policy: Normal users can only see cycles in their organization
CREATE POLICY cycles_tenant_select ON cycles
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "organizationId" = current_setting('app.current_organization_id', true)
  );

-- Policy: SUPERUSER cannot modify (read-only)
CREATE POLICY cycles_superuser_write ON cycles
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Policy: Normal users can modify only their organization's cycles
CREATE POLICY cycles_tenant_write ON cycles
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "organizationId" = current_setting('app.current_organization_id', true)
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "organizationId" = current_setting('app.current_organization_id', true)
  );

-- ==========================================
-- Step 7: Create RLS policies for Strategic Pillars
-- ==========================================

-- Policy: SUPERUSER can see all strategic pillars (read-only)
CREATE POLICY strategic_pillars_superuser_select ON strategic_pillars
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

-- Policy: Normal users can only see strategic pillars in their organization
CREATE POLICY strategic_pillars_tenant_select ON strategic_pillars
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "organizationId" = current_setting('app.current_organization_id', true)
  );

-- Policy: SUPERUSER cannot modify (read-only)
CREATE POLICY strategic_pillars_superuser_write ON strategic_pillars
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Policy: Normal users can modify only their organization's strategic pillars
CREATE POLICY strategic_pillars_tenant_write ON strategic_pillars
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "organizationId" = current_setting('app.current_organization_id', true)
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "organizationId" = current_setting('app.current_organization_id', true)
  );

-- ==========================================
-- Step 8: Create RLS policies for Check-In Requests
-- ==========================================

-- Policy: SUPERUSER can see all check-in requests (read-only)
CREATE POLICY check_in_requests_superuser_select ON check_in_requests
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

-- Policy: Normal users can only see check-in requests in their organization
CREATE POLICY check_in_requests_tenant_select ON check_in_requests
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "organizationId" = current_setting('app.current_organization_id', true)
  );

-- Policy: SUPERUSER cannot modify (read-only)
CREATE POLICY check_in_requests_superuser_write ON check_in_requests
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Policy: Normal users can modify only their organization's check-in requests
CREATE POLICY check_in_requests_tenant_write ON check_in_requests
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "organizationId" = current_setting('app.current_organization_id', true)
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND "organizationId" = current_setting('app.current_organization_id', true)
  );

-- ==========================================
-- Step 9: Create RLS policies for Organizations
-- ==========================================

-- Policy: SUPERUSER can see all organizations (read-only)
CREATE POLICY organizations_superuser_select ON organizations
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

-- Policy: Normal users can only see their own organization
CREATE POLICY organizations_tenant_select ON organizations
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND id = current_setting('app.current_organization_id', true)
  );

-- Policy: SUPERUSER cannot modify (read-only)
CREATE POLICY organizations_superuser_write ON organizations
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Policy: Normal users can modify only their own organization
CREATE POLICY organizations_tenant_write ON organizations
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND id = current_setting('app.current_organization_id', true)
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND id = current_setting('app.current_organization_id', true)
  );

-- ==========================================
-- Notes:
-- ==========================================
-- 
-- 1. Session variables are set by Prisma middleware before each query
-- 2. If session variables are not set, policies will fail (fail-safe)
-- 3. SUPERUSER policies allow read-only access to all tenants
-- 4. Normal user policies restrict to their organizationId
-- 5. This is defense-in-depth - application-level validation still required
--


