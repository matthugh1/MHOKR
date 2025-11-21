# Permissions System Audit & Best Practice Implementation Plan

## Executive Summary

This document provides a comprehensive audit of the current permissions system and outlines a best-practice implementation plan. The system has multiple inconsistencies between frontend and backend, conflicting superuser policies, and duplicate permission logic that needs consolidation.

---

## 1. Current State Analysis

### 1.1 Architecture Overview

The permissions system uses a multi-layered approach:

1. **Backend RBAC System** (`services/core-api/src/modules/rbac/`)
   - Core authorization logic in `rbac.ts`
   - Service layer in `rbac.service.ts`
   - Guard implementation in `rbac.guard.ts`
   - Role assignments stored in `RoleAssignment` table

2. **Governance Layer** (`services/core-api/src/modules/okr/okr-governance.service.ts`)
   - Publish lock checks (isPublished === true)
   - Cycle lock checks (cycle.status === LOCKED/ARCHIVED)

3. **Tenant Isolation** (`services/core-api/src/modules/okr/tenant-guard.ts`)
   - Tenant matching enforcement
   - Superuser read/write rules

4. **Frontend Hooks** (`apps/web/src/hooks/`)
   - `usePermissions.ts` - Basic RBAC checks
   - `useTenantPermissions.ts` - Tenant-scoped permissions with governance

### 1.2 Critical Issues Found

#### Issue 1: Superuser Policy Inconsistencies

**Problem**: Superuser capabilities are defined inconsistently across the codebase.

| Location | Superuser Can Edit? | Superuser Can Delete? | Notes |
|----------|---------------------|----------------------|-------|
| `rbac.ts:canSuperuser()` | ✅ Yes (returns true) | ✅ Yes | Full access |
| `okr-governance.service.ts` | ✅ Yes (bypasses locks) | ✅ Yes | Bypasses all locks |
| `objective.service.ts:canEdit()` | ✅ Yes (line 201) | ✅ Yes | Full access |
| `tenant-guard.ts:assertCanMutateTenant()` | ✅ Yes (line 66) | ✅ Yes | Can mutate |
| `rbac.guard.ts` | ⚠️ Limited actions | ⚠️ Limited actions | Only specific actions allowed |
| Frontend `usePermissions.ts` | ✅ Yes | ✅ Yes | Full access |

**Impact**: 
- Superusers may be blocked from legitimate operations
- Security risk if superuser checks are bypassed incorrectly
- Confusing behavior for superusers

**Root Cause**: No single source of truth for superuser capabilities.

---

#### Issue 2: Publish Lock Logic Duplication

**Problem**: Publish lock checks exist in multiple places with different logic.

| Location | Logic | Superuser Handling |
|---------|-------|-------------------|
| `rbac.ts:canEditOKRAction()` | Checks `isPublished === true`, requires TENANT_OWNER/ADMIN | Superuser returns true first (bypasses) |
| `okr-governance.service.ts:checkPublishLockForObjective()` | Checks state/isPublished, requires admin | Superuser bypasses (line 60) |
| Frontend `useTenantPermissions.ts` | Checks `isPublished === true` | Checks `canOverrideLocks()` |

**Impact**:
- Logic can drift between frontend and backend
- Backend is source of truth, but frontend may show incorrect UI state
- Duplicate code maintenance burden

**Root Cause**: Governance checks were extracted but not fully integrated into RBAC flow.

---

#### Issue 3: Tenant Isolation Inconsistencies

**Problem**: Tenant filtering and matching logic is inconsistent.

| Location | Behavior | Issue |
|---------|----------|-------|
| `rbac.service.ts:buildUserContext()` | Filters to `primaryOrganizationId` only (lines 95-111) | Users can only have roles in primary org |
| `rbac.ts:canEditOKRAction()` | Uses `resourceContext.tenantId` | May not match user's primary org |
| `tenant-guard.ts:assertSameTenant()` | Checks tenant match, superuser bypasses | Correct but not always called |
| `objective.service.ts:canEdit()` | Calls `assertSameTenant()` then RBAC | Double-checking |

**Impact**:
- Users may be incorrectly denied access to OKRs in their tenant
- Cross-tenant access may be incorrectly allowed
- Performance: Multiple tenant checks in same flow

**Root Cause**: Tenant isolation was added incrementally without centralizing logic.

---

#### Issue 4: Frontend/Backend Permission Mismatch

**Problem**: Frontend permission checks don't always match backend logic.

| Permission | Frontend Logic | Backend Logic | Mismatch |
|-----------|---------------|---------------|----------|
| `canExportData` | Only `isTenantAdminOrOwner()` | Allows `TENANT_VIEWER` too | ❌ Frontend too restrictive |
| `canEditObjective` | Checks locks then RBAC | RBAC checks locks internally | ⚠️ Order may differ |
| `canViewObjective` | Complex visibility logic | Uses `canViewOKR()` from visibilityPolicy | ⚠️ May diverge |

**Impact**:
- UI may show/hide buttons incorrectly
- Users may see actions they can't perform (backend blocks)
- Users may not see actions they can perform (frontend hides)

**Root Cause**: Frontend mirrors backend logic but doesn't use same code path.

---

#### Issue 5: Role Checking Inconsistencies

**Problem**: Different places check roles differently.

| Location | Method | Issue |
|----------|--------|-------|
| `rbac.ts` | Uses `hasTenantOwnerRole()`, `hasTenantAdminRole()` helpers | ✅ Consistent |
| `usePermissions.ts` | Checks `rolesByScope.tenant.find()` | ⚠️ Duplicate logic |
| `useTenantPermissions.ts` | Uses `permissions.isTenantAdminOrOwner()` | ✅ Uses hook |
| `okr-governance.service.ts` | Uses `canPerformAction()` | ✅ Uses RBAC system |

**Impact**:
- Role checks may drift between frontend and backend
- Harder to maintain role definitions

**Root Cause**: Frontend reimplements role checks instead of using API.

---

#### Issue 6: Governance Lock Ordering

**Problem**: Order of lock checks (publish vs cycle) may differ.

| Location | Order | Issue |
|----------|-------|-------|
| `okr-governance.service.ts:checkAllLocksForObjective()` | Cycle → Publish | ✅ Consistent |
| Frontend `useTenantPermissions.ts` | Publish → Cycle | ⚠️ Different order |
| `rbac.ts:canEditOKRAction()` | Publish lock only | ⚠️ Missing cycle lock |

**Impact**:
- Different error messages for same scenario
- Cycle lock may not be enforced in RBAC layer

**Root Cause**: Governance checks not fully integrated into RBAC `can()` function.

---

## 2. Best Practice Requirements

### 2.1 Single Source of Truth

**Requirement**: All permission checks must flow through a single, authoritative code path.

- ✅ Backend RBAC system (`rbac.ts` + `rbac.service.ts`) should be the source of truth
- ✅ Frontend should call backend API for permission checks (or mirror exactly)
- ✅ Governance locks should be integrated into RBAC flow, not separate

### 2.2 Consistent Superuser Policy

**Requirement**: Define superuser capabilities once, use everywhere.

**Proposed Policy**:
- Superusers can **view** everything (all tenants, all OKRs)
- Superusers can **edit/delete** everything (including published OKRs, locked cycles)
- Superusers bypass all governance locks
- Superusers bypass tenant isolation checks
- Superusers can perform all administrative actions

**Implementation**: 
- Single function `isSuperuser(userId)` or check `userContext.isSuperuser`
- Early return in `can()` function for superuser
- Document policy in one place

### 2.3 Centralized Governance Checks

**Requirement**: Publish and cycle locks should be checked in one place.

**Proposed Flow**:
1. Check superuser → allow if superuser
2. Check governance locks (publish + cycle) → throw if locked and not admin
3. Check RBAC permissions → allow/deny based on roles

**Implementation**:
- Integrate `OkrGovernanceService` checks into `rbac.ts:canEditOKRAction()` and `canDeleteOKRAction()`
- Remove duplicate governance checks from service layer
- Frontend should call backend API for lock status

### 2.4 Tenant Isolation Enforcement

**Requirement**: Tenant isolation must be enforced consistently.

**Proposed Flow**:
1. Build user context (filtered to primary org for non-superusers)
2. Check tenant match (superuser bypasses)
3. Check RBAC permissions (uses tenant from resource context)

**Implementation**:
- `buildUserContext()` already filters to primary org ✅
- `tenant-guard.ts` provides tenant matching ✅
- Ensure all RBAC checks use correct tenant from resource context

### 2.5 Frontend/Backend Alignment

**Requirement**: Frontend permission checks must match backend exactly.

**Options**:
1. **Option A (Recommended)**: Frontend calls backend API for permission checks
   - Pros: Single source of truth, no drift
   - Cons: More API calls, latency

2. **Option B**: Frontend mirrors backend logic exactly
   - Pros: Fast, no API calls
   - Cons: Must keep in sync manually

**Recommendation**: Hybrid approach
- Use backend API for critical checks (edit/delete)
- Mirror simple checks (view) for performance
- Add integration tests to ensure alignment

---

## 3. Implementation Plan

### Phase 1: Consolidate Superuser Policy (Priority: HIGH)

**Goal**: Define superuser policy once, use everywhere.

**Tasks**:
1. ✅ Document superuser policy in `rbac.ts` (already done: `canSuperuser()` returns true)
2. ✅ Ensure `okr-governance.service.ts` bypasses locks for superuser (already done)
3. ✅ Ensure `tenant-guard.ts` allows superuser mutation (already done)
4. ⚠️ **FIX**: Update `rbac.guard.ts` to allow all actions for superuser (currently limited)
5. ✅ Frontend already treats superuser as full access

**Files to Modify**:
- `services/core-api/src/modules/rbac/rbac.guard.ts` - Remove action whitelist for superuser

**Testing**:
- Superuser can perform all actions
- Superuser bypasses all locks
- Superuser bypasses tenant isolation

---

### Phase 2: Integrate Governance into RBAC (Priority: HIGH)

**Goal**: Make governance locks part of RBAC flow, not separate.

**Tasks**:
1. **Modify `rbac.ts:canEditOKRAction()`**:
   - Add governance lock checks (publish + cycle) before RBAC checks
   - Keep superuser bypass at top
   - Use `OkrGovernanceService` or inline logic

2. **Modify `rbac.ts:canDeleteOKRAction()`**:
   - Same as edit

3. **Remove duplicate governance checks**:
   - Remove from `objective.service.ts:update()` and `delete()`
   - Remove from `key-result.service.ts:update()` and `delete()`
   - Keep in `okr-governance.service.ts` for reuse

4. **Update frontend**:
   - Remove governance lock checks from `useTenantPermissions.ts`
   - Call backend API for lock status (or keep for UX only)

**Files to Modify**:
- `services/core-api/src/modules/rbac/rbac.ts` - Add governance checks
- `services/core-api/src/modules/okr/objective.service.ts` - Remove duplicate checks
- `services/core-api/src/modules/okr/key-result.service.ts` - Remove duplicate checks
- `apps/web/src/hooks/useTenantPermissions.ts` - Simplify (or remove lock checks)

**Testing**:
- Published OKRs: only admins can edit (via RBAC)
- Locked cycles: only admins can edit (via RBAC)
- Superuser bypasses all locks
- Frontend shows correct lock status

---

### Phase 3: Fix Tenant Isolation (Priority: MEDIUM)

**Goal**: Ensure tenant isolation is consistent and correct.

**Tasks**:
1. **Verify `buildUserContext()` filtering**:
   - ✅ Already filters to primary org (correct)
   - Ensure superusers get all roles

2. **Ensure resource context has correct tenantId**:
   - Verify `buildResourceContextFromOKR()` sets `tenantId` correctly
   - Use `resourceContext.tenantId` in RBAC checks (not `okr.tenantId`)

3. **Remove redundant tenant checks**:
   - `objective.service.ts:canEdit()` calls `assertSameTenant()` then RBAC
   - RBAC should handle tenant matching (via filtered user context)
   - Keep `assertSameTenant()` for write operations (defense-in-depth)

**Files to Modify**:
- `services/core-api/src/modules/rbac/rbac.ts` - Use `resourceContext.tenantId`
- `services/core-api/src/modules/okr/objective.service.ts` - Simplify tenant checks
- `services/core-api/src/modules/rbac/helpers.ts` - Ensure `tenantId` set correctly

**Testing**:
- Users can only access OKRs in their tenant
- Superusers can access all OKRs
- Cross-tenant access is blocked

---

### Phase 4: Align Frontend/Backend (Priority: MEDIUM)

**Goal**: Ensure frontend permission checks match backend.

**Tasks**:
1. **Fix `canExportData` mismatch**:
   - Frontend: Allow `TENANT_VIEWER` (match backend)
   - Or backend: Remove `TENANT_VIEWER` (match frontend) - **Recommendation: Allow VIEWER**

2. **Create backend permission API endpoint**:
   - `/rbac/permissions/check` - Check single permission
   - `/rbac/permissions/batch` - Check multiple permissions
   - Returns: `{ allowed: boolean, reason?: string }`

3. **Update frontend to use API** (optional):
   - For critical checks (edit/delete), call API
   - For simple checks (view), keep mirroring

4. **Add integration tests**:
   - Test frontend/backend alignment
   - Test all permission scenarios

**Files to Modify**:
- `apps/web/src/hooks/useTenantPermissions.ts` - Fix `canExportData`
- `services/core-api/src/modules/rbac/rbac.controller.ts` - Add permission check endpoint (if needed)
- Add integration tests

**Testing**:
- Frontend `canExportData` matches backend
- Frontend edit/delete checks match backend
- Integration tests pass

---

### Phase 5: Cleanup and Documentation (Priority: LOW)

**Goal**: Remove duplicate code and document system.

**Tasks**:
1. **Remove duplicate role checks**:
   - Frontend `usePermissions.ts` reimplements role checks
   - Consider using API or shared types

2. **Document permission flow**:
   - Create architecture diagram
   - Document superuser policy
   - Document governance locks
   - Document tenant isolation

3. **Add logging/monitoring**:
   - Log permission denials
   - Monitor superuser actions
   - Alert on tenant isolation violations

**Files to Modify**:
- Documentation files
- Add monitoring/logging

**Testing**:
- Documentation is accurate
- Logging works correctly

---

## 4. Detailed Implementation Steps

### Step 1: Fix Superuser Policy in RBAC Guard

**File**: `services/core-api/src/modules/rbac/rbac.guard.ts`

**Current Code** (lines 116-135):
```typescript
if (isSuperuser) {
  const superuserAllowedActions: Action[] = [
    'manage_users',
    'manage_workspaces',
    'manage_teams',
    'manage_tenant_settings',
    'view_okr',
    'view_all_okrs',
    'export_data',
    'impersonate_user',
  ];
  
  if (superuserAllowedActions.includes(action)) {
    return true;
  }
}
```

**Fix**: Remove action whitelist, allow all actions for superuser:
```typescript
if (isSuperuser) {
  // Superuser can perform all actions
  this.logger.log(`[RBAC Guard] SUPERUSER AUTHORIZED for ${action}`, {
    userId: user.id,
    action,
  });
  return true;
}
```

---

### Step 2: Integrate Governance into RBAC

**File**: `services/core-api/src/modules/rbac/rbac.ts`

**Current Code** (`canEditOKRAction`, lines 262-370):
- Checks publish lock inline
- Doesn't check cycle lock
- Superuser bypasses at top ✅

**Fix**: Add governance service integration:

```typescript
function canEditOKRAction(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  if (!resourceContext.okr) {
    return false;
  }

  const okr = resourceContext.okr;
  const tenantId = resourceContext.tenantId || okr.tenantId || '';

  // SUPERUSER bypasses all checks
  if (userContext.isSuperuser) {
    return true;
  }

  // Check governance locks (publish + cycle)
  // This should be done via OkrGovernanceService, but for now inline:
  const isPublished = okr.isPublished === true || 
                     okr.state === 'PUBLISHED' || 
                     okr.state === 'COMPLETED' || 
                     okr.state === 'CANCELLED' || 
                     okr.state === 'ARCHIVED';
  
  if (isPublished) {
    // Only TENANT_OWNER/ADMIN can edit published OKRs
    if (!hasTenantOwnerRole(userContext, tenantId) && 
        !hasTenantAdminRole(userContext, tenantId)) {
      return false;
    }
  }

  // Check cycle lock (if cycle exists and is locked)
  // TODO: Load cycle from resourceContext or check via governance service

  // Normal RBAC checks (owner, roles)
  // ... existing code ...
}
```

**Better Approach**: Call governance service (requires async, so need to modify `can()` to be async or check in service layer).

**Recommendation**: Keep governance checks in service layer (`objective.service.ts`, `key-result.service.ts`) but ensure they're called before RBAC checks. RBAC layer should assume governance is already checked.

---

### Step 3: Fix Frontend canExportData

**File**: `apps/web/src/hooks/useTenantPermissions.ts`

**Current Code** (lines 354-361):
```typescript
const canExportData = useMemo(() => {
  return (): boolean => {
    // Match backend RBAC canExportData() logic
    // TENANT_OWNER, TENANT_ADMIN, and TENANT_VIEWER can export
    return permissions.isTenantAdminOrOwner(currentOrganization?.id)
  }
}, [permissions, currentOrganization?.id])
```

**Fix**: Add TENANT_VIEWER check:
```typescript
const canExportData = useMemo(() => {
  return (): boolean => {
    if (permissions.isSuperuser) {
      return true;
    }
    
    if (!currentOrganization?.id) {
      return false;
    }
    
    const tenantRoles = permissions.rolesByScope.tenant.find(
      (t) => t.tenantId === currentOrganization.id
    );
    
    if (!tenantRoles) {
      return false;
    }
    
    // TENANT_OWNER, TENANT_ADMIN, and TENANT_VIEWER can export
    return tenantRoles.roles.includes('TENANT_OWNER') ||
           tenantRoles.roles.includes('TENANT_ADMIN') ||
           tenantRoles.roles.includes('TENANT_VIEWER');
  }
}, [permissions, currentOrganization?.id])
```

---

## 5. Testing Strategy

### 5.1 Unit Tests

**Test Superuser Policy**:
- Superuser can perform all actions
- Superuser bypasses governance locks
- Superuser bypasses tenant isolation

**Test Governance Locks**:
- Published OKRs: only admins can edit
- Locked cycles: only admins can edit
- Draft OKRs: normal RBAC applies

**Test Tenant Isolation**:
- Users can only access their tenant
- Superusers can access all tenants
- Cross-tenant access is blocked

### 5.2 Integration Tests

**Test Frontend/Backend Alignment**:
- Frontend `canEditObjective` matches backend
- Frontend `canExportData` matches backend
- Frontend lock checks match backend

**Test Permission Flow**:
- End-to-end permission checks
- Governance locks enforced
- Tenant isolation enforced

### 5.3 Manual Testing Checklist

- [ ] Superuser can edit published OKRs
- [ ] Superuser can edit OKRs in locked cycles
- [ ] Regular user cannot edit published OKRs
- [ ] Regular user cannot edit OKRs in locked cycles
- [ ] Tenant admin can edit published OKRs
- [ ] Tenant admin can edit OKRs in locked cycles
- [ ] Tenant viewer can export data
- [ ] Users can only see OKRs in their tenant
- [ ] Frontend buttons match backend permissions

---

## 6. Risk Assessment

### High Risk Changes

1. **Superuser Policy Changes**
   - Risk: May break superuser access
   - Mitigation: Test thoroughly, have rollback plan

2. **Governance Integration**
   - Risk: May allow unauthorized edits
   - Mitigation: Keep governance checks, add tests

### Medium Risk Changes

1. **Frontend/Backend Alignment**
   - Risk: UI may show incorrect state
   - Mitigation: Add integration tests

2. **Tenant Isolation Changes**
   - Risk: May allow cross-tenant access
   - Mitigation: Keep defense-in-depth checks

---

## 7. Rollout Plan

### Phase 1: Backend Fixes (Week 1)
1. Fix superuser policy in RBAC guard
2. Add governance checks to RBAC (or document current flow)
3. Test backend changes

### Phase 2: Frontend Fixes (Week 2)
1. Fix `canExportData` mismatch
2. Simplify `useTenantPermissions` (remove duplicate lock checks if backend handles)
3. Test frontend changes

### Phase 3: Integration Testing (Week 3)
1. Run full test suite
2. Manual testing
3. Fix any issues

### Phase 4: Documentation (Week 4)
1. Document permission flow
2. Document superuser policy
3. Update API documentation

---

## 8. Success Criteria

- ✅ Superuser policy is consistent across all code paths
- ✅ Governance locks are enforced consistently
- ✅ Tenant isolation is enforced correctly
- ✅ Frontend permission checks match backend
- ✅ No duplicate permission logic
- ✅ All tests pass
- ✅ Documentation is complete

---

## 9. Appendix: Current Permission Matrix

| Role | View OKR | Edit Draft OKR | Edit Published OKR | Edit Locked Cycle | Delete OKR | Export Data | Manage Users |
|------|----------|---------------|-------------------|-------------------|-----------|-------------|--------------|
| SUPERUSER | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| TENANT_OWNER | ✅ Tenant | ✅ Tenant | ✅ Tenant | ✅ Tenant | ✅ Tenant | ✅ Tenant | ✅ Tenant |
| TENANT_ADMIN | ✅ Tenant | ✅ Tenant | ✅ Tenant | ✅ Tenant | ✅ Tenant | ✅ Tenant | ✅ Tenant |
| TENANT_VIEWER | ✅ Tenant | ❌ | ❌ | ❌ | ❌ | ✅ Tenant | ❌ |
| WORKSPACE_LEAD | ✅ Workspace | ✅ Workspace | ❌ | ❌ | ✅ Workspace | ❌ | ✅ Workspace |
| TEAM_LEAD | ✅ Team | ✅ Team | ❌ | ❌ | ✅ Team | ❌ | ✅ Team |
| Owner | ✅ Own | ✅ Own | ❌ | ❌ | ✅ Own | ❌ | ❌ |

**Notes**:
- Published OKRs: Only TENANT_OWNER/ADMIN can edit
- Locked cycles: Only TENANT_OWNER/ADMIN can edit
- Superuser: Full access to everything
- Tenant isolation: Users can only access their primary organization

---

## 10. Next Steps

1. **Review this audit** with team
2. **Prioritize fixes** based on business impact
3. **Create tickets** for each phase
4. **Start implementation** with Phase 1 (Superuser Policy)
5. **Monitor** for permission-related issues during rollout

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-20  
**Author**: AI Assistant  
**Status**: Draft - Pending Review

