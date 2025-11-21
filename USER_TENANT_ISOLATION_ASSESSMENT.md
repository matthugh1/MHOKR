# User Tenant Isolation Security Assessment

**Date**: 2025-01-27  
**Status**: ⚠️ **CRITICAL SECURITY ISSUE IDENTIFIED**  
**Priority**: P0 - Critical

---

## Executive Summary

The `users` table has **NO database-level tenant isolation**. Users are not directly linked to organizations/tenants in the database schema, and there are **NO Row-Level Security (RLS) policies** protecting the users table. This creates a critical security vulnerability where:

1. **Direct database access can expose all users across all tenants**
2. **Application-level filtering can be bypassed**
3. **No referential integrity between users and organizations**

---

## Current Architecture

### 1. Database Schema Analysis

#### Users Table Structure
```prisma
model User {
  id                         String                  @id @default(cuid())
  email                      String                  @unique
  keycloakId                 String?                 @unique
  name                       String
  passwordHash               String?
  avatar                     String?
  isSuperuser                Boolean                 @default(false)
  settings                   Json?                   @default("{}")
  managerId                  String?
  // ... relationships ...
  // ❌ NO organizationId field
  // ❌ NO tenantId field
}
```

**Critical Finding**: The `users` table has **NO direct foreign key relationship** to organizations or tenants.

#### User-Organization Relationship
Users are linked to organizations **ONLY** through the `RoleAssignment` table:

```prisma
model RoleAssignment {
  id        String    @id @default(cuid())
  userId    String    // FK to User
  role      RBACRole
  scopeType ScopeType // PLATFORM | TENANT | WORKSPACE | TEAM
  scopeId   String?   // null for PLATFORM, organizationId for TENANT
  // ...
}
```

**Relationship Chain**:
- User → RoleAssignment (where `scopeType = 'TENANT'`) → Organization (via `scopeId`)

This is an **indirect relationship** with no database-level constraints.

---

### 2. Row-Level Security (RLS) Status

#### Tables WITH RLS Protection ✅
The following tables have RLS enabled and policies configured:
- `objectives`
- `key_results`
- `workspaces`
- `teams`
- `cycles`
- `strategic_pillars`
- `check_in_requests`
- `organizations`

#### Tables WITHOUT RLS Protection ❌
- **`users`** - **NO RLS policies**
- `role_assignments` - No RLS policies
- `audit_logs` - No RLS policies
- `permission_audits` - No RLS policies

**Evidence**: Migration file `20251103000000_enable_rls_tenant_isolation/migration.sql` does NOT include the `users` table.

---

### 3. Application-Level Protection

#### Current Implementation
The `UserService.findAll()` method filters users at the application layer:

```typescript
async findAll(userOrganizationId: string | null | undefined) {
  // Get all users who have a tenant role assignment for this organisation
  const tenantAssignments = await this.prisma.roleAssignment.findMany({
    where: {
      scopeType: 'TENANT',
      scopeId: userOrganizationId,
    },
  });
  
  const userIds = tenantAssignments.map(ta => ta.userId);
  
  return this.prisma.user.findMany({
    where: { id: { in: userIds } },
    // ...
  });
}
```

**Protection Level**: Application-layer only. This can be bypassed by:
1. Direct database queries
2. SQL injection attacks
3. Bypassing the service layer
4. Direct Prisma queries without tenant context

---

## Security Vulnerabilities

### Vulnerability 1: No Database-Level Tenant Isolation

**Severity**: 🔴 **CRITICAL**

**Issue**: The `users` table has no RLS policies. Anyone with direct database access can query all users across all tenants.

**Attack Vector**:
```sql
-- Direct database query bypasses all application-level checks
SELECT * FROM users;
-- Returns ALL users from ALL tenants
```

**Impact**:
- Cross-tenant data leakage
- PII exposure (emails, names)
- Violation of data isolation requirements

---

### Vulnerability 2: No Referential Integrity

**Severity**: 🟡 **HIGH**

**Issue**: There is no foreign key constraint ensuring users belong to organizations. Users can exist without any organization membership.

**Evidence**:
- No `organizationId` field on `users` table
- No database constraint linking users to organizations
- Users can be created without role assignments (though application code prevents this)

**Impact**:
- Orphaned users (users without organization membership)
- Data integrity issues
- Difficult to enforce "all users must belong to an organization" rule

---

### Vulnerability 3: Indirect Relationship Complexity

**Severity**: 🟡 **MEDIUM**

**Issue**: User-organization relationship is indirect through `RoleAssignment`. This makes queries complex and error-prone.

**Problems**:
1. **Performance**: Requires JOINs to filter users by tenant
2. **Complexity**: Harder to understand and maintain
3. **Error-Prone**: Easy to forget tenant filtering in queries
4. **No Database Enforcement**: Database cannot enforce tenant isolation

**Example of Complexity**:
```typescript
// To get users in a tenant, you must:
// 1. Query RoleAssignment table
// 2. Extract userIds
// 3. Query User table with those IDs
// This is inefficient and can be bypassed
```

---

### Vulnerability 4: Superuser Bypass

**Severity**: 🟡 **MEDIUM**

**Issue**: Superusers can see all users without any database-level restrictions.

**Current Behavior**:
```typescript
if (userOrganizationId === null) {
  // SUPERUSER: can see all users (read-only access)
  return this.prisma.user.findMany({
    // Returns ALL users from ALL tenants
  });
}
```

**Concern**: While superusers need broad access, there's no audit trail or database-level logging of cross-tenant access.

---

## Comparison with Other Tables

### How Other Tables Handle Tenant Isolation

#### Example: Objectives Table
```prisma
model Objective {
  id              String       @id @default(cuid())
  tenantId        String       // ✅ Direct tenant reference
  tenant          Organization @relation(fields: [tenantId], references: [id])
  // ...
}
```

**Protection Layers**:
1. ✅ **Database Schema**: Direct `tenantId` foreign key
2. ✅ **RLS Policies**: Database-level filtering
3. ✅ **Application Layer**: Service methods filter by tenant

#### Example: Workspaces Table
```prisma
model Workspace {
  id                String       @id @default(cuid())
  tenantId          String       // ✅ Direct tenant reference
  tenant            Organization @relation(fields: [tenantId], references: [id])
  // ...
}
```

**Protection Layers**:
1. ✅ **Database Schema**: Direct `tenantId` foreign key
2. ✅ **RLS Policies**: Database-level filtering
3. ✅ **Application Layer**: Service methods filter by tenant

---

## Recommendations

### Priority 1: Add RLS Policies to Users Table (P0 - Critical)

**Action**: Enable Row-Level Security on the `users` table with policies that filter based on `RoleAssignment` relationships.

**Implementation**:
```sql
-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: SUPERUSER can see all users (read-only)
CREATE POLICY users_superuser_select ON users
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'true'
  );

-- Policy: Normal users can only see users in their organization
CREATE POLICY users_tenant_select ON users
  FOR SELECT
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND EXISTS (
      SELECT 1 FROM role_assignments
      WHERE role_assignments."userId" = users.id
      AND role_assignments."scopeType" = 'TENANT'
      AND role_assignments."scopeId" = current_setting('app.current_organization_id', true)
    )
  );

-- Policy: SUPERUSER cannot modify (read-only)
CREATE POLICY users_superuser_write ON users
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Policy: Normal users can modify only users in their organization
CREATE POLICY users_tenant_write ON users
  FOR ALL
  USING (
    current_setting('app.user_is_superuser', true) = 'false'
    AND EXISTS (
      SELECT 1 FROM role_assignments
      WHERE role_assignments."userId" = users.id
      AND role_assignments."scopeType" = 'TENANT'
      AND role_assignments."scopeId" = current_setting('app.current_organization_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.user_is_superuser', true) = 'false'
    AND EXISTS (
      SELECT 1 FROM role_assignments
      WHERE role_assignments."userId" = users.id
      AND role_assignments."scopeType" = 'TENANT'
      AND role_assignments."scopeId" = current_setting('app.current_organization_id', true)
    )
  );
```

**Challenges**:
- RLS policies with EXISTS subqueries may have performance implications
- Need to ensure `role_assignments` table is indexed properly
- Testing required to verify performance impact

---

### Priority 2: Add Primary Organization Reference (P1 - High)

**Action**: Add a `primaryOrganizationId` field to the `users` table for direct reference and improved query performance.

**Rationale**:
- Most users belong to a single primary organization
- Enables direct foreign key constraint
- Improves query performance
- Maintains backward compatibility with multi-org support via `RoleAssignment`

**Implementation**:
```prisma
model User {
  id                         String                  @id @default(cuid())
  email                      String                  @unique
  primaryOrganizationId      String?                 // ✅ NEW: Primary organization reference
  primaryOrganization        Organization?           @relation("UserPrimaryOrganization", fields: [primaryOrganizationId], references: [id], onDelete: SetNull)
  // ... existing fields ...
}
```

**Migration Strategy**:
1. Add nullable `primaryOrganizationId` field
2. Backfill from `RoleAssignment` table (use first TENANT assignment)
3. Add foreign key constraint
4. Add index for performance
5. Update application code to maintain both fields

**Benefits**:
- Direct database-level relationship
- Better query performance
- Easier to enforce "users must belong to an organization"
- Can still support multi-org via `RoleAssignment`

---

### Priority 3: Add Database Constraints (P1 - High)

**Action**: Add database-level constraints to ensure data integrity.

**Constraints Needed**:
1. **Check Constraint**: Ensure users have at least one TENANT role assignment
2. **Foreign Key**: Ensure `RoleAssignment.scopeId` references valid organizations when `scopeType = 'TENANT'`
3. **Unique Constraint**: Prevent duplicate tenant role assignments

**Implementation**:
```sql
-- Add foreign key constraint for RoleAssignment.scopeId → Organization.id
ALTER TABLE role_assignments
ADD CONSTRAINT role_assignments_tenant_fk
FOREIGN KEY ("scopeId")
REFERENCES organizations(id)
ON DELETE CASCADE
WHERE "scopeType" = 'TENANT';

-- Add index for performance
CREATE INDEX role_assignments_tenant_idx 
ON role_assignments("userId", "scopeType", "scopeId")
WHERE "scopeType" = 'TENANT';
```

**Note**: Partial foreign keys (with WHERE clause) are not supported in PostgreSQL. Alternative approach:
- Create a separate `tenant_role_assignments` table with proper foreign keys
- Or use application-level validation with database triggers

---

### Priority 4: Audit Direct User Queries (P2 - Medium)

**Action**: Add database triggers to log all direct queries to the `users` table for security auditing.

**Implementation**:
```sql
-- Create audit log table for user access
CREATE TABLE user_access_audit (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  accessed_user_id TEXT NOT NULL,
  accessed_at TIMESTAMP DEFAULT NOW(),
  query_type TEXT, -- SELECT, UPDATE, DELETE
  session_user TEXT
);

-- Create trigger function
CREATE OR REPLACE FUNCTION audit_user_access()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_access_audit (user_id, accessed_user_id, query_type, session_user)
  VALUES (
    current_setting('app.current_user_id', true),
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    current_user
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER user_access_audit_trigger
AFTER SELECT OR UPDATE OR DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION audit_user_access();
```

---

## Migration Plan

### Phase 1: Immediate (Week 1)
1. ✅ **Add RLS policies to users table** (Priority 1)
2. ✅ **Add indexes to role_assignments table** for RLS performance
3. ✅ **Test RLS policies** in development environment
4. ✅ **Update documentation** with user tenant isolation guidelines

### Phase 2: Short-term (Month 1)
1. ✅ **Add primaryOrganizationId field** to users table (Priority 2)
2. ✅ **Backfill primaryOrganizationId** from RoleAssignment table
3. ✅ **Add foreign key constraint** for primaryOrganizationId
4. ✅ **Update application code** to maintain primaryOrganizationId

### Phase 3: Medium-term (Month 2-3)
1. ✅ **Add database constraints** (Priority 3)
2. ✅ **Implement audit logging** for user access (Priority 4)
3. ✅ **Performance testing** and optimization
4. ✅ **Security audit** of all user-related queries

---

## Testing Requirements

### Unit Tests
- [ ] Test RLS policies prevent cross-tenant user access
- [ ] Test superuser can see all users (read-only)
- [ ] Test normal users can only see users in their tenant
- [ ] Test user creation requires tenant assignment
- [ ] Test user deletion cascades properly

### Integration Tests
- [ ] Test user queries through API endpoints
- [ ] Test direct database queries are blocked by RLS
- [ ] Test performance impact of RLS policies
- [ ] Test multi-org users still work correctly

### Security Tests
- [ ] Attempt SQL injection to bypass tenant filtering
- [ ] Attempt direct database access to users table
- [ ] Verify audit logs capture all user access
- [ ] Test edge cases (users without organizations, etc.)

---

## Additional Findings

### Direct User Queries Throughout Codebase

**Finding**: There are **122+ direct `prisma.user` queries** throughout the codebase, many of which may not have tenant context validation.

**Examples of Potentially Vulnerable Queries**:
```typescript
// services/core-api/src/modules/okr/okr-reporting.service.ts:208
const krOwners = await this.prisma.user.findMany({
  where: { id: { in: ownerIds } },
});

// services/core-api/src/modules/okr/key-result.service.ts:1279
const users = await this.prisma.user.findMany({
  where: { id: { in: userIds } },
});

// services/core-api/src/modules/okr/checkin-request.service.ts:201
const targetUsers = await this.prisma.user.findMany({
  where: { id: { in: targetUserIds } },
});
```

**Risk**: These queries may return users from other tenants if the `userIds` array contains IDs from other tenants.

### Tenant Isolation Middleware Exclusion

**Finding**: The `users` model is **NOT included** in the tenant-scoped models list in the tenant isolation middleware.

**Evidence**: `services/core-api/src/common/prisma/tenant-isolation.middleware.ts`:
```typescript
const tenantScopedModels = [
  'objective',
  'keyResult',
  'workspace',
  'team',
  'cycle',
  'initiative',
  'checkInRequest',
  'strategicPillar',
  'activity',
  'userLayout',
  // ❌ 'user' is NOT in this list
];
```

**Impact**: User queries are **NOT automatically filtered** by the middleware, even if tenant context is available.

### RoleAssignment Table Also Unprotected

**Finding**: The `role_assignments` table also has **NO RLS policies**, which could expose role assignments across tenants.

**Risk**: 
- Cross-tenant role assignment visibility
- Ability to enumerate users in other tenants by querying role assignments
- No database-level protection for RBAC data

---

## Conclusion

The `users` table currently has **NO database-level tenant isolation**, relying entirely on application-layer filtering. This is a **critical security vulnerability** that must be addressed immediately.

**Key Issues**:
1. ❌ **NO RLS policies** on `users` table
2. ❌ **NO direct organizationId/tenantId** field on users table
3. ❌ **NOT included** in tenant isolation middleware
4. ❌ **122+ direct user queries** throughout codebase without guaranteed tenant filtering
5. ❌ **RoleAssignment table** also unprotected

**Recommended Actions**:
1. **Immediate**: Add RLS policies to users table (Priority 1)
2. **Immediate**: Add RLS policies to role_assignments table (Priority 1)
3. **Immediate**: Include 'user' in tenant isolation middleware (Priority 1)
4. **Short-term**: Add primaryOrganizationId field for direct relationship (Priority 2)
5. **Short-term**: Audit all 122+ user queries for tenant filtering (Priority 2)
6. **Medium-term**: Add database constraints and audit logging (Priorities 3-4)

**Risk Level**: 🔴 **CRITICAL** - This vulnerability allows cross-tenant data leakage and violates data isolation requirements. The scope is broader than initially assessed, affecting both users and role assignments.

---

## References

- [RLS Implementation Guide](./docs/audit/RLS_IMPLEMENTATION_GUIDE.md)
- [Tenant Isolation Guidelines](./docs/developer/TENANT_ISOLATION_GUIDELINES.md)
- [Database Schema](./services/core-api/prisma/schema.prisma)
- [RLS Migration](./services/core-api/prisma/migrations/20251103000000_enable_rls_tenant_isolation/migration.sql)

