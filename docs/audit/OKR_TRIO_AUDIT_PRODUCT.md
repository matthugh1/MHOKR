# OKR Trio Audit - Product Review (PD + PM)

**Date:** 2025-01-XX  
**Reviewers:** Product Director, Product Manager  
**Scope:** OKR List view and Tree/Builder view

---

## A. User Journeys Validation

### A.1 Discover Current Cycle OKRs (List)

**Journey:** User navigates to `/dashboard/okrs` → sees list of objectives for current cycle

**Findings:**
- ✅ **Working:** Default cycle selection loads first active cycle (`loadActiveCycles` sets `selectedCycleId` to first cycle)
- ⚠️ **Issue:** No explicit "current cycle" indicator in UI; users must infer from Cycle dropdown selection
- ⚠️ **Issue:** Default scope is "My" which may show empty state if user has no personal OKRs

**Recommendation:**
- Add visual indicator (badge or highlight) for "current active cycle" in Cycle dropdown
- Consider defaulting to "Tenant" scope for TENANT_ADMIN users if "My" returns empty

**Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx:288-307` (cycle loading)
- `apps/web/src/app/dashboard/okrs/page.tsx:150-162` (default scope logic)

---

### A.2 Switch Scope: My / Team/Workspace / Tenant

**Journey:** User clicks scope toggle → list updates to show filtered OKRs

**Findings:**
- ✅ **Working:** Scope toggle correctly shows/hides segments based on user roles (`availableScopes` computed from permissions)
- ⚠️ **Issue:** Scope filtering relies entirely on backend visibility; no explicit query params sent to backend
- ⚠️ **Issue:** Comments in code indicate "backend visibility filtering handles this" but no explicit `scope` param sent
- ⚠️ **Issue:** Scope toggle doesn't persist across page reloads (not in URL params)

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
- Add explicit `scope` query param to `/okr/overview` endpoint
- Backend should filter by scope explicitly (not just rely on visibility)
- Persist scope in URL: `/dashboard/okrs?scope=my&cycleId=...`

**Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx:121-148` (scope availability logic)
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:259-270` (scope filtering)

---

### A.3 Create Objective via Creation Drawer

**Journey:** User clicks "Add" → drawer opens → fills form → publishes

**Findings:**
- ✅ **Working:** Creation drawer opens correctly (`OKRCreationDrawer` component)
- ✅ **Working:** Multi-step wizard (Basics → Visibility → Key Results → Review)
- ✅ **Working:** Telemetry events fire (`okr.create.open`, `okr.create.step_viewed`, `okr.create.publish.success`)
- ⚠️ **Issue:** No telemetry for scope toggle or filter changes (missing events)
- ⚠️ **Issue:** Drawer doesn't pre-select cycle based on current filter selection
- ⚠️ **Issue:** No validation feedback if user tries to create OKR in locked cycle (warning shown but not blocking)

**Recommendation:**
- Pre-select cycle in drawer from current filter selection
- Add telemetry for `scope_toggle`, `filter_applied`, `cycle_changed`
- Block publish button (not just warn) if cycle is LOCKED/ARCHIVED

**Files:**
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx:76-1695`
- `apps/web/src/app/dashboard/okrs/page.tsx:1033-1094` (Add button)

---

### A.4 Publish & Lock Implications (Governance)

**Journey:** User edits published OKR → sees lock warning → cannot edit

**Findings:**
- ✅ **Working:** `PublishLockWarningModal` shows when user tries to edit locked OKR
- ✅ **Working:** Backend returns `canEdit`/`canDelete` flags based on governance locks
- ⚠️ **Issue:** Lock warning message is generic; doesn't explain WHY it's locked (publish lock vs cycle lock)
- ⚠️ **Issue:** SUPERUSER sees lock warnings but cannot bypass (correct behavior, but UX could be clearer)

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/page.tsx:1208-1239
const lockInfo = tenantPermissions.getLockInfoForObjective(objectiveForHook)
const lockMessage = lockInfo.message || 'This item is locked and cannot be changed in the current cycle.'
```

**Recommendation:**
- Enhance lock message to specify reason: "This objective is published and locked" vs "This cycle is locked"
- Add tooltip explaining governance rules (when publish lock applies, when cycle lock applies)

**Files:**
- `apps/web/src/app/dashboard/okrs/components/PublishLockWarningModal.tsx`
- `apps/web/src/app/dashboard/okrs/page.tsx:409-446` (handleEditOKR)

---

### A.5 Visibility: PRIVATE vs PUBLIC_TENANT

**Journey:** User with CONTRIBUTOR role → should not see PRIVATE OKRs owned by others

**Findings:**
- ✅ **Working:** Backend visibility filtering enforced (`OkrVisibilityService.canUserSeeObjective`)
- ✅ **Working:** PRIVATE OKRs filtered server-side before pagination
- ⚠️ **Issue:** No client-side defensive check; if backend bug, PRIVATE OKRs could leak
- ⚠️ **Issue:** Visibility level not displayed in UI (users can't tell if OKR is PRIVATE)

**Code Evidence:**
```typescript
// services/core-api/src/modules/okr/okr-visibility.service.ts:44-109
// PRIVATE visibility: Only owner + TENANT_ADMIN/TENANT_OWNER + whitelist can see
```

**Recommendation:**
- Add client-side defensive check: `canSeeObjective()` hook should verify visibility before rendering
- Consider showing visibility badge (PRIVATE vs PUBLIC_TENANT) for TENANT_ADMIN users

**Files:**
- `services/core-api/src/modules/okr/okr-visibility.service.ts:44-109`
- `apps/web/src/hooks/useTenantPermissions.ts:104-173` (canViewObjective)

---

### A.6 Navigate to Builder (Tree) and Validate Node Visibility

**Journey:** User switches to Tree view → sees same OKRs as List view

**Findings:**
- ✅ **Working:** Tree view uses same `/okr/overview` endpoint as List view
- ✅ **Working:** Tree view fetches all pages (up to 50 per page) to build complete tree
- ⚠️ **Issue:** Tree view performance degrades with large datasets (fetches all objectives upfront)
- ⚠️ **Issue:** Tree view doesn't support pagination (loads everything)
- ⚠️ **Issue:** Node visibility should mirror List view, but no explicit test coverage

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/OKRTreeContainer.tsx:192-245
// Fetches all objectives using pagination (max pageSize is 50)
let allObjectives: any[] = []
let currentPage = 1
let hasMore = true
while (hasMore) {
  // ... fetch page ...
}
```

**Recommendation:**
- Add test: verify Tree view shows same objectives as List view for same filters
- Consider lazy-loading tree nodes (only expand visible branches)
- Add performance warning if >100 objectives loaded

**Files:**
- `apps/web/src/app/dashboard/okrs/OKRTreeContainer.tsx:192-245`
- `apps/web/src/app/dashboard/okrs/page.tsx:1134-1163` (Tree view render)

---

### A.7 From List → Drill into Objective Details

**Journey:** User clicks objective row → expands to show KRs and Initiatives

**Findings:**
- ✅ **Working:** Row expansion shows nested KRs and Initiatives
- ✅ **Working:** Activity drawer opens for history view
- ⚠️ **Issue:** No dedicated "Objective Details" page; all info shown in expanded row
- ⚠️ **Issue:** Cannot navigate from List to Builder for same objective (no deep link)

**Recommendation:**
- Add deep link: `/dashboard/okrs?objectiveId=xxx` to highlight specific objective
- Consider dedicated Objective Details page (future enhancement)

**Files:**
- `apps/web/src/components/okr/ObjectiveRow.tsx:1-1381`
- `apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx:105-283`

---

## B. Clarity & Copy

### B.1 Single Active Filter Bar

**Finding:**
- ✅ **Correct:** Single filter toolbar with search, status chips, cycle selector
- ✅ **Correct:** Cycle Health Strip is non-interactive (shows summary only)
- ⚠️ **Issue:** Filter bar layout could be clearer (search, status, cycle all in one row; may wrap on small screens)

**Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx:838-1119` (filter toolbar)

---

### B.2 Cycle Dropdown Correctness

**Finding:**
- ✅ **Correct:** Cycles sourced from backend (`/reports/cycles/active`)
- ⚠️ **Issue:** Synthetic fallback cycle exists if backend returns empty (`normalizedCycles` fallback to "Q4 2025 (Active)")
- ⚠️ **Issue:** No "Unassigned/Backlog" option unless backend provides it (correct behavior, but not documented)

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/page.tsx:360-380
const normalizedCycles = useMemo(() => {
  if (cyclesFromApi && cyclesFromApi.length > 0) {
    return cyclesFromApi.map(c => ({ ... }))
  }
  return [
    {
      id: 'synthetic-active-cycle',
      name: 'Q4 2025 (Active)',
      status: 'ACTIVE',
      // ...
    },
  ]
}, [cyclesFromApi])
```

**Recommendation:**
- Remove synthetic fallback; show empty state if no cycles
- Document that "Unassigned" only appears if backend returns it

**Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx:360-380`

---

### B.3 British English & Consistent Labels

**Findings:**
- ✅ **Correct:** "Colour" not "Color" (British English)
- ✅ **Correct:** "Publish state" vs "Status" terminology separated
- ⚠️ **Issue:** Inconsistent use of "Cycle" vs "Period" (comments mention "Period removed - Cycle is canonical" but some code still references periods)
- ⚠️ **Issue:** "Team/Workspace" label is ambiguous (should be "Team or Workspace" or separate buttons)

**Recommendation:**
- Audit all copy for British English consistency
- Clarify "Team/Workspace" label (add tooltip or split into two buttons)
- Remove all "Period" references (replace with "Cycle")

**Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx:45` (comment: "W4.M1: Period utilities removed")
- `apps/web/src/app/dashboard/okrs/page.tsx:383` (legacyPeriods: [])

---

### B.4 Empty States

**Findings:**
- ✅ **Present:** Empty state shown when no OKRs (`OKRPageContainer.tsx:471-484`)
- ⚠️ **Issue:** Empty state messages are generic; not role-aware
- ⚠️ **Issue:** No "Create Objective" button in empty state (even if user has permission)

**Code Evidence:**
```typescript
// apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:471-484
if (totalCount === 0 || filteredOKRs.length === 0) {
  return (
    <div className="text-center py-12">
      <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm text-sm text-neutral-600">
        {selectedTimeframeKey === 'unassigned' ? (
          <p>No objectives are currently unassigned to a planning cycle.</p>
        ) : selectedTimeframeKey && selectedTimeframeKey !== 'all' ? (
          <p>No objectives found for the selected filters.</p>
        ) : (
          <p>No OKRs found</p>
        )}
      </div>
    </div>
  )
}
```

**Recommendation:**
- Add role-aware empty states:
  - TENANT_ADMIN: "No OKRs found. Create your first objective to get started." + "New Objective" button
  - CONTRIBUTOR: "No OKRs found." (no button if `canCreateObjective === false`)
  - SUPERUSER: "No OKRs found." (read-only, no button)

**Files:**
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:471-484`

---

## C. Outcomes & Metrics

### C.1 Success Events in Telemetry

**Current Telemetry Events:**

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

**Missing Telemetry Events:**

| Event | Expected Location | Priority |
|-------|-------------------|----------|
| `scope_toggle` | `page.tsx:972-1006` | High |
| `filter_applied` | `page.tsx:854-933` | High |
| `cycle_changed` | `page.tsx:940-949` | High |
| `okr_created` | `OKRCreationDrawer.tsx:578` | Medium (exists but named differently) |
| `publish_success` | `OKRCreationDrawer.tsx:578` | Medium (exists as `okr.create.publish.success`) |
| `checkin_requested` | `page.tsx:513-517` | Medium |
| `row_expanded` | `OKRListVirtualised.tsx` | Low |
| `row_collapsed` | `OKRListVirtualised.tsx` | Low |

**Recommendation:**
- Add telemetry for scope toggle, filter changes, cycle changes
- Standardize event naming: use `okr.*` prefix consistently
- Verify events fire in Network/console (add integration test)

**Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx:97` (example telemetry)
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx:185-613` (creation telemetry)

---

## D. Blockers and Friction Points

### Critical Blockers

1. **Scope Toggle Not Persisted**
   - **Impact:** User loses scope selection on page reload
   - **Severity:** Major
   - **Fix:** Add scope to URL params

2. **Empty State Not Role-Aware**
   - **Impact:** Users don't know if they can create OKRs
   - **Severity:** Major
   - **Fix:** Add role-aware empty states with action buttons

3. **Missing Telemetry for Key Actions**
   - **Impact:** Cannot measure scope toggle, filter usage, cycle changes
   - **Severity:** Medium
   - **Fix:** Add telemetry events

### Friction Points

1. **Lock Warning Message Too Generic**
   - **Impact:** Users don't understand why they can't edit
   - **Severity:** Medium
   - **Fix:** Enhance lock message with specific reason

2. **Tree View Performance**
   - **Impact:** Slow with large datasets (loads all objectives upfront)
   - **Severity:** Medium
   - **Fix:** Lazy-load tree nodes or add pagination

3. **No Deep Links**
   - **Impact:** Cannot share links to specific objectives
   - **Severity:** Low
   - **Fix:** Add objectiveId to URL params

---

## E. Proposed KPIs/Telemetry

### E.1 Engagement Metrics

- **Scope Toggle Usage:** `scope_toggle` event → track which scopes users prefer
- **Filter Usage:** `filter_applied` event → track most-used filters (status, cycle, search)
- **View Mode Preference:** `okr.tree.toggle` event → track List vs Tree usage

### E.2 Creation Metrics

- **Drawer Abandon Rate:** `okr.create.abandon` / `okr.create.open` → measure friction
- **Publish Success Rate:** `okr.create.publish.success` / `okr.create.open` → measure completion
- **Average Creation Time:** `okr.create.publish.success` duration → measure efficiency

### E.3 Governance Friction

- **Lock Warning Display Rate:** Count of `PublishLockWarningModal` opens
- **Failed Edit Attempts:** Count of edit clicks on locked OKRs
- **Permission Denials:** Count of 403 errors

---

## F. Top 10 Fixes (MoSCoW Prioritization)

### Must Have (M)

1. **M1:** Add scope toggle to URL params (persist across reloads)
2. **M2:** Add role-aware empty states with action buttons
3. **M3:** Add telemetry for scope toggle, filter changes, cycle changes
4. **M4:** Enhance lock warning message with specific reason

### Should Have (S)

5. **S1:** Remove synthetic cycle fallback (show empty state instead)
6. **S2:** Pre-select cycle in creation drawer from current filter
7. **S3:** Add client-side defensive visibility check (prevent PRIVATE leak)
8. **S4:** Clarify "Team/Workspace" label (add tooltip or split buttons)

### Could Have (C)

9. **C1:** Add deep links for objectives (`?objectiveId=xxx`)
10. **C2:** Optimize Tree view performance (lazy-load nodes)

### Won't Have (W)

- Dedicated Objective Details page (future enhancement)
- Advanced filter presets (future enhancement)

---

## G. Role-by-Role Findings

### SUPERUSER

- ✅ Can see all OKRs (read-only)
- ✅ Cannot create/edit/delete (buttons hidden)
- ⚠️ Lock warnings shown but cannot bypass (correct but UX could be clearer)
- ⚠️ No empty state guidance (should say "read-only view")

### TENANT_OWNER / TENANT_ADMIN

- ✅ Can see all tenant OKRs (including PRIVATE)
- ✅ Can create/edit/delete (permission-gated)
- ⚠️ Default scope is "My" (should default to "Tenant" if "My" is empty)
- ⚠️ Empty state doesn't show "Create Objective" button

### WORKSPACE_LEAD

- ✅ Can see workspace/team OKRs
- ✅ Can create OKRs in workspace
- ⚠️ Scope toggle shows "My" and "Team/Workspace" (correct)
- ⚠️ No guidance on which scope to use

### CONTRIBUTOR

- ✅ Can see PUBLIC_TENANT OKRs
- ✅ Cannot see PRIVATE OKRs (unless owner)
- ⚠️ Empty state doesn't explain why no OKRs visible
- ⚠️ No guidance on requesting access to PRIVATE OKRs

---

## H. Test Coverage Gaps

**Existing Tests:**
- ✅ `page.scope-toggle.spec.tsx` - Scope toggle logic
- ✅ `page.filters.spec.tsx` - Filter bar structure
- ✅ `rbac.inline-guards.spec.tsx` - RBAC guards

**Missing Tests:**
- ❌ Scope toggle persistence (URL params)
- ❌ Empty state role-awareness
- ❌ Telemetry event firing
- ❌ Tree view visibility parity with List view
- ❌ Lock warning message accuracy

---

## I. Acceptance Criteria for Product Fixes

1. ✅ Scope toggle persists in URL: `/dashboard/okrs?scope=my&cycleId=xxx`
2. ✅ Empty states show role-appropriate messages and actions
3. ✅ Telemetry events fire for all key actions (scope, filter, cycle)
4. ✅ Lock warnings specify reason (publish lock vs cycle lock)
5. ✅ No synthetic cycle fallback (show empty state instead)

