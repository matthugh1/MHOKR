-- ==========================================
-- Diagnostic Queries for Sarah Chen Permission Issue
-- ==========================================
-- IMPORTANT: Run these queries ONE AT A TIME
-- Copy and paste each query separately into your SQL client
-- ==========================================

-- ==========================================
-- QUERY 1: Find Sarah Chen's user ID
-- ==========================================
-- Run this first to get Sarah Chen's user ID
-- Then use that ID in the queries below
-- ==========================================

SELECT id, email, name, "isSuperuser" 
FROM users 
WHERE email LIKE '%sarah%' OR email LIKE '%chen%' OR name LIKE '%Sarah%' OR name LIKE '%Chen%';

-- ==========================================
-- QUERY 2: Check TENANT role assignments
-- ==========================================
-- Replace '<user-id>' with the actual user ID from Query 1
-- ==========================================

SELECT 
  id,
  "userId",
  role,
  "scopeType",
  "scopeId",
  "createdAt",
  "updatedAt"
FROM role_assignments
WHERE "userId" = '<user-id>'
AND "scopeType" = 'TENANT';

-- ==========================================
-- QUERY 3: Check organization memberships
-- ==========================================
-- Replace '<user-id>' with the actual user ID from Query 1
-- ==========================================

SELECT 
  id,
  "userId",
  "organizationId",
  role,
  "createdAt",
  "updatedAt"
FROM organization_members
WHERE "userId" = '<user-id>';

-- ==========================================
-- QUERY 4: Check ALL role assignments (all scopes)
-- ==========================================
-- Replace '<user-id>' with the actual user ID from Query 1
-- This shows all roles across all scopes
-- ==========================================

SELECT 
  id,
  "userId",
  role,
  "scopeType",
  "scopeId",
  "createdAt"
FROM role_assignments
WHERE "userId" = '<user-id>'
ORDER BY "scopeType", "scopeId";

-- ==========================================
-- QUERY 5: Compare role assignment with organization membership
-- ==========================================
-- Replace '<user-id>' with the actual user ID from Query 1
-- This checks if scopeId matches organizationId
-- ==========================================

SELECT 
  ra."scopeId" as role_assignment_scope_id,
  om."organizationId" as organization_member_org_id,
  ra.role as role_assignment_role,
  om.role as org_member_role,
  CASE 
    WHEN ra."scopeId" = om."organizationId" THEN '✅ Match'
    ELSE '❌ MISMATCH'
  END as id_match_status
FROM role_assignments ra
FULL OUTER JOIN organization_members om 
  ON om."userId" = ra."userId" 
  AND om."organizationId" = ra."scopeId"
WHERE ra."userId" = '<user-id>'
AND ra."scopeType" = 'TENANT';

-- ==========================================
-- QUERY 6: List all organizations
-- ==========================================
-- Use this to see what organization IDs exist
-- ==========================================

SELECT id, name, slug, "createdAt"
FROM organizations
ORDER BY "createdAt" DESC
LIMIT 10;

