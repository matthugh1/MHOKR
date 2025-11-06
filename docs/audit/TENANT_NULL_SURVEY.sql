-- Tenant NULL Survey
-- Generated: 2025-01-XX
-- Purpose: Auto-generated probes for NULL tenant_id per table
-- 
-- Execute these queries to identify rows with NULL organizationId that need backfilling.
-- After Phase 2 migration, all tenant_id columns should be NOT NULL.

-- ============================================================================
-- TABLE: workspaces
-- ============================================================================
-- organizationId is NOT NULL in schema, but check for any orphaned rows
SELECT 
    'workspaces' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE "organizationId" IS NULL) AS null_count,
    COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL) AS not_null_count
FROM workspaces;

-- List orphaned workspaces (should be 0)
SELECT 
    id,
    name,
    "organizationId",
    "createdAt"
FROM workspaces
WHERE "organizationId" IS NULL
ORDER BY "createdAt" DESC
LIMIT 100;

-- ============================================================================
-- TABLE: strategic_pillars
-- ============================================================================
-- organizationId is NOT NULL in schema
SELECT 
    'strategic_pillars' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE "organizationId" IS NULL) AS null_count,
    COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL) AS not_null_count
FROM strategic_pillars;

-- List orphaned pillars (should be 0)
SELECT 
    id,
    name,
    "organizationId",
    "createdAt"
FROM strategic_pillars
WHERE "organizationId" IS NULL
ORDER BY "createdAt" DESC
LIMIT 100;

-- ============================================================================
-- TABLE: cycles
-- ============================================================================
-- organizationId is NOT NULL in schema
SELECT 
    'cycles' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE "organizationId" IS NULL) AS null_count,
    COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL) AS not_null_count
FROM cycles;

-- List orphaned cycles (should be 0)
SELECT 
    id,
    name,
    "organizationId",
    "createdAt"
FROM cycles
WHERE "organizationId" IS NULL
ORDER BY "createdAt" DESC
LIMIT 100;

-- ============================================================================
-- TABLE: objectives (CRITICAL - nullable organizationId)
-- ============================================================================
-- organizationId is NULLABLE in schema (legacy data)
SELECT 
    'objectives' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE "organizationId" IS NULL) AS null_count,
    COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL) AS not_null_count
FROM objectives;

-- List objectives with NULL organizationId
SELECT 
    id,
    title,
    "organizationId",
    "workspaceId",
    "teamId",
    "cycleId",
    "createdAt"
FROM objectives
WHERE "organizationId" IS NULL
ORDER BY "createdAt" DESC
LIMIT 100;

-- Backfill strategy: objectives can inherit tenant from:
-- 1. cycle.organizationId (if cycleId is set)
-- 2. workspace.organizationId (if workspaceId is set)
-- 3. team.workspace.organizationId (if teamId is set)
-- 4. TENANT_QUARANTINE (if irreconcilable)

-- Check objectives that can be backfilled via cycle
SELECT 
    o.id,
    o.title,
    o."cycleId",
    c."organizationId" AS cycle_org_id,
    'CAN_BACKFILL_VIA_CYCLE' AS backfill_strategy
FROM objectives o
LEFT JOIN cycles c ON o."cycleId" = c.id
WHERE o."organizationId" IS NULL
  AND c."organizationId" IS NOT NULL
LIMIT 100;

-- Check objectives that can be backfilled via workspace
SELECT 
    o.id,
    o.title,
    o."workspaceId",
    w."organizationId" AS workspace_org_id,
    'CAN_BACKFILL_VIA_WORKSPACE' AS backfill_strategy
FROM objectives o
LEFT JOIN workspaces w ON o."workspaceId" = w.id
WHERE o."organizationId" IS NULL
  AND w."organizationId" IS NOT NULL
LIMIT 100;

-- Check objectives that can be backfilled via team -> workspace
SELECT 
    o.id,
    o.title,
    o."teamId",
    t."workspaceId",
    w."organizationId" AS workspace_org_id,
    'CAN_BACKFILL_VIA_TEAM' AS backfill_strategy
FROM objectives o
LEFT JOIN teams t ON o."teamId" = t.id
LEFT JOIN workspaces w ON t."workspaceId" = w.id
WHERE o."organizationId" IS NULL
  AND w."organizationId" IS NOT NULL
LIMIT 100;

-- Check irreconcilable objectives (no parent context)
SELECT 
    o.id,
    o.title,
    o."workspaceId",
    o."teamId",
    o."cycleId",
    'IRRECONCILABLE' AS backfill_strategy
FROM objectives o
WHERE o."organizationId" IS NULL
  AND o."cycleId" IS NULL
  AND o."workspaceId" IS NULL
  AND o."teamId" IS NULL
ORDER BY o."createdAt" DESC
LIMIT 100;

-- ============================================================================
-- TABLE: key_results
-- ============================================================================
-- key_results does NOT have organizationId field directly
-- Tenant is inherited from parent objective via objective_key_results junction
-- Check for key results with no parent objective (orphaned)
SELECT 
    'key_results' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM objective_key_results 
        WHERE "keyResultId" = key_results.id
    )) AS orphaned_count
FROM key_results;

-- List key results with no parent objective
SELECT 
    kr.id,
    kr.title,
    kr."cycleId",
    'ORPHANED_KEY_RESULT' AS issue
FROM key_results kr
WHERE NOT EXISTS (
    SELECT 1 FROM objective_key_results okr
    WHERE okr."keyResultId" = kr.id
)
ORDER BY kr."createdAt" DESC
LIMIT 100;

-- Check key results that can backfill via cycle
SELECT 
    kr.id,
    kr.title,
    kr."cycleId",
    c."organizationId" AS cycle_org_id,
    'CAN_BACKFILL_VIA_CYCLE' AS backfill_strategy
FROM key_results kr
LEFT JOIN cycles c ON kr."cycleId" = c.id
WHERE NOT EXISTS (
    SELECT 1 FROM objective_key_results okr
    WHERE okr."keyResultId" = kr.id
)
  AND c."organizationId" IS NOT NULL
LIMIT 100;

-- ============================================================================
-- TABLE: initiatives
-- ============================================================================
-- initiatives does NOT have organizationId field directly
-- Tenant is inherited from parent objective via objectiveId
-- Check for initiatives with no parent objective (orphaned)
SELECT 
    'initiatives' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE "objectiveId" IS NULL) AS orphaned_count
FROM initiatives;

-- List initiatives with no parent objective
SELECT 
    i.id,
    i.title,
    i."objectiveId",
    i."cycleId",
    'ORPHANED_INITIATIVE' AS issue
FROM initiatives i
WHERE i."objectiveId" IS NULL
ORDER BY i."createdAt" DESC
LIMIT 100;

-- Check initiatives that can backfill via cycle
SELECT 
    i.id,
    i.title,
    i."cycleId",
    c."organizationId" AS cycle_org_id,
    'CAN_BACKFILL_VIA_CYCLE' AS backfill_strategy
FROM initiatives i
LEFT JOIN cycles c ON i."cycleId" = c.id
WHERE i."objectiveId" IS NULL
  AND c."organizationId" IS NOT NULL
LIMIT 100;

-- ============================================================================
-- TABLE: check_in_requests
-- ============================================================================
-- organizationId is NOT NULL in schema
SELECT 
    'check_in_requests' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE "organizationId" IS NULL) AS null_count,
    COUNT(*) FILTER (WHERE "organizationId" IS NOT NULL) AS not_null_count
FROM check_in_requests;

-- List orphaned check-in requests (should be 0)
SELECT 
    id,
    "requesterUserId",
    "targetUserId",
    "organizationId",
    "createdAt"
FROM check_in_requests
WHERE "organizationId" IS NULL
ORDER BY "createdAt" DESC
LIMIT 100;

-- ============================================================================
-- SUMMARY QUERY
-- ============================================================================
-- Run this to get a complete overview of NULL tenant_id across all tables
SELECT 
    'workspaces' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE "organizationId" IS NULL) AS null_count
FROM workspaces
UNION ALL
SELECT 
    'strategic_pillars' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE "organizationId" IS NULL) AS null_count
FROM strategic_pillars
UNION ALL
SELECT 
    'cycles' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE "organizationId" IS NULL) AS null_count
FROM cycles
UNION ALL
SELECT 
    'objectives' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE "organizationId" IS NULL) AS null_count
FROM objectives
UNION ALL
SELECT 
    'check_in_requests' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE "organizationId" IS NULL) AS null_count
FROM check_in_requests
ORDER BY null_count DESC, table_name;

-- ============================================================================
-- BACKFILL VALIDATION QUERIES (Run AFTER migration)
-- ============================================================================
-- After Phase 2 migration, all organizationId columns should be NOT NULL
-- Run these queries to verify 0 NULL values remain:

-- Verify objectives backfill
SELECT 
    'objectives' AS table_name,
    COUNT(*) FILTER (WHERE "organizationId" IS NULL) AS remaining_nulls
FROM objectives
HAVING COUNT(*) FILTER (WHERE "organizationId" IS NULL) > 0;

-- Verify all tables have 0 NULLs
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM objectives WHERE "organizationId" IS NULL) THEN 'FAIL: objectives has NULL organizationId'
        WHEN EXISTS (SELECT 1 FROM workspaces WHERE "organizationId" IS NULL) THEN 'FAIL: workspaces has NULL organizationId'
        WHEN EXISTS (SELECT 1 FROM strategic_pillars WHERE "organizationId" IS NULL) THEN 'FAIL: strategic_pillars has NULL organizationId'
        WHEN EXISTS (SELECT 1 FROM cycles WHERE "organizationId" IS NULL) THEN 'FAIL: cycles has NULL organizationId'
        WHEN EXISTS (SELECT 1 FROM check_in_requests WHERE "organizationId" IS NULL) THEN 'FAIL: check_in_requests has NULL organizationId'
        ELSE 'PASS: All tenant_id columns are NOT NULL'
    END AS validation_result;

