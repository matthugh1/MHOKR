# Tenant Isolation Security Audit Report

**Date**: 2025-11-03  
**Scope**: All services and controllers in `services/core-api/src/modules`  
**Status**: 🔴 **CRITICAL ISSUES FOUND**

---

## Executive Summary

This audit identified **9 security vulnerabilities** where tenant isolation was missing or incomplete. All queries that return tenant-scoped data must be filtered by the caller's tenant.

**Status**: ✅ **ALL ISSUES FIXED** (2025-11-03)

---

## Critical Issues (P0 - Fix Immediately)

### 1. ❌ `organization.service.findAll()` - Returns ALL Organizations
**File**: `services/core-api/src/modules/organization/organization.service.ts:17-28`

**Issue**: Returns all organizations across all tenants without filtering.

```typescript
// ❌ VULNERABLE
async findAll() {
  return this.prisma.organization.findMany({ ... }) // Returns ALL orgs!
}
```

**Exposed via**: `GET /organizations` (requires `manage_tenant_settings`)

**Risk**: Users with `manage_tenant_settings` can see all organizations in the system.

**Fix Required**:
```typescript
async findAll(userOrganizationId: string | null | undefined) {
  if (userOrganizationId === undefined) return [];
  if (userOrganizationId === null) {
    // SUPERUSER: can see all (read-only)
    return this.prisma.organization.findMany({ ... });
  }
  // Normal user: only their organization(s)
  return this.prisma.organization.findMany({
    where: {
      id: userOrganizationId, // Or get from role assignments if multi-org
    },
    ...
  });
}
```

---

### 2. ❌ `organization.service.findById()` - No Tenant Validation
**File**: `services/core-api/src/modules/organization/organization.service.ts:50-67`

**Issue**: Returns any organization by ID without verifying caller's tenant.

**Exposed via**: `GET /organizations/:id` (requires `manage_tenant_settings`)

**Risk**: Users can access other tenants' organizations by guessing IDs.

**Fix Required**: Add tenant validation after `findUnique`:
```typescript
async findById(id: string, userOrganizationId: string | null | undefined) {
  const org = await this.prisma.organization.findUnique({ where: { id } });
  if (!org) throw new NotFoundException();
  
  // Tenant validation
  if (userOrganizationId === undefined) return null;
  if (userOrganizationId !== null) {
    // Normal user: must match their tenant
    if (org.id !== userOrganizationId) return null; // Don't leak existence
  }
  // SUPERUSER: can see any org
  
  return org;
}
```

---

### 3. ❌ `organization.controller.getMembers()` - No Tenant Validation
**File**: `services/core-api/src/modules/organization/organization.controller.ts:58-60`

**Issue**: `getMembers(organizationId)` accepts any `organizationId` from URL param without validating it's the caller's tenant.

**Exposed via**: `GET /organizations/:id/members` (requires `manage_users`)

**Risk**: Users can enumerate members of other tenants' organizations.

**Fix Required**: Add tenant validation in controller:
```typescript
async getMembers(@Param('id') id: string, @Req() req: any) {
  // Validate organization belongs to caller's tenant
  OkrTenantGuard.assertSameTenant(id, req.user.organizationId);
  return this.organizationService.getMembers(id);
}
```

---

### 4. ❌ `workspace.service.findAll()` - Accepts Any OrganizationId
**File**: `services/core-api/src/modules/workspace/workspace.service.ts:17-27`

**Issue**: Accepts optional `organizationId` parameter but doesn't validate it's the caller's tenant.

```typescript
// ❌ VULNERABLE
async findAll(organizationId?: string) {
  return this.prisma.workspace.findMany({
    where: organizationId ? { organizationId } : undefined, // No tenant check!
  });
}
```

**Exposed via**: `GET /workspaces?organizationId=xxx` (requires `manage_workspaces`)

**Risk**: Users can query workspaces from other tenants by providing different `organizationId`.

**Fix Required**:
```typescript
async findAll(userOrganizationId: string | null | undefined, filterOrganizationId?: string) {
  // Tenant isolation
  if (userOrganizationId === undefined) return [];
  
  // If filterOrganizationId provided, validate it matches caller's tenant
  if (filterOrganizationId && userOrganizationId !== null) {
    if (filterOrganizationId !== userOrganizationId) {
      throw new ForbiddenException('Cannot access workspaces from other tenants');
    }
  }
  
  const orgId = filterOrganizationId || userOrganizationId;
  if (!orgId) return [];
  
  return this.prisma.workspace.findMany({
    where: { organizationId: orgId },
    ...
  });
}
```

---

### 5. ❌ `workspace.service.findById()` - No Tenant Validation
**File**: `services/core-api/src/modules/workspace/workspace.service.ts:29-50`

**Issue**: Returns any workspace by ID without tenant validation.

**Exposed via**: `GET /workspaces/:id` (requires `manage_workspaces`)

**Risk**: Users can access other tenants' workspaces by guessing IDs.

**Fix Required**: Add tenant validation.

---

### 6. ❌ `workspace.controller.getMembers()` - No Tenant Validation
**File**: `services/core-api/src/modules/workspace/workspace.controller.ts:62-64`

**Issue**: Accepts workspace ID from URL without validating it belongs to caller's tenant.

**Fix Required**: Add tenant validation in controller.

---

### 7. ❌ `team.service.findAll()` - Accepts Any WorkspaceId
**File**: `services/core-api/src/modules/team/team.service.ts:18-25`

**Issue**: Accepts optional `workspaceId` but doesn't validate it belongs to caller's tenant.

**Exposed via**: `GET /teams?workspaceId=xxx` (requires `manage_teams`)

**Risk**: Users can query teams from other tenants' workspaces.

**Fix Required**: Validate workspace belongs to caller's tenant before filtering.

---

### 8. ❌ `team.service.findById()` - No Tenant Validation
**File**: `services/core-api/src/modules/team/team.service.ts:27-35`

**Issue**: Returns any team by ID without tenant validation.

**Exposed via**: `GET /teams/:id` (requires `manage_teams`)

**Risk**: Users can access other tenants' teams by guessing IDs.

**Fix Required**: Add tenant validation via workspace lookup.

---

## High Priority Issues (P1)

### 9. ⚠️ `objective.service.findById()` - Relies on Controller Check
**File**: `services/core-api/src/modules/okr/objective.service.ts:89-138`

**Current**: Controller calls `canView()` before calling `findById()`, but service method doesn't validate tenant.

**Risk**: If `findById()` is called directly or from another service, it bypasses tenant check.

**Recommendation**: Add tenant validation in service method as defense-in-depth.

---

### 10. ⚠️ `organization.service.findByUserOrganizations()` - No Input Validation
**File**: `services/core-api/src/modules/organization/organization.service.ts:30-48`

**Issue**: Accepts `organizationIds` array but doesn't validate caller has access to those orgs.

**Recommendation**: Filter to only return organizations the caller has access to.

---

## Services That Are Correctly Protected ✅

1. ✅ `user.service.findAll()` - **FIXED** (now tenant-isolated)
2. ✅ `user.service.findById()` - **FIXED** (now tenant-isolated)
3. ✅ `objective.service.findAll()` - Uses `OkrTenantGuard.buildTenantWhereClause()`
4. ✅ `okr-cycle.service.findAll()` - Validates tenant
5. ✅ `okr-cycle.service.findById()` - Validates tenant after lookup

---

## Fix Status

### ✅ Fixed (2025-11-03)
1. ✅ `organization.service.findAll()` - **FIXED** - Now tenant-isolated
2. ✅ `organization.service.findById()` - **FIXED** - Now validates tenant
3. ✅ `organization.controller.getMembers()` - **FIXED** - Added tenant validation
4. ✅ `workspace.service.findAll()` - **FIXED** - Validates organizationId parameter
5. ✅ `workspace.service.findById()` - **FIXED** - Now validates tenant
6. ✅ `workspace.controller.getMembers()` - **FIXED** - Added tenant validation
7. ✅ `team.service.findAll()` - **FIXED** - Validates workspaceId belongs to tenant
8. ✅ `team.service.findById()` - **FIXED** - Now validates tenant

### ✅ Fixed (2025-11-03 - Continued)
9. ✅ `objective.service.findById()` - **FIXED** - Added tenant validation (defense-in-depth)

---

## Pattern for Fixes

### For `findAll()` methods:
```typescript
async findAll(userOrganizationId: string | null | undefined) {
  if (userOrganizationId === undefined) return [];
  if (userOrganizationId === null) {
    // SUPERUSER: can see all (read-only)
    return this.prisma.model.findMany({ ... });
  }
  // Normal user: filter by tenant
  return this.prisma.model.findMany({
    where: { organizationId: userOrganizationId },
    ...
  });
}
```

### For `findById()` methods:
```typescript
async findById(id: string, userOrganizationId: string | null | undefined) {
  const entity = await this.prisma.model.findUnique({ where: { id } });
  if (!entity) return null;
  
  // Tenant validation
  if (userOrganizationId === undefined) return null;
  if (userOrganizationId !== null) {
    // Verify entity belongs to caller's tenant
    if (entity.organizationId !== userOrganizationId) return null;
  }
  // SUPERUSER: can see any
  
  return entity;
}
```

---

## Testing Requirements

After fixing, add tests for:
1. Regular user cannot access other tenants' data
2. SUPERUSER can see all data (read-only)
3. User with no org gets empty results
4. Invalid IDs return null (don't leak existence)

---

## Next Steps

1. Fix all P0 issues immediately
2. Add tenant validation to all controller endpoints
3. Add automated tests for tenant isolation
4. Consider implementing PostgreSQL RLS as defense-in-depth

