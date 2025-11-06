# OKR Trio Audit - Code Review (TL)

**Date:** 2025-01-XX  
**Reviewer:** Tech Lead  
**Scope:** OKR List view and Tree/Builder view

---

## A. Readability & Structure

### A.1 Separation of Concerns

**Findings:**
- ✅ **Good:** Clear separation: `page.tsx` (orchestration), `OKRPageContainer.tsx` (data fetching), `OKRListVirtualised.tsx` (rendering)
- ✅ **Good:** Tree view separated: `OKRTreeContainer.tsx` (data), `OKRTreeView.tsx` (rendering)
- ⚠️ **Issue:** `page.tsx` is large (1487 lines) - contains too much logic (state management, handlers, modals)
- ⚠️ **Issue:** Duplicate `mapObjectiveData` functions in `OKRPageContainer.tsx` and `OKRTreeContainer.tsx`

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/page.tsx:76-1487 (1487 lines total)
// Contains: state management, handlers, modals, telemetry, etc.
```

**Recommendation:**
- Extract modal handlers to custom hooks: `useOKRModals.ts`
- Extract state management to `useOKRPageState.ts`
- Consolidate `mapObjectiveData` into shared utility: `utils/mapObjectiveData.ts`

**Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx` (1487 lines)
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:91-202` (mapObjectiveData)
- `apps/web/src/app/dashboard/okrs/OKRTreeContainer.tsx:58-164` (mapObjectiveData duplicate)

---

### A.2 Guard Pattern Reuse

**Findings:**
- ✅ **Good:** RBAC guards reused via `useTenantPermissions` hook
- ✅ **Good:** `canEdit`/`canDelete` flags from backend used consistently
- ⚠️ **Issue:** Inline permission checks scattered (some in `ObjectiveRow`, some in `OKRPageContainer`)
- ⚠️ **Issue:** No centralized guard component for hiding/disabling actions

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:375-449
const preparedObjectives = useMemo(() => {
  return filteredOKRs.map((okr: any) => {
    const canEdit = okr.canEdit !== undefined ? okr.canEdit : false
    const canDelete = okr.canDelete !== undefined ? okr.canDelete : false
    // ... permission checks ...
  })
}, [filteredOKRs, ...])
```

**Recommendation:**
- Create `RBACGuard` component: `<RBACGuard can={canEdit} hide><EditButton /></RBACGuard>`
- Consolidate permission checks: use `useTenantPermissions` consistently
- Document guard pattern in coding standards

**Files:**
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:375-449`
- `apps/web/src/components/okr/ObjectiveRow.tsx:256-267` (permission props)

---

### A.3 Console.log Statements

**Findings:**
- ❌ **Critical:** 42 `console.log`/`console.error` statements in production code
- ❌ **Critical:** Debug logging in `okr-overview.controller.ts` (lines 157, 178-189, 206-234)
- ⚠️ **Issue:** Telemetry uses `console.log` instead of analytics service

**Console.log Count by File:**
- `page.tsx`: 16 instances
- `OKRCreationDrawer.tsx`: 19 instances
- `OKRTreeView.tsx`: 2 instances
- `OKRTreeContainer.tsx`: 2 instances
- `OKRPageContainer.tsx`: 2 instances
- `page.toolbar.actions.spec.tsx`: 1 instance (test file, acceptable)

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/page.tsx:83-88
useEffect(() => {
  console.log('[OKR Page] Feature flag check:', {
    okrTreeView,
    envVar: process.env.NEXT_PUBLIC_OKR_TREE_VIEW,
    urlView: searchParams.get('view'),
  })
}, [okrTreeView, searchParams])

// apps/web/src/app/dashboard/okrs/page.tsx:696-741
console.error(`🔍🔍🔍 [OKR MAPPING] STARTING MAPPING 🔍🔍🔍`);
console.error(`🔍 [OKR MAPPING] Raw objective data:`, { ... });
```

**Recommendation:**
- Remove all `console.log` statements (except telemetry)
- Replace telemetry `console.log` with analytics service: `analytics.track('okr.create.open', {...})`
- Remove debug logging from backend (`okr-overview.controller.ts`)
- Add ESLint rule: `no-console` (allow `console.error` for errors only)

**Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx:83-88, 696-741`
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx:185-613`
- `services/core-api/src/modules/okr/okr-overview.controller.ts:157, 178-189, 206-234`

---

### A.4 TODO/FIXME/HACK Audit

**Findings:**
- ✅ **Good:** Only 1 TODO found (properly tagged with `[phase6-polish]`)
- ✅ **Good:** No FIXME or HACK comments found

**TODO Found:**
```typescript
// apps/web/src/app/dashboard/okrs/components/PublishLockWarningModal.tsx:55
{/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
```

**Recommendation:**
- ✅ Keep TODO (properly tagged, tracked in GitHub issue)
- Document TODO policy: only `[phase6-polish]`, `[phase7-hardening]`, `[phase7-performance]` allowed

**Files:**
- `apps/web/src/app/dashboard/okrs/components/PublishLockWarningModal.tsx:55`

---

### A.5 Prop Drilling

**Findings:**
- ⚠️ **Issue:** Many props passed through multiple layers (`page.tsx` → `OKRPageContainer` → `OKRListVirtualised` → `ObjectiveRow`)
- ⚠️ **Issue:** `onAction` object passed with many handlers (could use context)
- ✅ **Good:** Some props avoided via hooks (`useAuth`, `useWorkspace`, `useTenantPermissions`)

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/page.tsx:1178-1194
<OKRPageContainer
  availableUsers={availableUsers}
  activeCycles={activeCycles}
  overdueCheckIns={overdueCheckIns}
  filterWorkspaceId={filterWorkspaceId}
  filterTeamId={filterTeamId}
  filterOwnerId={filterOwnerId}
  searchQuery={searchQuery}
  selectedTimeframeKey={selectedTimeframeKey}
  selectedStatus={selectedStatus}
  selectedCycleId={selectedCycleId}
  selectedScope={selectedScope}
  onAction={{ onEdit, onDelete, onAddKeyResult, ... }}
  // ... more props ...
/>
```

**Recommendation:**
- Create `OKRPageContext` for shared state (filters, scope, cycles)
- Use context for `onAction` handlers (reduce prop drilling)
- Keep data props (objectives, users) as props (not context)

**Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx:1178-1194`
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:204-220`

---

## B. Data & Security

### B.1 List Fetches via Paginated Endpoint

**Findings:**
- ✅ **Correct:** Uses `/okr/overview?page&pageSize` endpoint
- ✅ **Correct:** Pagination params validated (page >= 1, pageSize 1-50)
- ✅ **Correct:** Server-side pagination (backend slices after visibility filtering)
- ⚠️ **Issue:** Client-side filtering still applied (workspace, team, owner, search) - should be server-side

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:239-310
const loadOKRs = async () => {
  const params = new URLSearchParams({
    organizationId: currentOrganization.id,
    page: currentPage.toString(),
    pageSize: pageSize.toString(),
  })
  // ... filters ...
  const response = await api.get(`/okr/overview?${params.toString()}`)
}
```

**Recommendation:**
- Move client-side filters to backend: add `workspaceId`, `teamId`, `ownerId`, `search` query params
- Backend should filter before pagination (not after)
- Remove client-side filtering logic (keep only for backward compatibility during migration)

**Files:**
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:239-310`
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:322-371` (client-side filtering)

---

### B.2 Visibility Filtered on Server

**Findings:**
- ✅ **Correct:** Visibility filtering done server-side (`OkrVisibilityService.canUserSeeObjective`)
- ✅ **Correct:** PRIVATE OKRs filtered before pagination
- ✅ **Correct:** Tenant isolation enforced (`OkrTenantGuard`)
- ⚠️ **Issue:** No client-side defensive check (if backend bug, PRIVATE OKRs could leak)

**Code Evidence:**
```typescript
// services/core-api/src/modules/okr/okr-overview.controller.ts:159-200
// Filter objectives by visibility
const visibleObjectives = []
for (const objective of allObjectives) {
  const canSee = await this.visibilityService.canUserSeeObjective({ ... })
  if (canSee) {
    visibleObjectives.push(objective)
  }
}
```

**Recommendation:**
- Add client-side defensive check: `canSeeObjective()` hook should verify visibility before rendering
- Add test: verify PRIVATE OKRs not rendered for unauthorized users
- Document defense-in-depth approach

**Files:**
- `services/core-api/src/modules/okr/okr-overview.controller.ts:159-200`
- `apps/web/src/hooks/useTenantPermissions.ts:104-173` (canViewObjective)

---

### B.3 Scope Toggle Updates Query Deterministically

**Findings:**
- ⚠️ **Issue:** Scope toggle doesn't send explicit query params to backend
- ⚠️ **Issue:** Relies entirely on backend visibility filtering (no explicit scope param)
- ⚠️ **Issue:** Scope not persisted in URL (lost on page reload)

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:259-270
if (selectedScope === 'my' && user?.id) {
  // My scope: filter by ownerId
  // Note: backend visibility filtering handles this, but we can add explicit filter if needed
  // For now, rely on backend visibility
} else if (selectedScope === 'team-workspace') {
  // Team/Workspace scope: use managed workspace/team IDs
  // Backend visibility filtering will handle this
} else if (selectedScope === 'tenant') {
  // Tenant scope: show all visible OKRs in tenant
  // Backend visibility filtering handles this
}
```

**Recommendation:**
- Add explicit `scope` query param: `?scope=my&ownerId=xxx` or `?scope=tenant`
- Backend should filter by scope explicitly (not just rely on visibility)
- Persist scope in URL: `/dashboard/okrs?scope=my&cycleId=xxx`

**Files:**
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:259-270`
- `services/core-api/src/modules/okr/okr-overview.controller.ts` (add scope filtering)

---

### B.4 SUPERUSER Read-Only Consistently Applied

**Findings:**
- ✅ **Correct:** SUPERUSER cannot create/edit/delete (buttons hidden)
- ✅ **Correct:** Backend enforces SUPERUSER read-only (`canEdit`/`canDelete` flags false)
- ✅ **Correct:** Lock warnings shown but cannot bypass
- ⚠️ **Issue:** No explicit SUPERUSER check in some inline editors (relies on `canEdit` prop)

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/page.tsx:1033-1094
{(canCreateObjective || permissions.canEditOKR({ ... })) && !isSuperuser && (
  <DropdownMenu>
    {/* Add button */}
  </DropdownMenu>
)}
```

**Recommendation:**
- Add explicit SUPERUSER check in inline editors: `if (isSuperuser) return <ReadOnlyView />`
- Document SUPERUSER read-only policy in RBAC guide
- Add test: verify SUPERUSER cannot edit even if `canEdit` prop is true (defensive)

**Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx:1033-1094`
- `apps/web/src/components/okr/ObjectiveRow.tsx` (inline editors)

---

### B.5 PRIVATE Never Rendered for Unauthorized Users

**Findings:**
- ✅ **Correct:** Backend filters PRIVATE OKRs server-side
- ✅ **Correct:** `canViewObjective` hook checks visibility client-side
- ⚠️ **Issue:** No explicit check in render (relies on backend filtering)
- ⚠️ **Issue:** No test coverage for PRIVATE visibility leak prevention

**Recommendation:**
- Add defensive check in render: `if (!canViewObjective(objective)) return null`
- Add test: verify PRIVATE OKRs not rendered for unauthorized users
- Document defense-in-depth approach

**Files:**
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:375-449` (preparedObjectives)
- `apps/web/src/app/dashboard/okrs/OKRTreeContainer.tsx:315-380` (preparedObjectives)

---

## C. Performance

### C.1 Virtualisation Correctness

**Findings:**
- ✅ **Correct:** Window-based virtualisation implemented (`OKRListVirtualised`)
- ✅ **Correct:** Row height calculated dynamically (`calculateExpandedRowHeight`)
- ✅ **Correct:** Buffer rows configured (`BUFFER_ROWS = 2`)
- ⚠️ **Issue:** Row height estimates may be inaccurate (120px base, 200px expanded base)
- ⚠️ **Issue:** No performance monitoring (no telemetry for scroll FPS)

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx:73-103
const ROW_HEIGHT_ESTIMATE = 120
const EXPANDED_ROW_BASE_HEIGHT = 200
const KEY_RESULT_HEIGHT_ESTIMATE = 120
const INITIATIVE_HEIGHT_ESTIMATE = 90
const BUFFER_ROWS = 2
```

**Recommendation:**
- Measure actual row heights: use `ResizeObserver` to measure and update estimates
- Add performance telemetry: track scroll FPS, render time
- Add performance budget: target 60 FPS during scroll

**Files:**
- `apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx:73-283`

---

### C.2 Memoisation Keys Stable

**Findings:**
- ✅ **Good:** `useMemo` used for expensive computations (`filteredOKRs`, `preparedObjectives`)
- ✅ **Good:** Memo keys include all dependencies (no stale closures)
- ⚠️ **Issue:** Some memo keys may be unstable (object references in dependencies)
- ⚠️ **Issue:** `onAction` object recreated on every render (causes unnecessary re-renders)

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/page.tsx:1178-1194
<OKRPageContainer
  onAction={{
    onEdit: handleEditOKR,
    onDelete: handleDeleteOKR,
    onAddKeyResult: handleAddKrClick,
    // ... more handlers ...
  }}
/>
```

**Recommendation:**
- Memoize `onAction` object: `const onAction = useMemo(() => ({ onEdit, onDelete, ... }), [deps])`
- Use `useCallback` for handlers: `const handleEditOKR = useCallback((okr) => { ... }, [deps])`
- Verify memo keys stable: use `JSON.stringify` or `useMemo` with stable keys

**Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx:1178-1194`
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:375-449` (preparedObjectives memo)

---

### C.3 N+1 Avoidance

**Findings:**
- ✅ **Good:** Single endpoint `/okr/overview` returns nested data (objectives + KRs + initiatives)
- ✅ **Good:** No N+1 queries in frontend (all data fetched in one request)
- ⚠️ **Issue:** Backend may have N+1 queries (check `okr-overview.controller.ts`)

**Code Evidence:**
```typescript
// services/core-api/src/modules/okr/okr-overview.controller.ts:113-152
allObjectives = await this.prisma.objective.findMany({
  include: {
    keyResults: { include: { keyResult: { ... } } },
    initiatives: true,
    cycle: { select: { id, name, status } },
    owner: { select: { id, name, email } },
  },
})
```

**Recommendation:**
- Verify backend query efficiency: check Prisma query logs for N+1
- Use `include` correctly: ensure nested relations loaded in single query
- Add query performance monitoring: track query time

**Files:**
- `services/core-api/src/modules/okr/okr-overview.controller.ts:113-152`

---

## D. Telemetry & Tests

### D.1 Events Present for Critical Actions

**Findings:**
- ✅ **Present:** `okr.create.open`, `okr.create.publish.success`, `okr.create.abandon`
- ✅ **Present:** `okr.tree.expand`, `okr.tree.collapse`, `okr.tree.toggle`
- ❌ **Missing:** `scope_toggle`, `filter_applied`, `cycle_changed`, `checkin_requested`

**Telemetry Events Audit:**

| Event | Location | Status |
|-------|----------|--------|
| `okr.tree.toggle` | `page.tsx:97` | ✅ Present |
| `okr.create.open` | `OKRCreationDrawer.tsx:185` | ✅ Present |
| `okr.create.step_viewed` | `OKRCreationDrawer.tsx:241` | ✅ Present |
| `okr.create.publish.success` | `OKRCreationDrawer.tsx:578` | ✅ Present |
| `okr.create.publish.forbidden` | `OKRCreationDrawer.tsx:606` | ✅ Present |
| `okr.create.abandon` | `OKRCreationDrawer.tsx:195` | ✅ Present |
| `okr.tree.expand` | `OKRTreeView.tsx:65` | ✅ Present |
| `okr.tree.collapse` | `OKRTreeView.tsx:73` | ✅ Present |
| `scope_toggle` | `page.tsx:972-1006` | ❌ Missing |
| `filter_applied` | `page.tsx:854-933` | ❌ Missing |
| `cycle_changed` | `page.tsx:940-949` | ❌ Missing |
| `checkin_requested` | `page.tsx:513-517` | ❌ Missing |

**Recommendation:**
- Add telemetry for scope toggle, filter changes, cycle changes
- Replace `console.log` with analytics service: `analytics.track('okr.scope.toggle', {...})`
- Document telemetry events in `TELEMETRY.md`

**Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx:97` (example telemetry)
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx:185-613`

---

### D.2 Test Coverage

**Existing Tests:**
- ✅ `page.scope-toggle.spec.tsx` - Scope toggle logic
- ✅ `page.filters.spec.tsx` - Filter bar structure
- ✅ `rbac.inline-guards.spec.tsx` - RBAC guards
- ✅ `page.toolbar.actions.spec.tsx` - Toolbar actions
- ✅ `page.no-builder.spec.tsx` - Builder view absence
- ✅ `page.active-cycle.spec.tsx` - Active cycle display

**Missing Tests:**
- ❌ Scope toggle persistence (URL params)
- ❌ Empty state role-awareness
- ❌ Telemetry event firing
- ❌ Tree view visibility parity with List view
- ❌ Lock warning message accuracy
- ❌ PRIVATE visibility leak prevention
- ❌ Virtualisation performance (scroll FPS)

**Recommendation:**
- Add integration tests: verify scope toggle persists in URL
- Add accessibility tests: verify keyboard navigation works
- Add performance tests: verify virtualisation maintains 60 FPS
- Document test coverage goals: target 80% coverage

**Files:**
- `apps/web/src/app/dashboard/okrs/__tests__/` (existing tests)

---

## E. TODO/TECH-DEBT Audit

### E.1 TODO Comments

**Found:** 1 TODO (properly tagged)
```typescript
// apps/web/src/app/dashboard/okrs/components/PublishLockWarningModal.tsx:55
{/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
```

**Disposition:** ✅ Keep (properly tagged, tracked in GitHub issue)

---

### E.2 FIXME Comments

**Found:** 0 FIXME comments

**Disposition:** ✅ None found

---

### E.3 HACK Comments

**Found:** 0 HACK comments

**Disposition:** ✅ None found

---

### E.4 Tech Debt Items

**Identified Tech Debt:**

1. **Large `page.tsx` file (1487 lines)**
   - **Impact:** Hard to maintain, test, and understand
   - **Fix:** Extract modals, handlers, state to separate files/hooks
   - **Priority:** Medium

2. **Duplicate `mapObjectiveData` functions**
   - **Impact:** Code duplication, maintenance burden
   - **Fix:** Consolidate into shared utility
   - **Priority:** Low

3. **Client-side filtering (should be server-side)**
   - **Impact:** Performance, consistency issues
   - **Fix:** Move filters to backend query params
   - **Priority:** Medium

4. **Console.log statements (42 instances)**
   - **Impact:** Production noise, performance
   - **Fix:** Remove or replace with analytics service
   - **Priority:** High

5. **No performance monitoring**
   - **Impact:** Cannot measure scroll FPS, render time
   - **Fix:** Add performance telemetry
   - **Priority:** Low

---

## F. File/Line References

### Critical Issues

| File | Line | Issue | Severity |
|------|------|-------|----------|
| `page.tsx` | 83-88, 696-741 | Console.log statements | Critical |
| `okr-overview.controller.ts` | 157, 178-189, 206-234 | Debug logging | Critical |
| `OKRPageContainer.tsx` | 259-270 | Scope not sent to backend | Major |
| `OKRPageContainer.tsx` | 322-371 | Client-side filtering | Major |

### Major Issues

| File | Line | Issue | Severity |
|------|------|-------|----------|
| `page.tsx` | 1487 lines | File too large | Major |
| `OKRPageContainer.tsx` | 91-202 | Duplicate mapObjectiveData | Major |
| `OKRTreeContainer.tsx` | 58-164 | Duplicate mapObjectiveData | Major |
| `OKRListVirtualised.tsx` | 73-103 | Row height estimates | Medium |

---

## G. Acceptance Criteria for Code Fixes

1. ✅ All `console.log` removed (except telemetry via analytics service)
2. ✅ `page.tsx` split into smaller files (<500 lines each)
3. ✅ `mapObjectiveData` consolidated into shared utility
4. ✅ Scope toggle sends explicit query params to backend
5. ✅ Client-side filtering moved to backend
6. ✅ Memoization keys stable (no unnecessary re-renders)
7. ✅ Test coverage >80% for OKR pages

