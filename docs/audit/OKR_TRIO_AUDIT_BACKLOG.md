# OKR Trio Audit - Decision Log & Change Backlog

**Date:** 2025-01-XX  
**Reviewers:** Product Director, Product Manager, Tech Lead  
**Scope:** Decision log and prioritized backlog of fixes

---

## Decision Log

### D1: Scope Toggle Implementation

**Decision:** Add explicit `scope` query parameter to backend instead of relying solely on visibility filtering.

**Rationale:**
- Current implementation relies entirely on backend visibility, making scope filtering implicit
- Explicit scope param improves clarity, testability, and performance
- Allows backend to optimize queries based on scope

**Impact:** Medium (requires backend changes)

**Status:** Approved

---

### D2: Empty State Role-Awareness

**Decision:** Show role-appropriate empty states with action buttons (TENANT_ADMIN sees "Create Objective" button, CONTRIBUTOR doesn't).

**Rationale:**
- Improves UX: users know if they can create OKRs
- Reduces confusion: empty state explains why no OKRs visible
- Aligns with RBAC: actions gated by permissions

**Impact:** Low (frontend-only change)

**Status:** Approved

---

### D3: Console.log Removal

**Decision:** Remove all `console.log` statements from production code, replace telemetry with analytics service.

**Rationale:**
- Production noise reduction
- Performance improvement
- Security: prevents sensitive data leakage

**Impact:** Medium (requires analytics service integration)

**Status:** Approved

---

### D4: Client-Side Filtering Migration

**Decision:** Move client-side filters (workspace, team, owner, search) to backend query params.

**Rationale:**
- Consistency: all filtering server-side
- Performance: reduces client-side computation
- Scalability: backend can optimize queries

**Impact:** High (requires backend changes)

**Status:** Approved (phased approach)

---

### D5: Tree View Performance

**Decision:** Implement lazy loading for Tree view (only render expanded branches) instead of loading all objectives upfront.

**Rationale:**
- Performance: Tree view degrades with large datasets (>100 objectives)
- Scalability: supports larger OKR hierarchies
- UX: faster initial load

**Impact:** Medium (requires Tree view refactoring)

**Status:** Approved (future enhancement)

---

## Change Backlog

### Story 1: Add Scope Toggle to URL Params

**Title:** Persist scope selection in URL and send explicit scope param to backend

**Rationale:** Users lose scope selection on page reload; backend should filter by scope explicitly.

**Acceptance Criteria:**
- Scope toggle updates URL: `/dashboard/okrs?scope=my&cycleId=xxx`
- Backend accepts `scope` query param: `?scope=my|team-workspace|tenant`
- Backend filters by scope explicitly (not just visibility)
- Scope persists across page reloads

**Affected Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx` (scope toggle handler)
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx` (API call)
- `services/core-api/src/modules/okr/okr-overview.controller.ts` (query params, filtering)

**RBAC Notes:** Scope filtering respects RBAC (users only see OKRs they have permission to view).

**Test Updates:** Add test for scope persistence in URL.

**Priority:** Now (Must Have)

**Effort:** Medium (2-3 days)

---

### Story 2: Role-Aware Empty States

**Title:** Show role-appropriate empty states with action buttons

**Rationale:** Users don't know if they can create OKRs; empty state should guide them.

**Acceptance Criteria:**
- TENANT_ADMIN sees: "No OKRs found. Create your first objective to get started." + "New Objective" button
- CONTRIBUTOR sees: "No OKRs found." (no button if `canCreateObjective === false`)
- SUPERUSER sees: "No OKRs found." (read-only, no button)

**Affected Files:**
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx` (empty state component)

**RBAC Notes:** Uses `canCreateObjective` flag from backend.

**Test Updates:** Add test for role-aware empty states.

**Priority:** Now (Must Have)

**Effort:** Small (1 day)

---

### Story 3: Add Telemetry for Scope Toggle and Filters

**Title:** Track scope toggle, filter changes, and cycle changes

**Rationale:** Cannot measure user behavior without telemetry; need data for product decisions.

**Acceptance Criteria:**
- `scope_toggle` event fires when scope changes
- `filter_applied` event fires when filters change (status, cycle, search)
- `cycle_changed` event fires when cycle selector changes
- Events include metadata: `{ scope: 'my', previousScope: 'tenant', timestamp: ... }`

**Affected Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx` (scope toggle, filter handlers)
- `apps/web/src/lib/analytics.ts` (analytics service - create if doesn't exist)

**RBAC Notes:** None (telemetry only, no RBAC impact).

**Test Updates:** Add test for telemetry event firing.

**Priority:** Now (Must Have)

**Effort:** Small (1 day)

---

### Story 4: Enhance Lock Warning Message

**Title:** Show specific lock reason in warning message (publish lock vs cycle lock)

**Rationale:** Users don't understand why they can't edit; generic message is confusing.

**Acceptance Criteria:**
- Lock message specifies reason: "This objective is published and locked" vs "This cycle is locked"
- Tooltip explains governance rules (when publish lock applies, when cycle lock applies)
- Message includes actionable guidance (e.g., "Contact your administrator to unlock")

**Affected Files:**
- `apps/web/src/app/dashboard/okrs/components/PublishLockWarningModal.tsx`
- `apps/web/src/hooks/useTenantPermissions.ts` (getLockInfoForObjective)

**RBAC Notes:** Lock messages respect RBAC (different messages for admins vs contributors).

**Test Updates:** Add test for lock message accuracy.

**Priority:** Next (Should Have)

**Effort:** Small (1 day)

---

### Story 5: Remove Console.log Statements

**Title:** Remove all console.log statements and replace telemetry with analytics service

**Rationale:** Production noise, performance overhead, security risk.

**Acceptance Criteria:**
- All `console.log` statements removed (except errors via `console.error`)
- Telemetry uses analytics service: `analytics.track('okr.create.open', {...})`
- Backend debug logging removed (or gated by log level)
- ESLint rule added: `no-console` (allow `console.error` only)

**Affected Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx` (16 instances)
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx` (19 instances)
- `services/core-api/src/modules/okr/okr-overview.controller.ts` (debug logging)

**RBAC Notes:** None (logging only, no RBAC impact).

**Test Updates:** Verify telemetry still fires (via analytics service).

**Priority:** Next (Should Have)

**Effort:** Medium (2 days)

---

### Story 6: Split Large page.tsx File

**Title:** Extract modals, handlers, and state management from page.tsx into separate files/hooks

**Rationale:** File is too large (1487 lines), hard to maintain and test.

**Acceptance Criteria:**
- `page.tsx` < 500 lines (orchestration only)
- Extract modals to `hooks/useOKRModals.ts`
- Extract state management to `hooks/useOKRPageState.ts`
- Extract handlers to `hooks/useOKRHandlers.ts`

**Affected Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx` (refactor)
- `apps/web/src/app/dashboard/okrs/hooks/useOKRModals.ts` (new)
- `apps/web/src/app/dashboard/okrs/hooks/useOKRPageState.ts` (new)
- `apps/web/src/app/dashboard/okrs/hooks/useOKRHandlers.ts` (new)

**RBAC Notes:** None (refactoring only, no RBAC changes).

**Test Updates:** Verify tests still pass after refactoring.

**Priority:** Next (Should Have)

**Effort:** Medium (2-3 days)

---

### Story 7: Consolidate mapObjectiveData Function

**Title:** Extract duplicate `mapObjectiveData` functions into shared utility

**Rationale:** Code duplication, maintenance burden.

**Acceptance Criteria:**
- Single `mapObjectiveData` function in `utils/mapObjectiveData.ts`
- Both `OKRPageContainer` and `OKRTreeContainer` use shared utility
- Function signature unchanged (backward compatible)

**Affected Files:**
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx` (remove duplicate)
- `apps/web/src/app/dashboard/okrs/OKRTreeContainer.tsx` (remove duplicate)
- `apps/web/src/app/dashboard/okrs/utils/mapObjectiveData.ts` (new)

**RBAC Notes:** None (refactoring only, no RBAC changes).

**Test Updates:** Verify mapping still works correctly.

**Priority:** Later (Could Have)

**Effort:** Small (1 day)

---

### Story 8: Move Client-Side Filters to Backend

**Title:** Add workspace, team, owner, search query params to `/okr/overview` endpoint

**Rationale:** Consistency, performance, scalability.

**Acceptance Criteria:**
- Backend accepts `workspaceId`, `teamId`, `ownerId`, `search` query params
- Backend filters by these params before visibility filtering
- Frontend sends these params instead of client-side filtering
- Remove client-side filtering logic (keep for backward compatibility during migration)

**Affected Files:**
- `services/core-api/src/modules/okr/okr-overview.controller.ts` (query params, filtering)
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx` (API call, remove client-side filtering)

**RBAC Notes:** Filters respect RBAC (users only see OKRs they have permission to view).

**Test Updates:** Add test for backend filtering by workspace/team/owner/search.

**Priority:** Later (Could Have)

**Effort:** Large (3-5 days)

---

### Story 9: Add Keyboard Navigation to List View

**Title:** Add Arrow key navigation and Enter to expand for List view rows

**Rationale:** Accessibility, keyboard users cannot navigate list.

**Acceptance Criteria:**
- Arrow keys navigate between rows (Up/Down)
- Enter key expands/collapses row
- Tab key focuses interactive elements (buttons, inputs)
- Focus visible (meets WCAG AA contrast)

**Affected Files:**
- `apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx` (keyboard handlers)
- `apps/web/src/components/okr/ObjectiveRow.tsx` (keyboard handlers)

**RBAC Notes:** None (accessibility only, no RBAC changes).

**Test Updates:** Add test for keyboard navigation.

**Priority:** Later (Could Have)

**Effort:** Medium (2 days)

---

### Story 10: Add Performance Monitoring

**Title:** Track scroll FPS, render time, and API response times

**Rationale:** Cannot measure performance without telemetry; need data for optimization.

**Acceptance Criteria:**
- Track scroll FPS during virtualised list scroll (target: 60 FPS)
- Track render time for OKR list (target: < 150ms for 20 items)
- Track API response times (target: < 200ms for `/okr/overview`)
- Performance data sent to analytics service

**Affected Files:**
- `apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx` (scroll FPS tracking)
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx` (API timing)
- `apps/web/src/lib/analytics.ts` (performance events)

**RBAC Notes:** None (performance only, no RBAC changes).

**Test Updates:** Add test for performance telemetry.

**Priority:** Later (Could Have)

**Effort:** Medium (2 days)

---

### Story 11: Add Deep Links for Objectives

**Title:** Add `objectiveId` query param to highlight specific objective

**Rationale:** Users cannot share links to specific objectives; improves collaboration.

**Acceptance Criteria:**
- URL supports `?objectiveId=xxx` param
- Objective highlighted/expanded when `objectiveId` in URL
- Deep link works in both List and Tree views

**Affected Files:**
- `apps/web/src/app/dashboard/okrs/page.tsx` (URL param handling)
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx` (highlight logic)
- `apps/web/src/app/dashboard/okrs/OKRTreeContainer.tsx` (highlight logic)

**RBAC Notes:** Deep links respect visibility (users cannot access PRIVATE OKRs via deep link).

**Test Updates:** Add test for deep link functionality.

**Priority:** Later (Could Have)

**Effort:** Small (1 day)

---

### Story 12: Optimize Tree View Performance

**Title:** Implement lazy loading for Tree view (only render expanded branches)

**Rationale:** Tree view performance degrades with large datasets (>100 objectives).

**Acceptance Criteria:**
- Only render expanded branches (not all nodes)
- Lazy-load children when branch expanded
- Performance warning shown if >100 objectives loaded
- Maintains 60 FPS during tree navigation

**Affected Files:**
- `apps/web/src/app/dashboard/okrs/OKRTreeContainer.tsx` (lazy loading)
- `apps/web/src/app/dashboard/okrs/components/OKRTreeView.tsx` (render optimization)

**RBAC Notes:** Lazy loading respects visibility (only loads visible nodes).

**Test Updates:** Add test for lazy loading performance.

**Priority:** Later (Could Have)

**Effort:** Large (3-5 days)

---

## Prioritization Summary

### Now (Must Have)
1. Story 1: Add Scope Toggle to URL Params
2. Story 2: Role-Aware Empty States
3. Story 3: Add Telemetry for Scope Toggle and Filters

### Next (Should Have)
4. Story 4: Enhance Lock Warning Message
5. Story 5: Remove Console.log Statements
6. Story 6: Split Large page.tsx File

### Later (Could Have)
7. Story 7: Consolidate mapObjectiveData Function
8. Story 8: Move Client-Side Filters to Backend
9. Story 9: Add Keyboard Navigation to List View
10. Story 10: Add Performance Monitoring
11. Story 11: Add Deep Links for Objectives
12. Story 12: Optimize Tree View Performance

---

## Total Effort Estimate

- **Now:** 4-5 days (3 stories)
- **Next:** 5-6 days (3 stories)
- **Later:** 10-14 days (6 stories)
- **Total:** 19-25 days

