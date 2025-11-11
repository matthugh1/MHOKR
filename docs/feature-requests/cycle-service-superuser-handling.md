# Feature Request: Cycle Service SUPERUSER Handling

**Status**: 📋 Backlog  
**Priority**: P2 (Nice to Have)  
**Category**: Bug Fix / Consistency  
**Estimated Effort**: Low (1-2 hours)

---

## User Story

**As a** SUPERUSER,  
**I want** to view cycles across all organizations (read-only access),  
**So that** I can audit and monitor cycle usage across all tenants without being blocked by tenant isolation.

---

## Background

Currently, `OkrCycleService.findAll()` and `OkrCycleService.findById()` use `organizationId: string` (non-nullable), which means:

1. **SUPERUSER cannot view cycles**: They cannot pass `null` to see all cycles
2. **Inconsistent with other services**: Other services accept `userOrganizationId: string | null | undefined`
3. **No read-only access**: SUPERUSER should be able to read cycles for auditing purposes

**Current code**:
```typescript
async findAll(organizationId: string): Promise<any[]> {
  OkrTenantGuard.assertCanMutateTenant(organizationId); // Blocks SUPERUSER!
  // ...
}
```

**Expected behavior** (consistent with other services):
```typescript
async findAll(userOrganizationId: string | null | undefined): Promise<any[]> {
  if (userOrganizationId === undefined) return [];
  if (userOrganizationId === null) {
    // SUPERUSER: can see all cycles (read-only)
    return this.prisma.cycle.findMany({ ... });
  }
  // Normal user: only their tenant
  return this.prisma.cycle.findMany({
    where: { organizationId: userOrganizationId },
    ...
  });
}
```

---

## Acceptance Criteria

### 1. Service Method Updates
- [ ] Update `findAll()` to accept `userOrganizationId: string | null | undefined`
- [ ] Update `findById()` to accept `userOrganizationId: string | null | undefined`
- [ ] Remove `OkrTenantGuard.assertCanMutateTenant()` from read methods (only use for mutations)
- [ ] Implement consistent tenant isolation pattern:
  - `undefined` → return empty array
  - `null` → SUPERUSER can see all (read-only)
  - `string` → normal user sees only their tenant

### 2. Controller Updates
- [ ] Update `OkrCycleController` to pass `req.user.organizationId` to service methods
- [ ] Ensure SUPERUSER can access cycle endpoints without errors

### 3. Mutation Methods
- [ ] Keep `assertCanMutateTenant()` in `create()`, `update()`, `delete()` methods
- [ ] Ensure SUPERUSER cannot mutate cycles (read-only)

### 4. Testing
- [ ] Add test for SUPERUSER reading all cycles
- [ ] Add test for normal user reading only their tenant cycles
- [ ] Add test for user with no org returning empty array
- [ ] Add test ensuring SUPERUSER cannot mutate cycles

---

## Implementation Details

### Service Method Changes

**Before**:
```typescript
async findAll(organizationId: string): Promise<any[]> {
  OkrTenantGuard.assertCanMutateTenant(organizationId);
  
  return this.prisma.cycle.findMany({
    where: { organizationId },
    orderBy: { startDate: 'desc' },
  });
}

async findById(id: string, organizationId: string): Promise<any> {
  OkrTenantGuard.assertCanMutateTenant(organizationId);
  
  const cycle = await this.prisma.cycle.findUnique({ where: { id } });
  
  if (cycle.organizationId !== organizationId) {
    throw new ForbiddenException('Cycle does not belong to your organization');
  }
  
  return cycle;
}
```

**After**:
```typescript
async findAll(userOrganizationId: string | null | undefined): Promise<any[]> {
  // User with no org - return empty
  if (userOrganizationId === undefined || userOrganizationId === '') {
    return [];
  }

  if (userOrganizationId === null) {
    // SUPERUSER: can see all cycles (read-only)
    return this.prisma.cycle.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        _count: {
          select: {
            objectives: true,
            keyResults: true,
            initiatives: true,
          },
        },
      },
    });
  }

  // Normal user: only their tenant
  return this.prisma.cycle.findMany({
    where: { organizationId: userOrganizationId },
    orderBy: { startDate: 'desc' },
    include: {
      _count: {
        select: {
          objectives: true,
          keyResults: true,
          initiatives: true,
        },
      },
    },
  });
}

async findById(id: string, userOrganizationId: string | null | undefined): Promise<any> {
  const cycle = await this.prisma.cycle.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          objectives: true,
          keyResults: true,
          initiatives: true,
        },
      },
    },
  });

  if (!cycle) {
    throw new NotFoundException(`Cycle with ID ${id} not found`);
  }

  // User with no org - cannot access
  if (userOrganizationId === undefined || userOrganizationId === '') {
    throw new NotFoundException(`Cycle with ID ${id} not found`);
  }

  if (userOrganizationId === null) {
    // SUPERUSER: can see any cycle (read-only)
    return cycle;
  }

  // Normal user: verify tenant match
  if (cycle.organizationId !== userOrganizationId) {
    // Don't leak existence - return not found
    throw new NotFoundException(`Cycle with ID ${id} not found`);
  }

  return cycle;
}
```

### Controller Updates

**Before**:
```typescript
@Get()
async getAll(@Query('organizationId') organizationId: string) {
  return this.cycleService.findAll(organizationId);
}
```

**After**:
```typescript
@Get()
async getAll(@Req() req: any) {
  return this.cycleService.findAll(req.user.organizationId);
}
```

---

## Benefits

1. **Consistency**: Matches pattern used in all other services
2. **SUPERUSER Support**: Enables read-only access for auditing
3. **Better UX**: SUPERUSER can view cycles without errors
4. **Security**: Maintains tenant isolation while allowing read access

---

## Risks & Considerations

1. **Breaking Change**: If any code calls `findAll(organizationId)` directly, it will break
2. **Testing**: Need to verify all cycle-related endpoints work correctly
3. **Documentation**: Update API documentation if needed

---

## Migration Steps

1. Update service method signatures
2. Update controller methods to use `req.user.organizationId`
3. Update any direct service calls (if any)
4. Add tests for new behavior
5. Run full test suite to ensure no regressions

---

## Related Documentation

- `services/core-api/src/modules/okr/okr-cycle.service.ts` - Current implementation
- `docs/developer/TENANT_ISOLATION_GUIDELINES.md` - Tenant isolation patterns
- `services/core-api/src/modules/organization/organization.service.ts` - Reference implementation

---

## Notes

- This is a **low-risk change** if done carefully
- Follow the same pattern as `OrganizationService`, `WorkspaceService`, `TeamService`
- Mutation methods (`create`, `update`, `delete`) should continue to use `assertCanMutateTenant()` to block SUPERUSER
- This ensures SUPERUSER can audit cycles but cannot modify them

---

## Testing Checklist

- [ ] SUPERUSER can view all cycles
- [ ] Normal user can view only their tenant cycles
- [ ] User with no org returns empty array
- [ ] SUPERUSER cannot create/update/delete cycles (read-only)
- [ ] Cross-tenant access returns NotFoundException (not ForbiddenException)
- [ ] All existing tests pass




