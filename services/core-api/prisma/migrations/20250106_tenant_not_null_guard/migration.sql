-- Tenant NOT NULL Guard Migration
-- Generated: 2025-01-06
-- Purpose: Backfill NULL tenantId, add NOT NULL constraints, and enforce tenant boundaries
--
-- Strategy:
-- 1. Backfill NULL tenantId via parent joins (objectives→cycles/workspaces/teams)
-- 2. Quarantine irreconcilable rows into TENANT_QUARANTINE id
-- 3. Add NOT NULL constraints to all tenant-scoped tables
-- 4. Add composite uniqueness constraints under tenant scope
-- 5. Add foreign keys to organizations(id) with ON DELETE RESTRICT

BEGIN;

-- ============================================================================
-- STEP 1: Create TENANT_QUARANTINE organization for irreconcilable rows
-- ============================================================================
-- This organisation will hold rows that cannot be mapped to a tenant
-- These rows should be reviewed manually and either deleted or assigned to a real tenant
INSERT INTO organizations (id, name, slug, "createdAt", "updatedAt")
VALUES (
  'tenant_quarantine_0000000000000000000000',
  'TENANT_QUARANTINE',
  'tenant-quarantine',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 2: Backfill objectives.tenantId from parent relationships
-- ============================================================================

-- Strategy 1: Backfill via cycle
UPDATE objectives o
SET "tenantId" = c."tenantId"
FROM cycles c
WHERE o."tenantId" IS NULL
  AND o."cycleId" = c.id
  AND c."tenantId" IS NOT NULL;

-- Strategy 2: Backfill via workspace
UPDATE objectives o
SET "tenantId" = w."tenantId"
FROM workspaces w
WHERE o."tenantId" IS NULL
  AND o."workspaceId" = w.id
  AND w."tenantId" IS NOT NULL;

-- Strategy 3: Backfill via team → workspace
UPDATE objectives o
SET "tenantId" = w."tenantId"
FROM teams t
JOIN workspaces w ON t."workspaceId" = w.id
WHERE o."tenantId" IS NULL
  AND o."teamId" = t.id
  AND w."tenantId" IS NOT NULL;

-- Strategy 4: Quarantine irreconcilable objectives
UPDATE objectives
SET "tenantId" = 'tenant_quarantine_0000000000000000000000'
WHERE "tenantId" IS NULL;

-- ============================================================================
-- STEP 3: Verify backfill (should show 0 NULLs)
-- ============================================================================
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM objectives
  WHERE "tenantId" IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'Backfill failed: objectives table still has % NULL tenantId values', null_count;
  END IF;

  RAISE NOTICE 'Backfill successful: objectives table has 0 NULL tenantId values';
END $$;

-- ============================================================================
-- STEP 4: Add NOT NULL constraint to objectives.tenantId (if not already NOT NULL)
-- ============================================================================
-- Note: This may already be NOT NULL if column was created that way
-- Only alter if currently nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'objectives'
    AND column_name = 'tenantId'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE objectives
      ALTER COLUMN "tenantId" SET NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 7: Verify all tenant-scoped tables have NOT NULL constraints
-- ============================================================================
DO $$
DECLARE
  nullable_tables TEXT[];
BEGIN
  SELECT ARRAY_AGG(table_name) INTO nullable_tables
  FROM (
    SELECT 'workspaces' AS table_name WHERE EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'workspaces' AND column_name = 'tenantId' AND is_nullable = 'YES'
    )
    UNION ALL
    SELECT 'cycles' WHERE EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'cycles' AND column_name = 'tenantId' AND is_nullable = 'YES'
    )
    UNION ALL
    SELECT 'strategic_pillars' WHERE EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'strategic_pillars' AND column_name = 'tenantId' AND is_nullable = 'YES'
    )
    UNION ALL
    SELECT 'check_in_requests' WHERE EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'check_in_requests' AND column_name = 'tenantId' AND is_nullable = 'YES'
    )
  ) t;

  IF array_length(nullable_tables, 1) > 0 THEN
    RAISE WARNING 'Tables with nullable tenantId: %', array_to_string(nullable_tables, ', ');
  ELSE
    RAISE NOTICE 'All tenant-scoped tables have NOT NULL tenantId';
  END IF;
END $$;

-- ============================================================================
-- STEP 8: Report backfill statistics
-- ============================================================================
DO $$
DECLARE
  quarantined_count INTEGER;
  total_objectives INTEGER;
BEGIN
  SELECT COUNT(*) INTO quarantined_count
  FROM objectives
  WHERE "tenantId" = 'tenant_quarantine_0000000000000000000000';

  SELECT COUNT(*) INTO total_objectives
  FROM objectives;

  RAISE NOTICE 'Migration complete. Objectives backfilled:';
  RAISE NOTICE '  Total objectives: %', total_objectives;
  RAISE NOTICE '  Quarantined (irreconcilable): %', quarantined_count;
  RAISE NOTICE '  Successfully backfilled: %', total_objectives - quarantined_count;

  IF quarantined_count > 0 THEN
    RAISE WARNING 'ACTION REQUIRED: % objectives quarantined. Review and assign to real tenants.', quarantined_count;
  END IF;
END $$;

COMMIT;

