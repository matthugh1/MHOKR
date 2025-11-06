# Tenant Audit Map

**Generated**: 2025-01-XX  
**Purpose**: Comprehensive mapping of all tenant-related identifiers (`organizationId`, `organisationId`, `orgId`, `tenantId`, `tenant_id`) across the codebase.

---

## Summary Statistics

- **Total occurrences**: 1207+ references across source code
- **Database schema fields**: `organizationId` used in 6+ tables
- **Primary identifier**: `organizationId` (Prisma schema standard)
- **Alternative identifiers found**: `tenantId`, `orgId`, `organisationId`
- **Migration target**: Canonicalise to `tenantId` (with `organizationId` retained in DB schema for backward compatibility)

---

## Database Schema (`prisma/schema.prisma`)

### Tables with `organizationId` field:

1. **Workspace** (line 38)
   - Field: `organizationId: String` (NOT NULL)
   - Foreign key: `Organization.id` (CASCADE delete)
   - Index: `@@index([organizationId])`

2. **StrategicPillar** (line 137)
   - Field: `organizationId: String` (NOT NULL)
   - Foreign key: `Organization.id` (CASCADE delete)
   - Index: `@@index([organizationId])`

3. **Cycle** (line 158)
   - Field: `organizationId: String` (NOT NULL)
   - Foreign key: `Organization.id` (CASCADE delete)
   - Index: `@@index([organizationId])`

4. **Objective** (line 188)
   - Field: `organizationId: String?` (NULLABLE - legacy data)
   - Foreign key: `Organization.id` (CASCADE delete)
   - Index: `@@index([organizationId])`

5. **CheckInRequest** (line 462)
   - Field: `organizationId: String` (NOT NULL)
   - Foreign key: `Organization.id` (CASCADE delete)
   - Index: `@@index([organizationId])`

---

## Source Code References

### Controllers (`services/core-api/src/modules/*/`)

#### `modules/organization/organization.controller.ts`
- **Lines**: 18, 25, 32, 39, 46, 53, 59, 63, 72, 76, 87
- **Usage**: `req.user.organizationId` (11 occurrences)
- **Context**: All CRUD operations use `organizationId` from authenticated user

#### `modules/workspace/workspace.controller.ts`
- **Lines**: 17, 19, 35, 41, 42, 49, 56, 64, 76, 87, 93
- **Usage**: `req.user.organizationId`, `data.organizationId`, `@Param('organizationId')`
- **Context**: Tenant isolation checks, workspace hierarchy queries

#### `modules/okr/objective.controller.ts`
- **Lines**: 28, 45, 70, 81, 87, 98
- **Usage**: `req.user.organizationId` (6 occurrences)
- **Context**: Tenant-scoped queries, permission checks

#### `modules/okr/okr-cycle.controller.ts`
- **Lines**: 37, 43, 45, 61, 63, 81, 97, 99, 103, 120, 122, 126, 135, 137, 141, 154, 156, 160, 168, 172
- **Usage**: `req.user.organizationId` (20+ occurrences)
- **Context**: Cycle operations require tenant context

#### `modules/okr/key-result.controller.ts`
- **Lines**: Multiple references to `organizationId`
- **Context**: Key result CRUD operations

#### `modules/okr/initiative.controller.ts`
- **Lines**: References to `organizationId`
- **Context**: Initiative operations

---

### Services (`services/core-api/src/modules/*/`)

#### `modules/organization/organization.service.ts`
- **Pattern**: All service methods accept `organizationId: string | null | undefined`
- **Semantics**:
  - `null` = SUPERUSER (read-only access to all tenants)
  - `string` = Normal user (scoped to that tenant)
  - `undefined` = User with no tenant membership (no access)

#### `modules/okr/objective.service.ts`
- **Pattern**: Uses `organizationId` for tenant filtering in `findAll()`, `findById()`, `create()`, `update()`, `delete()`
- **Tenant isolation**: Implemented via `OkrTenantGuard.buildTenantWhereClause()`

#### `modules/okr/tenant-guard.ts`
- **Lines**: 41, 47, 61, 64, 71, 75, 89, 95, 110, 116, 120, 125, 134, 138
- **Pattern**: `buildTenantWhereClause(userOrganizationId)` returns Prisma where clause
- **Logic**: 
  - `null` → no filter (superuser)
  - `string` → filter by `organizationId`
  - `undefined` → return null (caller should return empty array)

---

### RBAC & Policy (`services/core-api/src/modules/rbac/`, `services/core-api/src/policy/`)

#### `modules/rbac/rbac.guard.ts`
- **Lines**: 65, 88, 132, 139, 147, 151, 152, 163, 164, 169, 172, 181, 183, 193, 194, 199, 202, 233, 234, 240, 258, 279, 287, 305, 309, 343-350, 356, 367, 374
- **Pattern**: Extracts `tenantId` from request (maps `organizationId` → `tenantId`)
- **Logic**: `extractResourceContextFromRequest()` normalises `organizationId` to `tenantId`

#### `modules/rbac/helpers.ts`
- **Lines**: 171-184
- **Function**: `extractTenantId(request: any): string`
- **Logic**: Checks `params.tenantId || params.organizationId || body.tenantId || body.organizationId || query.tenantId || ''`

#### `modules/rbac/types.ts`
- **Lines**: 95, 112, 153, 154, 198
- **Interface**: `Tenant`, `Workspace`, `OKREntity`, `ResourceContext`
- **Note**: `OKREntity` has both `organizationId` (primary) and `tenantId` (deprecated)

#### `policy/policy.controller.ts`
- **Lines**: 30, 46, 100, 105, 106, 108, 130, 131, 136, 142, 147, 167, 168, 176, 202, 203, 209, 215, 219, 239, 240, 248, 253, 279, 280, 282, 284, 298, 299, 339
- **Pattern**: Uses both `organizationId` and `tenantId` interchangeably
- **Context**: Policy decision endpoint resolves tenant from objective/workspace/team

#### `policy/tenant-boundary.ts`
- **Lines**: 23, 40, 60, 62, 63, 72, 81, 87
- **Pattern**: `assertMutation()` enforces tenant boundary checks
- **Logic**: Compares `userOrgId` vs `resourceContext.tenantId`

---

### Common Infrastructure (`services/core-api/src/common/`)

#### `common/tenant/tenant-context.service.ts`
- **Lines**: 18, 29, 34, 52, 71, 80
- **Interface**: `TenantContext { organizationId: string | null | undefined }`
- **Pattern**: Uses `organizationId` throughout (needs migration to `tenantId`)

#### `common/decorators/tenant-scoped.decorator.ts`
- **Lines**: 21, 28
- **Pattern**: Uses `userOrganizationId` from request user
- **Logic**: Validates tenant match via `OkrTenantGuard.assertSameTenant()`

---

### Authentication (`services/core-api/src/modules/auth/`)

#### `modules/auth/strategies/jwt.strategy.ts`
- **Lines**: 84, 88, 107, 108, 110, 118
- **Pattern**: Sets `organizationId` on user object from JWT
- **Logic**: 
  - Superuser → `organizationId: null`
  - Normal user → `organizationId: orgAssignment?.scopeId || undefined`
- **Note**: Uses `RoleAssignment.scopeId` where `scopeType = 'TENANT'`

---

## Naming Drift Analysis

### Primary Identifier: `organizationId`
- **Used in**: Database schema, Prisma queries, service methods, controllers
- **Status**: ✅ Standard (but needs canonicalisation to `tenantId`)

### Alternative Identifier: `tenantId`
- **Used in**: RBAC types, policy controller, resource context
- **Status**: ⚠️ Inconsistent - sometimes used as alias for `organizationId`

### Alternative Identifier: `orgId`
- **Used in**: Prisma factories (`prisma/factories/okrs.ts`, `prisma/factories/cycles.ts`)
- **Status**: ⚠️ Internal factory parameter (not exposed in API)

### Alternative Identifier: `organisationId` (British spelling)
- **Used in**: Minimal (none found in core-api)
- **Status**: ✅ Not used (good - avoids confusion)

### Alternative Identifier: `tenant_id` (snake_case)
- **Used in**: None found
- **Status**: ✅ Not used (good - consistent camelCase)

---

## Migration Targets

### Phase 1: Runtime Guardrails
- [ ] Create `tenant-context.middleware.ts` that normalises `organizationId` → `tenantId`
- [ ] Create `tenant-mutation.guard.ts` that enforces tenant boundary checks
- [ ] Update DTOs to accept both `organizationId` and `tenantId` (with deprecation warning)

### Phase 2: Data Backfill
- [ ] Add `tenant_id` column to all domain tables (or backfill `organizationId` NULLs)
- [ ] Add NOT NULL constraints
- [ ] Add foreign keys to `organizations.id`

### Phase 3: Static Analysis
- [ ] ESLint rule to flag `organizationId` usage (except DTO mappers)
- [ ] Type alias: `export type OrganizationId = never`
- [ ] Codemod: rename `organizationId` → `tenantId` in core modules

---

## Files Requiring Updates

### High Priority (Core Infrastructure)
1. `services/core-api/src/common/tenant/tenant-context.service.ts` - Migrate to `tenantId`
2. `services/core-api/src/modules/rbac/rbac.guard.ts` - Already uses `tenantId` (good)
3. `services/core-api/src/modules/rbac/types.ts` - Update interfaces
4. `services/core-api/src/modules/auth/strategies/jwt.strategy.ts` - Add `tenantId` alias

### Medium Priority (Services)
5. `services/core-api/src/modules/organization/organization.service.ts`
6. `services/core-api/src/modules/workspace/workspace.service.ts`
7. `services/core-api/src/modules/okr/objective.service.ts`
8. `services/core-api/src/modules/okr/key-result.service.ts`
9. `services/core-api/src/modules/okr/okr-cycle.service.ts`

### Low Priority (Controllers - mostly pass-through)
10. All controller files (update to use `req.tenantId` from middleware)

---

## Notes

- **Database schema**: Keep `organizationId` column name (no migration needed)
- **Application layer**: Migrate to `tenantId` for clarity
- **Backward compatibility**: Accept `organizationId` in DTOs with deprecation warning
- **Type safety**: Add branded `TenantId` type after migration

