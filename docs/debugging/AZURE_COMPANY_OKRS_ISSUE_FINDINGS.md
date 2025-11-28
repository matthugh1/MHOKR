# Azure Company OKRs Issue - Root Cause Analysis

## Problem Summary

When selecting "Company OKRs" → "Annual 2025" in Azure, nothing displays, but the same selection works correctly in the local environment.

## Root Cause Identified ✅

**All users have different primary organization IDs between local and Azure databases:**

- **Local Organization ID**: `cmi910l5t0000uw8jtagzxcoa` (Puzzel)
- **Azure Organization ID**: `cmieod79v00008ufdq56b7iom` (Puzzel)

Both organizations are named "Puzzel" but have different IDs. This causes a cascade of issues:

### Impact Chain

1. **User Primary Organization Mismatch**
   - All 133 users in Azure have `primaryOrganizationId = cmieod79v00008ufdq56b7iom`
   - In local, users have `primaryOrganizationId = cmi910l5t0000uw8jtagzxcoa`

2. **Role Assignment Mismatch**
   - Tenant role assignments (TENANT_ADMIN, TENANT_VIEWER, etc.) are tied to organization IDs
   - Roles assigned to `cmieod79v00008ufdq56b7iom` don't match the organization context used by the backend

3. **Objective/Cycle Mismatch**
   - Objectives and cycles are likely associated with one organization ID
   - When users query with a different `primaryOrganizationId`, the backend can't find matching data

4. **Visibility Check Failure**
   - The backend checks if users can view OKRs based on:
     - Their `primaryOrganizationId` (from JWT/user record)
     - Role assignments for that organization ID
     - Objectives' `tenantId` matching the user's organization
   - When these don't align, visibility checks fail silently

## Evidence

### Comparison Results

The role comparison script (`scripts/db/compare-role-assignments.ts`) found:

- **133 users** with different primary organization IDs
- **Role assignments exist** but are tied to the wrong organization ID
- **Tenant roles are present** (TENANT_ADMIN, TENANT_OWNER) but ineffective due to ID mismatch

### Example Users Affected

- `admin@puzzel.com` - Has TENANT_ADMIN role but assigned to wrong org ID
- `frederic.laziou@puzzel.com` - Has TENANT_ADMIN role but assigned to wrong org ID
- All other users - Same issue

## Solution

### Option 1: Update Azure to Match Local (Recommended)

Update all users and data in Azure to use the local organization ID:

```bash
LOCAL_DATABASE_URL="postgresql://okr_user:okr_password@localhost:5433/okr_nexus" \
AZURE_DATABASE_URL="postgresql://okr_user:okr_password@okr-nexus-postgres-db.postgres.database.azure.com:5432/okr_nexus?schema=public&sslmode=require" \
npx ts-node scripts/db/fix-azure-organization-ids.ts
```

This script will:
1. Find the correct organization ID from local database
2. Update all users' `primaryOrganizationId` in Azure
3. Update all role assignments to reference the correct organization ID
4. Update objectives, key results, cycles, etc. to use the correct organization ID

### Option 2: Update Local to Match Azure

If Azure is the source of truth, reverse the process and update local instead.

## Why This Happened

This likely occurred because:
1. **Separate database seeds** - Local and Azure databases were seeded independently
2. **Different import processes** - Data was imported at different times, creating new organization IDs
3. **No organization ID synchronization** - The organization ID wasn't preserved during data migration

## Prevention

To prevent this in the future:

1. **Use consistent organization IDs** - When seeding/migrating, preserve organization IDs
2. **Validate organization IDs** - Add checks to ensure organization IDs match between environments
3. **Document organization IDs** - Keep a record of which organization IDs are used in which environments
4. **Use environment-specific config** - Consider using environment variables for organization IDs if they must differ

## Verification

After applying the fix, verify:

1. **Users have correct primaryOrganizationId**:
   ```sql
   SELECT email, "primaryOrganizationId" FROM users LIMIT 5;
   ```

2. **Role assignments reference correct organization**:
   ```sql
   SELECT u.email, ra.role, ra."scopeId" 
   FROM role_assignments ra
   JOIN users u ON ra."userId" = u.id
   WHERE ra."scopeType" = 'TENANT';
   ```

3. **Objectives are in correct organization**:
   ```sql
   SELECT COUNT(*) FROM objectives WHERE "tenantId" = '<correct-org-id>';
   ```

4. **Test Company OKRs display** - Navigate to Company OKRs → Annual 2025 in Azure and verify data appears

## Related Files

- `scripts/db/compare-role-assignments.ts` - Comparison tool
- `scripts/db/fix-azure-organization-ids.ts` - Fix script
- `scripts/db/compare-role-assignments.sql` - SQL queries for manual comparison

## Next Steps

1. ✅ **Root cause identified** - Organization ID mismatch
2. ⏳ **Apply fix** - Run the fix script to update Azure database
3. ⏳ **Verify** - Test that Company OKRs now display correctly
4. ⏳ **Monitor** - Ensure no other issues arise from the fix



