# ESLint Rules for Tenant Isolation

**Status**: Documentation Only (Custom Plugin Required for Full Implementation)

---

## Overview

This document describes ESLint rules that should be enforced to catch tenant isolation violations at lint time. Full implementation requires creating a custom ESLint plugin.

---

## Recommended Rules

### 1. `tenant-isolation/find-many-requires-tenant-filter`

**Rule**: `findMany()` calls on tenant-scoped models must include `organizationId` filter or use `OkrTenantGuard.buildTenantWhereClause()`.

**Example Violations**:
```typescript
// ❌ Violation
async findAll() {
  return this.prisma.objective.findMany();
}

// ✅ Correct
async findAll(userOrganizationId: string | null | undefined) {
  if (userOrganizationId === undefined) return [];
  return this.prisma.objective.findMany({
    where: { organizationId: userOrganizationId },
  });
}
```

---

### 2. `tenant-isolation/find-by-id-requires-tenant-validation`

**Rule**: `findById()` methods must validate tenant after lookup.

**Example Violations**:
```typescript
// ❌ Violation
async findById(id: string) {
  return this.prisma.objective.findUnique({ where: { id } });
}

// ✅ Correct
async findById(id: string, userOrganizationId: string | null | undefined) {
  const objective = await this.prisma.objective.findUnique({ where: { id } });
  if (!objective) throw new NotFoundException();
  if (userOrganizationId !== null && objective.organizationId !== userOrganizationId) {
    throw new NotFoundException();
  }
  return objective;
}
```

---

### 3. `tenant-isolation/controller-must-pass-organization-id`

**Rule**: Controller methods that call service `findAll()` or `findById()` must pass `req.user.organizationId`.

**Example Violations**:
```typescript
// ❌ Violation
@Get()
async getAll() {
  return this.service.findAll(); // Missing organizationId
}

// ✅ Correct
@Get()
async getAll(@Req() req: any) {
  return this.service.findAll(req.user.organizationId);
}
```

---

## Current Implementation

**Status**: Manual checks via audit script

Currently, tenant isolation is checked via:
- `npm run audit:tenant-isolation` - Automated script that scans codebase
- Code review checklist - Manual review process

**Future Enhancement**: Create custom ESLint plugin for real-time linting.

---

## Manual Checks (Until Plugin is Created)

### Using Audit Script

```bash
npm run audit:tenant-isolation
```

This will flag:
- `findMany()` calls without tenant filtering
- `findUnique()` calls without tenant validation
- Controllers missing tenant validation

### Using Code Review Checklist

See `docs/developer/TENANT_ISOLATION_CODE_REVIEW_CHECKLIST.md` for manual review checklist.

---

## Future: Custom ESLint Plugin

To implement these rules, create a custom ESLint plugin:

```typescript
// eslint-plugin-tenant-isolation/index.js
module.exports = {
  rules: {
    'find-many-requires-tenant-filter': {
      meta: {
        type: 'problem',
        docs: {
          description: 'findMany() must include tenant filter',
        },
      },
      create(context) {
        return {
          CallExpression(node) {
            if (node.callee.property?.name === 'findMany') {
              // Check if tenant filter is present
              // Flag if missing
            }
          },
        };
      },
    },
  },
};
```

---

## Related Documentation

- `docs/developer/TENANT_ISOLATION_GUIDELINES.md` - Implementation patterns
- `docs/developer/TENANT_ISOLATION_CODE_REVIEW_CHECKLIST.md` - Review checklist
- `scripts/audit-tenant-isolation.ts` - Audit script




