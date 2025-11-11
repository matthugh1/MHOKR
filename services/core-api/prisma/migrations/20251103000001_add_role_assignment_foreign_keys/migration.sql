-- Add Foreign Key Constraints for RoleAssignment.scopeId
-- 
-- This migration adds database-level foreign key constraints to ensure referential integrity
-- for RoleAssignment.scopeId based on scopeType.
-- 
-- Note: Since scopeId can point to different tables based on scopeType, we use check constraints
-- and triggers to validate references, as Prisma doesn't support conditional foreign keys.

-- ==========================================
-- Step 1: Create check constraint function
-- ==========================================

CREATE OR REPLACE FUNCTION validate_role_assignment_scope()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate scopeId based on scopeType
  IF NEW."scopeType" = 'PLATFORM' THEN
    -- PLATFORM scope: scopeId must be null
    IF NEW."scopeId" IS NOT NULL THEN
      RAISE EXCEPTION 'scopeId must be null for PLATFORM scope';
    END IF;
  ELSIF NEW."scopeType" = 'TENANT' THEN
    -- TENANT scope: scopeId must reference an organization
    IF NEW."scopeId" IS NULL THEN
      RAISE EXCEPTION 'scopeId is required for TENANT scope';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = NEW."scopeId") THEN
      RAISE EXCEPTION 'scopeId % does not exist in organizations table', NEW."scopeId";
    END IF;
  ELSIF NEW."scopeType" = 'WORKSPACE' THEN
    -- WORKSPACE scope: scopeId must reference a workspace
    IF NEW."scopeId" IS NULL THEN
      RAISE EXCEPTION 'scopeId is required for WORKSPACE scope';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM workspaces WHERE id = NEW."scopeId") THEN
      RAISE EXCEPTION 'scopeId % does not exist in workspaces table', NEW."scopeId";
    END IF;
  ELSIF NEW."scopeType" = 'TEAM' THEN
    -- TEAM scope: scopeId must reference a team
    IF NEW."scopeId" IS NULL THEN
      RAISE EXCEPTION 'scopeId is required for TEAM scope';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM teams WHERE id = NEW."scopeId") THEN
      RAISE EXCEPTION 'scopeId % does not exist in teams table', NEW."scopeId";
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- Step 2: Create trigger to validate on insert/update
-- ==========================================

DROP TRIGGER IF EXISTS role_assignment_scope_validation ON role_assignments;

CREATE TRIGGER role_assignment_scope_validation
  BEFORE INSERT OR UPDATE ON role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION validate_role_assignment_scope();

-- ==========================================
-- Step 3: Validate existing data
-- ==========================================

-- Check for orphaned TENANT scope assignments
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM role_assignments
  WHERE "scopeType" = 'TENANT'
    AND "scopeId" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM organizations WHERE id = role_assignments."scopeId");
  
  IF orphaned_count > 0 THEN
    RAISE WARNING 'Found % orphaned TENANT role assignments', orphaned_count;
  END IF;
END $$;

-- Check for orphaned WORKSPACE scope assignments
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM role_assignments
  WHERE "scopeType" = 'WORKSPACE'
    AND "scopeId" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM workspaces WHERE id = role_assignments."scopeId");
  
  IF orphaned_count > 0 THEN
    RAISE WARNING 'Found % orphaned WORKSPACE role assignments', orphaned_count;
  END IF;
END $$;

-- Check for orphaned TEAM scope assignments
DO $$
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM role_assignments
  WHERE "scopeType" = 'TEAM'
    AND "scopeId" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM teams WHERE id = role_assignments."scopeId");
  
  IF orphaned_count > 0 THEN
    RAISE WARNING 'Found % orphaned TEAM role assignments', orphaned_count;
  END IF;
END $$;

-- Check for invalid PLATFORM scope assignments (should have null scopeId)
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM role_assignments
  WHERE "scopeType" = 'PLATFORM'
    AND "scopeId" IS NOT NULL;
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'Found % PLATFORM role assignments with non-null scopeId', invalid_count;
  END IF;
END $$;

-- ==========================================
-- Notes:
-- ==========================================
-- 
-- 1. This uses a trigger-based approach because Prisma doesn't support conditional foreign keys
-- 2. The trigger validates scopeId references based on scopeType
-- 3. Existing orphaned data is logged as warnings but doesn't block the migration
-- 4. Future inserts/updates will be validated by the trigger
-- 5. Consider running a cleanup script to remove orphaned assignments if warnings are found
--




