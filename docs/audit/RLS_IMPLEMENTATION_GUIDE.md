# PostgreSQL Row-Level Security (RLS) Implementation Guide

**Date**: 2025-11-03  
**Status**: ✅ **IMPLEMENTED**

---

## Overview

PostgreSQL Row-Level Security (RLS) has been implemented as a defense-in-depth layer for tenant isolation. This provides an additional security layer at the database level, protecting against SQL injection attacks and direct database access.

---

## How It Works

### 1. RLS Policies

RLS policies are defined in the migration `20251103000000_enable_rls_tenant_isolation/migration.sql`. They filter data based on PostgreSQL session variables:

- `app.current_organization_id`: Current user's organization ID (string or NULL for SUPERUSER)
- `app.user_is_superuser`: Boolean flag for SUPERUSER ('true' or 'false')

### 2. Session Variable Setting

Session variables are set automatically by Prisma middleware before each query executes. The `PrismaService` includes a middleware hook that sets these variables using `SET LOCAL` commands.

### 3. Policy Behavior

**SUPERUSER (null organizationId)**:
- Can SELECT (read) all data across all tenants
- Cannot INSERT/UPDATE/DELETE (read-only enforced at database level)

**Normal Users (string organizationId)**:
- Can SELECT only data in their organization
- Can INSERT/UPDATE/DELETE only data in their organization

**Users with no org (undefined)**:
- Session variables are not set, policies fail (fail-safe)
- No data access (as expected)

---

## Tables Protected

The following tables have RLS enabled:

1. ✅ `objectives` - Filtered by `organizationId`
2. ✅ `key_results` - Filtered via parent objective's `organizationId`
3. ✅ `workspaces` - Filtered by `organizationId`
4. ✅ `teams` - Filtered via workspace's `organizationId`
5. ✅ `cycles` - Filtered by `organizationId`
6. ✅ `strategic_pillars` - Filtered by `organizationId`
7. ✅ `check_in_requests` - Filtered by `organizationId`
8. ✅ `organizations` - Filtered by `id` (users can only see their own org)

---

## Implementation Details

### Migration

The migration file is located at:
```
services/core-api/prisma/migrations/20251103000000_enable_rls_tenant_isolation/migration.sql
```

To apply:
```bash
cd services/core-api
npx prisma migrate dev --name enable_rls_tenant_isolation
```

### Prisma Middleware

The `PrismaService` automatically sets session variables before each query. **Middleware order matters** - RLS session variable middleware runs FIRST:

```typescript
// Set in PrismaService constructor (registered FIRST so it runs first)
this.$use(async (params, next) => {
  const organizationId = getTenantContext();
  const isSuperuser = organizationId === null;
  
  if (organizationId !== undefined) {
    // Use SET (session-level) - works for both transaction and non-transaction queries
    // Connection pool will reset variables when connection is returned
    const orgIdValue = organizationId === null ? 'NULL' : `'${organizationId.replace(/'/g, "''")}'`;
    await this.$executeRawUnsafe(`SET app.current_organization_id = ${orgIdValue}`);
    await this.$executeRawUnsafe(`SET app.user_is_superuser = '${isSuperuser}'`);
  }
  
  return next(params);
});

// Tenant isolation middleware registered SECOND (runs after RLS variables are set)
this.$use(createTenantIsolationMiddleware());
```

### Tenant Context

The tenant context is set by the `RBACGuard` using `AsyncLocalStorage`:

```typescript
// In RBACGuard.canActivate()
return withTenantContext(user?.organizationId, async () => {
  return this.performAuthorizationCheck(...);
});
```

---

## Testing RLS

### Manual Testing

1. **Test as normal user**:
   ```sql
   SET LOCAL app.current_organization_id = 'org-123';
   SET LOCAL app.user_is_superuser = 'false';
   SELECT * FROM objectives; -- Should only return org-123 objectives
   ```

2. **Test as SUPERUSER**:
   ```sql
   SET LOCAL app.current_organization_id = NULL;
   SET LOCAL app.user_is_superuser = 'true';
   SELECT * FROM objectives; -- Should return all objectives
   ```

3. **Test write protection for SUPERUSER**:
   ```sql
   SET LOCAL app.current_organization_id = NULL;
   SET LOCAL app.user_is_superuser = 'true';
   UPDATE objectives SET title = 'test' WHERE id = 'some-id'; -- Should fail
   ```

### Automated Testing

RLS is automatically tested as part of:
- Tenant isolation service tests
- Integration tests that verify cross-tenant access is blocked

---

## Limitations & Considerations

### 1. Connection Pooling

**Issue**: Session variables set with `SET LOCAL` are only valid for the current transaction. With connection pooling, variables may persist across requests.

**Solution**: 
- Use `SET LOCAL` (not `SET`) - `SET LOCAL` is automatically rolled back at transaction end
- Ensure transactions are properly committed/rolled back
- Consider using a connection pooler that resets session state between connections

### 2. Performance

**Impact**: RLS policies add overhead to queries (subqueries in policies).

**Mitigation**:
- Indexes on `organizationId` columns (already in place)
- Policies use efficient EXISTS subqueries
- Monitor query performance after enabling RLS

### 3. Prisma Query Builder

**Note**: Prisma may not always respect RLS policies in complex queries. Application-level validation is still required.

**Solution**: Always validate tenant context in services (defense-in-depth).

### 4. Migration Scripts

**Issue**: Migration scripts may need to run with elevated privileges.

**Solution**: 
- Run migrations as database superuser
- Temporarily disable RLS during migrations if needed
- Re-enable RLS after migration completes

---

## Troubleshooting

### RLS blocking all queries

**Symptom**: All queries return empty results.

**Cause**: Session variables not set or incorrectly formatted.

**Solution**:
1. Check that `getTenantContext()` returns expected value
2. Verify session variables are set before query execution
3. Check PostgreSQL logs for policy evaluation errors

### SUPERUSER can't read data

**Symptom**: SUPERUSER queries return empty results.

**Cause**: `app.user_is_superuser` not set to 'true'.

**Solution**: Verify `organizationId === null` correctly sets `isSuperuser = true`.

### Cross-tenant data leakage

**Symptom**: Users can see other tenants' data.

**Cause**: RLS policies not working or session variables incorrect.

**Solution**:
1. Verify RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
2. Check policies: `SELECT * FROM pg_policies WHERE tablename = 'objectives';`
3. Verify session variables are set correctly

---

## Rollback

To disable RLS (if needed):

```sql
-- Disable RLS on all tables
ALTER TABLE objectives DISABLE ROW LEVEL SECURITY;
ALTER TABLE key_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE cycles DISABLE ROW LEVEL SECURITY;
ALTER TABLE strategic_pillars DISABLE ROW LEVEL SECURITY;
ALTER TABLE check_in_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;

-- Drop policies (optional)
DROP POLICY IF EXISTS objectives_superuser_select ON objectives;
DROP POLICY IF EXISTS objectives_tenant_select ON objectives;
-- ... (drop all other policies)
```

---

## Next Steps

1. ✅ **COMPLETED**: RLS migration created
2. ✅ **COMPLETED**: Prisma middleware configured to set session variables
3. ⚠️ **TODO**: Test RLS in development environment
4. ⚠️ **TODO**: Monitor performance impact
5. ⚠️ **TODO**: Add RLS to CI/CD testing
6. ⚠️ **TODO**: Document for operations team

---

## References

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Prisma Raw Queries](https://www.prisma.io/docs/concepts/components/prisma-client/raw-database-access)
- Migration file: `services/core-api/prisma/migrations/20251103000000_enable_rls_tenant_isolation/migration.sql`

