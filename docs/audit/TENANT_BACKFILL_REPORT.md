# Tenant Backfill Report

**Generated**: 2025-01-06  
**Purpose**: Document tenant backfill statistics before and after migration

---

## Pre-Migration Statistics

Run these queries BEFORE applying the migration:

```sql
-- Count NULL organizationId per table
SELECT 
    'objectives' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE "organizationId" IS NULL) AS null_count
FROM objectives
UNION ALL
SELECT 
    'workspaces' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE "organizationId" IS NULL) AS null_count
FROM workspaces
UNION ALL
SELECT 
    'cycles' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE "organizationId" IS NULL) AS null_count
FROM cycles
UNION ALL
SELECT 
    'strategic_pillars' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE "organizationId" IS NULL) AS null_count
FROM strategic_pillars
UNION ALL
SELECT 
    'check_in_requests' AS table_name,
    COUNT(*) AS total_rows,
    COUNT(*) FILTER (WHERE "organizationId" IS NULL) AS null_count
FROM check_in_requests
ORDER BY null_count DESC;
```

---

## Post-Migration Statistics

Run these queries AFTER applying the migration:

```sql
-- Verify all organizationId columns are NOT NULL
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM objectives WHERE "organizationId" IS NULL) THEN 'FAIL: objectives has NULL organizationId'
        WHEN EXISTS (SELECT 1 FROM workspaces WHERE "organizationId" IS NULL) THEN 'FAIL: workspaces has NULL organizationId'
        WHEN EXISTS (SELECT 1 FROM strategic_pillars WHERE "organizationId" IS NULL) THEN 'FAIL: strategic_pillars has NULL organizationId'
        WHEN EXISTS (SELECT 1 FROM cycles WHERE "organizationId" IS NULL) THEN 'FAIL: cycles has NULL organizationId'
        WHEN EXISTS (SELECT 1 FROM check_in_requests WHERE "organizationId" IS NULL) THEN 'FAIL: check_in_requests has NULL organizationId'
        ELSE 'PASS: All tenant_id columns are NOT NULL'
    END AS validation_result;

-- Count quarantined rows
SELECT 
    COUNT(*) AS quarantined_objectives
FROM objectives
WHERE "organizationId" = 'tenant_quarantine_0000000000000000000000';

-- List quarantined objectives for review
SELECT 
    id,
    title,
    "workspaceId",
    "teamId",
    "cycleId",
    "createdAt"
FROM objectives
WHERE "organizationId" = 'tenant_quarantine_0000000000000000000000'
ORDER BY "createdAt" DESC
LIMIT 100;
```

---

## Backfill Strategy

### Objectives Backfill Priority:

1. **Via cycle** (highest priority)
   - `objectives.organizationId` ← `cycles.organizationId`
   - Applied when `objectives.cycleId` is set

2. **Via workspace**
   - `objectives.organizationId` ← `workspaces.organizationId`
   - Applied when `objectives.workspaceId` is set

3. **Via team → workspace**
   - `objectives.organizationId` ← `teams.workspace.organizationId`
   - Applied when `objectives.teamId` is set

4. **Quarantine** (lowest priority)
   - `objectives.organizationId` ← `'tenant_quarantine_0000000000000000000000'`
   - Applied when no parent relationship exists

---

## Quarantine Process

Rows assigned to `tenant_quarantine_0000000000000000000000` should be reviewed:

1. **Review quarantined rows**:
   ```sql
   SELECT * FROM objectives
   WHERE "organizationId" = 'tenant_quarantine_0000000000000000000000';
   ```

2. **Assign to real tenant**:
   ```sql
   UPDATE objectives
   SET "organizationId" = '<real-tenant-id>'
   WHERE id = '<objective-id>';
   ```

3. **Delete if obsolete**:
   ```sql
   DELETE FROM objectives
   WHERE id = '<objective-id>';
   ```

---

## Rollback Plan

If migration fails or needs to be rolled back:

```sql
-- Remove NOT NULL constraint
ALTER TABLE objectives
  ALTER COLUMN "organizationId" DROP NOT NULL;

-- Remove quarantine assignments (optional)
UPDATE objectives
SET "organizationId" = NULL
WHERE "organizationId" = 'tenant_quarantine_0000000000000000000000';

-- Delete quarantine organization (optional)
DELETE FROM organizations
WHERE id = 'tenant_quarantine_0000000000000000000000';
```

---

## Notes

- **Database schema**: Keep `organizationId` column name (no migration needed)
- **Application layer**: Use `tenantId` terminology
- **Foreign keys**: ON DELETE RESTRICT prevents accidental tenant deletion
- **Composite uniqueness**: Add tenant-scoped unique constraints if needed

