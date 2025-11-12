-- Migration: Rename organizationId columns to tenantId
-- Generated: 2025-01-06
-- Purpose: Consolidate to single identifier (tenantId) throughout database

BEGIN;

-- ============================================================================
-- STEP 1: Rename columns in all tenant-scoped tables
-- ============================================================================

-- Workspaces table
ALTER TABLE workspaces RENAME COLUMN "organizationId" TO "tenantId";
ALTER INDEX "workspaces_organizationId_idx" RENAME TO "workspaces_tenantId_idx";
ALTER TABLE workspaces RENAME CONSTRAINT "workspaces_organizationId_fkey" TO "workspaces_tenantId_fkey";

-- Strategic Pillars table
ALTER TABLE strategic_pillars RENAME COLUMN "organizationId" TO "tenantId";
ALTER INDEX "strategic_pillars_organizationId_idx" RENAME TO "strategic_pillars_tenantId_idx";
ALTER TABLE strategic_pillars RENAME CONSTRAINT "strategic_pillars_organizationId_fkey" TO "strategic_pillars_tenantId_fkey";

-- Cycles table
ALTER TABLE cycles RENAME COLUMN "organizationId" TO "tenantId";
ALTER INDEX "cycles_organizationId_idx" RENAME TO "cycles_tenantId_idx";
ALTER TABLE cycles RENAME CONSTRAINT "cycles_organizationId_fkey" TO "cycles_tenantId_fkey";

-- Objectives table
ALTER TABLE objectives RENAME COLUMN "organizationId" TO "tenantId";
ALTER INDEX "objectives_organizationId_idx" RENAME TO "objectives_tenantId_idx";
ALTER TABLE objectives RENAME CONSTRAINT "objectives_organizationId_fkey" TO "objectives_tenantId_fkey";

-- Check-in Requests table
ALTER TABLE check_in_requests RENAME COLUMN "organizationId" TO "tenantId";
ALTER INDEX "check_in_requests_organizationId_idx" RENAME TO "check_in_requests_tenantId_idx";
ALTER TABLE check_in_requests RENAME CONSTRAINT "check_in_requests_organizationId_fkey" TO "check_in_requests_tenantId_fkey";

-- ============================================================================
-- STEP 2: Verify all columns renamed
-- ============================================================================

DO $$
DECLARE
  remaining_org_cols INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_org_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'organizationId'
    AND table_name IN ('workspaces', 'strategic_pillars', 'cycles', 'objectives', 'check_in_requests');

  IF remaining_org_cols > 0 THEN
    RAISE EXCEPTION 'Migration failed: % columns still named organizationId', remaining_org_cols;
  END IF;

  RAISE NOTICE 'Migration successful: All organizationId columns renamed to tenantId';
END $$;

COMMIT;

