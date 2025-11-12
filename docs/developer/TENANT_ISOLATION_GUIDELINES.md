# Tenant Isolation Developer Guidelines

**Last Updated**: 2025-11-03  
**Status**: Active Guidelines

---

## Overview

This document provides comprehensive guidelines for implementing tenant isolation in the OKR Framework. All developers must follow these patterns to ensure data security and prevent cross-tenant data leakage.

---

## Core Principles

### 1. Tenant Context Semantics

The `organizationId` field has three distinct states:

- **`null`** → SUPERUSER (can READ all organisations; cannot write)
- **`<string>`** → Normal user (can read/write only within that organisation)
- **`undefined`** → User with no organisation membership (cannot read or write tenant data)

**Critical**: `null` and `undefined` are NOT the same. Always handle them separately.

### 2. Defense-in-Depth

Tenant isolation is enforced at **three layers**:

1. **Application Layer** - Service methods validate tenant context
2. **Prisma Middleware** - Automatic query filtering
3. **PostgreSQL RLS** - Database-level policies

**Never rely on a single layer** - always validate at the application layer even though middleware and RLS provide protection.

---

## Implementation Patterns

### Pattern 1: `findAll()` Methods

**Always** filter by tenant context:

```typescript
async findAll(userOrganizationId: string | null | undefined) {
  // User with no organisation - return empty
  if (userOrganizationId === undefined || userOrganizationId === '') {
    return [];
  }

  // SUPERUSER - can see all (read-only)
  if (userOrganizationId === null) {
    return this.prisma.model.findMany({
      // ... include relations, orderBy, etc.
    });
  }

  // Normal user - filter by tenant
  return this.prisma.model.findMany({
    where: {
      organizationId: userOrganizationId,
    },
    // ... include relations, orderBy, etc.
  });
}
```

**Key Points**:
- ✅ Always check `undefined` first (user has no org)
- ✅ Handle `null` separately (SUPERUSER)
- ✅ Filter by `organizationId` for normal users
- ✅ Use `OkrTenantGuard.buildTenantWhereClause()` if available

---

### Pattern 2: `findById()` Methods

**Always** validate tenant after lookup:

```typescript
async findById(id: string, userOrganizationId: string | null | undefined) {
  const entity = await this.prisma.model.findUnique({
    where: { id },
    // ... include relations
  });

  if (!entity) {
    throw new NotFoundException(`Entity with ID ${id} not found`);
  }

  // User with no organisation - cannot access
  if (userOrganizationId === undefined || userOrganizationId === '') {
    throw new NotFoundException(`Entity with ID ${id} not found`);
  }

  // SUPERUSER - can see any (read-only)
  if (userOrganizationId === null) {
    return entity;
  }

  // Normal user - verify tenant match
  if (entity.organizationId !== userOrganizationId) {
    // Don't leak existence - return not found
    throw new NotFoundException(`Entity with ID ${id} not found`);
  }

  return entity;
}
```

**Key Points**:
- ✅ Lookup first, then validate tenant
- ✅ Don't leak existence - use `NotFoundException` for cross-tenant access
- ✅ SUPERUSER can read but not modify (enforced at service layer)

---

### Pattern 3: Controller Endpoints

**Always** pass tenant context to services:

```typescript
@Get()
@RequireAction('view_okr')
async getAll(@Req() req: any) {
  return this.service.findAll(req.user.organizationId);
}

@Get(':id')
@RequireAction('view_okr')
async getById(@Param('id') id: string, @Req() req: any) {
  return this.service.findById(id, req.user.organizationId);
}
```

**Optional**: Use `@TenantScoped()` decorator for automatic validation:

```typescript
@Get(':id')
@TenantScoped('id')
async getById(@Param('id') id: string) {
  // Tenant already validated by decorator
  return this.service.findById(id);
}
```

---

### Pattern 4: Mutation Operations (Create/Update/Delete)

**Always** validate tenant context before mutations:

```typescript
async create(data: CreateDto, userOrganizationId: string | null | undefined, actorUserId: string) {
  // SUPERUSER cannot mutate (read-only)
  OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

  // Validate tenant match
  if (data.organizationId) {
    OkrTenantGuard.assertSameTenant(data.organizationId, userOrganizationId);
  }

  // Auto-inject tenant if not provided
  const tenantId = data.organizationId || userOrganizationId;
  if (!tenantId) {
    throw new ForbiddenException('No tenant context available');
  }

  // Create with tenant context
  return this.prisma.model.create({
    data: {
      ...data,
      organizationId: tenantId,
    },
  });
}
```

**Key Points**:
- ✅ Use `OkrTenantGuard.assertCanMutateTenant()` to block SUPERUSER
- ✅ Use `OkrTenantGuard.assertSameTenant()` to verify tenant match
- ✅ Auto-inject tenant from context when appropriate

---

## Using `OkrTenantGuard`

The `OkrTenantGuard` utility provides helper methods for tenant isolation:

### `buildTenantWhereClause(userOrganizationId)`

Builds Prisma `where` clause for tenant filtering:

```typescript
const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
if (orgFilter === null && userOrganizationId !== null) {
  // User has no org - return empty
  return [];
}
const where = orgFilter ? { ...orgFilter, ...otherFilters } : { ...otherFilters };
```

### `assertCanMutateTenant(userOrganizationId)`

Throws `ForbiddenException` if user cannot mutate (SUPERUSER or no org):

```typescript
// Blocks SUPERUSER and users with no org
OkrTenantGuard.assertCanMutateTenant(userOrganizationId);
```

### `assertSameTenant(orgId1, orgId2)`

Throws `ForbiddenException` if organisations don't match:

```typescript
// Validates orgId1 matches orgId2 (or orgId2 is null for SUPERUSER)
OkrTenantGuard.assertSameTenant(resourceOrgId, userOrganizationId);
```

---

## SUPERUSER Handling

### SUPERUSER Rules

- ✅ **Can READ** all data across all tenants
- ❌ **Cannot WRITE** (create, update, delete) - read-only
- ✅ **Can CREATE users** (special exception for user management)
- ❌ **Cannot access** tenant-scoped endpoints without tenant context

### Implementation

```typescript
// In service methods
if (userOrganizationId === null) {
  // SUPERUSER: read-only access
  // Return all data (no filter)
  // But block mutations
  return this.prisma.model.findMany({ ... });
}

// In mutation methods
OkrTenantGuard.assertCanMutateTenant(userOrganizationId);
// This will throw ForbiddenException if userOrganizationId === null
```

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Not Filtering `findAll()`

```typescript
// ❌ WRONG - Returns all data across all tenants
async findAll() {
  return this.prisma.objective.findMany();
}

// ✅ CORRECT - Filters by tenant
async findAll(userOrganizationId: string | null | undefined) {
  if (userOrganizationId === undefined) return [];
  if (userOrganizationId === null) {
    return this.prisma.objective.findMany(); // SUPERUSER can see all
  }
  return this.prisma.objective.findMany({
    where: { organizationId: userOrganizationId },
  });
}
```

### ❌ Mistake 2: Not Validating `findById()`

```typescript
// ❌ WRONG - No tenant validation
async findById(id: string) {
  return this.prisma.objective.findUnique({ where: { id } });
}

// ✅ CORRECT - Validates tenant
async findById(id: string, userOrganizationId: string | null | undefined) {
  const objective = await this.prisma.objective.findUnique({ where: { id } });
  if (!objective) throw new NotFoundException();
  
  if (userOrganizationId === undefined) throw new NotFoundException();
  if (userOrganizationId !== null && objective.organizationId !== userOrganizationId) {
    throw new NotFoundException(); // Don't leak existence
  }
  return objective;
}
```

### ❌ Mistake 3: Mixing Up `null` and `undefined`

```typescript
// ❌ WRONG - Treats null and undefined the same
if (!userOrganizationId) {
  return []; // This blocks SUPERUSER!
}

// ✅ CORRECT - Handles separately
if (userOrganizationId === undefined || userOrganizationId === '') {
  return []; // User has no org
}
if (userOrganizationId === null) {
  // SUPERUSER - can see all
  return this.prisma.model.findMany();
}
```

### ❌ Mistake 4: Leaking Existence Information

```typescript
// ❌ WRONG - Leaks that entity exists in different tenant
if (entity.organizationId !== userOrganizationId) {
  throw new ForbiddenException('You cannot access this resource');
  // This tells the user the resource exists!
}

// ✅ CORRECT - Returns not found (don't leak existence)
if (entity.organizationId !== userOrganizationId) {
  throw new NotFoundException(`Entity with ID ${id} not found`);
}
```

---

## Testing Tenant Isolation

### Test Scenarios

Always test these scenarios:

```typescript
describe('Tenant Isolation', () => {
  it('should return empty array for user with no organisation', async () => {
    const result = await service.findAll(undefined);
    expect(result).toEqual([]);
  });

  it('should return all data for SUPERUSER (read-only)', async () => {
    const result = await service.findAll(null);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should return only tenant data for normal user', async () => {
    const result = await service.findAll('org-a');
    expect(result.every(r => r.organizationId === 'org-a')).toBe(true);
  });

  it('should prevent cross-tenant access', async () => {
    await expect(
      service.findById('entity-from-org-b', 'org-a')
    ).rejects.toThrow(NotFoundException);
  });

  it('should allow SUPERUSER to read cross-tenant data', async () => {
    const result = await service.findById('entity-from-org-b', null);
    expect(result).toBeDefined();
  });
});
```

---

## Helper Utilities

### `withTenantContext()`

Use `withTenantContext()` to set tenant context for Prisma middleware:

```typescript
import { withTenantContext } from '../../common/prisma/tenant-isolation.middleware';

// In guard or interceptor
return withTenantContext(user.organizationId, async () => {
  // All Prisma queries in this scope will have tenant context
  return this.service.findAll();
});
```

### `@TenantScoped()` Decorator

Use `@TenantScoped()` to automatically validate tenant in controllers:

```typescript
import { TenantScoped } from '../../common/decorators/tenant-scoped.decorator';

@Get(':id')
@TenantScoped('id')
async getById(@Param('id') id: string) {
  // Tenant already validated
  return this.service.findById(id);
}
```

---

## Code Review Checklist

When reviewing code for tenant isolation, check:

- [ ] **`findAll()` methods**: Filter by `organizationId` for normal users
- [ ] **`findById()` methods**: Validate tenant after lookup
- [ ] **Controllers**: Pass `req.user.organizationId` to services
- [ ] **SUPERUSER handling**: Correctly handle `null` (read-only)
- [ ] **No org handling**: Return empty/not found for `undefined`
- [ ] **Mutation operations**: Use `OkrTenantGuard.assertCanMutateTenant()`
- [ ] **Cross-tenant validation**: Use `OkrTenantGuard.assertSameTenant()`
- [ ] **No information leakage**: Use `NotFoundException` for cross-tenant access
- [ ] **Tests**: Include tenant isolation test scenarios
- [ ] **Tenant context**: Set via `withTenantContext()` in guards

---

## Quick Reference

### When to Use What

| Scenario | Solution |
|----------|----------|
| Filter `findMany()` queries | `OkrTenantGuard.buildTenantWhereClause()` or manual filter |
| Validate tenant in `findById()` | Check `entity.organizationId === userOrganizationId` |
| Block SUPERUSER mutations | `OkrTenantGuard.assertCanMutateTenant()` |
| Validate tenant match | `OkrTenantGuard.assertSameTenant()` |
| Set tenant context for middleware | `withTenantContext(orgId, fn)` |
| Auto-validate in controllers | `@TenantScoped('paramName')` |

---

## Examples

### Complete Service Example

```typescript
@Injectable()
export class ExampleService {
  constructor(private prisma: PrismaService) {}

  async findAll(userOrganizationId: string | null | undefined) {
    if (userOrganizationId === undefined) return [];
    
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    if (orgFilter === null && userOrganizationId !== null) {
      return [];
    }

    return this.prisma.example.findMany({
      where: orgFilter ? { ...orgFilter } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, userOrganizationId: string | null | undefined) {
    const entity = await this.prisma.example.findUnique({ where: { id } });
    if (!entity) throw new NotFoundException();

    if (userOrganizationId === undefined) {
      throw new NotFoundException();
    }
    if (userOrganizationId === null) {
      return entity; // SUPERUSER
    }
    if (entity.organizationId !== userOrganizationId) {
      throw new NotFoundException();
    }
    return entity;
  }

  async create(data: CreateDto, userOrganizationId: string | null | undefined, actorUserId: string) {
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);
    OkrTenantGuard.assertSameTenant(data.organizationId, userOrganizationId);

    return this.prisma.example.create({
      data: {
        ...data,
        organizationId: data.organizationId || userOrganizationId!,
      },
    });
  }
}
```

---

## Questions?

If you're unsure about tenant isolation:
1. Check this document first
2. Review existing service implementations (e.g., `OrganizationService`, `WorkspaceService`)
3. Run the audit script: `npm run audit:tenant-isolation`
4. Ask for code review

---

## Related Documentation

- `docs/audit/TENANT_ISOLATION_AUDIT_REPORT.md` - Security audit findings
- `docs/audit/TENANT_ISOLATION_RECOMMENDATIONS.md` - Implementation recommendations
- `docs/audit/RLS_IMPLEMENTATION_GUIDE.md` - PostgreSQL RLS documentation
- `services/core-api/src/modules/okr/tenant-guard.ts` - `OkrTenantGuard` source code




