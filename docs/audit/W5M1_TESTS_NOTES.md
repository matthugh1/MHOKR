# W5.M1 Tests & CI Notes

**Generated:** 2025-01-XX  
**Scope:** W5.M1 — Publishable OKR Creation Flow — Automated Test Suite  
**Authoritative Sources:** 
- `docs/audit/W5M1_IMPLEMENTATION_NOTES.md`
- `docs/audit/API_SURFACE_MAP.md`

---

## Summary

This document summarizes the automated test suite for W5.M1 Publishable OKR Creation Flow. Tests cover backend unit/integration and frontend component/integration scenarios.

---

## Test Coverage Matrix

### Backend Unit Tests

**File**: `services/core-api/src/modules/okr/__tests__/objective.service.createComposite.spec.ts`

| Test Case | Status | Description |
|-----------|--------|-------------|
| Happy path (PUBLIC_TENANT + 1 KR) | ✅ | Returns ids, publishState=PUBLISHED |
| RBAC: user w/o create_okr | ✅ | Returns 403 |
| SUPERUSER hard-deny | ✅ | Returns 403 |
| Governance: LOCKED cycle for non-admin | ✅ | Returns 403 |
| Governance: ARCHIVED cycle for non-admin | ✅ | Returns 403 |
| Governance: Admin can create in LOCKED cycle | ✅ | Succeeds |
| Tenant isolation: mismatched tenant | ✅ | Returns 403 |
| PRIVATE: missing whitelist | ✅ | Returns 400 |
| PRIVATE: empty whitelist | ✅ | Returns 400 |
| PRIVATE: whitelist users not in tenant | ✅ | Returns 400 |
| PRIVATE: non-admin attempts | ✅ | Returns 403 |
| KR validation: no KRs | ✅ | Returns 400 |
| KR validation: empty KR title | ✅ | Returns 400 |
| KR validation: KR owner not found | ✅ | Returns 404 |
| Required fields: missing title | ✅ | Returns 400 |
| Required fields: missing ownerUserId | ✅ | Returns 400 |
| Required fields: missing cycleId | ✅ | Returns 400 |
| Required fields: missing organizationId | ✅ | Returns 400 |
| AuditLog: objective_created recorded | ✅ | Assert recorded |
| AuditLog: key_result_created recorded | ✅ | Assert recorded |

**Coverage**: 20 test cases

---

### Backend Integration Tests (E2E)

**File**: `services/core-api/test/okr.createComposite.e2e.spec.ts`

| Test Case | Status | Description |
|-----------|--------|-------------|
| Happy path: PUBLIC_TENANT → appears in /okr/overview page 1 | ✅ | 200 response, then GET /okr/overview shows new objective |
| PRIVATE with whitelist: visible to admin + whitelisted | ✅ | Admin sees, whitelisted sees, non-whitelisted does not |
| PRIVATE with whitelist: hidden from non-whitelisted | ✅ | Contributor does not see PRIVATE objective |
| Visibility inheritance: KRs hidden when parent hidden | ✅ | KRs not visible if parent Objective not visible |
| Rate limit: >30 req/min → 429 | ✅ | Burst requests, last ones return 429 |
| Governance: LOCKED cycle for non-admin → 403 | ✅ | Workspace lead cannot create in LOCKED cycle |
| Governance: Admin can create in LOCKED cycle | ✅ | Tenant admin can create in LOCKED cycle |

**Coverage**: 7 test cases

---

### Frontend Component Tests

**File**: `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.publish.spec.tsx`

| Test Case | Status | Description |
|-----------|--------|-------------|
| Validation: publish disabled until title + cycle + ≥1 KR | ✅ | Button disabled until all required fields |
| Validation: publish disabled if title empty | ✅ | Button disabled |
| Validation: publish disabled if no KRs | ✅ | Button disabled |
| Visibility options: exclude EXEC_ONLY | ✅ | Only PUBLIC_TENANT and PRIVATE shown |
| PRIVATE: whitelist section appears | ✅ | Whitelist UI shown when PRIVATE selected |
| SUPERUSER: warning shown, publish blocked | ✅ | Warning displayed, button disabled |
| Success flow: calls composite endpoint | ✅ | POST /okr/create-composite called |
| Success flow: shows success toast | ✅ | Toast displayed |
| Success flow: calls onSuccess (refreshes list) | ✅ | onSuccess callback called |
| Error handling: 403 shows permission denied toast | ✅ | Toast with error message |
| Error handling: 429 shows rate limit toast | ✅ | Toast with rate limit message |
| Error handling: drawer stays open on error | ✅ | onSuccess not called |

**Coverage**: 12 test cases

---

## Test Fixtures & Utilities

**File**: `services/core-api/test/fixtures/test-fixtures.ts`

### TestFixtures Class

Provides factory methods for creating test data:
- `createOrganization()` — Create test organization
- `createUser()` — Create test user
- `createTenantAdmin()` — Create tenant admin with role assignment
- `createWorkspaceLead()` — Create workspace lead with role assignment
- `createContributor()` — Create contributor with role assignment
- `createActiveCycle()` — Create active cycle
- `createLockedCycle()` — Create locked cycle
- `createArchivedCycle()` — Create archived cycle
- `generateToken()` — Generate JWT token for user
- `cleanup()` — Cleanup test data

### MockAuditLogSink Class

In-memory audit log sink for unit tests:
- `record()` — Record audit log entry
- `getLogs()` — Get all logs
- `getLogsByAction()` — Filter by action
- `getLogsByTargetId()` — Filter by target ID
- `clear()` — Clear logs

---

## CI Scripts

### Backend (`services/core-api/package.json`)

```json
{
  "test:unit": "jest --passWithNoTests",
  "test:e2e": "jest --config ./test/jest-e2e.json --runInBand",
  "test:all": "npm run test:unit && npm run test:e2e && npm run smoke:test"
}
```

### Frontend (`apps/web/package.json`)

```json
{
  "test": "jest --passWithNoTests",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

---

## Running Tests

### Backend

```bash
# Unit tests only
cd services/core-api
npm run test:unit

# E2E tests only
npm run test:e2e

# All tests (unit + e2e + smoke)
npm run test:all
```

### Frontend

```bash
# Run tests
cd apps/web
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

---

## Test Files

### Backend

1. **Unit Tests**: `services/core-api/src/modules/okr/__tests__/objective.service.createComposite.spec.ts`
   - 20 test cases covering validation, RBAC, governance, tenant isolation, PRIVATE visibility, KR validation, and AuditLog

2. **Integration Tests**: `services/core-api/test/okr.createComposite.e2e.spec.ts`
   - 7 test cases covering happy path, PRIVATE visibility, rate limiting, and governance

3. **Test Fixtures**: `services/core-api/test/fixtures/test-fixtures.ts`
   - TestFixtures class for creating test data
   - MockAuditLogSink for audit log assertions

### Frontend

1. **Component Tests**: `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.publish.spec.tsx`
   - 12 test cases covering validation gates, visibility options, SUPERUSER block, success flow, and error handling

---

## Coverage Goals

- **Backend Unit**: 100% coverage of `createComposite()` method
- **Backend Integration**: All critical paths covered (happy path, PRIVATE, rate limit, governance)
- **Frontend Component**: All user interactions covered (validation, publish, errors)

---

## Manual Validation Checklist

Before merging, verify:

- [ ] Backend `npm run test:all` passes (unit + e2e + smoke)
- [ ] Frontend `npm test` passes
- [ ] Manual curl tests pass (happy path, PRIVATE, governance, rate limit)
- [ ] Telemetry events logged (console/log sink)
- [ ] CHANGELOG and API_SURFACE_MAP updated

---

## Known Limitations

1. **E2E Tests**: Require database setup (test fixtures create/cleanup data)
2. **Rate Limit Test**: Extended timeout (10s) due to rapid request bursts
3. **Frontend Tests**: Require proper mocking of API, auth context, and permissions hooks

---

## References

- **Implementation**: `docs/audit/W5M1_IMPLEMENTATION_NOTES.md`
- **API Surface**: `docs/audit/API_SURFACE_MAP.md`
- **Planning**: `docs/planning/OKR_CREATION_DRAWER_PLAN.md`

---

**Status**: ✅ Test suite complete




