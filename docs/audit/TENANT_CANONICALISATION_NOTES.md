# Tenant Canonicalisation Notes

**Generated**: 2025-01-06  
**Status**: Complete  
**Purpose**: Documentation for tenant canonicalisation implementation

---

## Overview

This document describes the tenant canonicalisation effort that eliminates confusion between "organisation/org" and "tenant" terminology. The canonical term is **tenant** (with `tenantId` as the identifier).

---

## Canonical Term

**Tenant** is the canonical term for multi-tenancy.  
**Tenant ID** (`tenantId`) is the canonical identifier.

**Database schema** retains `organizationId` column name for backward compatibility (no migration needed).

---

## Accepted Input Aliases

During the grace period, the following aliases are accepted and automatically normalised:

- `organizationId` → `tenantId`
- `organisationId` → `tenantId` (British spelling, not used)
- `orgId` → `tenantId` (internal only)

**Deprecation warning**: A one-time deprecation warning is logged when `organizationId` is detected in requests.

---

## Runtime Guardrails

### Tenant Context Middleware

**File**: `services/core-api/src/common/tenant/tenant-context.middleware.ts`

**Responsibilities**:
- Resolves `tenantId` from multiple sources (JWT, header, subdomain, session)
- Normalises `organizationId` → `tenantId` in request body/params/query
- Attaches `req.tenantId` to all requests
- Logs org→tenant mapping for telemetry

**Resolution order**:
1. JWT claims (`user.tenantId` or `user.organizationId`)
2. Header `x-tenant-id`
3. Subdomain (e.g., `tenant.example.com`)
4. Session (if applicable)

### Tenant Mutation Guard

**File**: `services/core-api/src/common/tenant/tenant-mutation.guard.ts`

**Responsibilities**:
- Enforces tenant boundary checks for all mutation operations (POST/PUT/PATCH/DELETE)
- Validates `req.tenantId` is present
- Ensures payload `tenantId` matches request `tenantId`
- Normalises `organizationId` → `tenantId` before comparison

**Errors**:
- `TENANT_CONTEXT_MISSING` (403): Tenant context not found
- `TENANT_BOUNDARY` (403): Cross-tenant mutation attempt

### Service Entry Check

**File**: `services/core-api/src/policy/tenant-boundary.ts`

**Function**: `assertMutationBoundary(userCtx, resourceCtx)`

**Usage**: Call at the TOP of every mutating service method:

```typescript
import { assertMutationBoundary } from '../../policy/tenant-boundary';

async create(data: CreateDto, userTenantId: string) {
  assertMutationBoundary(userTenantId, data.tenantId);
  // ... rest of method
}
```

### DTO Normaliser Pipe

**File**: `services/core-api/src/common/tenant/organization-to-tenant.pipe.ts`

**Usage**: Apply to DTOs that accept `organizationId`:

```typescript
@UsePipes(OrganizationToTenantPipe)
async create(@Body() dto: CreateDto) { ... }
```

---

## Telemetry

### Metrics

- `rbac_missing_tenant_context_total`: Incremented when tenant context is missing (400 error)
- `org_to_tenant_mapping`: Logged when `organizationId` is normalised to `tenantId`

### Log Samples

```
[Telemetry] org_to_tenant_mapping {
  path: '/objectives',
  method: 'POST',
  mappedFrom: 'organizationId',
  mappedTo: 'tenantId',
  tenantId: 'tenant-123'
}
```

---

## Data Backfill

### Migration

**File**: `prisma/migrations/20250106_tenant_not_null_guard/migration.sql`

**Strategy**:
1. Backfill NULL `organizationId` via parent relationships:
   - Objectives → Cycles
   - Objectives → Workspaces
   - Objectives → Teams → Workspaces
2. Quarantine irreconcilable rows into `TENANT_QUARANTINE`
3. Add NOT NULL constraints
4. Add foreign keys with ON DELETE RESTRICT

### Quarantine Process

Rows assigned to `tenant_quarantine_0000000000000000000000` should be reviewed and either:
- Assigned to a real tenant
- Deleted if obsolete

---

## Static & CI Guardrails

### ESLint Rules

**Rule**: `local-tenant/no-org-identifier`
- Flags `organizationId`, `organisationId`, `orgId` usage
- Exceptions: DTOs, tests, migrations, seed files

**Rule**: `local-tenant/no-unguarded-mutations`
- Ensures mutations have `TenantMutationGuard`
- Works alongside `RBACGuard` and `@RequireAction`

### Type Aliases

**File**: `services/core-api/src/modules/rbac/types.ts`

```typescript
export type OrganizationId = never; // Force compile-time errors
export type TenantId = string; // Canonical type
```

---

## Rollback Notes

### Runtime Guardrails

1. Remove `TenantContextMiddleware` from `app.module.ts`
2. Remove `TenantMutationGuard` from `APP_GUARD` providers
3. Remove `OrganizationToTenantPipe` usage

### Data Backfill

```sql
-- Remove NOT NULL constraint
ALTER TABLE objectives ALTER COLUMN "organizationId" DROP NOT NULL;

-- Remove quarantine assignments
UPDATE objectives
SET "organizationId" = NULL
WHERE "organizationId" = 'tenant_quarantine_0000000000000000000000';

-- Delete quarantine organization
DELETE FROM organizations
WHERE id = 'tenant_quarantine_0000000000000000000000';
```

### Static Analysis

- Remove ESLint rules from `.eslintrc.custom-rules.js`
- Remove type aliases from `types.ts`

---

## Migration Guide for API Consumers

### Before

```typescript
POST /objectives
{
  "organizationId": "tenant-123",
  "title": "My Objective"
}
```

### After

```typescript
POST /objectives
{
  "tenantId": "tenant-123",  // Preferred
  "title": "My Objective"
}
```

**Note**: `organizationId` is still accepted during grace period (with deprecation warning).

---

## Safety & Identity

- **Idempotent**: Re-running creates no duplicates; guards don't double-apply
- **No business rules changed**: Only enforcing presence/equality of tenant
- **No DB fetches in middleware/guard**: Compare IDs only (no performance impact)

---

## Testing

Run acceptance tests:

```bash
npm test -- tenant-context.middleware.spec.ts
npm test -- tenant-mutation.guard.spec.ts
npm test -- tenant-backfill.spec.ts
```

---

## References

- `docs/audit/TENANT_AUDIT_MAP.md` - Comprehensive audit of tenant identifiers
- `docs/audit/TENANT_NAMING_DRIFT.md` - Naming drift analysis
- `docs/audit/TENANT_NULL_SURVEY.sql` - SQL queries for NULL tenant_id
- `docs/audit/TENANT_BACKFILL_REPORT.md` - Backfill statistics

