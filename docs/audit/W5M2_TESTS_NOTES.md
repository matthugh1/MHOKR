# W5.M2 Tests & CI Notes

**Generated:** 2025-01-XX  
**Scope:** W5.M2 — Inline Insights & Cycle Health — Tests & CI  
**Authoritative Sources:**
- `docs/audit/W5M2_IMPLEMENTATION_NOTES.md`
- `services/core-api/src/modules/okr/okr-insights.controller.ts`
- `services/core-api/src/modules/okr/okr-insights.service.ts`
- `apps/web/src/components/okr/CycleHealthStrip.tsx`
- `apps/web/src/components/okr/InlineInsightBar.tsx`
- `apps/web/src/components/okr/AttentionDrawer.tsx`

---

## Summary

This PR adds a complete automated test suite for W5.M2 Inline Insights & Cycle Health features, including backend unit and e2e tests, frontend component and integration tests, and CI script updates.

---

## Test Coverage Matrix

### Backend Tests

#### Unit Tests (`okr-insights.service.spec.ts`)

**Coverage**:
- ✅ `getCycleSummary()`: Correct counts; visibility filtering excludes PRIVATE/EXEC_ONLY when not allowed
- ✅ `getObjectiveInsights()`: Status trend calculation (IMPROVING/DECLINING/FLAT/UNKNOWN) with edge cases; lastUpdateAgeHours correct
- ✅ `getAttentionFeed()`: Pagination stable; types OVERDUE_CHECKIN/NO_UPDATE_14D/STATUS_DOWNGRADE emitted as expected
- ✅ SUPERUSER read-only: No writes; reads allowed

**Test File**: `services/core-api/src/modules/okr/okr-insights.service.spec.ts`

**Key Assertions**:
```typescript
// Visibility filtering
expect(result.objectives.total).toBe(1) // PRIVATE filtered out
expect(mockVisibilityService.canUserSeeObjective).toHaveBeenCalledTimes(2)

// Status trend
expect(result!.statusTrend).toBe('UNKNOWN') // Default for new objectives

// Check-in calculations
expect(result.checkins.overdue).toBe(1) // Correctly identifies overdue
```

#### E2E Tests (`okr.insights.e2e.spec.ts`)

**Coverage**:
- ✅ `GET /okr/insights/cycle-summary` returns tenant-scoped metrics
- ✅ `GET /okr/insights/objective/:id` obeys visibility rules (unauthorised → 404 or 403)
- ✅ `GET /okr/insights/attention` paginates; items all visible to caller
- ✅ Performance guardrail: each endpoint under 300ms on seeded data (skip/flaky marker allowed for CI)

**Test File**: `services/core-api/test/okr.insights.e2e.spec.ts`

**Key Assertions**:
```typescript
// Visibility enforcement
expect(contributorResponse.body.objectives.total).toBeLessThan(adminResponse.body.objectives.total)

// Pagination
expect(response.body.page).toBe(1)
expect(response.body.items.length).toBeLessThanOrEqual(20)

// Performance (skipped in CI)
if (process.env.CI !== 'true') {
  expect(duration).toBeLessThan(300)
}
```

### Frontend Tests

#### Component Tests

**CycleHealthStrip** (`CycleHealthStrip.renders.spec.tsx`):
- ✅ Renders totals from mocked API
- ✅ Chip clicks set local filters
- ✅ Loading and error states handled
- ✅ Telemetry tracking

**InlineInsightBar** (`InlineInsightBar.lazyload.spec.tsx`):
- ✅ Loads on intersection (IntersectionObserver)
- ✅ Shows trend arrow + "last update Xh ago"
- ✅ Formats last update age correctly (hours/days)
- ✅ Shows KR roll-ups and check-in badges
- ✅ Handles loading and error states

**AttentionDrawer** (`AttentionDrawer.paginate.spec.tsx`):
- ✅ Paginated list display
- ✅ Grouped by type (OVERDUE_CHECKIN, NO_UPDATE_14D, STATUS_DOWNGRADE)
- ✅ Action buttons hidden by permission (`canRequestCheckIn`)
- ✅ Navigation callbacks work
- ✅ Empty state handled

#### Integration Tests

**OKRs Page** (`okrs.page.insights.integration.spec.tsx`):
- ✅ End-to-end render with mocked APIs
- ✅ No leakage of hidden objectives/KRs (visibility filtering)
- ✅ Cycle Health Strip integration
- ✅ Attention Drawer integration

**Key Assertions**:
```typescript
// Visibility filtering
expect(screen.queryByText('Private Objective')).not.toBeInTheDocument()

// Cycle Health Strip
expect(screen.getByText(/Cycle health:/)).toBeInTheDocument()
```

---

## How to Run Tests Locally

### Backend Tests

**Unit Tests**:
```bash
cd services/core-api
npm run test:unit
```

**E2E Tests**:
```bash
cd services/core-api
npm run test:e2e
```

**All Tests**:
```bash
cd services/core-api
npm run test:all
```

**Specific Test File**:
```bash
cd services/core-api
npm test -- okr-insights.service.spec.ts
npm test -- okr.insights.e2e.spec.ts
```

### Frontend Tests

**All Tests**:
```bash
cd apps/web
npm test
```

**Watch Mode**:
```bash
cd apps/web
npm run test:watch
```

**Coverage**:
```bash
cd apps/web
npm run test:coverage
```

**Specific Test File**:
```bash
cd apps/web
npm test -- CycleHealthStrip.renders.spec.tsx
```

---

## CI Integration

### Backend CI

**Package Scripts** (`services/core-api/package.json`):
- `test:unit`: Runs unit tests with `--passWithNoTests`
- `test:e2e`: Runs e2e tests with Jest e2e config
- `test:all`: Runs unit + e2e + smoke tests

**GitHub Actions** (to be added to `.github/workflows/premerge-check.yml`):
```yaml
- name: Run backend tests
  working-directory: services/core-api
  run: npm run test:all
```

### Frontend CI

**Package Scripts** (`apps/web/package.json`):
- `test`: Runs tests with coverage (`jest --passWithNoTests --coverage`)
- `test:watch`: Watch mode for development
- `test:coverage`: Coverage report

**GitHub Actions** (to be added to `.github/workflows/premerge-check.yml`):
```yaml
- name: Run frontend tests
  working-directory: apps/web
  run: npm test
```

---

## Test Fixtures

### Backend Fixtures

Tests reuse existing test patterns from W5.M1:
- Uses `PrismaService` to create test data
- Creates users, organizations, cycles, objectives, KRs
- Uses JWT tokens for authentication
- Cleans up test data in `afterAll`

**Example Fixture**:
```typescript
testOrg = await prisma.organization.create({
  data: { name: 'Test Organization', slug: 'test-org' },
})

publicObjective = await prisma.objective.create({
  data: {
    title: 'Public Objective',
    ownerId: tenantAdminUser.id,
    organizationId: testOrg.id,
    cycleId: activeCycle.id,
    visibilityLevel: 'PUBLIC_TENANT',
    isPublished: true,
    status: 'ON_TRACK',
  },
})
```

### Frontend Fixtures

Tests use mocked API responses:
- `mockApi.get.mockResolvedValue({ data: {...} })`
- Mock auth context: `mockUseAuth.mockReturnValue({ user: {...} })`
- Mock permissions: `mockUsePermissions.mockReturnValue({...})`

**Example Fixture**:
```typescript
const mockSummary = {
  cycleId: 'cycle-1',
  objectives: { total: 10, published: 7, draft: 3 },
  krs: { total: 25, onTrack: 15, atRisk: 5, blocked: 3, completed: 2 },
  checkins: { upcoming7d: 8, overdue: 3, recent24h: 5 },
}
```

---

## Performance Considerations

### Backend Performance Tests

- **Guardrail**: Each endpoint should respond within 300ms on seeded data
- **CI Skip**: Performance tests are skipped in CI (`process.env.CI !== 'true'`) to avoid flakiness
- **Timeouts**: E2E tests have extended timeouts (5000ms) for performance tests

### Frontend Performance

- **IntersectionObserver**: Used for lazy loading to avoid unnecessary API calls
- **Abort on Unmount**: Inflight requests are aborted when component unmounts
- **Caching**: Components cache loaded data to avoid redundant requests

---

## Known Limitations

1. **IntersectionObserver Mock**: Frontend tests mock `IntersectionObserver` - may need adjustment for CI environment
2. **Performance Tests**: Skipped in CI due to potential flakiness - can be enabled later with better CI infrastructure
3. **E2E Test Data**: Requires seeded database - tests create and clean up their own data
4. **Frontend Test Environment**: May need Jest configuration for Next.js (to be added if missing)

---

## Files Changed

### Backend Tests

**Created**:
- `services/core-api/src/modules/okr/okr-insights.service.spec.ts` (unit tests)
- `services/core-api/test/okr.insights.e2e.spec.ts` (e2e tests)

### Frontend Tests

**Created**:
- `apps/web/src/components/okr/CycleHealthStrip.renders.spec.tsx` (component tests)
- `apps/web/src/components/okr/InlineInsightBar.lazyload.spec.tsx` (component tests)
- `apps/web/src/components/okr/AttentionDrawer.paginate.spec.tsx` (component tests)
- `apps/web/src/app/dashboard/okrs/okrs.page.insights.integration.spec.tsx` (integration tests)

### CI Scripts

**Modified**:
- `services/core-api/package.json` (scripts already present)
- `apps/web/package.json` (updated test script to include coverage)

**To Be Added** (GitHub Actions):
- `.github/workflows/premerge-check.yml` (add backend and frontend test jobs)

---

## References

- **Implementation**: `docs/audit/W5M2_IMPLEMENTATION_NOTES.md`
- **Backend Service**: `services/core-api/src/modules/okr/okr-insights.service.ts`
- **Backend Controller**: `services/core-api/src/modules/okr/okr-insights.controller.ts`
- **Frontend Components**: `apps/web/src/components/okr/*.tsx`

---

**Status**: ✅ Tests implemented and ready for CI integration

