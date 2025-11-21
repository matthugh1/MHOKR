-- Add primaryOrganizationId field to users table
-- 
-- This migration adds a direct foreign key relationship between users and organizations.
-- This improves query performance and enables better database-level tenant isolation.
-- 
-- The primaryOrganizationId represents the user's primary organization. Users can still
-- belong to multiple organizations via role_assignments, but this field provides a
-- direct reference for the primary organization.

-- ==========================================
-- Step 1: Add primaryOrganizationId column
-- ==========================================

ALTER TABLE users 
ADD COLUMN "primaryOrganizationId" TEXT;

-- ==========================================
-- Step 2: Backfill primaryOrganizationId from role_assignments
-- ==========================================

-- Set primaryOrganizationId to the first TENANT role assignment for each user
UPDATE users
SET "primaryOrganizationId" = (
  SELECT "scopeId"
  FROM role_assignments
  WHERE role_assignments."userId" = users.id
    AND role_assignments."scopeType" = 'TENANT'
    AND role_assignments."scopeId" IS NOT NULL
  ORDER BY role_assignments."createdAt" ASC
  LIMIT 1
)
WHERE "primaryOrganizationId" IS NULL;

-- ==========================================
-- Step 3: Add foreign key constraint
-- ==========================================

ALTER TABLE users
ADD CONSTRAINT users_primary_organization_fk
FOREIGN KEY ("primaryOrganizationId")
REFERENCES organizations(id)
ON DELETE SET NULL;

-- ==========================================
-- Step 4: Add index for performance
-- ==========================================

CREATE INDEX users_primary_organization_id_idx 
ON users("primaryOrganizationId");

-- ==========================================
-- Step 5: Update RLS policies to use primaryOrganizationId
-- ==========================================

-- Drop existing user RLS policies
DROP POLICY IF EXISTS users_superuser_select ON users;
DROP POLICY IF EXISTS users_tenant_select ON users;
DROP POLICY IF EXISTS users_superuser_write ON users;
DROP POLICY IF EXISTS users_tenant_write ON users;

-- Recreate policies with primaryOrganizationId support
-- Policy: SUPERUSER can see all users (read-only)
CREATE POLICY users_superuser_select ON users
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

-- Policy: Normal users can only see users in their organization
-- Check both primaryOrganizationId (direct) and role_assignments (backward compatibility)
CREATE POLICY users_tenant_select ON users
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND (
      -- Direct primary organization match (faster)
      "primaryOrganizationId" = current_setting('app.current_organization_id', true)
      OR
      -- Fallback to role_assignments lookup (for multi-org users)
      EXISTS (
        SELECT 1 FROM role_assignments
        WHERE role_assignments."userId" = users.id
        AND role_assignments."scopeType" = 'TENANT'
        AND role_assignments."scopeId" = current_setting('app.current_organization_id', true)
      )
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
    AND (
      -- Direct primary organization match (faster)
      "primaryOrganizationId" = current_setting('app.current_organization_id', true)
      OR
      -- Fallback to role_assignments lookup (for multi-org users)
      EXISTS (
        SELECT 1 FROM role_assignments
        WHERE role_assignments."userId" = users.id
        AND role_assignments."scopeType" = 'TENANT'
        AND role_assignments."scopeId" = current_setting('app.current_organization_id', true)
      )
    )
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND (
      -- Direct primary organization match (faster)
      "primaryOrganizationId" = current_setting('app.current_organization_id', true)
      OR
      -- Fallback to role_assignments lookup (for multi-org users)
      EXISTS (
        SELECT 1 FROM role_assignments
        WHERE role_assignments."userId" = users.id
        AND role_assignments."scopeType" = 'TENANT'
        AND role_assignments."scopeId" = current_setting('app.current_organization_id', true)
      )
    )
  );

-- ==========================================
-- Notes:
-- ==========================================
-- 
-- 1. primaryOrganizationId is nullable to support users without organizations (edge case)
-- 2. Foreign key constraint uses ON DELETE SET NULL to handle organization deletion gracefully
-- 3. RLS policies check both primaryOrganizationId (fast path) and role_assignments (fallback)
-- 4. This maintains backward compatibility with multi-org users via role_assignments
-- 5. Application code should maintain primaryOrganizationId when creating/updating users
--

