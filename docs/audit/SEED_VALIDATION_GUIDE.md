# Seed Validation Guide

**Purpose:** Step-by-step manual validation checks after seed execution

---

## 1. Database Counts

### Expected Counts

After seeding, verify:

```sql
-- Users
SELECT COUNT(*) FROM users WHERE email LIKE '%@puzzelcx.local';
-- Expected: ~200

-- Workspaces
SELECT COUNT(*) FROM workspaces w
JOIN organizations o ON o.id = w.organization_id
WHERE o.slug = 'puzzel-cx-demo';
-- Expected: 6

-- Teams
SELECT COUNT(*) FROM teams t
JOIN workspaces w ON w.id = t.workspace_id
JOIN organizations o ON o.id = w.organization_id
WHERE o.slug = 'puzzel-cx-demo';
-- Expected: 20

-- Cycles
SELECT COUNT(*) FROM cycles c
JOIN organizations o ON o.id = c.organization_id
WHERE o.slug = 'puzzel-cx-demo';
-- Expected: 4

-- Objectives
SELECT COUNT(*) FROM objectives o
JOIN organizations org ON org.id = o.organization_id
WHERE org.slug = 'puzzel-cx-demo';
-- Expected: ~260

-- Key Results
SELECT COUNT(*) FROM key_results kr
JOIN objective_key_results okr ON okr.key_result_id = kr.id
JOIN objectives o ON o.id = okr.objective_id
JOIN organizations org ON org.id = o.organization_id
WHERE org.slug = 'puzzel-cx-demo';
-- Expected: ~780
```

---

## 2. API Endpoint Checks

### OKR Overview

**Endpoint:** `GET /okr/overview?organizationId=<orgId>&scope=tenant&page=1&pageSize=20`

**Expected:**
- Returns paginated objectives
- Response time < 1.5s
- Includes nested key results and initiatives
- Respects visibility (PRIVATE OKRs filtered)

**Test:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/okr/overview?organizationId=<orgId>&scope=tenant&page=1&pageSize=20"
```

### Attention Feed

**Endpoint:** `GET /okr/insights/attention?organizationId=<orgId>&scope=tenant&page=1&pageSize=5`

**Expected:**
- Returns attention items (overdue check-ins, no progress)
- Badge count > 0
- Includes overdue KRs (10-15% of active KRs)

**Test:**
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/okr/insights/attention?organizationId=<orgId>&scope=tenant&page=1&pageSize=5"
```

### Cycle Selector

**Expected:**
- Shows Q4 2025 (ACTIVE)
- Shows Q1 2026 (ACTIVE)
- Shows Q2 2026 (DRAFT)
- Shows Q3 2026 (ARCHIVED)
- No "Unassigned/Backlog" cycles

---

## 3. Visibility & Governance

### PRIVATE Objectives

**Check:**
1. Login as regular user (not whitelisted)
2. Navigate to OKR list
3. Verify PRIVATE objectives are NOT visible

**Check:**
1. Login as whitelisted user (founder, admin1, admin2)
2. Navigate to OKR list
3. Verify PRIVATE objectives ARE visible

**SQL Check:**
```sql
SELECT COUNT(*) FROM objectives o
JOIN organizations org ON org.id = o.organization_id
WHERE org.slug = 'puzzel-cx-demo'
  AND o.visibility_level = 'PRIVATE';
-- Expected: ~15-20
```

### SUPERUSER Read-Only

**Check:**
1. Login as `platform@puzzelcx.local` (SUPERUSER)
2. Attempt to create/edit OKR
3. Verify mutation is blocked (read-only)

---

## 4. Frontend Checks

### Dashboard Load Time

**Check:**
1. Login as regular user
2. Navigate to `/dashboard/okrs`
3. Verify page loads in < 1.5s
4. Verify OKR list renders with counts > 0

### Attention Badge

**Check:**
1. Navigate to dashboard
2. Verify attention badge shows count > 0
3. Click badge to open attention drawer
4. Verify items are filtered by scope and cycle

### Cycle Selector

**Check:**
1. Open cycle selector dropdown
2. Verify shows Q4 2025, Q1 2026, Q2 2026, Q3 2026
3. Verify correct statuses (ACTIVE, ACTIVE, DRAFT, ARCHIVED)

---

## 5. RBAC Checks

### Role Assignments

**Check:**
```sql
SELECT 
  ra.role,
  ra.scope_type,
  COUNT(DISTINCT ra.user_id) as user_count
FROM role_assignments ra
JOIN users u ON u.id = ra.user_id
WHERE u.email LIKE '%@puzzelcx.local'
GROUP BY ra.role, ra.scope_type
ORDER BY ra.scope_type, ra.role;
```

**Expected:**
- 1 TENANT_OWNER
- 5 TENANT_ADMIN
- ~24 WORKSPACE_LEAD
- ~24 TEAM_LEAD
- Remainder: WORKSPACE_MEMBER, TEAM_CONTRIBUTOR, TEAM_VIEWER

### Effective Permissions

**Endpoint:** `GET /rbac/assignments/effective?tenantId=<orgId>`

**Check:**
1. Login as different roles
2. Verify effective permissions match role assignments
3. Verify tenant isolation (no cross-tenant access)

---

## 6. Check-ins & Attention

### Overdue KRs

**Check:**
```sql
SELECT 
  COUNT(DISTINCT kr.id) as overdue_krs
FROM key_results kr
JOIN objective_key_results okr ON okr.key_result_id = kr.id
JOIN objectives o ON o.id = okr.objective_id
JOIN organizations org ON org.id = o.organization_id
LEFT JOIN check_ins ci ON ci.key_result_id = kr.id
WHERE org.slug = 'puzzel-cx-demo'
  AND kr.check_in_cadence = 'WEEKLY'
  AND (ci.created_at IS NULL OR ci.created_at < NOW() - INTERVAL '7 days');
```

**Expected:** 10-15% of active KRs with WEEKLY cadence

### No Progress Items

**Check:**
- KRs with last check-in > 14 days ago
- Expected: 15-25% of active KRs

---

## 7. Cross-Tenant Leakage

**Critical Check:**
```sql
SELECT COUNT(*) as cross_tenant_leakage
FROM objectives o1
JOIN objectives o2 ON o1.id = o2.id
WHERE o1.organization_id != o2.organization_id;
-- Expected: 0
```

**Verify:**
- No OKRs visible across tenants
- No role assignments across tenants
- Tenant isolation enforced

---

## 8. Performance

### Database Queries

**Check:**
- Objective list query: < 500ms
- Attention feed query: < 300ms
- Role assignment query: < 200ms

### API Response Times

**Check:**
- `/okr/overview`: < 1.5s
- `/okr/insights/attention`: < 1s
- `/rbac/assignments/me`: < 500ms

---

## 9. Feature Flags

### RBAC Inspector

**Check:**
```sql
SELECT email, settings FROM users
WHERE settings::text LIKE '%rbacInspectorEnabled%';
-- Expected: 5 users
```

**Users with rbacInspector:**
- founder@puzzelcx.local
- admin1@puzzelcx.local
- admin2@puzzelcx.local
- 2 workspace leads

---

## 10. Summary Checklist

- [ ] User count: ~200
- [ ] Workspace count: 6
- [ ] Team count: 20
- [ ] Cycle count: 4
- [ ] Objective count: ~260
- [ ] Key result count: ~780
- [ ] Initiative count: ~520
- [ ] Check-in count: ~2000
- [ ] Attention badge > 0
- [ ] Overdue KRs present (10-15%)
- [ ] PRIVATE objectives visible only to whitelisted users
- [ ] SUPERUSER read-only enforced
- [ ] Cycle selector shows all 4 cycles
- [ ] No cross-tenant leakage
- [ ] Dashboard loads in < 1.5s
- [ ] RBAC assignments correct
- [ ] Feature flags configured (5 users with rbacInspector)

---

## Troubleshooting

**Issue:** Seed fails with constraint violation
- **Solution:** Run purge first: `npm run seed:purge`

**Issue:** Duplicate key errors
- **Solution:** Check idempotency - natural keys should match

**Issue:** Missing data
- **Solution:** Check seed script execution order
- **Solution:** Verify foreign key relationships

**Issue:** Performance issues
- **Solution:** Check database indexes
- **Solution:** Verify chunking in bulk operations

