# Tenant Isolation Code Review Checklist

**Last Updated**: 2025-11-03  
**Use This**: Before approving any PR that touches service methods or controllers

---

## Pre-Review Checks

- [ ] **Run audit script**: `npm run audit:tenant-isolation`
- [ ] **Check for test coverage**: Verify tenant isolation tests exist
- [ ] **Review service changes**: Identify all `findMany()`, `findById()`, mutation methods

---

## Service Layer Checklist

### `findAll()` Methods

- [ ] Accepts `userOrganizationId: string | null | undefined` parameter
- [ ] Returns empty array `[]` if `userOrganizationId === undefined` or `''`
- [ ] Returns all data (no filter) if `userOrganizationId === null` (SUPERUSER)
- [ ] Filters by `organizationId` for normal users
- [ ] Uses `OkrTenantGuard.buildTenantWhereClause()` if appropriate

**Example Pattern**:
```typescript
async findAll(userOrganizationId: string | null | undefined) {
  if (userOrganizationId === undefined) return [];
  if (userOrganizationId === null) {
    return this.prisma.model.findMany({ ... }); // SUPERUSER
  }
  return this.prisma.model.findMany({
    where: { organizationId: userOrganizationId },
    ...
  });
}
```

---

### `findById()` Methods

- [ ] Accepts `userOrganizationId: string | null | undefined` parameter
- [ ] Throws `NotFoundException` if entity doesn't exist
- [ ] Throws `NotFoundException` if `userOrganizationId === undefined` (don't leak existence)
- [ ] Returns entity if `userOrganizationId === null` (SUPERUSER can read)
- [ ] Validates `entity.organizationId === userOrganizationId` for normal users
- [ ] Throws `NotFoundException` (not `ForbiddenException`) for cross-tenant access

**Example Pattern**:
```typescript
async findById(id: string, userOrganizationId: string | null | undefined) {
  const entity = await this.prisma.model.findUnique({ where: { id } });
  if (!entity) throw new NotFoundException();
  
  if (userOrganizationId === undefined) throw new NotFoundException();
  if (userOrganizationId === null) return entity; // SUPERUSER
  if (entity.organizationId !== userOrganizationId) {
    throw new NotFoundException(); // Don't leak existence
  }
  return entity;
}
```

---

### Mutation Methods (Create/Update/Delete)

- [ ] Calls `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` to block SUPERUSER
- [ ] Validates tenant match using `OkrTenantGuard.assertSameTenant()` if applicable
- [ ] Auto-injects tenant from context when appropriate
- [ ] Validates `organizationId` in data matches caller's tenant

**Example Pattern**:
```typescript
async create(data: CreateDto, userOrganizationId: string | null | undefined, actorUserId: string) {
  OkrTenantGuard.assertCanMutateTenant(userOrganizationId);
  
  if (data.organizationId) {
    OkrTenantGuard.assertSameTenant(data.organizationId, userOrganizationId);
  }
  
  // ... create logic
}
```

---

## Controller Layer Checklist

### Endpoints That Return Data

- [ ] Passes `req.user.organizationId` to service methods
- [ ] Uses `@TenantScoped()` decorator if applicable
- [ ] Validates tenant context before calling service

**Example Pattern**:
```typescript
@Get()
async getAll(@Req() req: any) {
  return this.service.findAll(req.user.organizationId);
}

@Get(':id')
@TenantScoped('id') // Optional: auto-validates tenant
async getById(@Param('id') id: string) {
  return this.service.findById(id, req.user.organizationId);
}
```

---

### Endpoints That Accept Resource IDs

- [ ] Validates resource belongs to caller's tenant
- [ ] Uses `@TenantScoped()` decorator OR manual validation
- [ ] Doesn't leak existence information (use `NotFoundException`)

**Example Pattern**:
```typescript
@Get(':id/members')
async getMembers(@Param('id') id: string, @Req() req: any) {
  OkrTenantGuard.assertSameTenant(id, req.user.organizationId);
  return this.service.getMembers(id);
}
```

---

## SUPERUSER Handling Checklist

- [ ] SUPERUSER (`null`) can READ all data
- [ ] SUPERUSER cannot WRITE (blocked by `assertCanMutateTenant`)
- [ ] SUPERUSER exception documented if mutations are allowed (e.g., user creation)
- [ ] SUPERUSER handling is explicit (not implicit)

---

## Common Anti-Patterns to Reject

### ❌ Reject These Patterns

1. **Missing tenant parameter**:
   ```typescript
   // ❌ REJECT
   async findAll() {
     return this.prisma.model.findMany();
   }
   ```

2. **Not filtering by tenant**:
   ```typescript
   // ❌ REJECT
   async findAll(userOrganizationId: string) {
     return this.prisma.model.findMany(); // Missing filter!
   }
   ```

3. **Not validating tenant in findById**:
   ```typescript
   // ❌ REJECT
   async findById(id: string) {
     return this.prisma.model.findUnique({ where: { id } });
   }
   ```

4. **Leaking existence information**:
   ```typescript
   // ❌ REJECT
   if (entity.organizationId !== userOrganizationId) {
     throw new ForbiddenException('Cannot access'); // Leaks existence!
   }
   ```

5. **Mixing null and undefined**:
   ```typescript
   // ❌ REJECT
   if (!userOrganizationId) {
     return []; // Blocks SUPERUSER!
   }
   ```

6. **Missing SUPERUSER read-only check**:
   ```typescript
   // ❌ REJECT
   async update(id: string, data: UpdateDto, userOrganizationId: string | null) {
     // Missing assertCanMutateTenant - allows SUPERUSER to write!
     return this.prisma.model.update({ where: { id }, data });
   }
   ```

---

## Testing Checklist

- [ ] **Test user with no org**: Returns empty/not found
- [ ] **Test SUPERUSER**: Can read all, cannot write
- [ ] **Test normal user**: Only sees their tenant data
- [ ] **Test cross-tenant access**: Throws `NotFoundException`
- [ ] **Test mutation operations**: SUPERUSER blocked, tenant validated

**Required Test Cases**:
```typescript
describe('Tenant Isolation', () => {
  it('user with no org returns empty');
  it('SUPERUSER can read all');
  it('normal user only sees their tenant');
  it('cross-tenant access blocked');
  it('SUPERUSER cannot mutate');
});
```

---

## Post-Review Actions

- [ ] **Verify audit script passes**: `npm run audit:tenant-isolation`
- [ ] **Run tests**: Ensure tenant isolation tests pass
- [ ] **Check for console.logs**: Remove any debug logging
- [ ] **Update documentation**: If new patterns are introduced

---

## Quick Decision Tree

```
Does the method query tenant-scoped data?
├─ YES → Does it filter by organizationId?
│   ├─ YES → ✅ Good
│   └─ NO → ❌ REJECT - Add tenant filtering
│
└─ NO → Does it validate tenant for mutations?
    ├─ YES → ✅ Good
    └─ NO → ❌ REJECT - Add tenant validation
```

---

## Questions to Ask

1. **"What happens if a user from Org A tries to access Org B's data?"**
   - Should return `NotFoundException` (not found, don't leak existence)

2. **"What happens if SUPERUSER tries to modify data?"**
   - Should throw `ForbiddenException` (read-only)

3. **"What happens if user has no organisation?"**
   - Should return empty array or `NotFoundException`

4. **"Are there any queries that bypass tenant filtering?"**
   - Should be flagged and reviewed

---

## Related Files

- `docs/developer/TENANT_ISOLATION_GUIDELINES.md` - Detailed implementation guide
- `scripts/audit-tenant-isolation.ts` - Automated audit script
- `services/core-api/src/modules/okr/tenant-guard.ts` - Tenant guard utility

---

## Approval Criteria

**✅ APPROVE** if:
- All checklist items are checked
- Tests cover tenant isolation scenarios
- Audit script passes
- No anti-patterns are present

**❌ REQUEST CHANGES** if:
- Missing tenant filtering or validation
- Tests don't cover tenant isolation
- Anti-patterns are present
- SUPERUSER handling is incorrect




