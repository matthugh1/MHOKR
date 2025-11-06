# OKR SQL Probes

**Generated:** 2025-01-XX  
**Purpose:** Read-only SQL queries to verify data model assumptions and uncover gaps

**Database:** PostgreSQL (Prisma schema)  
**Table Names:** Use exact table names from schema (e.g., `objectives`, `key_results`, `strategic_pillars`)

---

## 1. Publish State vs Status Distribution

**Purpose:** Expose conflation between `isPublished` (boolean) and `status` (enum). Check if published objectives have different status distributions than drafts.

**Query:**
```sql
-- Distribution of status by publish state
SELECT 
  "isPublished",
  status,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY "isPublished") as percentage
FROM objectives
GROUP BY "isPublished", status
ORDER BY "isPublished", count DESC;
```

**Expected Output:**
```
isPublished | status      | count | percentage
------------|-------------|-------|------------
false       | ON_TRACK    | 50    | 45.5
false       | AT_RISK     | 30    | 27.3
true        | ON_TRACK    | 20    | 60.6
true        | COMPLETED   | 10    | 30.3
```

**Insight:** Determines if publish state correlates with status, or if they're independent concepts.

---

## 2. Objectives with Both cycleId AND periodId

**Purpose:** Check if objectives can have both cycle and period set, and if they overlap semantically.

**Query:**
```sql
-- Objectives with both cycle and period
SELECT 
  o.period,
  c.name as cycle_name,
  c.status as cycle_status,
  COUNT(*) as count
FROM objectives o
LEFT JOIN cycles c ON o."cycleId" = c.id
WHERE o."cycleId" IS NOT NULL
GROUP BY o.period, c.name, c.status
ORDER BY count DESC;

-- Check if period matches cycle type (e.g., QUARTERLY period matches Q1/Q2/Q3/Q4 cycles)
SELECT 
  o.period,
  c.name as cycle_name,
  COUNT(*) as count
FROM objectives o
JOIN cycles c ON o."cycleId" = c.id
WHERE o."cycleId" IS NOT NULL
GROUP BY o.period, c.name
ORDER BY o.period, c.name;
```

**Expected Output:**
```
period    | cycle_name | count
----------|------------|------
QUARTERLY | Q1 2025    | 15
QUARTERLY | Q2 2025    | 12
MONTHLY   | Q1 2025    | 5
```

**Insight:** Determines if period and cycle are redundant or serve different purposes.

---

## 3. Visibility Level Distribution

**Purpose:** Check distribution of visibility levels, including deprecated ones. Show whitelist link if exists.

**Query:**
```sql
-- Distribution of visibility levels
SELECT 
  "visibilityLevel",
  COUNT(*) as count,
  COUNT(*) * 100.0 / (SELECT COUNT(*) FROM objectives) as percentage
FROM objectives
GROUP BY "visibilityLevel"
ORDER BY count DESC;

-- Check deprecated visibility levels
SELECT 
  "visibilityLevel",
  COUNT(*) as deprecated_count
FROM objectives
WHERE "visibilityLevel" IN ('WORKSPACE_ONLY', 'TEAM_ONLY', 'MANAGER_CHAIN', 'EXEC_ONLY')
GROUP BY "visibilityLevel"
ORDER BY deprecated_count DESC;

-- Check PRIVATE objectives (should have whitelist)
SELECT 
  COUNT(*) as private_count,
  COUNT(DISTINCT "organizationId") as orgs_with_private
FROM objectives
WHERE "visibilityLevel" = 'PRIVATE';
```

**Expected Output:**
```
visibilityLevel | count | percentage
----------------|-------|------------
PUBLIC_TENANT   | 100   | 80.0
EXEC_ONLY       | 15    | 12.0
PRIVATE         | 10    | 8.0
```

**Insight:** Determines if deprecated visibility levels are in use and need migration.

---

## 4. Key Result Anchoring

**Purpose:** Count KRs per objective. Check if initiatives anchor to KRs or objectives (or both).

**Query:**
```sql
-- Count KRs per objective
SELECT 
  o.id as objective_id,
  o.title as objective_title,
  COUNT(okr."keyResultId") as kr_count
FROM objectives o
LEFT JOIN objective_key_results okr ON o.id = okr."objectiveId"
GROUP BY o.id, o.title
ORDER BY kr_count DESC;

-- Check if any KRs belong to multiple objectives (many-to-many)
SELECT 
  kr.id,
  kr.title,
  COUNT(okr."objectiveId") as objective_count
FROM key_results kr
JOIN objective_key_results okr ON kr.id = okr."keyResultId"
GROUP BY kr.id, kr.title
HAVING COUNT(okr."objectiveId") > 1
ORDER BY objective_count DESC;

-- Check initiative anchoring (to objective vs KR)
SELECT 
  COUNT(*) FILTER (WHERE "objectiveId" IS NOT NULL AND "keyResultId" IS NULL) as objective_only,
  COUNT(*) FILTER (WHERE "keyResultId" IS NOT NULL AND "objectiveId" IS NULL) as kr_only,
  COUNT(*) FILTER (WHERE "objectiveId" IS NOT NULL AND "keyResultId" IS NOT NULL) as both,
  COUNT(*) FILTER (WHERE "objectiveId" IS NULL AND "keyResultId" IS NULL) as neither
FROM initiatives;
```

**Expected Output:**
```
objective_id | objective_title | kr_count
-------------|----------------|----------
abc123       | Increase Revenue | 5
def456       | Improve UX      | 3

objective_only | kr_only | both | neither
---------------|---------|------|--------
50            | 30      | 10   | 0
```

**Insight:** Determines KR anchoring patterns and initiative linking preferences.

---

## 5. Pillars Reality Check

**Purpose:** If `pillarId` exists but no `pillars` table, show non-null counts and distinct IDs. (Actually, pillars table DOES exist, so check usage.)

**Query:**
```sql
-- Check pillar usage
SELECT 
  COUNT(*) as total_objectives,
  COUNT("pillarId") as objectives_with_pillar,
  COUNT(*) - COUNT("pillarId") as objectives_without_pillar,
  COUNT(DISTINCT "pillarId") as distinct_pillars
FROM objectives;

-- Check distinct pillars in use
SELECT 
  sp.id,
  sp.name,
  COUNT(o.id) as objective_count
FROM strategic_pillars sp
LEFT JOIN objectives o ON o."pillarId" = sp.id
GROUP BY sp.id, sp.name
ORDER BY objective_count DESC;

-- Check organizations with pillars
SELECT 
  o2.id as org_id,
  o2.name as org_name,
  COUNT(DISTINCT sp.id) as pillar_count,
  COUNT(DISTINCT o."pillarId") as used_pillar_count
FROM organizations o2
LEFT JOIN strategic_pillars sp ON sp."organizationId" = o2.id
LEFT JOIN objectives o ON o."organizationId" = o2.id
GROUP BY o2.id, o2.name
HAVING COUNT(DISTINCT sp.id) > 0
ORDER BY pillar_count DESC;
```

**Expected Output:**
```
total_objectives | objectives_with_pillar | objectives_without_pillar | distinct_pillars
-----------------|------------------------|---------------------------|------------------
100             | 20                    | 80                        | 3

id        | name              | objective_count
----------|-------------------|------------------
pillar1   | Growth            | 12
pillar2   | Innovation        | 5
pillar3   | Efficiency        | 3
```

**Insight:** Determines if pillars are actively used or can be removed.

---

## 6. Cycle Status Distribution

**Purpose:** Check distribution of cycle statuses and their relationship to objectives.

**Query:**
```sql
-- Distribution of cycle statuses
SELECT 
  c.status,
  COUNT(DISTINCT c.id) as cycle_count,
  COUNT(DISTINCT o.id) as objective_count
FROM cycles c
LEFT JOIN objectives o ON o."cycleId" = c.id
GROUP BY c.status
ORDER BY cycle_count DESC;

-- Objectives by cycle status
SELECT 
  c.status as cycle_status,
  COUNT(o.id) as objective_count,
  COUNT(o.id) FILTER (WHERE o."isPublished" = true) as published_count,
  COUNT(o.id) FILTER (WHERE o."isPublished" = false) as draft_count
FROM objectives o
JOIN cycles c ON o."cycleId" = c.id
GROUP BY c.status
ORDER BY objective_count DESC;
```

**Expected Output:**
```
status | cycle_count | objective_count
-------|-------------|----------------
ACTIVE | 2           | 50
LOCKED | 3           | 30
DRAFT  | 1           | 10
```

**Insight:** Determines cycle status distribution and relationship to objectives.

---

## 7. Check-In Cadence Distribution

**Purpose:** Check distribution of check-in cadences and their relationship to overdue check-ins.

**Query:**
```sql
-- Distribution of check-in cadences
SELECT 
  "checkInCadence",
  COUNT(*) as kr_count,
  COUNT(*) * 100.0 / (SELECT COUNT(*) FROM key_results WHERE "checkInCadence" IS NOT NULL) as percentage
FROM key_results
WHERE "checkInCadence" IS NOT NULL
GROUP BY "checkInCadence"
ORDER BY kr_count DESC;

-- Check KRs with cadence vs without
SELECT 
  COUNT(*) FILTER (WHERE "checkInCadence" IS NOT NULL) as with_cadence,
  COUNT(*) FILTER (WHERE "checkInCadence" IS NULL) as without_cadence,
  COUNT(*) FILTER (WHERE "checkInCadence" = 'NONE') as none_cadence
FROM key_results;
```

**Expected Output:**
```
checkInCadence | kr_count | percentage
---------------|----------|------------
WEEKLY         | 40       | 50.0
MONTHLY        | 30       | 37.5
BIWEEKLY       | 10       | 12.5
```

**Insight:** Determines check-in cadence usage patterns.

---

## 8. Key Result Visibility vs Parent Objective

**Purpose:** Check if KR visibility matches parent objective visibility (inheritance pattern).

**Query:**
```sql
-- KR visibility vs parent objective visibility
SELECT 
  kr."visibilityLevel" as kr_visibility,
  o."visibilityLevel" as obj_visibility,
  COUNT(*) as count
FROM key_results kr
JOIN objective_key_results okr ON kr.id = okr."keyResultId"
JOIN objectives o ON okr."objectiveId" = o.id
GROUP BY kr."visibilityLevel", o."visibilityLevel"
ORDER BY count DESC;

-- Check if any KRs have different visibility than parent
SELECT 
  COUNT(*) as mismatched_count,
  COUNT(DISTINCT kr.id) as distinct_krs
FROM key_results kr
JOIN objective_key_results okr ON kr.id = okr."keyResultId"
JOIN objectives o ON okr."objectiveId" = o.id
WHERE kr."visibilityLevel" != o."visibilityLevel";
```

**Expected Output:**
```
kr_visibility | obj_visibility | count
--------------|----------------|------
PUBLIC_TENANT | PUBLIC_TENANT   | 80
PRIVATE       | PRIVATE         | 10

mismatched_count | distinct_krs
-----------------|--------------
0               | 0
```

**Insight:** Determines if KR visibility field is vestigial (always matches parent) or used independently.

---

## 9. Objective Hierarchy (Parent-Child)

**Purpose:** Check if objective hierarchy (parent-child relationships) is used.

**Query:**
```sql
-- Check objective hierarchy usage
SELECT 
  COUNT(*) FILTER (WHERE "parentId" IS NOT NULL) as child_objectives,
  COUNT(*) FILTER (WHERE "parentId" IS NULL) as root_objectives,
  COUNT(DISTINCT "parentId") as distinct_parents
FROM objectives;

-- Check hierarchy depth
WITH RECURSIVE hierarchy AS (
  SELECT 
    id,
    "parentId",
    0 as depth
  FROM objectives
  WHERE "parentId" IS NULL
  
  UNION ALL
  
  SELECT 
    o.id,
    o."parentId",
    h.depth + 1
  FROM objectives o
  JOIN hierarchy h ON o."parentId" = h.id
)
SELECT 
  depth,
  COUNT(*) as objective_count
FROM hierarchy
GROUP BY depth
ORDER BY depth;
```

**Expected Output:**
```
child_objectives | root_objectives | distinct_parents
-----------------|------------------|-----------------
10              | 90               | 5

depth | objective_count
------|-----------------
0     | 90
1     | 8
2     | 2
```

**Insight:** Determines if objective hierarchy is used or can be removed.

---

## 10. Overdue Check-Ins Analysis

**Purpose:** Check distribution of overdue check-ins by cadence and cycle.

**Query:**
```sql
-- Check overdue check-ins by cadence
SELECT 
  kr."checkInCadence",
  COUNT(DISTINCT kr.id) as kr_count,
  COUNT(DISTINCT ci.id) as check_in_count,
  MAX(ci."createdAt") as last_check_in
FROM key_results kr
LEFT JOIN check_ins ci ON ci."keyResultId" = kr.id
WHERE kr."checkInCadence" IS NOT NULL 
  AND kr."checkInCadence" != 'NONE'
GROUP BY kr."checkInCadence";

-- Check KRs with overdue check-ins (requires cadence and last check-in date)
-- Note: This is a simplified query; actual overdue logic is more complex
SELECT 
  kr.id,
  kr.title,
  kr."checkInCadence",
  MAX(ci."createdAt") as last_check_in,
  CASE 
    WHEN kr."checkInCadence" = 'WEEKLY' AND MAX(ci."createdAt") < NOW() - INTERVAL '7 days' THEN true
    WHEN kr."checkInCadence" = 'BIWEEKLY' AND MAX(ci."createdAt") < NOW() - INTERVAL '14 days' THEN true
    WHEN kr."checkInCadence" = 'MONTHLY' AND MAX(ci."createdAt") < NOW() - INTERVAL '30 days' THEN true
    ELSE false
  END as is_overdue
FROM key_results kr
LEFT JOIN check_ins ci ON ci."keyResultId" = kr.id
WHERE kr."checkInCadence" IS NOT NULL 
  AND kr."checkInCadence" != 'NONE'
GROUP BY kr.id, kr.title, kr."checkInCadence"
HAVING (
  CASE 
    WHEN kr."checkInCadence" = 'WEEKLY' AND MAX(ci."createdAt") < NOW() - INTERVAL '7 days' THEN true
    WHEN kr."checkInCadence" = 'BIWEEKLY' AND MAX(ci."createdAt") < NOW() - INTERVAL '14 days' THEN true
    WHEN kr."checkInCadence" = 'MONTHLY' AND MAX(ci."createdAt") < NOW() - INTERVAL '30 days' THEN true
    ELSE false
  END
) = true;
```

**Expected Output:**
```
checkInCadence | kr_count | check_in_count | last_check_in
---------------|----------|----------------|---------------
WEEKLY         | 40       | 200           | 2025-01-15
MONTHLY        | 30       | 90            | 2025-01-01
```

**Insight:** Determines overdue check-in patterns and cadence effectiveness.

---

## 11. Ownership Distribution

**Purpose:** Check distribution of objectives and key results by owner.

**Query:**
```sql
-- Objectives by owner
SELECT 
  u.id as owner_id,
  u.name as owner_name,
  u.email as owner_email,
  COUNT(o.id) as objective_count
FROM users u
LEFT JOIN objectives o ON o."ownerId" = u.id
GROUP BY u.id, u.name, u.email
ORDER BY objective_count DESC
LIMIT 20;

-- Key Results by owner
SELECT 
  u.id as owner_id,
  u.name as owner_name,
  u.email as owner_email,
  COUNT(kr.id) as kr_count
FROM users u
LEFT JOIN key_results kr ON kr."ownerId" = u.id
GROUP BY u.id, u.name, u.email
ORDER BY kr_count DESC
LIMIT 20;
```

**Expected Output:**
```
owner_id | owner_name | owner_email        | objective_count
---------|------------|-------------------|-----------------
user1    | John Doe   | john@example.com  | 10
user2    | Jane Smith | jane@example.com | 8
```

**Insight:** Determines ownership patterns and identifies power users.

---

## 12. Organization Tenancy Check

**Purpose:** Verify tenant isolation - ensure objectives belong to correct organizations.

**Query:**
```sql
-- Check objectives without organization
SELECT 
  COUNT(*) as objectives_without_org
FROM objectives
WHERE "organizationId" IS NULL;

-- Check objectives by organization
SELECT 
  o2.id as org_id,
  o2.name as org_name,
  COUNT(o.id) as objective_count,
  COUNT(DISTINCT o."workspaceId") as workspace_count,
  COUNT(DISTINCT o."teamId") as team_count
FROM organizations o2
LEFT JOIN objectives o ON o."organizationId" = o2.id
GROUP BY o2.id, o2.name
ORDER BY objective_count DESC;
```

**Expected Output:**
```
objectives_without_org
----------------------
0

org_id | org_name      | objective_count | workspace_count | team_count
-------|---------------|-----------------|-----------------|------------
org1   | Acme Corp     | 50              | 5               | 10
```

**Insight:** Verifies tenant isolation and organizational structure.

---

## Running These Queries

**Prerequisites:**
- Database connection credentials
- Read-only access to database
- PostgreSQL client (psql) or database GUI tool

**Usage:**
1. Connect to database using `DATABASE_URL` from environment
2. Run queries individually or in batch
3. Save results for analysis
4. Compare results to expected outputs to identify gaps

**Note:** These queries are read-only and safe to run in production. They do not modify any data.

---

## Evidence File References

- Schema: `services/core-api/prisma/schema.prisma`
- Baseline Migration: `services/core-api/prisma/migrations/20251102100826_baseline/migration.sql`

