# Role Assignment Comparison Tool

This tool helps diagnose why Company OKRs for "Annual 2025" might not display in Azure but do locally by comparing user role assignments between the two database environments.

## Problem

When selecting "Company OKRs" → "Annual 2025" in Azure, nothing displays, but the same selection works locally. This is likely due to:

1. **Missing tenant-level roles** in Azure (users need `TENANT_VIEWER`, `TENANT_ADMIN`, or `TENANT_OWNER` to see Company OKRs)
2. **Different primary organization assignments** between environments
3. **Missing or incorrect role assignments** for specific users

## Solution

Compare role assignments between local and Azure databases to identify differences.

## Method 1: TypeScript Script (Recommended)

### Prerequisites

1. Get your Azure database connection string from Azure Portal:
   - Go to Azure Portal → Your Database → Connection strings
   - Copy the PostgreSQL connection string
   - Format: `postgresql://user:password@host:5432/database?sslmode=require`

2. Get your local database connection string:
   - Usually: `postgresql://okr_user:okr_password@localhost:5432/okr_nexus`
   - Or check your `.env` file: `DATABASE_URL`

### Usage

```bash
# Set environment variables
export LOCAL_DATABASE_URL="postgresql://okr_user:okr_password@localhost:5432/okr_nexus"
export AZURE_DATABASE_URL="postgresql://user:password@azure-host:5432/database?sslmode=require"

# Run the comparison script
npx ts-node scripts/db/compare-role-assignments.ts
```

### What It Does

1. Connects to both databases
2. Fetches all users and their role assignments
3. Compares:
   - User existence
   - Primary organization assignments
   - Superuser status
   - Role assignments (especially tenant-level roles)
4. Reports differences, with special focus on tenant-level roles

### Output

The script will show:
- Summary statistics (user counts, differences found)
- Detailed differences by user
- **Tenant-level role analysis** (most relevant for Company OKRs)
- Complete list of tenant role assignments in both environments

## Method 2: SQL Queries

If you prefer to run SQL queries directly:

### Local Database

```bash
psql -h localhost -U okr_user -d okr_nexus -f scripts/db/compare-role-assignments.sql > local-roles.txt
```

### Azure Database

```bash
psql -h <azure-host> -U <user> -d <database> -f scripts/db/compare-role-assignments.sql > azure-roles.txt
```

Then compare the two files manually.

### Key Queries

The SQL file includes several useful queries:

1. **User Summary with Tenant Roles** - Shows all users with tenant role counts
2. **Detailed Tenant Role Assignments** - Complete list of tenant roles
3. **Users Without Tenant Roles** - Users who might not see Company OKRs
4. **Tenant Admin/Owner Roles** - Users who should definitely see Company OKRs
5. **Organizations with Annual 2025 Objectives** - Verifies cycle and data existence

## Common Issues Found

### Issue 1: Missing Tenant Roles

**Symptom**: Users exist in Azure but have no tenant-level role assignments.

**Solution**: Grant tenant roles:
```bash
# Run the grant-default-viewer-roles script in Azure
AZURE_DATABASE_URL="..." npx ts-node scripts/admin/grant-default-viewer-roles.ts
```

### Issue 2: Different Primary Organizations

**Symptom**: User's `primaryOrganizationId` differs between environments.

**Solution**: Update primary organization in Azure to match local:
```sql
UPDATE users 
SET "primaryOrganizationId" = '<correct-org-id>'
WHERE email = '<user-email>';
```

### Issue 3: Missing TENANT_ADMIN Roles

**Symptom**: Admin users have tenant roles locally but not in Azure.

**Solution**: Manually grant roles:
```sql
INSERT INTO role_assignments ("userId", role, "scopeType", "scopeId")
SELECT 
    u.id,
    'TENANT_ADMIN',
    'TENANT',
    u."primaryOrganizationId"
FROM users u
WHERE u.email = '<admin-email>'
    AND u."primaryOrganizationId" IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM role_assignments ra
        WHERE ra."userId" = u.id
            AND ra."scopeType" = 'TENANT'
            AND ra."scopeId" = u."primaryOrganizationId"
    );
```

## Understanding Role Requirements for Company OKRs

To see Company OKRs (`scope=tenant`), users need:

1. **TENANT_VIEWER** - Can view all tenant OKRs (read-only)
2. **TENANT_ADMIN** - Can view and manage tenant OKRs
3. **TENANT_OWNER** - Full access to tenant OKRs
4. **SUPERUSER** - Can view everything (but this is rare)

Users without any tenant-level roles will **not** see Company OKRs, even if they can see "My OKRs" or "Team/Workspace OKRs".

## Next Steps After Comparison

1. **If roles are missing**: Grant appropriate tenant roles using the scripts above
2. **If organizations differ**: Update primary organization assignments
3. **If cycle data differs**: Check if Annual 2025 cycle exists in Azure and has objectives
4. **If everything matches**: The issue might be in:
   - Visibility filtering logic
   - Tenant context (AsyncLocalStorage)
   - RBAC service behavior
   - Environment-specific configuration

## Troubleshooting

### Connection Issues

If you can't connect to Azure database:

1. Check firewall rules in Azure Portal
2. Verify connection string format
3. Ensure SSL is enabled (`?sslmode=require`)
4. Test connection with `psql` directly first

### Script Errors

If the TypeScript script fails:

1. Ensure `@prisma/client` is installed: `npm install`
2. Check Prisma schema is up to date: `npx prisma generate`
3. Verify environment variables are set correctly
4. Check database URLs are accessible from your machine

## Related Scripts

- `scripts/admin/grant-default-viewer-roles.ts` - Grant default viewer roles to all users
- `scripts/admin/assign-role-to-sarah.ts` - Example of assigning a specific role
- `scripts/seed/03_users_and_roles.ts` - Seed script that creates users with roles




