# Status: organizationId → tenantId Migration

## ✅ Completed

### Phase 1: Prisma Schema
- ✅ Updated all models: `organizationId` → `tenantId`
- ✅ Updated relation names: `organization` → `tenant`
- ✅ Updated indexes: `@@index([organizationId])` → `@@index([tenantId])`
- ✅ Kept `Organization` model name (business concept)

### Phase 2: Database Migration
- ✅ Created migration SQL: `20250106_rename_organizationId_to_tenantId/migration.sql`
- ✅ Migration includes column renames, index renames, FK renames

### Phase 3: Critical Infrastructure Files (Updated)
- ✅ `services/core-api/src/modules/rbac/types.ts` - Removed `organizationId` from `OKREntity`
- ✅ `services/core-api/src/modules/auth/strategies/jwt.strategy.ts` - Added `tenantId`, kept `organizationId` as deprecated alias
- ✅ `services/core-api/src/policy/policy.controller.ts` - Updated to use `tenantId`
- ✅ `services/core-api/src/policy/authorisation.service.ts` - Updated to use `tenantId`
- ✅ `services/core-api/src/common/tenant/tenant-context.middleware.ts` - Removed normalization
- ✅ `services/core-api/src/common/tenant/tenant-mutation.guard.ts` - Removed `organizationId` fallback
- ✅ `services/core-api/src/modules/okr/tenant-guard.ts` - Updated all methods to use `tenantId`
- ✅ `services/core-api/src/common/prisma/tenant-isolation.middleware.ts` - Updated to use `tenantId`
- ✅ `services/core-api/src/common/tenant/tenant-context.service.ts` - Updated interface and methods
- ✅ `services/core-api/src/common/decorators/tenant-scoped.decorator.ts` - Updated to use `tenantId`
- ✅ `services/core-api/src/common/prisma/prisma.service.ts` - Updated RLS session variables
- ✅ `services/core-api/src/modules/rbac/rbac.guard.ts` - Updated to use `tenantId`

## 🔄 In Progress

### Phase 3: Remaining Application Code (57 files remaining)
- ⏳ Need to update all service files
- ⏳ Need to update all controller files
- ⏳ Need to update helper/utils files

### Phase 4: API Contracts
- ⏳ Update DTOs to remove `organizationId`
- ⏳ Update interfaces to use `tenantId` only

### Phase 5: Remove Normalization Code
- ⏳ Delete `organization-to-tenant.pipe.ts` (no longer needed)
- ⏳ Remove `organizationId` backward compatibility aliases

### Phase 6: Tests
- ⏳ Update all test files (replace `organizationId` → `tenantId`)

## 📝 Next Steps

1. **Run bulk replacement script** (if safe):
   ```bash
   node scripts/bulk-replace-organizationId-to-tenantId.js
   ```

2. **Manual updates** for remaining critical files:
   - Service files (objective.service.ts, key-result.service.ts, etc.)
   - Controller files
   - Helper files

3. **Remove normalization code**:
   - Delete `services/core-api/src/common/tenant/organization-to-tenant.pipe.ts`
   - Remove `organizationId` from JWT strategy (deprecated alias)

4. **Update tests**:
   - Replace all `organizationId` → `tenantId` in test files

5. **Run migration**:
   ```bash
   cd services/core-api
   npx prisma migrate deploy
   ```

6. **Verify**:
   - Run tests
   - Check for remaining `organizationId` references
   - Verify database columns renamed

## ⚠️ Important Notes

- **Database**: PostgreSQL session variable changed from `app.current_organization_id` → `app.current_tenant_id`
- **RLS Policies**: May need to update PostgreSQL RLS policies to use `current_tenant_id` instead of `current_organization_id`
- **JWT Strategy**: Currently includes `organizationId` as deprecated alias - should be removed after migration
- **Backward Compatibility**: No longer accepting `organizationId` in API requests after migration

