# Structural Code Review & Refactor Plan

**Date:** 2024-12-19  
**Reviewer:** Principal Engineer / Architect  
**Scope:** Backend (core-api) and Frontend (apps/web) structural improvements

---

## Executive Summary

This review identifies structural improvements to enhance maintainability, clarity, and consistency **without changing runtime behavior**. The primary goals are:

1. **Separate concerns**: Extract analytics/reporting, governance (publish/cycle locks), and tenant isolation from CRUD services
2. **Eliminate duplication**: Centralize repeated tenant isolation, publish lock, and cycle lock checks
3. **Improve controller organization**: Move endpoints to their logical owners (activity endpoints → activity controller, analytics → reporting service)
4. **Frontend consistency**: Create a single source of truth for permission checks that mirrors backend logic

---

## 1. MAIN STRUCTURAL RISKS

### 1.1 Backend Risks

**Risk: Mixed Responsibilities in Services**
- `ObjectiveService` and `KeyResultService` mix CRUD, analytics, reporting, governance, and tenant isolation
- Makes services harder to test, maintain, and reason about
- New engineers may add features to wrong service

**Risk: Repeated Tenant Isolation Logic**
- Tenant isolation checks are duplicated across:
  - `objective.service.ts`: `findAll()`, `canEdit()`, `canDelete()`, `getOrgSummary()`, `exportObjectivesCSV()`, `getPillarsForOrg()`, `getActiveCycleForOrg()`, `getPillarCoverageForActiveCycle()`, `getUserOwnedObjectives()`
  - `key-result.service.ts`: `canEdit()`, `canDelete()`, `create()`, `update()`, `delete()`, `createCheckIn()`, `getRecentCheckInFeed()`, `getOverdueCheckIns()`, `getUserOwnedKeyResults()`
- Pattern: `if (userOrganizationId === null) { ... } else if (userOrganizationId && userOrganizationId !== '') { ... } else { return [] }`
- **Impact**: If tenant isolation rules change, must update 15+ locations

**Risk: Repeated Publish Lock Logic**
- Publish lock checks duplicated in:
  - `objective.service.ts`: `update()`, `delete()`
  - `key-result.service.ts`: `update()`, `delete()`, `createCheckIn()`
- Pattern: Check `isPublished === true`, then check RBAC for admin override
- **Impact**: Logic scattered, hard to maintain consistency

**Risk: Repeated Cycle Lock Logic**
- Cycle lock checks duplicated:
  - `objective.service.ts`: `checkCycleLock()` (private), used in `update()`, `delete()`
  - `key-result.service.ts`: `checkCycleLockForKR()` (private), used in `update()`, `delete()`, `createCheckIn()`
- **Impact**: Similar logic exists in two places, must keep in sync

**Risk: Endpoints in Wrong Controllers**
- Analytics endpoints in `objective.controller.ts`:
  - `GET /objectives/analytics/summary`
  - `GET /objectives/analytics/feed`
  - `GET /objectives/export/csv`
- Activity endpoints in OKR controllers:
  - `GET /objectives/:id/activity` (should be in `activity.controller.ts`)
  - `GET /key-results/:id/activity` (should be in `activity.controller.ts`)
- **Impact**: Endpoints not grouped by domain, harder to find

### 1.2 Frontend Risks

**Risk: Permission Logic Duplication**
- `usePermissions.ts` exists but doesn't handle:
  - Publish lock (must check `isPublished` + admin role)
  - Cycle lock (must check cycle status + admin role)
  - Export permissions (`export_data` action)
- Logic duplicated in `okrs/page.tsx`:
  - `handleEditOKR()`: checks publish lock manually
  - `handleDeleteOKR()`: checks publish lock manually
  - Permission checks: `canEditPublished`, `canDeletePublished` computed inline
- **Impact**: Frontend and backend permission logic can drift

**Risk: Mixed Page Responsibilities**
- `okrs/page.tsx` contains:
  - Data fetching
  - Filtering logic
  - Permission checks
  - Publish lock dialog state
  - Activity drawer state
  - View model transformation (inline)
- **Impact**: Page is too complex, hard to test, hard to maintain

**Risk: Inconsistent Permission Sources**
- `analytics/page.tsx` uses `useTenantAdmin()` hook
- `okrs/page.tsx` uses `usePermissions()` hook
- No single source of truth for "can export", "can edit published OKR", etc.
- **Impact**: Permission checks may not match backend

---

## 2. BACKEND REFACTOR PLAN

### 2.1 New Services & Utilities

#### A. `OkrReportingService`
**Purpose:** Centralize all analytics, reporting, and export functionality

**File:** `services/core-api/src/modules/okr/okr-reporting.service.ts`

**Responsibilities:**
- Analytics summary (`getOrgSummary`)
- CSV export (`exportObjectivesCSV`)
- Recent check-in feed (`getRecentCheckInFeed`)
- Strategic pillar coverage (`getPillarCoverageForActiveCycle`)
- Pillar listing (`getPillarsForOrg`)
- Active cycle queries (`getActiveCycleForOrg`)

**Dependencies:**
- `PrismaService`
- `OkrTenantGuard` (for tenant isolation)

#### B. `OkrGovernanceService`
**Purpose:** Centralize publish lock, cycle lock, and future "propose change" workflow

**File:** `services/core-api/src/modules/okr/okr-governance.service.ts`

**Responsibilities:**
- Check publish lock (`checkPublishLock`)
- Check cycle lock (`checkCycleLock`, `checkCycleLockForKR`)
- Future: propose change workflow

**Dependencies:**
- `PrismaService`
- `RBACService`
- `OkrTenantGuard` (for tenant isolation)

#### C. `OkrTenantGuard`
**Purpose:** Centralize tenant isolation and superuser read-only rules

**File:** `services/core-api/src/modules/okr/tenant-guard.ts`

**Responsibilities:**
- Build tenant isolation `where` clause (`buildTenantWhereClause`)
- Check if user can mutate (reject superuser, reject no-org)
- Check tenant match (`assertTenantMatch`)

**Dependencies:**
- None (pure utility)

#### D. `ActivityController`
**Purpose:** Dedicated controller for activity timeline endpoints

**File:** `services/core-api/src/modules/activity/activity.controller.ts`

**Responsibilities:**
- `GET /activity/objectives/:id` (moved from `objective.controller.ts`)
- `GET /activity/key-results/:id` (moved from `key-result.controller.ts`)
- Future: global activity feed, filtered activity

**Dependencies:**
- `ActivityService`
- `ObjectiveService` (for `canView` check)

### 2.2 Service Refactoring

#### `ObjectiveService` Changes
**Keep:**
- `findAll()` - CRUD
- `findById()` - CRUD
- `canView()` - Permission check
- `canEdit()` - Permission check (delegates to `OkrTenantGuard` + `RBACService`)
- `canDelete()` - Permission check (delegates to `OkrTenantGuard` + `RBACService`)
- `canCreateInWorkspace()` - Permission check
- `create()` - CRUD (delegates to `OkrGovernanceService` for locks)
- `update()` - CRUD (delegates to `OkrGovernanceService` for locks)
- `delete()` - CRUD (delegates to `OkrGovernanceService` for locks)

**Move to `OkrReportingService`:**
- `getOrgSummary()`
- `exportObjectivesCSV()`
- `getPillarsForOrg()`
- `getActiveCycleForOrg()`
- `getPillarCoverageForActiveCycle()`
- `getUserOwnedObjectives()`

**Move to `OkrGovernanceService`:**
- `checkCycleLock()` (private method → public in governance service)

**Remove:**
- Tenant isolation logic (use `OkrTenantGuard`)

#### `KeyResultService` Changes
**Keep:**
- `findAll()` - CRUD
- `findById()` - CRUD
- `canView()` - Permission check
- `canEdit()` - Permission check (delegates to `OkrTenantGuard` + `RBACService`)
- `canDelete()` - Permission check (delegates to `OkrTenantGuard` + `RBACService`)
- `canEditObjective()` - Permission check
- `create()` - CRUD (delegates to `OkrGovernanceService` for locks)
- `update()` - CRUD (delegates to `OkrGovernanceService` for locks)
- `delete()` - CRUD (delegates to `OkrGovernanceService` for locks)
- `createCheckIn()` - CRUD (delegates to `OkrGovernanceService` for locks)

**Move to `OkrReportingService`:**
- `getRecentCheckInFeed()`
- `getOverdueCheckIns()`
- `getUserOwnedKeyResults()`

**Move to `OkrGovernanceService`:**
- `checkCycleLockForKR()` (private method → public in governance service)

**Remove:**
- Tenant isolation logic (use `OkrTenantGuard`)

#### `ObjectiveController` Changes
**Keep:**
- `GET /objectives` - CRUD
- `GET /objectives/:id` - CRUD
- `POST /objectives` - CRUD
- `PATCH /objectives/:id` - CRUD
- `DELETE /objectives/:id` - CRUD

**Move to `ActivityController`:**
- `GET /objectives/:id/activity` → `GET /activity/objectives/:id`

**Move to `OkrReportingController` (new):**
- `GET /objectives/analytics/summary` → `GET /reports/analytics/summary`
- `GET /objectives/analytics/feed` → `GET /reports/analytics/feed`
- `GET /objectives/export/csv` → `GET /reports/export/csv`
- `GET /objectives/pillars` → `GET /reports/pillars`
- `GET /objectives/cycles/active` → `GET /reports/cycles/active`
- `GET /objectives/pillars/coverage` → `GET /reports/pillars/coverage`

#### `KeyResultController` Changes
**Keep:**
- `GET /key-results` - CRUD
- `GET /key-results/:id` - CRUD
- `POST /key-results` - CRUD
- `PATCH /key-results/:id` - CRUD
- `DELETE /key-results/:id` - CRUD
- `POST /key-results/:id/check-in` - CRUD

**Move to `ActivityController`:**
- `GET /key-results/:id/activity` → `GET /activity/key-results/:id`

**Move to `OkrReportingController` (new):**
- `GET /key-results/overdue` → `GET /reports/check-ins/overdue`

---

## 3. FRONTEND REFACTOR PLAN

### 3.1 New Hooks

#### `useTenantPermissions`
**Purpose:** Single source of truth for all tenant-level permission checks

**File:** `apps/web/src/hooks/useTenantPermissions.ts`

**Responsibilities:**
- `canEdit(okr)` - Checks RBAC + publish lock + cycle lock
- `canDelete(okr)` - Checks RBAC + publish lock + cycle lock
- `canPublish(okr)` - Checks RBAC
- `canExport()` - Checks `export_data` permission
- `canView(okr)` - Checks RBAC

**Dependencies:**
- `usePermissions` (for RBAC roles)
- `useAuth` (for current user)
- `useWorkspace` (for current org context)

### 3.2 Page Refactoring

#### `okrs/page.tsx` Changes
**Keep:**
- Data fetching (`loadOKRs`, `loadUsers`, `loadActiveCycles`)
- Filter state management
- View mode state
- Activity drawer state
- Publish lock dialog state

**Add:**
- View model mapper: `mapToObjectiveViewModel(okr)` - transforms raw API data to clean props for `ObjectiveCard`
- Use `useTenantPermissions()` instead of inline permission checks

**Remove:**
- Inline publish lock checks (move to `useTenantPermissions`)
- Duplicate permission computation (`canEditPublished`, `canDeletePublished`)

#### `analytics/page.tsx` Changes
**Keep:**
- Data fetching
- Rendering logic

**Update:**
- Use `useTenantPermissions().canExport()` instead of `useTenantAdmin()`

#### `dashboard/page.tsx` Changes
**Keep:**
- Current structure (already reasonable)

**No changes needed**

---

## 4. MIGRATION STRATEGY

### Phase 1: Create New Services (No Behavior Change)
1. Create `OkrTenantGuard` utility
2. Create `OkrGovernanceService` skeleton
3. Create `OkrReportingService` skeleton
4. Create `ActivityController` skeleton

### Phase 2: Extract Logic (No Behavior Change)
1. Move tenant isolation logic to `OkrTenantGuard`
2. Move publish/cycle lock logic to `OkrGovernanceService`
3. Move analytics/reporting logic to `OkrReportingService`
4. Update `ObjectiveService` and `KeyResultService` to use new services

### Phase 3: Move Endpoints (No Behavior Change)
1. Create `OkrReportingController`
2. Move analytics endpoints from `ObjectiveController` to `OkrReportingController`
3. Move activity endpoints from OKR controllers to `ActivityController`
4. Update frontend API calls

### Phase 4: Frontend Refactor (No Behavior Change)
1. Create `useTenantPermissions` hook
2. Update `okrs/page.tsx` to use new hook
3. Update `analytics/page.tsx` to use new hook
4. Add view model mappers

### Phase 5: Cleanup
1. Remove duplicate code
2. Update tests
3. Update documentation

---

## 5. EXPECTED BENEFITS

### Maintainability
- **Single source of truth** for tenant isolation, publish lock, cycle lock
- **Clear separation** of CRUD, reporting, governance
- **Easier testing** - smaller, focused services

### Clarity
- **Clear ownership** - analytics endpoints in reporting controller
- **Clear patterns** - all tenant checks use `OkrTenantGuard`
- **Clear responsibilities** - services do one thing

### Consistency
- **Frontend matches backend** - `useTenantPermissions` mirrors backend logic
- **Consistent error messages** - centralized in guards/services
- **Consistent patterns** - all services follow same structure

---

## 6. RISKS & MITIGATION

### Risk: Breaking Changes During Migration
**Mitigation:** Migrate incrementally, test after each phase, keep old code until new code verified

### Risk: Increased Complexity (More Files)
**Mitigation:** Better organization offsets complexity. Document new structure in README.

### Risk: Performance Impact
**Mitigation:** No runtime behavior changes. Only structural changes. Monitor performance after migration.

---

## 7. NEXT STEPS

1. **Review this plan** with team
2. **Create skeleton files** (see examples below)
3. **Implement Phase 1** (create new services)
4. **Test thoroughly** after each phase
5. **Update documentation** as services are created

---

## APPENDIX: SKELETON FILES

See separate skeleton files for:
- `okr-reporting.service.ts`
- `okr-governance.service.ts`
- `tenant-guard.ts`
- `activity.controller.ts`
- `useTenantPermissions.ts`
- `ObjectiveViewModel` mapper example






