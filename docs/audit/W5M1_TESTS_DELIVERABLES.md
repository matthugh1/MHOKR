# W5.M1 Tests & CI Deliverables Summary

## 1. Files Added/Changed

### Backend Tests

**Created**:
- `services/core-api/src/modules/okr/__tests__/objective.service.createComposite.spec.ts`
  - Unit tests for `createComposite()` method (20 test cases)
  
- `services/core-api/test/okr.createComposite.e2e.spec.ts`
  - Integration/E2E tests for `POST /okr/create-composite` endpoint (7 test cases)

- `services/core-api/test/fixtures/test-fixtures.ts`
  - TestFixtures utility class for creating test data
  - MockAuditLogSink for audit log assertions

- `services/core-api/test/jest-e2e.json`
  - E2E test configuration

**Modified**:
- `services/core-api/package.json`
  - Added `test:unit`, `test:e2e`, `test:all` scripts

### Frontend Tests

**Created**:
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.publish.spec.tsx`
  - Component tests for drawer publish flow (12 test cases)

**Modified**:
- `apps/web/package.json`
  - Added `test`, `test:watch`, `test:coverage` scripts

### Documentation

**Created**:
- `docs/audit/W5M1_TESTS_NOTES.md`

**Updated**:
- `CHANGELOG.md` (added W5.M1 Tests & CI section)

---

## 2. Key Test Snippets

### Backend Unit Test Example

```typescript
// services/core-api/src/modules/okr/__tests__/objective.service.createComposite.spec.ts

describe('Happy Path', () => {
  it('should create PUBLIC_TENANT objective + 1 KR and return ids with publishState=PUBLISHED', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
    mockPrismaService.cycle.findUnique.mockResolvedValue(mockCycle);
    mockRBACService.canPerformAction.mockResolvedValue(true);

    const result = await service.createComposite(
      validObjectiveData,
      validKeyResultsData,
      'creator-1',
      'org-1',
    );

    expect(result).toEqual({
      objectiveId: 'objective-1',
      keyResultIds: ['kr-1'],
      publishState: 'PUBLISHED',
      status: 'ON_TRACK',
      visibilityLevel: 'PUBLIC_TENANT',
    });

    expect(mockAuditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'objective_created',
        targetType: 'OKR',
        targetId: 'objective-1',
      }),
    );
  });
});
```

### Backend Integration Test Example

```typescript
// services/core-api/test/okr.createComposite.e2e.spec.ts

describe('Happy Path - PUBLIC_TENANT', () => {
  it('should create objective + KR and return 200 with ids, then appear in /okr/overview page 1', async () => {
    const payload = {
      objective: {
        title: 'Reduce churn Q1',
        ownerUserId: tenantAdminUser.id,
        cycleId: activeCycle.id,
        visibilityLevel: 'PUBLIC_TENANT',
      },
      keyResults: [
        {
          title: 'NRR ≥ 110%',
          metricType: 'PERCENT',
          targetValue: 110,
          ownerUserId: tenantAdminUser.id,
        },
      ],
    };

    const response = await request(app.getHttpServer())
      .post('/okr/create-composite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(200);

    expect(response.body).toMatchObject({
      objectiveId: expect.any(String),
      keyResultIds: expect.arrayContaining([expect.any(String)]),
      publishState: 'PUBLISHED',
    });

    // Verify it appears in /okr/overview page 1
    const overviewResponse = await request(app.getHttpServer())
      .get(`/okr/overview?organizationId=${testOrg.id}&page=1&pageSize=20`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const createdObjective = overviewResponse.body.objectives.find(
      (o: any) => o.objectiveId === response.body.objectiveId,
    );
    expect(createdObjective).toBeDefined();
  });
});
```

### Frontend Component Test Example

```typescript
// apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.publish.spec.tsx

describe('Success Flow', () => {
  it('should call composite endpoint, close drawer, and refresh list on success', async () => {
    mockApi.post.mockResolvedValue({
      data: {
        objectiveId: 'objective-1',
        keyResultIds: ['kr-1'],
        publishState: 'PUBLISHED',
        status: 'ON_TRACK',
        visibilityLevel: 'PUBLIC_TENANT',
      },
    });

    render(<OKRCreationDrawer {...mockProps} />);

    // Fill form and navigate to review
    const titleInput = screen.getByLabelText(/Objective Title/i);
    fireEvent.change(titleInput, { target: { value: 'Test Objective' } });

    // Navigate through steps and publish
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    
    const addKRButton = screen.getByText(/Add Key Result/i);
    fireEvent.click(addKRButton);

    const krTitleInput = screen.getByLabelText(/KR Title/i);
    fireEvent.change(krTitleInput, { target: { value: 'Test KR' } });

    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText(/Publish/i));

    // Should call composite endpoint
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith(
        '/okr/create-composite',
        expect.objectContaining({
          objective: expect.objectContaining({
            title: 'Test Objective',
          }),
        }),
      );
    });

    expect(mockOnSuccess).toHaveBeenCalled();
  });
});
```

---

## 3. CI Scripts

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

## 4. CHANGELOG Chunk

```markdown
## [W5.M1 — Tests & CI] Complete

- **Backend Unit Tests**: Added comprehensive unit tests for `ObjectiveService.createComposite()` covering validation, RBAC, governance, tenant isolation, PRIVATE visibility, KR validation, and AuditLog (20 test cases).
- **Backend Integration Tests**: Added E2E tests for `POST /okr/create-composite` endpoint covering happy path, PRIVATE visibility enforcement, rate limiting, and governance (7 test cases).
- **Frontend Component Tests**: Added component tests for `OKRCreationDrawer` publish flow covering validation gates, visibility options, SUPERUSER block, success flow, and error handling (12 test cases).
- **Test Fixtures**: Created `TestFixtures` utility class for creating test data (users, organizations, cycles) and `MockAuditLogSink` for audit log assertions.
- **CI Scripts**: Added `test:unit`, `test:e2e`, and `test:all` scripts to backend package.json. Added `test`, `test:watch`, and `test:coverage` scripts to frontend package.json.
- **E2E Config**: Created `test/jest-e2e.json` configuration for integration tests.
- **Documentation**: Test coverage matrix and notes at `docs/audit/W5M1_TESTS_NOTES.md`.
```

---

## 5. PR Body

```markdown
# W5.M1: Publishable Creation – Tests & CI

## Why

This PR adds comprehensive automated tests for W5.M1 Publishable OKR Creation Flow to ensure reliability, catch regressions, and validate RBAC/governance enforcement.

## What

### Backend Tests

**Unit Tests** (`objective.service.createComposite.spec.ts`):
- 20 test cases covering validation, RBAC, governance, tenant isolation, PRIVATE visibility, KR validation, and AuditLog

**Integration Tests** (`okr.createComposite.e2e.spec.ts`):
- 7 E2E test cases covering happy path, PRIVATE visibility enforcement, rate limiting, and governance

### Frontend Tests

**Component Tests** (`OKRCreationDrawer.publish.spec.tsx`):
- 12 test cases covering validation gates, visibility options, SUPERUSER block, success flow, and error handling

### Test Utilities

- `TestFixtures` class for creating test data (users, organizations, cycles)
- `MockAuditLogSink` for audit log assertions in unit tests

### CI Scripts

- Backend: `test:unit`, `test:e2e`, `test:all`
- Frontend: `test`, `test:watch`, `test:coverage`

## Coverage

### Backend Unit Tests (20 cases)
- ✅ Happy path (PUBLIC_TENANT + 1 KR)
- ✅ RBAC enforcement (403 for non-authorized)
- ✅ SUPERUSER hard-deny
- ✅ Governance (LOCKED/ARCHIVED cycle for non-admin → 403)
- ✅ Tenant isolation (mismatched tenant → 403)
- ✅ PRIVATE visibility (missing whitelist → 400, non-admin → 403)
- ✅ KR validation (no KRs → 400, empty title → 400, owner not found → 404)
- ✅ Required fields validation
- ✅ AuditLog recording (objective_created + key_result_created)

### Backend Integration Tests (7 cases)
- ✅ Happy path: PUBLIC_TENANT → appears in /okr/overview page 1
- ✅ PRIVATE with whitelist: visible to admin + whitelisted, hidden from non-whitelisted
- ✅ Visibility inheritance: KRs hidden when parent Objective hidden
- ✅ Rate limit: >30 req/min → 429
- ✅ Governance: LOCKED cycle for non-admin → 403, admin can create in LOCKED cycle

### Frontend Component Tests (12 cases)
- ✅ Validation gates (publish disabled until title + cycle + ≥1 KR)
- ✅ Visibility options exclude EXEC_ONLY
- ✅ PRIVATE requires whitelist
- ✅ SUPERUSER publish blocked with warning
- ✅ Success flow: calls composite endpoint, shows toast, refreshes list
- ✅ Error handling: 403/429 show appropriate toasts, drawer stays open

## How to Run

### Backend

```bash
cd services/core-api

# Unit tests only
npm run test:unit

# E2E tests only
npm run test:e2e

# All tests (unit + e2e + smoke)
npm run test:all
```

### Frontend

```bash
cd apps/web

# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## References

- **Implementation**: `docs/audit/W5M1_IMPLEMENTATION_NOTES.md`
- **Test Notes**: `docs/audit/W5M1_TESTS_NOTES.md`
- **API Surface**: `docs/audit/API_SURFACE_MAP.md`
```

---

## 6. Git Commands

```bash
git checkout -b feat/w5m1-tests-and-ci

git add -A

git commit -m "test(okr): W5.M1 tests & CI (unit + e2e + component tests, fixtures, CI scripts)"

# push + PR (using gh if available)
gh repo view >/dev/null 2>&1 && gh pr create -t "W5.M1: Publishable Creation – Tests & CI" -b "$(cat docs/audit/W5M1_TESTS_NOTES.md)" -B main -H feat/w5m1-tests-and-ci
```

---

## Summary

✅ **Backend Unit Tests**: 20 test cases covering all validation, RBAC, governance paths  
✅ **Backend Integration Tests**: 7 E2E test cases covering happy path, PRIVATE, rate limit, governance  
✅ **Frontend Component Tests**: 12 test cases covering validation, publish flow, error handling  
✅ **Test Fixtures**: TestFixtures utility and MockAuditLogSink  
✅ **CI Scripts**: Added test scripts to both backend and frontend package.json  
✅ **Documentation**: W5M1_TESTS_NOTES.md with coverage matrix  

**Status**: ✅ Test suite complete and ready for review




