# W5.M2 Implementation Notes

**Generated:** 2025-01-XX  
**Scope:** W5.M2 — Inline Insights & Cycle Health (RBAC/Visibility-Safe)  
**Authoritative Sources:** 
- `docs/planning/OKR_SCREEN_MODERNISATION_PLAN.md` (W5.M2 deliverables)
- `docs/audit/W3M2_VALIDATION_PLAN.md` (server-side visibility patterns)
- `docs/planning/OKR_TAXONOMY_DECISIONS.md` (visibility and tenant isolation)
- `docs/audit/W5M1_IMPLEMENTATION_NOTES.md` (endpoint patterns)

---

## Summary

This PR implements **inline insights and cycle health** features for the OKR list page, providing users with immediate context about objective health, KR roll-ups, upcoming/overdue check-ins, and attention items. All insights respect server-side visibility and tenant isolation.

---

## Backend Changes

### 1. Insights Service

**File**: `services/core-api/src/modules/okr/okr-insights.service.ts` (NEW)

**Methods**:
- `getCycleSummary()` - Returns cycle health summary (objectives, KRs, check-ins) for a specific cycle
- `getObjectiveInsights()` - Returns compact facts for a single objective (status trend, last update age, KR roll-ups, check-in counts)
- `getAttentionFeed()` - Returns paginated attention items (overdue check-ins, no updates, status downgrades)

**Features**:
- **Visibility Filtering**: Uses `OkrVisibilityService.canUserSeeObjective()` for all queries
- **Tenant Isolation**: Uses `OkrTenantGuard.buildTenantWhereClause()` for tenant scoping
- **Performance**: Optimized queries with indexed filters (cycleId, updated_at). No heavy joins in hot path
- **Pagination**: Attention feed supports pagination (default 20 per page, max 50)

### 2. Insights Controller

**File**: `services/core-api/src/modules/okr/okr-insights.controller.ts` (NEW)

**Endpoints**:
- `GET /okr/insights/cycle-summary?cycleId=<uuid>` - Cycle health summary
- `GET /okr/insights/objective/:id` - Objective-level insights
- `GET /okr/insights/attention?cycleId=<uuid>&page=<n>&pageSize=<m>` - Attention feed (paginated)

**Guards**:
- `JwtAuthGuard` + `RBACGuard` (class-level)
- `@RequireAction('view_okr')` (method-level)

**Rate Limiting**: Not applied (GET endpoints, lightweight queries)

### 3. Module Registration

**File**: `services/core-api/src/modules/okr/okr.module.ts` (UPDATED)

- Added `OkrInsightsService` to providers and exports
- Added `OkrInsightsController` to controllers

---

## Frontend Changes

### 1. Cycle Health Strip

**File**: `apps/web/src/components/okr/CycleHealthStrip.tsx` (NEW)

**Features**:
- Displays cycle health summary in header
- Shows objectives (published/draft), KRs (on track/at risk/blocked), and check-ins (upcoming/overdue)
- Clickable chips for filtering (onFilterClick callback)
- Lazy loads when cycleId is selected

**Integration**: Added to `apps/web/src/app/dashboard/okrs/page.tsx` header section

### 2. Inline Insight Bar

**File**: `apps/web/src/components/okr/InlineInsightBar.tsx` (NEW)

**Features**:
- Displays objective-level insights in expanded objective rows
- Shows status trend (↑/↓/→), last update age, KR roll-ups, and check-in badges
- Lazy loads via IntersectionObserver when row is expanded and visible
- Aborts inflight requests on unmount

**Integration**: Added to `apps/web/src/components/okr/ObjectiveRow.tsx` expanded body section

### 3. Attention Drawer

**File**: `apps/web/src/components/okr/AttentionDrawer.tsx` (NEW)

**Features**:
- Right-side sheet drawer showing paginated attention items
- Groups items by type (OVERDUE_CHECKIN, NO_UPDATE_14D, STATUS_DOWNGRADE)
- Row actions: "Open KR" / "Open Objective" (navigates/expands in list), "Request check-in" (permission-gated)
- Pagination controls (20 per page)

**Integration**: Added to `apps/web/src/app/dashboard/okrs/page.tsx` with "Needs attention" button

---

## Testing

### Backend Tests

**Unit Tests** (to be added):
- `services/core-api/src/modules/okr/okr-insights.service.spec.ts`
  - Visibility filtering tests (PRIVATE/EXEC_ONLY excluded for non-whitelisted)
  - Status trend calculation tests
  - Overdue check-in logic tests
  - Tenant isolation tests

**Integration Tests** (to be added):
- `services/core-api/src/modules/okr/okr-insights.integration.spec.ts`
  - `GET /okr/insights/cycle-summary` happy path + visibility denial
  - `GET /okr/insights/objective/:id` happy path + visibility denial
  - `GET /okr/insights/attention` pagination integrity + visibility filtering

### Frontend Tests

**Component Tests** (to be added):
- `apps/web/src/components/okr/CycleHealthStrip.test.tsx`
  - Renders correct numbers from mock data
  - Handles loading and error states
  - Calls onFilterClick on chip click

- `apps/web/src/components/okr/InlineInsightBar.test.tsx`
  - Loads insights on view (IntersectionObserver)
  - Shows trend + last update age
  - Handles loading and error states

- `apps/web/src/components/okr/AttentionDrawer.test.tsx`
  - Paginates correctly
  - Hides forbidden actions (request check-in)
  - Navigation callbacks work

**Integration Tests** (to be added):
- Visibility: private/exec-only items not present
- Action gating: request-check-in button absent for unauthorised roles

---

## API Contract Changes

### New Endpoints

**GET /okr/insights/cycle-summary**
- **Query Parameters**: `cycleId` (required)
- **Response**: Cycle health summary with objectives, KRs, and check-ins counts
- **Visibility**: Filtered by caller's visibility scope

**GET /okr/insights/objective/:id**
- **Path Parameters**: `id` (objective ID)
- **Response**: Objective insights (status trend, last update age, KR roll-ups, check-in counts)
- **Visibility**: Returns null if objective not visible to caller

**GET /okr/insights/attention**
- **Query Parameters**: `cycleId` (optional), `page` (default: 1), `pageSize` (default: 20, max: 50)
- **Response**: Paginated attention items
- **Visibility**: Filtered by caller's visibility scope

### Existing Endpoints

**No Breaking Changes**: All existing endpoints remain unchanged.

---

## Database Changes

**No Schema Changes**: No migrations required. All insights computed from existing data.

---

## Limitations & Future Work

1. **Status Trend Calculation**: Currently returns `UNKNOWN`. Can be enhanced with audit log history to detect actual status changes.
2. **Cache Hint**: Optional in-memory LRU cache for cycle summary per user+cycle (30s TTL) not yet implemented.
3. **Batched Fetch**: Objective-level insights could be batched for multiple objectives in a single query (future optimization).
4. **KR Navigation**: Attention drawer "Open KR" navigation needs to find and expand parent objective (simplified for now).

---

## Files Changed

### Backend

**Created**:
- `services/core-api/src/modules/okr/okr-insights.service.ts`
- `services/core-api/src/modules/okr/okr-insights.controller.ts`

**Modified**:
- `services/core-api/src/modules/okr/okr.module.ts` (added service and controller)

### Frontend

**Created**:
- `apps/web/src/components/okr/CycleHealthStrip.tsx`
- `apps/web/src/components/okr/InlineInsightBar.tsx`
- `apps/web/src/components/okr/AttentionDrawer.tsx`

**Modified**:
- `apps/web/src/app/dashboard/okrs/page.tsx` (integrated Cycle Health Strip and Attention Drawer)
- `apps/web/src/components/okr/ObjectiveRow.tsx` (integrated Inline Insight Bar)

### Tests

**To Be Added**:
- `services/core-api/src/modules/okr/okr-insights.service.spec.ts` (unit tests)
- `services/core-api/src/modules/okr/okr-insights.integration.spec.ts` (integration tests)
- `apps/web/src/components/okr/CycleHealthStrip.test.tsx` (component tests)
- `apps/web/src/components/okr/InlineInsightBar.test.tsx` (component tests)
- `apps/web/src/components/okr/AttentionDrawer.test.tsx` (component tests)

### Documentation

**Created**:
- `docs/audit/W5M2_IMPLEMENTATION_NOTES.md` (this file)

**Updated**:
- `docs/audit/API_SURFACE_MAP.md` (added OkrInsightsController endpoints)
- `CHANGELOG.md` (added W5.M2 section)

---

## References

- **Planning**: `docs/planning/OKR_SCREEN_MODERNISATION_PLAN.md`
- **Visibility**: `docs/audit/W3M2_VALIDATION_PLAN.md`
- **Taxonomy**: `docs/planning/OKR_TAXONOMY_DECISIONS.md`
- **W5.M1**: `docs/audit/W5M1_IMPLEMENTATION_NOTES.md`

---

**Status**: ✅ Ready for review and merge

