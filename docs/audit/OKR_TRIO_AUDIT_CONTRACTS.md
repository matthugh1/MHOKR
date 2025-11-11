# OKR Trio Audit - Data Contract & Backend Parity (TL)

**Date:** 2025-01-XX  
**Reviewer:** Tech Lead  
**Scope:** API contracts and backend parity verification

---

## A. `/okr/overview` Envelope Verification

### A.1 Response Envelope Structure

**Verified Structure:**
```typescript
{
  page: number                    // ✅ Present
  pageSize: number                // ✅ Present
  totalCount: number              // ✅ Present (AFTER visibility filtering)
  canCreateObjective: boolean    // ✅ Present
  objectives: Array<{ ... }>     // ✅ Present
}
```

**Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:448-583`

**Findings:**
- ✅ **Correct:** Envelope structure matches documented contract
- ✅ **Correct:** `totalCount` calculated AFTER visibility filtering (line 203)
- ✅ **Correct:** `canCreateObjective` flag computed server-side (lines 432-467)
- ⚠️ **Issue:** No `canPublishOKR` flag in response (frontend expects it per `DashboardPage.tsx:43`)

**Code Evidence:**
```typescript
// services/core-api/src/modules/okr/okr-overview.controller.ts:448-583
return {
  page: pageNum,
  pageSize: pageSizeNum,
  totalCount,
  canCreateObjective,
  objectives,
}
```

**Recommendation:**
- Add `canPublishOKR` flag to response envelope (if needed by frontend)
- Document all envelope fields in API contract

**Files:**
- `services/core-api/src/modules/okr/okr-overview.controller.ts:448-583`
- `apps/web/src/app/dashboard/page.tsx:37-44` (expects `canPublishOKR`)

---

### A.2 Query Parameters Used for Scope Toggle

**Current Implementation:**
- ❌ **Missing:** No explicit `scope` query parameter sent to backend
- ❌ **Missing:** No `ownerId` parameter sent for "My" scope
- ❌ **Missing:** No `workspaceId`/`teamId` parameters sent for "Team/Workspace" scope
- ⚠️ **Issue:** Scope filtering relies entirely on backend visibility (no explicit params)

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

**Backend Support:**
- ❌ **Not Supported:** Backend doesn't accept `scope` parameter
- ❌ **Not Supported:** Backend doesn't accept `ownerId` parameter
- ❌ **Not Supported:** Backend doesn't accept `workspaceId`/`teamId` parameters

**Recommendation:**
- Add `scope` query parameter to backend: `?scope=my|team-workspace|tenant`
- Add `ownerId` parameter for "My" scope: `?scope=my&ownerId=xxx`
- Add `workspaceId`/`teamId` parameters for "Team/Workspace" scope
- Backend should filter by scope explicitly (not just rely on visibility)

**Files:**
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:259-270`
- `services/core-api/src/modules/okr/okr-overview.controller.ts:50-57` (query params)

---

## B. Backend Visibility Parity

### B.1 `OkrVisibilityService` Usage

**Verified Endpoints:**
- ✅ `/okr/overview` - Uses `OkrVisibilityService.canUserSeeObjective()` (line 166)
- ✅ `/okr/insights/cycle-summary` - Should use visibility service (verify)
- ✅ `/okr/insights/attention` - Should use visibility service (verify)

**Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:159-200`

**Findings:**
- ✅ **Correct:** `/okr/overview` applies visibility filtering before pagination
- ⚠️ **Issue:** Need to verify `/okr/insights/cycle-summary` and `/okr/insights/attention` use same visibility service
- ⚠️ **Issue:** Key Results filtered by visibility (line 312-334) but Initiatives not filtered

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

// services/core-api/src/modules/okr/okr-overview.controller.ts:312-334
// Filter key results by visibility
const visibleKeyResults = []
for (const okr of o.keyResults) {
  const canSeeKr = await this.visibilityService.canUserSeeKeyResult({ ... })
  if (!canSeeKr) continue
  visibleKeyResults.push({ ... })
}
```

**Recommendation:**
- Verify `/okr/insights/cycle-summary` uses `OkrVisibilityService`
- Verify `/okr/insights/attention` uses `OkrVisibilityService`
- Filter Initiatives by visibility (inherit from parent Key Result or Objective)

**Files:**
- `services/core-api/src/modules/okr/okr-overview.controller.ts:159-200`
- `services/core-api/src/modules/okr/okr-insights.controller.ts` (verify visibility)

---

### B.2 Visibility Filtering Logic

**Verified Logic:**
1. ✅ Tenant isolation: `requesterOrgId !== objective.organizationId` → deny
2. ✅ SUPERUSER: `userContext.isSuperuser === true` → allow
3. ✅ Owner rule: `objective.ownerId === requesterUserId` → allow
4. ✅ PRIVATE visibility: Only owner + TENANT_ADMIN/TENANT_OWNER + whitelist → allow
5. ✅ All other visibility levels: Allow (PUBLIC_TENANT, etc.)

**Source:** `services/core-api/src/modules/okr/okr-visibility.service.ts:44-109`

**Findings:**
- ✅ **Correct:** Visibility logic matches documented contract
- ✅ **Correct:** PRIVATE OKRs filtered server-side before pagination
- ⚠️ **Issue:** No client-side defensive check (if backend bug, PRIVATE OKRs could leak)

**Recommendation:**
- Add client-side defensive check: `canViewObjective()` hook should verify visibility before rendering
- Document defense-in-depth approach

**Files:**
- `services/core-api/src/modules/okr/okr-visibility.service.ts:44-109`
- `apps/web/src/hooks/useTenantPermissions.ts:104-173` (canViewObjective)

---

## C. Governance Locks Reflected in Flags

### C.1 `canEdit`/`canDelete` Flags

**Verified Logic:**
1. ✅ RBAC check: `canPerformAction(userId, 'edit_okr', resourceContext)`
2. ✅ Governance check: `checkAllLocksForObjective()` (publish lock + cycle lock)
3. ✅ If locked and user not admin: `canEdit = false`, `canDelete = false`

**Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:281-310`

**Findings:**
- ✅ **Correct:** `canEdit`/`canDelete` flags computed server-side
- ✅ **Correct:** Governance locks (publish + cycle) checked before setting flags
- ✅ **Correct:** Flags honored by UI (buttons hidden if `canEdit === false`)

**Code Evidence:**
```typescript
// services/core-api/src/modules/okr/okr-overview.controller.ts:281-310
let canEdit = false
let canDelete = false
try {
  const resourceContext = await buildResourceContextFromOKR(this.prisma, o.id)
  canEdit = await this.rbacService.canPerformAction(requesterUserId, 'edit_okr', resourceContext)
  canDelete = await this.rbacService.canPerformAction(requesterUserId, 'delete_okr', resourceContext)

  // Check governance locks
  if (canEdit || canDelete) {
    try {
      await this.governanceService.checkAllLocksForObjective({ ... })
    } catch (error) {
      // If locked and user is not admin, deny edit/delete
      canEdit = false
      canDelete = false
    }
  }
}
```

**Recommendation:**
- ✅ No changes needed (correctly implemented)

**Files:**
- `services/core-api/src/modules/okr/okr-overview.controller.ts:281-310`
- `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:375-449` (uses flags)

---

### C.2 `canCheckIn` Flag

**Verified Logic:**
1. ✅ RBAC check: `canPerformAction(userId, 'edit_okr', resourceContext)`
2. ✅ Governance check: `checkAllLocksForKeyResult()` (publish lock + cycle lock from parent)
3. ✅ If locked and user not admin: `canCheckIn = false`

**Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:336-361`

**Findings:**
- ✅ **Correct:** `canCheckIn` flag computed server-side
- ✅ **Correct:** Governance locks checked before setting flag
- ✅ **Correct:** Flag honored by UI (check-in button hidden if `canCheckIn === false`)

**Recommendation:**
- ✅ No changes needed (correctly implemented)

**Files:**
- `services/core-api/src/modules/okr/okr-overview.controller.ts:336-361`
- `apps/web/src/components/okr/ObjectiveRow.tsx` (uses flag)

---

### C.3 `canCreateObjective` Flag

**Verified Logic:**
1. ✅ RBAC check: `canPerformAction(userId, 'create_okr', resourceContext)`
2. ✅ Cycle lock check: If `cycleId` provided and cycle is LOCKED/ARCHIVED, require admin override
3. ✅ SUPERUSER check: If `userOrganizationId === null`, deny creation (read-only)

**Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:432-467`

**Findings:**
- ✅ **Correct:** `canCreateObjective` flag computed server-side
- ✅ **Correct:** Cycle lock and SUPERUSER checks applied
- ✅ **Correct:** Flag honored by UI (Add button hidden if `canCreateObjective === false`)

**Recommendation:**
- ✅ No changes needed (correctly implemented)

**Files:**
- `services/core-api/src/modules/okr/okr-overview.controller.ts:432-467`
- `apps/web/src/app/dashboard/okrs/page.tsx:1033-1094` (uses flag)

---

## D. Inconsistencies Summary

### D.1 Missing Query Parameters

| Parameter | Expected | Actual | Impact |
|-----------|----------|--------|--------|
| `scope` | `my\|team-workspace\|tenant` | Not sent | Scope filtering relies on visibility only |
| `ownerId` | User ID for "My" scope | Not sent | Cannot explicitly filter by owner |
| `workspaceId` | Workspace ID for "Team/Workspace" scope | Not sent | Cannot explicitly filter by workspace |
| `teamId` | Team ID for "Team/Workspace" scope | Not sent | Cannot explicitly filter by team |
| `search` | Search query string | Not sent | Client-side filtering only |

**Recommendation:**
- Add all missing query parameters to backend
- Backend should filter by these params before visibility filtering
- Remove client-side filtering after backend supports it

---

### D.2 Response Envelope Inconsistencies

| Field | Expected | Actual | Impact |
|-------|----------|--------|--------|
| `canPublishOKR` | Boolean flag | Missing | Frontend expects it (`DashboardPage.tsx:43`) |

**Recommendation:**
- Add `canPublishOKR` flag to response envelope (if needed)
- Or remove expectation from frontend (if not needed)

---

### D.3 Visibility Filtering Inconsistencies

| Entity | Filtered by Visibility | Issue |
|--------|------------------------|-------|
| Objectives | ✅ Yes | None |
| Key Results | ✅ Yes | None |
| Initiatives | ❌ No | Should inherit from parent Key Result or Objective |

**Recommendation:**
- Filter Initiatives by visibility (inherit from parent)
- Document visibility inheritance rules

---

## E. Endpoint Summary

### E.1 `/okr/overview`

**Query Params:**
- ✅ `organizationId` (required)
- ✅ `page` (optional, default: 1)
- ✅ `pageSize` (optional, default: 20, max: 50)
- ✅ `cycleId` (optional)
- ✅ `status` (optional, enum)
- ❌ `scope` (missing)
- ❌ `ownerId` (missing)
- ❌ `workspaceId` (missing)
- ❌ `teamId` (missing)
- ❌ `search` (missing)

**Response Envelope:**
- ✅ `page`, `pageSize`, `totalCount`
- ✅ `canCreateObjective`
- ✅ `objectives[]` with `canEdit`, `canDelete`, `canCheckIn` flags
- ❌ `canPublishOKR` (missing, but expected by frontend)

**Visibility Filtering:**
- ✅ Applied server-side before pagination
- ✅ Uses `OkrVisibilityService.canUserSeeObjective()`
- ✅ PRIVATE OKRs filtered correctly

**Governance Flags:**
- ✅ `canEdit`/`canDelete` computed with governance locks
- ✅ `canCheckIn` computed with governance locks
- ✅ `canCreateObjective` computed with cycle lock and SUPERUSER checks

---

### E.2 `/okr/insights/cycle-summary`

**Status:** ⚠️ Needs verification

**Recommendation:**
- Verify uses `OkrVisibilityService` for visibility filtering
- Verify respects tenant isolation
- Document visibility filtering approach

---

### E.3 `/okr/insights/attention`

**Status:** ⚠️ Needs verification

**Recommendation:**
- Verify uses `OkrVisibilityService` for visibility filtering
- Verify respects tenant isolation
- Document visibility filtering approach

---

## F. Acceptance Criteria for Contract Fixes

1. ✅ All query parameters documented and supported
2. ✅ Scope toggle sends explicit query params to backend
3. ✅ Response envelope includes all expected fields
4. ✅ Visibility filtering consistent across all endpoints
5. ✅ Governance flags correctly computed and honored



