-- Compare Role Assignments Between Local and Azure Databases
-- 
-- This SQL query helps diagnose why Company OKRs might not display in Azure but do locally.
-- Run this query against both databases and compare the results.
--
-- Usage:
--   Local:  psql -h localhost -U okr_user -d okr_nexus -f scripts/db/compare-role-assignments.sql
--   Azure:  psql -h <azure-host> -U <user> -d <db> -f scripts/db/compare-role-assignments.sql

-- ============================================================================
-- USER SUMMARY WITH TENANT ROLES
-- ============================================================================
-- Shows all users with their primary organization and tenant-level role assignments
-- This is the most relevant query for diagnosing Company OKRs visibility issues

SELECT 
    u.id AS user_id,
    u.email,
    u.name,
    u."isSuperuser",
    u."primaryOrganizationId",
    o.name AS primary_org_name,
    COUNT(ra.id) FILTER (WHERE ra."scopeType" = 'TENANT') AS tenant_role_count,
    STRING_AGG(
        DISTINCT ra.role || ':' || ra."scopeId",
        ', '
        ORDER BY ra.role || ':' || ra."scopeId"
    ) FILTER (WHERE ra."scopeType" = 'TENANT') AS tenant_roles
FROM 
    users u
LEFT JOIN 
    organizations o ON u."primaryOrganizationId" = o.id
LEFT JOIN 
    role_assignments ra ON u.id = ra."userId" AND ra."scopeType" = 'TENANT'
GROUP BY 
    u.id, u.email, u.name, u."isSuperuser", u."primaryOrganizationId", o.name
ORDER BY 
    u.email;

-- ============================================================================
-- DETAILED TENANT ROLE ASSIGNMENTS
-- ============================================================================
-- Shows all tenant-level role assignments with organization names

SELECT 
    u.email,
    u.name AS user_name,
    ra.role,
    ra."scopeType",
    ra."scopeId",
    o.name AS organization_name,
    ra."createdAt"
FROM 
    role_assignments ra
JOIN 
    users u ON ra."userId" = u.id
LEFT JOIN 
    organizations o ON ra."scopeId" = o.id
WHERE 
    ra."scopeType" = 'TENANT'
ORDER BY 
    u.email, ra.role, o.name;

-- ============================================================================
-- USERS WITHOUT TENANT ROLES
-- ============================================================================
-- Shows users who don't have any tenant-level roles
-- These users might not be able to see Company OKRs

SELECT 
    u.id,
    u.email,
    u.name,
    u."primaryOrganizationId",
    o.name AS primary_org_name,
    COUNT(ra.id) FILTER (WHERE ra."scopeType" = 'TENANT') AS tenant_role_count
FROM 
    users u
LEFT JOIN 
    organizations o ON u."primaryOrganizationId" = o.id
LEFT JOIN 
    role_assignments ra ON u.id = ra."userId" AND ra."scopeType" = 'TENANT'
WHERE 
    u."isSuperuser" = false
GROUP BY 
    u.id, u.email, u.name, u."primaryOrganizationId", o.name
HAVING 
    COUNT(ra.id) FILTER (WHERE ra."scopeType" = 'TENANT') = 0
ORDER BY 
    u.email;

-- ============================================================================
-- TENANT ADMIN/OWNER ROLES
-- ============================================================================
-- Shows users with TENANT_ADMIN or TENANT_OWNER roles
-- These users should definitely be able to see Company OKRs

SELECT 
    u.email,
    u.name AS user_name,
    ra.role,
    o.name AS organization_name,
    o.id AS organization_id,
    ra."createdAt"
FROM 
    role_assignments ra
JOIN 
    users u ON ra."userId" = u.id
LEFT JOIN 
    organizations o ON ra."scopeId" = o.id
WHERE 
    ra."scopeType" = 'TENANT'
    AND ra.role IN ('TENANT_ADMIN', 'TENANT_OWNER')
ORDER BY 
    o.name, u.email;

-- ============================================================================
-- ROLE ASSIGNMENT COUNTS BY TYPE
-- ============================================================================
-- Summary statistics of role assignments

SELECT 
    ra."scopeType",
    ra.role,
    COUNT(*) AS assignment_count,
    COUNT(DISTINCT ra."userId") AS unique_users,
    COUNT(DISTINCT ra."scopeId") AS unique_scopes
FROM 
    role_assignments ra
GROUP BY 
    ra."scopeType", ra.role
ORDER BY 
    ra."scopeType", ra.role;

-- ============================================================================
-- ORGANIZATIONS WITH OBJECTIVES IN ANNUAL 2025 CYCLE
-- ============================================================================
-- Check which organizations have objectives in the Annual 2025 cycle
-- This helps verify if the cycle exists and has data

SELECT 
    o.id AS org_id,
    o.name AS org_name,
    c.id AS cycle_id,
    c.name AS cycle_name,
    c.status AS cycle_status,
    COUNT(DISTINCT obj.id) AS objective_count
FROM 
    organizations o
LEFT JOIN 
    cycles c ON c."tenantId" = o.id AND c.name LIKE '%2025%'
LEFT JOIN 
    objectives obj ON obj."tenantId" = o.id AND obj."cycleId" = c.id
GROUP BY 
    o.id, o.name, c.id, c.name, c.status
HAVING 
    COUNT(DISTINCT obj.id) > 0 OR c.id IS NOT NULL
ORDER BY 
    o.name, c.name;



