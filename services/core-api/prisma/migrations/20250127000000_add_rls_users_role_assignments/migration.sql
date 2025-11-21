-- Enable Row-Level Security (RLS) for Users and Role Assignments
-- 
-- This migration adds RLS policies to the users and role_assignments tables
-- to enforce tenant isolation at the database level.
-- 
-- RLS policies filter data based on session variables:
-- - app.current_organization_id: Current user's organization ID (string or null for SUPERUSER)
-- - app.user_is_superuser: Boolean flag for SUPERUSER (true/false)
-- 
-- These session variables are set by Prisma middleware before queries execute.

-- ==========================================
-- Step 1: Enable RLS on users and role_assignments tables
-- ==========================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_assignments ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- Step 2: Create RLS policies for Users
-- ==========================================

-- Policy: SUPERUSER can see all users (read-only)
CREATE POLICY users_superuser_select ON users
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

-- Policy: Normal users can only see users in their organization
-- Users are linked to organizations through role_assignments table
CREATE POLICY users_tenant_select ON users
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND EXISTS (
      SELECT 1 FROM role_assignments
      WHERE role_assignments."userId" = users.id
      AND role_assignments."scopeType" = 'TENANT'
      AND role_assignments."scopeId" = current_setting('app.current_organization_id', true)
    )
  );

-- Policy: SUPERUSER cannot modify users (read-only)
CREATE POLICY users_superuser_write ON users
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Policy: Normal users can modify only users in their organization
CREATE POLICY users_tenant_write ON users
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND EXISTS (
      SELECT 1 FROM role_assignments
      WHERE role_assignments."userId" = users.id
      AND role_assignments."scopeType" = 'TENANT'
      AND role_assignments."scopeId" = current_setting('app.current_organization_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND EXISTS (
      SELECT 1 FROM role_assignments
      WHERE role_assignments."userId" = users.id
      AND role_assignments."scopeType" = 'TENANT'
      AND role_assignments."scopeId" = current_setting('app.current_organization_id', true)
    )
  );

-- ==========================================
-- Step 3: Create RLS policies for Role Assignments
-- ==========================================

-- Policy: SUPERUSER can see all role assignments (read-only)
CREATE POLICY role_assignments_superuser_select ON role_assignments
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

-- Policy: Normal users can only see role assignments in their organization
-- For TENANT scope: check scopeId matches current organization
-- For WORKSPACE/TEAM scope: check parent organization matches current organization
CREATE POLICY role_assignments_tenant_select ON role_assignments
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND (
      -- TENANT scope: direct match
      (
        "scopeType" = 'TENANT'
        AND "scopeId" = current_setting('app.current_organization_id', true)
      )
      OR
      -- WORKSPACE scope: check workspace belongs to current organization
      (
        "scopeType" = 'WORKSPACE'
        AND EXISTS (
          SELECT 1 FROM workspaces
          WHERE workspaces.id = role_assignments."scopeId"
          AND workspaces."tenantId" = current_setting('app.current_organization_id', true)
        )
      )
      OR
      -- TEAM scope: check team's workspace belongs to current organization
      (
        "scopeType" = 'TEAM'
        AND EXISTS (
          SELECT 1 FROM teams
          INNER JOIN workspaces ON workspaces.id = teams."workspaceId"
          WHERE teams.id = role_assignments."scopeId"
          AND workspaces."tenantId" = current_setting('app.current_organization_id', true)
        )
      )
      OR
      -- PLATFORM scope: only visible to superuser (handled by superuser policy)
      "scopeType" = 'PLATFORM'
    )
  );

-- Policy: SUPERUSER cannot modify role assignments (read-only)
CREATE POLICY role_assignments_superuser_write ON role_assignments
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Policy: Normal users can modify only role assignments in their organization
CREATE POLICY role_assignments_tenant_write ON role_assignments
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND (
      -- TENANT scope: direct match
      (
        "scopeType" = 'TENANT'
        AND "scopeId" = current_setting('app.current_organization_id', true)
      )
      OR
      -- WORKSPACE scope: check workspace belongs to current organization
      (
        "scopeType" = 'WORKSPACE'
        AND EXISTS (
          SELECT 1 FROM workspaces
          WHERE workspaces.id = role_assignments."scopeId"
          AND workspaces."tenantId" = current_setting('app.current_organization_id', true)
        )
      )
      OR
      -- TEAM scope: check team's workspace belongs to current organization
      (
        "scopeType" = 'TEAM'
        AND EXISTS (
          SELECT 1 FROM teams
          INNER JOIN workspaces ON workspaces.id = teams."workspaceId"
          WHERE teams.id = role_assignments."scopeId"
          AND workspaces."tenantId" = current_setting('app.current_organization_id', true)
        )
      )
    )
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND (
      -- TENANT scope: direct match
      (
        "scopeType" = 'TENANT'
        AND "scopeId" = current_setting('app.current_organization_id', true)
      )
      OR
      -- WORKSPACE scope: check workspace belongs to current organization
      (
        "scopeType" = 'WORKSPACE'
        AND EXISTS (
          SELECT 1 FROM workspaces
          WHERE workspaces.id = role_assignments."scopeId"
          AND workspaces."tenantId" = current_setting('app.current_organization_id', true)
        )
      )
      OR
      -- TEAM scope: check team's workspace belongs to current organization
      (
        "scopeType" = 'TEAM'
        AND EXISTS (
          SELECT 1 FROM teams
          INNER JOIN workspaces ON workspaces.id = teams."workspaceId"
          WHERE teams.id = role_assignments."scopeId"
          AND workspaces."tenantId" = current_setting('app.current_organization_id', true)
        )
      )
    )
  );

-- ==========================================
-- Step 4: Add indexes for RLS policy performance
-- ==========================================

-- Index for users RLS policy (role_assignments lookup)
CREATE INDEX IF NOT EXISTS role_assignments_user_tenant_idx 
ON role_assignments("userId", "scopeType", "scopeId")
WHERE "scopeType" = 'TENANT';

-- Index for role_assignments RLS policy (workspace lookup)
CREATE INDEX IF NOT EXISTS workspaces_tenant_id_idx 
ON workspaces("tenantId");

-- Index for role_assignments RLS policy (team -> workspace lookup)
CREATE INDEX IF NOT EXISTS teams_workspace_id_idx 
ON teams("workspaceId");

-- ==========================================
-- Notes:
-- ==========================================
-- 
-- 1. Session variables are set by Prisma middleware before each query
-- 2. If session variables are not set, policies will fail (fail-safe)
-- 3. SUPERUSER policies allow read-only access to all tenants
-- 4. Normal user policies restrict to their organizationId
-- 5. Users table policies use EXISTS subquery on role_assignments (may have performance impact)
-- 6. Role assignments policies check parent organization for WORKSPACE/TEAM scopes
-- 7. This is defense-in-depth - application-level validation still required
--

