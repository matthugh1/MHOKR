# Tenant Naming Drift Analysis

**Generated**: 2025-01-XX  
**Purpose**: Identify all locations where `organization`, `organisation`, or `org` terminology is used instead of `tenant`.

---

## Executive Summary

The codebase uses **`organizationId`** as the primary identifier throughout, with `tenantId` appearing inconsistently in RBAC and policy layers. This creates confusion between:
- **Organization** (the entity/concept)
- **Tenant** (the canonical term for multi-tenancy)

**Canonical term**: `tenant` / `tenantId`  
**Legacy term**: `organization` / `organizationId` (retained in DB schema)

---

## Terminology Usage

### Database Schema (`prisma/schema.prisma`)

| Table | Field Name | Status | Notes |
|-------|-----------|--------|-------|
| `organizations` | Table name | ⚠️ Legacy | Consider renaming to `tenants` (or keep as-is for backward compatibility) |
| `workspaces` | `organizationId` | ⚠️ Legacy | FK to `organizations.id` |
| `strategic_pillars` | `organizationId` | ⚠️ Legacy | FK to `organizations.id` |
| `cycles` | `organizationId` | ⚠️ Legacy | FK to `organizations.id` |
| `objectives` | `organizationId` | ⚠️ Legacy | FK to `organizations.id` (nullable) |
| `check_in_requests` | `organizationId` | ⚠️ Legacy | FK to `organizations.id` |

**Recommendation**: Keep `organizationId` in database schema (no migration needed). Add `tenantId` computed column or application-level alias.

---

## Source Code Naming Drift

### Controllers

#### `modules/organization/organization.controller.ts`
- **Route**: `/organizations`
- **Parameter**: `@Param('id') organizationId`
- **Context**: Route uses `organizations` (plural)
- **Action**: Keep route as-is (backward compatibility). Internally use `tenantId`.

#### `modules/workspace/workspace.controller.ts`
- **Line 17**: `@Query('organizationId') organizationId?: string`
- **Line 41**: `@Body() data: { ... organizationId: string }`
- **Line 90**: `@Param('organizationId') organizationId: string`
- **Context**: Accepts `organizationId` in queries/body/params
- **Action**: Accept both `organizationId` and `tenantId` (with deprecation warning).

#### `modules/okr/okr-cycle.controller.ts`
- **Pattern**: Uses `req.user.organizationId` throughout
- **Context**: All cycle operations require tenant context
- **Action**: Migrate to `req.tenantId` after middleware is added.

---

### Services

#### `modules/organization/organization.service.ts`
- **Method signatures**: `organizationId: string | null | undefined`
- **Context**: Core tenant service (should be renamed to `tenant.service.ts`)
- **Action**: 
  - Option 1: Keep service name as-is (backward compatibility)
  - Option 2: Rename to `tenant.service.ts` (breaking change)

#### `modules/okr/tenant-guard.ts`
- **File name**: ✅ Uses `tenant` terminology
- **Methods**: `buildTenantWhereClause(userOrganizationId)` - parameter name uses `organizationId`
- **Action**: Update parameter name to `userTenantId` (or keep as-is for compatibility).

---

### RBAC & Policy

#### `modules/rbac/types.ts`
- **Line 95**: `export interface Tenant { ... }` ✅ Uses `Tenant`
- **Line 112**: `tenantId: string` ✅ Uses `tenantId`
- **Line 153**: `organizationId: string` ⚠️ Legacy field
- **Line 154**: `tenantId: string` ✅ New field (deprecated comment)
- **Context**: Dual naming in `OKREntity` interface
- **Action**: Remove `organizationId` from interface, keep only `tenantId`.

#### `modules/rbac/rbac.guard.ts`
- **Pattern**: Extracts `tenantId` from request (normalises `organizationId` → `tenantId`)
- **Line 343-350**: Checks both `params.tenantId` and `params.organizationId`
- **Action**: ✅ Already handles both (good pattern for migration).

#### `modules/rbac/helpers.ts`
- **Function**: `extractTenantId(request: any): string`
- **Logic**: Checks `params.tenantId || params.organizationId || body.tenantId || body.organizationId`
- **Action**: ✅ Already handles both (good pattern).

#### `policy/policy.controller.ts`
- **Pattern**: Uses both `organizationId` and `tenantId` interchangeably
- **Line 130**: `let tenantId = objective.organizationId` (maps org → tenant)
- **Line 167**: `organizationId: tenantId, tenantId: tenantId` (dual assignment)
- **Action**: Migrate to use only `tenantId`.

#### `policy/tenant-boundary.ts`
- **File name**: ✅ Uses `tenant` terminology
- **Pattern**: Uses `userOrgId` and `resourceContext.tenantId`
- **Action**: Migrate `userOrgId` → `userTenantId`.

---

### Common Infrastructure

#### `common/tenant/tenant-context.service.ts`
- **File name**: ✅ Uses `tenant` terminology
- **Interface**: `TenantContext { organizationId: ... }` ⚠️ Uses `organizationId`
- **Action**: Update interface to use `tenantId`.

#### `common/decorators/tenant-scoped.decorator.ts`
- **File name**: ✅ Uses `tenant` terminology
- **Pattern**: Uses `userOrganizationId` from request
- **Action**: Update to use `userTenantId`.

---

### Authentication

#### `modules/auth/strategies/jwt.strategy.ts`
- **Line 84**: `organizationId: null` (superuser)
- **Line 88**: `organizationId: orgAssignment?.scopeId`
- **Line 107-115**: Comments explain `organizationId` semantics
- **Action**: Add `tenantId` alias alongside `organizationId` (deprecation period).

---

## API Endpoints

### Routes Using `organization` Terminology

| Route | Method | Status | Action |
|-------|--------|--------|--------|
| `/organizations` | GET, POST | ⚠️ Legacy | Keep route name (backward compatibility) |
| `/organizations/:id` | GET, PATCH, DELETE | ⚠️ Legacy | Keep route name |
| `/organizations/:id/members` | GET, POST, DELETE | ⚠️ Legacy | Keep route name |
| `/workspaces/hierarchy/:organizationId` | GET | ⚠️ Legacy | Accept both `organizationId` and `tenantId` |
| `/superuser/organizations` | GET, POST | ⚠️ Legacy | Keep route name (admin endpoint) |

**Recommendation**: Keep route names as-is for backward compatibility. Accept both `organizationId` and `tenantId` in query/body parameters (with deprecation warning).

---

## DTOs & Request Bodies

### Expected DTO Updates

#### `CreateWorkspaceDto`
- **Current**: `{ name: string; organizationId: string; ... }`
- **Action**: Accept both `organizationId` and `tenantId` (map to `tenantId` internally).

#### `CreateObjectiveDto`
- **Current**: May include `organizationId` (optional)
- **Action**: Accept both `organizationId` and `tenantId`.

#### `CreateCycleDto`
- **Current**: May include `organizationId` (optional)
- **Action**: Accept both `organizationId` and `tenantId`.

---

## Migration Strategy

### Phase 1: Runtime Guardrails
- ✅ Accept both `organizationId` and `tenantId` in DTOs (with deprecation warning)
- ✅ Normalise `organizationId` → `tenantId` in middleware
- ✅ Attach `req.tenantId` to all requests

### Phase 2: Data Backfill
- ✅ Keep `organizationId` column in database (no schema change)
- ✅ Backfill NULL `organizationId` values

### Phase 3: Static Analysis
- ✅ ESLint rule flags `organizationId` usage (except DTO mappers)
- ✅ Type alias: `export type OrganizationId = never`
- ✅ Codemod: rename `organizationId` → `tenantId` in core modules

### Phase 4: Documentation
- ✅ Update API docs to use `tenantId` terminology
- ✅ Add deprecation notices for `organizationId` parameters
- ✅ Create migration guide for API consumers

---

## Summary

**Total files with naming drift**: ~30+ files  
**Critical files**: 10 (controllers, services, RBAC)  
**Low priority**: 20+ (DTOs, factories, tests)

**Action Plan**:
1. ✅ Create middleware to normalise `organizationId` → `tenantId`
2. ✅ Update DTOs to accept both (with deprecation warning)
3. ✅ Migrate core services to use `tenantId` internally
4. ✅ Keep database schema as-is (`organizationId` column)
5. ✅ Add ESLint rules to prevent new `organizationId` usage

