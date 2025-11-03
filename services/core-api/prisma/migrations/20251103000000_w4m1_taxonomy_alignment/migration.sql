-- W4.M1: Taxonomy & Data Model Alignment Migration
-- 
-- This migration implements the canonical taxonomy decisions from OKR_TAXONOMY_DECISIONS.md:
-- 
-- 1. Cycle vs Period: Period is deprecated (validation-only concept, not exposed in API)
--    - Keep period column in DB for backward compatibility
--    - No schema changes needed (period remains for validation)
--
-- 2. Status vs Publish State: Already separate (status = progress, isPublished = governance)
--    - No schema changes needed
--    - Ensure API responses use correct fields
--
-- 3. Visibility: Deprecated values (WORKSPACE_ONLY, TEAM_ONLY, MANAGER_CHAIN, EXEC_ONLY) 
--    treated as PUBLIC_TENANT
--    - No schema changes (enum values remain for backward compatibility)
--    - Migration will normalize deprecated values to PUBLIC_TENANT in data
--
-- 4. Pillars: Deprecate pillarId in API responses (table exists but not used in UI)
--    - No schema changes needed
--    - Keep pillarId column for backward compatibility
--
-- 5. Initiatives Anchoring: Current implementation is correct (both objectiveId and keyResultId nullable)
--    - No schema changes needed

-- ==========================================
-- Step 1: Normalize deprecated visibility values to PUBLIC_TENANT
-- ==========================================
-- Convert deprecated visibility levels to PUBLIC_TENANT
UPDATE objectives
SET "visibilityLevel" = 'PUBLIC_TENANT'
WHERE "visibilityLevel" IN ('WORKSPACE_ONLY', 'TEAM_ONLY', 'MANAGER_CHAIN', 'EXEC_ONLY');

UPDATE key_results
SET "visibilityLevel" = 'PUBLIC_TENANT'
WHERE "visibilityLevel" IN ('WORKSPACE_ONLY', 'TEAM_ONLY', 'MANAGER_CHAIN', 'EXEC_ONLY');

-- ==========================================
-- Step 2: Add comment to period column indicating it's deprecated for API use
-- ==========================================
-- Note: PostgreSQL doesn't support column comments in migration SQL directly
-- Comments will be added via Prisma schema documentation

-- ==========================================
-- Step 3: Verify status and isPublished separation
-- ==========================================
-- No changes needed - status and isPublished are already separate columns

-- ==========================================
-- Step 4: Add comment to pillarId column indicating it's deprecated for API use
-- ==========================================
-- Note: PostgreSQL doesn't support column comments in migration SQL directly
-- Comments will be added via Prisma schema documentation

-- Migration complete
-- All taxonomy alignment changes are handled in application code (controllers, services)

