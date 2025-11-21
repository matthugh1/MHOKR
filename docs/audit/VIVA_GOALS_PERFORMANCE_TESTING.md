# Viva Goals Feature Gaps - Performance Testing Guide

**Date:** 2025-01-27  
**Version:** 1.0  
**Status:** ✅ Complete

---

## Overview

This document outlines the performance testing approach for the Viva Goals feature gaps implementation. It covers database query performance, API response times, and UI rendering performance.

---

## Performance Testing Objectives

1. **Database Performance**: Verify new indexes improve query performance
2. **API Performance**: Ensure new fields don't degrade API response times
3. **UI Performance**: Verify UI components render efficiently with new fields
4. **Migration Performance**: Ensure migration completes in acceptable time

---

## Database Performance Testing

### 1. Index Effectiveness

**Test:** Verify indexes on new fields improve query performance.

```sql
-- Test goalType filtering with index
EXPLAIN ANALYZE
SELECT * FROM "Objective" 
WHERE "goalType" = 'COMMITTED'
LIMIT 100;

-- Expected: Uses index on goalType
-- Performance: < 50ms for typical dataset

-- Test createdBy filtering with index
EXPLAIN ANALYZE
SELECT * FROM "Objective" 
WHERE "createdBy" = 'user-123'
LIMIT 100;

-- Expected: Uses index on createdBy
-- Performance: < 50ms for typical dataset

-- Test teamId filtering with index
EXPLAIN ANALYZE
SELECT * FROM "KeyResult" 
WHERE "teamId" = 'team-123'
LIMIT 100;

-- Expected: Uses index on teamId
-- Performance: < 50ms for typical dataset

-- Test composite query (goalType + status)
EXPLAIN ANALYZE
SELECT * FROM "Objective" 
WHERE "goalType" = 'COMMITTED' 
  AND status = 'ON_TRACK'
LIMIT 100;

-- Expected: Uses both indexes
-- Performance: < 100ms for typical dataset
```

**Success Criteria:**
- ✅ Indexes used in query plans
- ✅ Query times < 100ms for typical datasets
- ✅ No full table scans

### 2. Join Performance

**Test:** Verify joins with new foreign keys perform well.

```sql
-- Test Objective with creator join
EXPLAIN ANALYZE
SELECT o.*, u.name as creator_name
FROM "Objective" o
LEFT JOIN "User" u ON o."createdBy" = u.id
WHERE o."tenantId" = 'org-123'
LIMIT 100;

-- Expected: Efficient join using index
-- Performance: < 150ms for typical dataset

-- Test Key Result with team join
EXPLAIN ANALYZE
SELECT kr.*, t.name as team_name
FROM "KeyResult" kr
LEFT JOIN "Team" t ON kr."teamId" = t.id
WHERE kr."tenantId" = 'org-123'
LIMIT 100;

-- Expected: Efficient join using index
-- Performance: < 150ms for typical dataset
```

**Success Criteria:**
- ✅ Joins use indexes
- ✅ Query times < 200ms for typical datasets
- ✅ No N+1 query patterns

### 3. Migration Performance

**Test:** Measure migration execution time.

```bash
# Time the migration
time npx prisma migrate dev --name add_viva_goals_feature_gaps

# Expected times:
# - Small dataset (< 1K OKRs): < 30 seconds
# - Medium dataset (1K-10K OKRs): < 2 minutes
# - Large dataset (10K+ OKRs): < 5 minutes
```

**Success Criteria:**
- ✅ Migration completes in acceptable time
- ✅ No timeouts
- ✅ Backfill completes successfully

---

## API Performance Testing

### 1. Endpoint Response Times

**Test:** Measure API endpoint response times with new fields.

```bash
# Test Objective creation
time curl -X POST http://localhost:3001/objectives \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Objective",
    "ownerId": "user-1",
    "cycleId": "cycle-1",
    "tenantId": "org-1",
    "goalType": "COMMITTED"
  }'

# Expected: < 500ms response time

# Test Key Result creation
time curl -X POST http://localhost:3001/key-results \
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
    "teamId": "team-1"
  }'

# Expected: < 500ms response time

# Test Initiative creation
time curl -X POST http://localhost:3001/initiatives \
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

# Expected: < 500ms response time
```

**Success Criteria:**
- ✅ Response times < 500ms for creation endpoints
- ✅ Response times < 200ms for read endpoints
- ✅ No significant degradation vs. baseline

### 2. Overview Endpoint Performance

**Test:** Measure /okr/overview endpoint with new fields.

```bash
# Test overview endpoint
time curl -X GET "http://localhost:3001/okr/overview?organizationId=org-1&page=1&pageSize=20" \
  -H "Authorization: Bearer <token>"

# Expected: < 300ms response time
# Verify response includes new fields (goalType, createdBy, etc.)
```

**Success Criteria:**
- ✅ Response time < 300ms
- ✅ Response includes new fields
- ✅ No performance regression

### 3. Filter Performance

**Test:** Measure filter performance with new status value.

```bash
# Test NOT_STARTED filter
time curl -X GET "http://localhost:3001/okr/overview?organizationId=org-1&status=NOT_STARTED&page=1&pageSize=20" \
  -H "Authorization: Bearer <token>"

# Expected: < 300ms response time
```

**Success Criteria:**
- ✅ Filter performance acceptable
- ✅ Results returned correctly
- ✅ No performance issues

---

## UI Performance Testing

### 1. Component Render Performance

**Test:** Measure component render times with new fields.

**Tools:** React DevTools Profiler

**Test Cases:**

1. **ObjectiveRow with GoalType badge**
   - Render time: < 50ms
   - Re-render time: < 30ms

2. **Key Result row with Team badge**
   - Render time: < 50ms
   - Re-render time: < 30ms

3. **Initiative row with Progress badge**
   - Render time: < 50ms
   - Re-render time: < 30ms

4. **GoalTypeSelector component**
   - Render time: < 20ms
   - Interaction time: < 50ms

**Success Criteria:**
- ✅ Components render efficiently
- ✅ No unnecessary re-renders
- ✅ Smooth interactions

### 2. Form Performance

**Test:** Measure form performance with new fields.

**Test Cases:**

1. **OKRCreationDrawer with GoalType**
   - Open time: < 200ms
   - Form interaction: < 50ms per field

2. **EditObjectiveModal with GoalType**
   - Open time: < 200ms
   - Save time: < 500ms

3. **EditKeyResultDrawer with Team**
   - Open time: < 200ms
   - Team selector load: < 100ms

**Success Criteria:**
- ✅ Forms open quickly
- ✅ Interactions are responsive
- ✅ No lag or delays

### 3. List Performance

**Test:** Measure list rendering with new badges.

**Test Cases:**

1. **OKR list with GoalType badges**
   - Initial render: < 500ms for 20 items
   - Scroll performance: Smooth (60fps)

2. **Filtered list with NOT_STARTED**
   - Filter application: < 200ms
   - List update: < 300ms

**Success Criteria:**
- ✅ Lists render efficiently
- ✅ Smooth scrolling
- ✅ Fast filtering

---

## Load Testing

### 1. Concurrent Creation

**Test:** Measure performance under concurrent load.

```bash
# Create 100 Objectives concurrently
for i in {1..100}; do
  curl -X POST http://localhost:3001/objectives \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d "{
      \"title\": \"Test Objective $i\",
      \"ownerId\": \"user-1\",
      \"cycleId\": \"cycle-1\",
      \"tenantId\": \"org-1\",
      \"goalType\": \"COMMITTED\"
    }" &
done
wait

# Measure total time and success rate
# Expected: All requests complete successfully
# Expected: Average response time < 1s
```

**Success Criteria:**
- ✅ All requests succeed
- ✅ Average response time acceptable
- ✅ No database deadlocks
- ✅ No performance degradation

### 2. Bulk Operations

**Test:** Measure performance of bulk operations.

```sql
-- Test bulk update of goalType
UPDATE "Objective" 
SET "goalType" = 'COMMITTED'
WHERE "goalType" IS NULL OR "goalType" = 'ASPIRATIONAL'
LIMIT 1000;

-- Expected: Completes in < 5 seconds
-- Verify: Uses index for WHERE clause
```

**Success Criteria:**
- ✅ Bulk operations complete efficiently
- ✅ Indexes used appropriately
- ✅ No table locks

---

## Performance Benchmarks

### Baseline (Before Changes)

| Operation | Baseline Time |
|-----------|---------------|
| Create Objective | 200-300ms |
| Create Key Result | 200-300ms |
| Create Initiative | 200-300ms |
| Get Overview (20 items) | 150-250ms |
| Filter by Status | 100-200ms |

### Target (After Changes)

| Operation | Target Time | Acceptable Degradation |
|-----------|-------------|------------------------|
| Create Objective | 200-400ms | < 100ms |
| Create Key Result | 200-400ms | < 100ms |
| Create Initiative | 200-400ms | < 100ms |
| Get Overview (20 items) | 150-300ms | < 50ms |
| Filter by Status | 100-250ms | < 50ms |

**Success Criteria:**
- ✅ All operations within target times
- ✅ Degradation < acceptable threshold
- ✅ No significant performance regression

---

## Performance Monitoring

### 1. Database Monitoring

**Metrics to Monitor:**
- Query execution times
- Index usage
- Table scan frequency
- Lock contention

**Tools:**
- PostgreSQL `pg_stat_statements`
- Prisma query logging
- Database performance insights

### 2. API Monitoring

**Metrics to Monitor:**
- Endpoint response times
- Error rates
- Request throughput
- Database query counts

**Tools:**
- Application logs
- API monitoring tools
- Performance profiling

### 3. UI Monitoring

**Metrics to Monitor:**
- Component render times
- User interaction latency
- Memory usage
- Bundle size

**Tools:**
- React DevTools Profiler
- Browser DevTools
- Performance API

---

## Performance Optimization

### If Performance Issues Detected

1. **Database Optimization**
   - Verify indexes are being used
   - Add additional indexes if needed
   - Optimize queries
   - Consider query caching

2. **API Optimization**
   - Optimize database queries
   - Add response caching
   - Reduce payload sizes
   - Optimize serialization

3. **UI Optimization**
   - Optimize component rendering
   - Implement virtual scrolling if needed
   - Lazy load components
   - Optimize bundle size

---

## Performance Test Checklist

### Pre-Deployment

- [ ] Database indexes verified
- [ ] Query plans reviewed
- [ ] API response times measured
- [ ] UI render times measured
- [ ] Load testing completed
- [ ] Performance benchmarks met

### Post-Deployment

- [ ] Monitor database performance
- [ ] Monitor API performance
- [ ] Monitor UI performance
- [ ] Check for performance regressions
- [ ] Review error logs
- [ ] Gather user feedback

---

## Performance Test Results Template

### Test Environment
- **Database:** PostgreSQL X.X
- **Dataset Size:** X Objectives, Y Key Results, Z Initiatives
- **Server:** [Specs]
- **Date:** YYYY-MM-DD

### Results

| Operation | Baseline | After Changes | Change | Status |
|-----------|----------|---------------|--------|--------|
| Create Objective | X ms | Y ms | +Z ms | ✅/❌ |
| Create Key Result | X ms | Y ms | +Z ms | ✅/❌ |
| Create Initiative | X ms | Y ms | +Z ms | ✅/❌ |
| Get Overview | X ms | Y ms | +Z ms | ✅/❌ |
| Filter by Status | X ms | Y ms | +Z ms | ✅/❌ |

### Index Usage

| Query | Index Used | Performance | Status |
|-------|------------|------------|--------|
| Filter by goalType | goalType_idx | X ms | ✅/❌ |
| Filter by createdBy | createdBy_idx | X ms | ✅/❌ |
| Filter by teamId | teamId_idx | X ms | ✅/❌ |

---

**Last Updated:** 2025-01-27  
**Performance Testing Guide Version:** 1.0

