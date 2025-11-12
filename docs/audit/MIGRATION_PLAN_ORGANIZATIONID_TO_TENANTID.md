# Complete Migration Plan: organizationId → tenantId

**Goal**: By end of sprint, use ONLY `tenantId` throughout the entire application  
**Scope**: Database schema, Prisma models, application code, APIs, tests  
**Timeline**: Single sprint

---

## Current State

- **organizationId**: 829 occurrences across 89 files
- **tenantId**: 540 occurrences across 42 files
- **Dual naming**: Both exist in many places

---

## Target State

- **Database**: `tenantId` columns (not `organizationId`)
- **Prisma Schema**: `tenantId` fields (not `organizationId`)
- **Application Code**: `tenantId` only (no `organizationId` references)
- **API Contracts**: `tenantId` only (no `organizationId`)
- **Normalization Code**: REMOVED (no longer needed)

---

## Migration Steps

### Phase 1: Update Prisma Schema

**File**: `services/core-api/prisma/schema.prisma`

**Changes**:
- Rename `organizationId` → `tenantId` in all models:
  - `Workspace.organizationId` → `tenantId`
  - `StrategicPillar.organizationId` → `tenantId`
  - `Cycle.organizationId` → `tenantId`
  - `Objective.organizationId` → `tenantId`
  - `CheckInRequest.organizationId` → `tenantId`
- Update relation names: `organization` → `tenant`
- Update indexes: `@@index([organizationId])` → `@@index([tenantId])`
- Keep `Organization` model name (it's the business entity, but FK uses `tenantId`)

**Note**: Keep `Organization` model/table name (business concept), but all FK columns become `tenantId`

---

### Phase 2: Generate Database Migration

**Command**: `npx prisma migrate dev --name rename_organizationId_to_tenantId`

**Migration will**:
- Rename columns: `ALTER TABLE ... RENAME COLUMN "organizationId" TO "tenantId"`
- Rename indexes: `RENAME INDEX ... TO ...`
- Rename foreign keys: `ALTER TABLE ... RENAME CONSTRAINT ...`

**Backup**: Create database backup before running migration

---

### Phase 3: Update Application Code (Mass Replace)

**Strategy**: Find and replace `organizationId` → `tenantId` in all TypeScript files

**Files to update** (89 files):
- Controllers: Use `req.user.tenantId` instead of `req.user.organizationId`
- Services: Use `tenantId` parameter instead of `organizationId`
- Guards: Use `tenantId` consistently
- Types: Remove `organizationId` from interfaces, keep only `tenantId`

**Patterns to replace**:
- `organizationId` → `tenantId`
- `organizationId:` → `tenantId:`
- `.organizationId` → `.tenantId`
- `userOrganizationId` → `userTenantId` (or keep as `tenantId`)

**Exceptions**:
- Comments mentioning "organization" (business concept) - OK to keep
- `Organization` model/table name - keep as-is
- Variable names like `organization` (business entity) - keep as-is

---

### Phase 4: Remove Normalization Code

**Files to delete/modify**:
- `services/core-api/src/common/tenant/organization-to-tenant.pipe.ts` - DELETE (no longer needed)
- `services/core-api/src/common/tenant/tenant-context.middleware.ts` - Remove normalization logic
- `services/core-api/src/common/tenant/tenant-mutation.guard.ts` - Remove `organizationId` fallback

**Update**:
- Middleware: Only resolve `tenantId`, don't normalize `organizationId`
- Guard: Only check `tenantId`, remove `organizationId` checks

---

### Phase 5: Update API Contracts

**Remove**:
- `organizationId` from all DTOs
- `organizationId` from request/response types
- `organizationId` from OpenAPI/Swagger docs

**Keep**:
- `tenantId` only in all API contracts

---

### Phase 6: Update Tests

**Replace**:
- `organizationId` → `tenantId` in all test files
- Update test data fixtures
- Update test assertions

---

### Phase 7: Update ESLint Rules

**File**: `services/core-api/.eslintrc.custom-rules.js`

**Remove**:
- `no-org-identifier` rule (no longer needed if we eliminate `organizationId`)

**Keep**:
- `no-unguarded-mutations` rule

---

### Phase 8: Update Documentation

**Files to update**:
- Remove references to `organizationId` in docs
- Update API documentation
- Update migration guides

---

## Critical Considerations

### 1. Database Migration Safety

**Before migration**:
```sql
-- Backup check
SELECT COUNT(*) FROM objectives WHERE "organizationId" IS NULL;
-- Should be 0 (from previous migration)
```

**After migration**:
```sql
-- Verify all columns renamed
SELECT column_name FROM information_schema.columns 
WHERE table_name IN ('workspaces', 'objectives', 'cycles', 'strategic_pillars', 'check_in_requests')
AND column_name LIKE '%tenant%';
```

### 2. Prisma Client Regeneration

**After schema change**:
```bash
npx prisma generate
```

**This will**:
- Regenerate Prisma client with `tenantId` fields
- Break all code using `organizationId` (good - forces update)

### 3. Application Code Breakage

**Expected**: All code using `organizationId` will break after Prisma regeneration

**Fix**: Update all files systematically (Phase 3)

### 4. Zero Downtime

**If possible**: Run migration during maintenance window

**If not**: Use dual-write pattern temporarily (write to both columns), then cutover

---

## Execution Order

1. ✅ **Phase 1**: Update Prisma schema
2. ✅ **Phase 2**: Generate migration (dry-run first)
3. ✅ **Phase 3**: Update application code (before running migration)
4. ✅ **Phase 4**: Remove normalization code
5. ✅ **Phase 5**: Update API contracts
6. ✅ **Phase 6**: Update tests
7. ✅ **Phase 7**: Update ESLint rules
8. ✅ **Phase 8**: Update documentation

**Then**: Run migration and verify

---

## Verification Checklist

- [ ] Prisma schema: All `organizationId` → `tenantId`
- [ ] Database: All columns renamed
- [ ] Application code: Zero `organizationId` references (except Organization model name)
- [ ] API contracts: Only `tenantId` in DTOs
- [ ] Tests: All passing with `tenantId`
- [ ] Normalization code: Removed
- [ ] ESLint: No errors

---

## Rollback Plan

If migration fails:

1. **Database**: Restore from backup
2. **Prisma**: Revert schema changes
3. **Code**: Revert all file changes

**Note**: This is a non-production app, so rollback is acceptable

---

## Estimated Effort

- **Prisma schema**: 30 minutes
- **Database migration**: 15 minutes (after testing)
- **Application code**: 4-6 hours (systematic find/replace + manual fixes)
- **Tests**: 2-3 hours
- **Documentation**: 1 hour
- **Total**: ~8-10 hours

---

## Risk Assessment

**Low Risk**:
- Non-production application
- Can rollback easily
- No external dependencies

**Medium Risk**:
- Large codebase (89 files)
- Many references to update
- Potential for missed references

**Mitigation**:
- Comprehensive search/replace
- Run tests after each phase
- Code review before merge

