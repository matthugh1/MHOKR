-- Verification Queries for Tenant Association Migration
-- Run these AFTER migration to verify everything is correct

-- ============================================================================
-- 1. Check for NULL tenantId values (should all be 0)
-- ============================================================================

SELECT 
  'objectives' as table_name,
  COUNT(*) as null_tenant_count
FROM objectives 
WHERE "tenantId" IS NULL

UNION ALL

SELECT 
  'activities' as table_name,
  COUNT(*) as null_tenant_count
FROM activities 
WHERE "tenantId" IS NULL

UNION ALL

SELECT 
  'user_layouts' as table_name,
  COUNT(*) as null_tenant_count
FROM user_layouts 
WHERE "tenantId" IS NULL;

-- Expected: All should return 0

-- ============================================================================
-- 2. Verify RLS is enabled on all tenant-scoped tables
-- ============================================================================

SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'objectives',
  'key_results',
  'activities',
  'user_layouts',
  'initiatives',
  'workspaces',
  'teams',
  'cycles',
  'strategic_pillars',
  'check_in_requests',
  'organizations'
)
ORDER BY tablename;

-- Expected: All should show rls_enabled = true

-- ============================================================================
-- 3. Check for orphaned records (should be 0 or minimal)
-- ============================================================================

-- Orphaned activities
SELECT COUNT(*) as orphaned_activities
FROM activities a
WHERE NOT EXISTS (
  SELECT 1 FROM organizations o WHERE o.id = a."tenantId"
);

-- Orphaned user_layouts
SELECT COUNT(*) as orphaned_layouts
FROM user_layouts ul
WHERE NOT EXISTS (
  SELECT 1 FROM organizations o WHERE o.id = ul."tenantId"
);

-- Orphaned objectives (should be 0 after migration)
SELECT COUNT(*) as orphaned_objectives
FROM objectives o
WHERE NOT EXISTS (
  SELECT 1 FROM organizations org WHERE org.id = o."tenantId"
);

-- Expected: All should return 0

-- ============================================================================
-- 4. Verify foreign key constraints exist
-- ============================================================================

SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('activities', 'user_layouts', 'objectives')
  AND kcu.column_name = 'tenantId'
ORDER BY tc.table_name;

-- Expected: Should show foreign keys to organizations.id

-- ============================================================================
-- 5. Sample data check - verify tenantId values are valid
-- ============================================================================

-- Check a few sample records
SELECT 
  'activities' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT "tenantId") as unique_tenants
FROM activities

UNION ALL

SELECT 
  'user_layouts' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT "tenantId") as unique_tenants
FROM user_layouts

UNION ALL

SELECT 
  'objectives' as table_name,
  COUNT(*) as total_records,
  COUNT(DISTINCT "tenantId") as unique_tenants
FROM objectives;

-- Expected: Should show reasonable counts and tenant distribution

-- ============================================================================
-- 6. Verify indexes exist
-- ============================================================================

SELECT
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname LIKE '%tenantId%' 
    OR indexname LIKE '%activities_tenantId%'
    OR indexname LIKE '%user_layouts_tenantId%'
  )
ORDER BY tablename, indexname;

-- Expected: Should show indexes on tenantId columns

-- ============================================================================
-- 7. Check RLS policies exist
-- ============================================================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('activities', 'user_layouts', 'initiatives')
ORDER BY tablename, policyname;

-- Expected: Should show 4 policies per table (superuser select, tenant select, superuser write, tenant write)

-- ============================================================================
-- Summary Report
-- ============================================================================

DO $$
DECLARE
  null_objectives INTEGER;
  null_activities INTEGER;
  null_layouts INTEGER;
  rls_count INTEGER;
  fk_count INTEGER;
BEGIN
  -- Check NULL values
  SELECT COUNT(*) INTO null_objectives FROM objectives WHERE "tenantId" IS NULL;
  SELECT COUNT(*) INTO null_activities FROM activities WHERE "tenantId" IS NULL;
  SELECT COUNT(*) INTO null_layouts FROM user_layouts WHERE "tenantId" IS NULL;
  
  -- Check RLS enabled
  SELECT COUNT(*) INTO rls_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('activities', 'user_layouts', 'initiatives')
    AND rowsecurity = true;
  
  -- Check foreign keys
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('activities', 'user_layouts')
    AND kcu.column_name = 'tenantId';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tenant Association Migration Verification';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'NULL tenantId counts:';
  RAISE NOTICE '  Objectives: %', null_objectives;
  RAISE NOTICE '  Activities: %', null_activities;
  RAISE NOTICE '  User Layouts: %', null_layouts;
  RAISE NOTICE '';
  RAISE NOTICE 'RLS enabled tables: %/3', rls_count;
  RAISE NOTICE 'Foreign key constraints: %/2', fk_count;
  RAISE NOTICE '';
  
  IF null_objectives = 0 AND null_activities = 0 AND null_layouts = 0 AND rls_count = 3 AND fk_count = 2 THEN
    RAISE NOTICE '✅ ALL CHECKS PASSED - Migration successful!';
  ELSE
    RAISE WARNING '⚠️  Some checks failed - Review the results above';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

