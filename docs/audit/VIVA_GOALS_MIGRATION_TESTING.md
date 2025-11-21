# Viva Goals Feature Gaps - Migration Testing Guide

**Date:** 2025-01-27  
**Version:** 1.0  
**Status:** ✅ Complete

---

## Overview

This document provides a comprehensive testing guide for validating the database migration and feature implementation for Viva Goals feature gaps. It covers pre-migration, migration execution, and post-migration validation steps.

---

## Pre-Migration Testing

### 1. Database Backup

**Action:** Create a full database backup before running the migration.

```bash
# PostgreSQL backup
pg_dump -U postgres -d okr_nexus > backup_pre_viva_goals_$(date +%Y%m%d).sql

# Verify backup
ls -lh backup_pre_viva_goals_*.sql
```

**Validation:**
- ✅ Backup file created
- ✅ Backup file size > 0
- ✅ Backup file contains schema and data

### 2. Current State Verification

**Action:** Document current state of OKR entities.

```sql
-- Count existing entities
SELECT 
  (SELECT COUNT(*) FROM "Objective") as objective_count,
  (SELECT COUNT(*) FROM "KeyResult") as kr_count,
  (SELECT COUNT(*) FROM "Initiative") as initiative_count;

-- Check for existing goalType, createdBy, teamId, progress fields
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('Objective', 'KeyResult', 'Initiative')
  AND column_name IN ('goalType', 'createdBy', 'teamId', 'progress');

-- Should return empty (fields don't exist yet)
```

**Expected Results:**
- ✅ Counts returned successfully
- ✅ No existing fields found (clean state)

### 3. Test Data Preparation

**Action:** Create test data to validate migration behavior.

```sql
-- Create test objective with activities (for createdBy backfill)
INSERT INTO "Objective" (id, title, "ownerId", "tenantId", status, progress, "createdAt", "updatedAt")
VALUES ('test-obj-1', 'Test Objective', 'user-1', 'org-1', 'ON_TRACK', 0, NOW(), NOW());

-- Create activity record for backfill test
INSERT INTO "Activity" (id, "entityType", "entityId", "userId", action, "createdAt")
VALUES ('test-act-1', 'Objective', 'test-obj-1', 'user-1', 'objective_created', NOW());
```

**Validation:**
- ✅ Test data created successfully
- ✅ Activity record exists for backfill test

---

## Migration Execution

### 1. Run Migration

**Action:** Execute the Prisma migration.

```bash
cd services/core-api

# Option 1: Using migrate dev (for development)
npx prisma migrate dev --name add_viva_goals_feature_gaps

# Option 2: Using db push (if migration history is inconsistent)
npx prisma db push

# Option 3: Mark migration as applied and run backfill separately
npx prisma migrate resolve --applied 20250127_add_viva_goals_feature_gaps
```

**Validation:**
- ✅ Migration executed without errors
- ✅ Migration file created in `prisma/migrations/`
- ✅ Database schema updated

### 2. Verify Schema Changes

**Action:** Verify new fields and enum values exist.

```sql
-- Check GoalType enum exists
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'GoalType');

-- Should return: ASPIRATIONAL, COMMITTED

-- Check OKRStatus enum includes NOT_STARTED
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'OKRStatus')
ORDER BY enumlabel;

-- Should include: NOT_STARTED, ON_TRACK, AT_RISK, OFF_TRACK, BLOCKED, COMPLETED, CANCELLED

-- Check new columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'Objective'
  AND column_name IN ('goalType', 'createdBy');

-- Should show:
-- goalType: enum, nullable, default 'ASPIRATIONAL'
-- createdBy: uuid, nullable, no default

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'KeyResult'
  AND column_name IN ('goalType', 'createdBy', 'teamId');

-- Should show all three columns

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'Initiative'
  AND column_name IN ('goalType', 'createdBy', 'teamId', 'progress');

-- Should show all four columns
```

**Validation:**
- ✅ GoalType enum created with correct values
- ✅ NOT_STARTED added to OKRStatus enum
- ✅ All new columns exist with correct types
- ✅ Default values set correctly

### 3. Verify Foreign Keys and Indexes

**Action:** Check foreign key constraints and indexes.

```sql
-- Check foreign keys
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
  AND tc.table_name IN ('Objective', 'KeyResult', 'Initiative')
  AND kcu.column_name IN ('createdBy', 'teamId');

-- Should show:
-- Objective.createdBy -> User.id
-- KeyResult.createdBy -> User.id
-- KeyResult.teamId -> Team.id
-- Initiative.createdBy -> User.id
-- Initiative.teamId -> Team.id

-- Check indexes
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('Objective', 'KeyResult', 'Initiative')
  AND indexname LIKE '%goalType%' OR indexname LIKE '%createdBy%' OR indexname LIKE '%teamId%';

-- Should show indexes on goalType, createdBy, teamId
```

**Validation:**
- ✅ Foreign keys created correctly
- ✅ Indexes created for performance
- ✅ Constraints enforce data integrity

---

## Post-Migration Validation

### 1. Backfill Validation

**Action:** Verify backfill logic executed correctly.

```sql
-- Check createdBy backfill for Objectives
SELECT 
  COUNT(*) as total_objectives,
  COUNT("createdBy") as objectives_with_creator,
  COUNT(*) - COUNT("createdBy") as objectives_without_creator
FROM "Objective";

-- Should show: objectives_with_creator > 0 (if activities exist)

-- Check createdBy backfill for Key Results
SELECT 
  COUNT(*) as total_krs,
  COUNT("createdBy") as krs_with_creator,
  COUNT(*) - COUNT("createdBy") as krs_without_creator
FROM "KeyResult";

-- Check teamId inheritance for Key Results
SELECT 
  COUNT(*) as total_krs,
  COUNT("teamId") as krs_with_team,
  COUNT(*) - COUNT("teamId") as krs_without_team
FROM "KeyResult";

-- Check teamId inheritance for Initiatives
SELECT 
  COUNT(*) as total_initiatives,
  COUNT("teamId") as initiatives_with_team,
  COUNT(*) - COUNT("teamId") as initiatives_without_team
FROM "Initiative";
```

**Validation:**
- ✅ createdBy populated where activities exist
- ✅ teamId inherited where applicable
- ✅ No data loss occurred

### 2. Default Values Validation

**Action:** Verify default values are set correctly.

```sql
-- Check goalType defaults
SELECT 
  goalType,
  COUNT(*) as count
FROM "Objective"
GROUP BY goalType;

-- Should show: ASPIRATIONAL as default (or NULL if not set)

-- Check status defaults (should still work)
SELECT 
  status,
  COUNT(*) as count
FROM "Objective"
GROUP BY status;

-- Should include existing statuses, NOT_STARTED may appear
```

**Validation:**
- ✅ Default values applied correctly
- ✅ Existing data remains intact
- ✅ New enum values work correctly

### 3. API Functionality Testing

**Action:** Test API endpoints with new fields.

```bash
# Test creating Objective with goalType
curl -X POST http://localhost:3001/objectives \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Objective",
    "ownerId": "user-1",
    "cycleId": "cycle-1",
    "tenantId": "org-1",
    "goalType": "COMMITTED",
    "status": "NOT_STARTED"
  }'

# Verify response includes goalType and createdBy
# Verify status is NOT_STARTED

# Test creating Key Result with teamId
curl -X POST http://localhost:3001/key-results \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test KR",
    "objectiveId": "obj-1",
    "ownerId": "user-1",
    "cycleId": "cycle-1",
    "metricType": "PERCENTAGE",
    "startValue": 0,
    "targetValue": 100,
    "goalType": "COMMITTED",
    "teamId": "team-1",
    "status": "NOT_STARTED"
  }'

# Verify response includes goalType, createdBy, teamId
# Verify status is NOT_STARTED

# Test creating Initiative with progress
curl -X POST http://localhost:3001/initiatives \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Initiative",
    "objectiveId": "obj-1",
    "ownerId": "user-1",
    "goalType": "COMMITTED",
    "teamId": "team-1",
    "progress": 75
  }'

# Verify response includes goalType, createdBy, teamId, progress
```

**Validation:**
- ✅ All endpoints accept new fields
- ✅ Responses include new fields
- ✅ Validation works correctly
- ✅ Default values applied when not specified

### 4. UI Functionality Testing

**Action:** Test UI components with new fields.

**Test Cases:**

1. **Create Objective with GoalType**
   - ✅ GoalType selector appears
   - ✅ Can select Aspirational/Committed
   - ✅ Badge displays correctly
   - ✅ Default is Aspirational

2. **Create Key Result with Team**
   - ✅ Team selector appears (if teams available)
   - ✅ Can select team or None
   - ✅ Team badge displays when assigned
   - ✅ Inherits from Objective if not set

3. **Create Initiative with Progress**
   - ✅ Progress input appears
   - ✅ Can enter 0-100
   - ✅ Progress badge displays
   - ✅ Validation prevents invalid values

4. **Status Selector**
   - ✅ "Not Started" appears in all selectors
   - ✅ Can select "Not Started"
   - ✅ Badge displays correctly
   - ✅ Filter works correctly

5. **Edit Forms**
   - ✅ All new fields appear in edit forms
   - ✅ Can update GoalType
   - ✅ Can update Team assignment
   - ✅ Can update Progress
   - ✅ Can update Status to NOT_STARTED

**Validation:**
- ✅ All UI components work correctly
- ✅ Badges display properly
- ✅ Forms validate correctly
- ✅ No console errors

### 5. Data Integrity Testing

**Action:** Verify data integrity and relationships.

```sql
-- Check for orphaned createdBy references
SELECT COUNT(*) 
FROM "Objective" o
LEFT JOIN "User" u ON o."createdBy" = u.id
WHERE o."createdBy" IS NOT NULL AND u.id IS NULL;

-- Should return 0 (no orphaned references)

-- Check for invalid teamId references
SELECT COUNT(*) 
FROM "KeyResult" kr
LEFT JOIN "Team" t ON kr."teamId" = t.id
WHERE kr."teamId" IS NOT NULL AND t.id IS NULL;

-- Should return 0 (no invalid team references)

-- Check for invalid progress values
SELECT COUNT(*) 
FROM "Initiative"
WHERE progress IS NOT NULL AND (progress < 0 OR progress > 100);

-- Should return 0 (no invalid progress values)

-- Check for invalid goalType values
SELECT COUNT(*) 
FROM "Objective"
WHERE "goalType" IS NOT NULL 
  AND "goalType" NOT IN ('ASPIRATIONAL', 'COMMITTED');

-- Should return 0 (no invalid goalType values)
```

**Validation:**
- ✅ No orphaned foreign key references
- ✅ No invalid enum values
- ✅ No invalid progress values
- ✅ Data integrity maintained

---

## Rollback Testing

### 1. Rollback Preparation

**Action:** Prepare rollback script (if needed).

**Note:** Rollback is not recommended after backfill, but test the process.

```sql
-- Rollback script (DO NOT RUN unless absolutely necessary)
-- This would remove new fields and data

-- ALTER TABLE "Initiative" DROP COLUMN IF EXISTS progress;
-- ALTER TABLE "Initiative" DROP COLUMN IF EXISTS "teamId";
-- ALTER TABLE "Initiative" DROP COLUMN IF EXISTS "createdBy";
-- ALTER TABLE "Initiative" DROP COLUMN IF EXISTS "goalType";

-- ALTER TABLE "KeyResult" DROP COLUMN IF EXISTS "teamId";
-- ALTER TABLE "KeyResult" DROP COLUMN IF EXISTS "createdBy";
-- ALTER TABLE "KeyResult" DROP COLUMN IF EXISTS "goalType";

-- ALTER TABLE "Objective" DROP COLUMN IF EXISTS "createdBy";
-- ALTER TABLE "Objective" DROP COLUMN IF EXISTS "goalType";

-- DROP TYPE IF EXISTS "GoalType";
-- Remove NOT_STARTED from OKRStatus (requires enum recreation)
```

**Validation:**
- ✅ Rollback script prepared (but not executed)
- ✅ Backup available for restore if needed

---

## Performance Testing

### 1. Query Performance

**Action:** Test query performance with new indexes.

```sql
-- Test goalType filtering
EXPLAIN ANALYZE
SELECT * FROM "Objective" WHERE "goalType" = 'COMMITTED';

-- Should use index on goalType

-- Test createdBy filtering
EXPLAIN ANALYZE
SELECT * FROM "Objective" WHERE "createdBy" = 'user-1';

-- Should use index on createdBy

-- Test teamId filtering
EXPLAIN ANALYZE
SELECT * FROM "KeyResult" WHERE "teamId" = 'team-1';

-- Should use index on teamId
```

**Validation:**
- ✅ Indexes used in query plans
- ✅ Query performance acceptable
- ✅ No significant slowdown

### 2. Migration Performance

**Action:** Measure migration execution time.

```bash
# Time the migration
time npx prisma migrate dev --name add_viva_goals_feature_gaps

# Or time db push
time npx prisma db push
```

**Expected Results:**
- ✅ Migration completes in reasonable time (< 5 minutes for typical datasets)
- ✅ No timeouts or performance issues

---

## Staging Environment Testing

### 1. Pre-Deployment Checklist

- [ ] Database backup created
- [ ] Migration tested on local environment
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] UI components tested
- [ ] API endpoints tested
- [ ] Performance acceptable
- [ ] Rollback plan prepared

### 2. Deployment Steps

1. **Backup Database**
   ```bash
   pg_dump -U postgres -d okr_nexus_staging > backup_staging_$(date +%Y%m%d).sql
   ```

2. **Run Migration**
   ```bash
   cd services/core-api
   npx prisma migrate deploy
   ```

3. **Verify Migration**
   ```bash
   npx prisma migrate status
   # Should show migration as applied
   ```

4. **Run Backfill (if separate)**
   ```bash
   # Extract backfill SQL from migration file
   # Run using psql or prisma db execute
   npx prisma db execute --file backfill.sql --schema prisma/schema.prisma
   ```

5. **Validate Results**
   - Check database schema
   - Run integration tests
   - Test UI functionality
   - Monitor for errors

### 3. Post-Deployment Validation

- [ ] Schema changes applied
- [ ] Backfill completed successfully
- [ ] API endpoints working
- [ ] UI components functional
- [ ] No errors in logs
- [ ] Performance acceptable
- [ ] User acceptance testing passed

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] Staging testing completed successfully
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Team notified of deployment
- [ ] Rollback plan prepared
- [ ] Database backup scheduled

### Deployment

- [ ] Maintenance window scheduled (if needed)
- [ ] Database backup created
- [ ] Migration executed
- [ ] Backfill executed (if separate)
- [ ] Verification completed

### Post-Deployment

- [ ] Monitor error logs
- [ ] Verify API functionality
- [ ] Verify UI functionality
- [ ] Check performance metrics
- [ ] User acceptance testing
- [ ] Document any issues

---

## Troubleshooting

### Migration Fails

**Symptoms:** Migration execution fails with error

**Solutions:**
1. Check database connection
2. Verify Prisma schema is correct
3. Check for conflicting migrations
4. Review error message for specific issue
5. Restore from backup if needed

### Backfill Fails

**Symptoms:** Backfill script fails or doesn't populate data

**Solutions:**
1. Check activities table exists
2. Verify user IDs are valid
3. Check foreign key constraints
4. Run backfill manually with corrected SQL
5. Verify data after manual backfill

### Performance Issues

**Symptoms:** Slow queries or timeouts

**Solutions:**
1. Verify indexes were created
2. Check query plans for index usage
3. Consider additional indexes if needed
4. Monitor database performance
5. Optimize queries if necessary

---

## Success Criteria

### Migration Success

- ✅ Migration executes without errors
- ✅ All schema changes applied
- ✅ All indexes created
- ✅ All foreign keys created
- ✅ Backfill completes successfully
- ✅ No data loss
- ✅ No data corruption

### Feature Success

- ✅ API endpoints accept new fields
- ✅ API endpoints return new fields
- ✅ UI components display new fields
- ✅ Validation works correctly
- ✅ Default values applied
- ✅ Inheritance works correctly
- ✅ No breaking changes

---

**Last Updated:** 2025-01-27  
**Testing Guide Version:** 1.0

