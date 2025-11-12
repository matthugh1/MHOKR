# Investigation: Sarah Chen "New Objective" Button Not Appearing

## Executive Summary

**Status**: ✅ Sarah Chen DOES have a TENANT role assignment in the database.

**Database Findings**:
- ✅ User ID: `cmhesnyxo00054xhjb6h2qm1v`
- ✅ Role: `TENANT_ADMIN` (not TENANT_VIEWER, so role type is correct)
- ✅ Role Assignment scopeId: `cmhesnyvx00004xhjjxs272gs`
- ✅ Organization Membership organizationId: `cmhesnyvx00004xhjjxs272gs`
- ✅ IDs match between role assignment and organization membership

**Root Cause**: **ID Mismatch** - The `currentOrganization.id` being sent from frontend likely doesn't match the role assignment's `scopeId` (`cmhesnyvx00004xhjjxs272gs`).

**Why Frontend Shows Admin**: Frontend `permissions.isTenantAdminOrOwner()` checks old permission system (likely `OrganizationMember.role`).

**Why Backend Denies**: Backend `canCreateOKRAction()` checks `userContext.tenantRoles.get(tenantId)`, which requires exact match between `tenantId` and role assignment's `scopeId`. If frontend sends a different `organizationId`, the lookup fails.

**Next Steps**: 
1. ✅ Check browser console for `[OKR PAGE CONTAINER]` logs showing what `organizationId` is being sent
2. ✅ Check backend logs for `[OKR OVERVIEW]` logs showing what `tenantIdForRBAC` value is being used
3. ✅ Verify `currentOrganization.id` matches `cmhesnyvx00004xhjjxs272gs`
4. ✅ If IDs don't match, either:
   - Update `currentOrganization.id` to match role assignment
   - OR update role assignment `scopeId` to match `currentOrganization.id`

---

## Problem Statement
Sarah Chen can see the debug button ("New Objective (Debug - Admin Override)") but not the regular "New Objective" button. This indicates:
- `canCreateObjective` state is `false` 
- `currentOrganization?.id` exists
- `permissions.isTenantAdminOrOwner(currentOrganization.id)` returns `true`
- But backend is returning `canCreateObjective: false`

## Root Cause Analysis

### Frontend Flow

1. **State Management** (`page.tsx` line 96):
   ```typescript
   const [canCreateObjective, setCanCreateObjective] = useState<boolean>(false)
   ```

2. **Button Rendering** (`page.tsx` lines 663-668):
   ```typescript
   {canCreateObjective && (
     <Button onClick={() => setIsCreateDrawerOpen(true)}>
       <Plus className="h-4 w-4 mr-2" />
       New Objective
     </Button>
   )}
   ```

3. **Debug Button** (`page.tsx` lines 670-679):
   ```typescript
   {!canCreateObjective && currentOrganization?.id && permissions.isTenantAdminOrOwner(currentOrganization.id) && (
     <Button variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
       New Objective (Debug - Admin Override)
     </Button>
   )}
   ```

4. **Permission Flag Update** (`OKRPageContainer.tsx` lines 242-251):
   ```typescript
   if (onCanCreateChange) {
     if (envelope.canCreateObjective !== undefined) {
       onCanCreateChange(envelope.canCreateObjective)
     } else {
       console.warn('[OKR PAGE CONTAINER] Backend did not return canCreateObjective flag, defaulting to false')
       onCanCreateChange(false)
     }
   }
   ```

### Backend Flow

1. **API Endpoint** (`okr-overview.controller.ts` lines 331-398):
   ```typescript
   let canCreateObjective = false;
   try {
     const tenantIdForRBAC = organizationId || userOrganizationId || '';
     const resourceContext = {
       tenantId: tenantIdForRBAC,
       workspaceId: null,
       teamId: null,
     };
     
     canCreateObjective = await this.rbacService.canPerformAction(
       requesterUserId,
       'create_okr',
       resourceContext,
     );
   }
   ```

2. **RBAC Service** (`rbac.service.ts` lines 204-238):
   ```typescript
   async canPerformAction(userId: string, action: Action, resourceContext: ResourceContext): Promise<boolean> {
     const userContext = await this.buildUserContext(userId, false);
     const result = can(userContext, action, resourceContext);
     return result;
   }
   ```

3. **Permission Check** (`rbac.ts` lines 431-464):
   ```typescript
   function canCreateOKRAction(userContext: UserContext, resourceContext: ResourceContext): boolean {
     const tenantId = resourceContext.tenantId;
     
     // Check if user has any role in the tenant
     const tenantRoles = userContext.tenantRoles.get(tenantId) || [];
     if (tenantRoles.length > 0) {
       // TENANT_VIEWER cannot create OKRs
       if (tenantRoles.includes('TENANT_VIEWER') && tenantRoles.length === 1) {
         return false;
       }
       return true;
     }
     
     // Check workspace membership (workspaceId is null, so this won't execute)
     // Check team membership (teamId is null, so this won't execute)
     
     return false;
   }
   ```

## Critical Issue: Organization Membership vs Role Assignment

**IMPORTANT**: There are TWO SEPARATE systems for managing user permissions:

1. **OrganizationMember table**: User belongs to organization (membership record)
   - Managed via `OrganizationMember` records
   - Used by `req.user.organizationId` in JWT strategy
   - Used by frontend `currentOrganization` context

2. **RoleAssignment table**: User has RBAC permissions (role assignments)
   - Managed via `RoleAssignment` records  
   - Used by `RBACService.buildUserContext()` to build permission context
   - Used by `canCreateOKRAction()` to check permissions

The `canCreateOKRAction` function checks:
```typescript
const tenantRoles = userContext.tenantRoles.get(tenantId) || [];
```

This means:
1. **The `tenantId` in `resourceContext` MUST match the `scopeId` in Sarah Chen's `RoleAssignment` records**
2. **OrganizationMember records are NOT checked** - only RoleAssignment records matter
3. If Sarah Chen has a `TENANT_ADMIN` role assignment with `scopeId = "org-123"`, and the query uses `tenantId = "org-123"` (same ID), it should work
4. **BUT** if Sarah Chen only has an `OrganizationMember` record but NO `RoleAssignment` record, the check will fail

### Why Frontend Shows Admin But Backend Denies

The frontend's `permissions.isTenantAdminOrOwner()` likely checks:
- `OrganizationMember.role` field (old system)
- OR some other permission check that doesn't use RBAC

But the backend's `canCreateOKRAction()` ONLY checks:
- `RoleAssignment` records with `scopeType='TENANT'`

This is why Sarah Chen appears as admin in the frontend but gets `canCreateObjective: false` from the backend.

## Possible Causes

### 1. ID Mismatch (Most Likely)
Sarah Chen has a TENANT role assignment, but the `scopeId` doesn't match the `organizationId` being queried:

**Frontend sends**: `organizationId: currentOrganization.id` (line 210 in `OKRPageContainer.tsx`)
**Backend receives**: `organizationId` query parameter
**Backend uses**: `tenantIdForRBAC = organizationId || userOrganizationId || ''` (line 336)
**RBAC checks**: `userContext.tenantRoles.get(tenantIdForRBAC)` (line 438)

If `scopeId = "org-123"` but query uses `organizationId = "org-456"`, it won't match.

### 2. TENANT_VIEWER Only
Sarah Chen has a TENANT role assignment, but it's only `TENANT_VIEWER` (which blocks creation):

```typescript
// Line 441-443 in rbac.ts
if (tenantRoles.includes('TENANT_VIEWER') && tenantRoles.length === 1) {
  return false;
}
```

If Sarah Chen only has `TENANT_VIEWER` and no other tenant roles, `canCreateOKRAction` returns `false`.

### 3. Empty tenantId
If `organizationId` query param is missing AND `userOrganizationId` is null/undefined:
- `tenantIdForRBAC = ''` (empty string)
- `userContext.tenantRoles.get('')` won't match any role assignment's `scopeId`
- Result: `canCreateOKRAction` returns `false`

## Debug Steps Required

### Step 1: Check Backend Logs
Look for logs from `RBACService.canPerformAction` that show:
- `userId`: Sarah Chen's user ID
- `action`: `'create_okr'`
- `resourceContext`: The tenantId being checked
- `userContext.tenantRoles`: What roles Sarah Chen has for that tenantId

### Step 2: Check Database
**IMPORTANT**: Run these queries separately to diagnose. See `docs/debugging/SARAH_CHEN_DIAGNOSTIC_QUERIES.sql` for complete script.

**Step 2a: Find Sarah Chen's user ID**
```sql
SELECT id, email, name, "isSuperuser" 
FROM users 
WHERE email LIKE '%sarah%' OR email LIKE '%chen%' OR name LIKE '%Sarah%' OR name LIKE '%Chen%';
```

**Step 2b: Check role assignments (TENANT scope)**
```sql
SELECT 
  id,
  "userId",
  role,
  "scopeType",
  "scopeId",
  "createdAt"
FROM role_assignments
WHERE "userId" = '<user-id-from-step-2a>'
AND "scopeType" = 'TENANT';
```

**Step 2c: Check organization memberships**
```sql
SELECT 
  id,
  "userId",
  "organizationId",
  role,
  "createdAt"
FROM organization_members
WHERE "userId" = '<user-id-from-step-2a>';
```

**Step 2d: Check ALL role assignments (all scopes)**
```sql
SELECT 
  role,
  "scopeType",
  "scopeId"
FROM role_assignments
WHERE "userId" = '<user-id-from-step-2a>'
ORDER BY "scopeType", "scopeId";
```

**What to Look For**:
1. ✅ Does Sarah Chen have a `role_assignments` record with `scopeType = 'TENANT'`?
2. ✅ What is the `scopeId` value in that record?
3. ✅ What is the `role` value? (Should be `TENANT_ADMIN` or `TENANT_OWNER`, not just `TENANT_VIEWER`)
4. ✅ Does Sarah Chen have an `organization_members` record?
5. ✅ Does `organization_members.organizationId` match `role_assignments.scopeId`?
6. ✅ What is the `currentOrganization.id` value in the frontend? (Check browser console)

### Step 3: Verify Organization ID
Check what `organizationId` is being passed in the API call:
- Frontend: `currentOrganization.id`
- Backend: `organizationId` query parameter
- Should match: `scopeId` in `RoleAssignment` table

### Step 4: Check Frontend Console
Look for the debug log from `OKRPageContainer.tsx` line 230:
```typescript
console.log('[OKR PAGE CONTAINER] Full response:', {
  canCreateObjectiveValue: envelope.canCreateObjective,
  // ...
})
```

### Step 5: Check Backend Console
Look for logs from `okr-overview.controller.ts` line 354:
```typescript
console.log('[OKR OVERVIEW] canCreateObjective check:', {
  userId,
  userOrganizationId,
  organizationIdFromQuery: organizationId,
  tenantIdForRBAC,
  canCreate: canCreateObjective,
});
```

## Recommended Fix

### Option A: Fix ID Mismatch (MOST LIKELY NEEDED)
If Sarah Chen's role assignment `scopeId` doesn't match `currentOrganization.id`:

**Check for mismatch**:
```sql
-- Compare role assignment scopeId with organization membership
SELECT 
  ra."scopeId" as role_assignment_scope_id,
  om."organizationId" as organization_member_org_id,
  CASE 
    WHEN ra."scopeId" = om."organizationId" THEN '✅ Match'
    ELSE '❌ MISMATCH'
  END as status
FROM "role_assignments" ra
JOIN "organization_members" om ON om."userId" = ra."userId"
WHERE ra."userId" = '<sarah-chen-user-id>'
AND ra."scopeType" = 'TENANT';
```

**Fix**: Update role assignment to match organization:
```sql
UPDATE "role_assignments"
SET "scopeId" = '<correct-organization-id>'
WHERE "userId" = '<sarah-chen-user-id>'
AND "scopeType" = 'TENANT'
AND "role" = 'TENANT_ADMIN'; -- or whatever role she should have
```

### Option B: Upgrade Role from TENANT_VIEWER
If Sarah Chen only has `TENANT_VIEWER` role, upgrade it:

```sql
-- Check current role
SELECT "role" FROM "role_assignments" 
WHERE "userId" = '<sarah-chen-user-id>' 
AND "scopeType" = 'TENANT';

-- Upgrade to TENANT_ADMIN (if she should be admin)
UPDATE "role_assignments"
SET "role" = 'TENANT_ADMIN'
WHERE "userId" = '<sarah-chen-user-id>'
AND "scopeType" = 'TENANT'
AND "scopeId" = '<organization-id>';

-- OR add additional role (keep viewer, add admin)
INSERT INTO "role_assignments" ("id", "userId", "role", "scopeType", "scopeId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  '<sarah-chen-user-id>',
  'TENANT_ADMIN',
  'TENANT',
  '<organization-id>',
  NOW(),
  NOW()
);
```

### Option C: Add Missing Role Assignment (If None Found)
If Sarah Chen doesn't have a tenant role assignment, create one:

**Via API (if endpoint exists)**:
```typescript
POST /rbac/assign-role
{
  "userId": "sarah-chen-user-id",
  "role": "TENANT_ADMIN",
  "scopeType": "TENANT",
  "scopeId": "<organization-id>" // Must match currentOrganization.id
}
```

**Via Database Script**:
```sql
-- Check if Sarah Chen has any tenant role assignments
SELECT * FROM "role_assignments" 
WHERE "userId" = '<sarah-chen-user-id>' 
AND "scopeType" = 'TENANT';

-- If missing, insert one:
INSERT INTO "role_assignments" ("id", "userId", "role", "scopeType", "scopeId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  '<sarah-chen-user-id>',
  'TENANT_ADMIN',
  'TENANT',
  '<organization-id>', -- Must match currentOrganization.id
  NOW(),
  NOW()
);
```

**Via RBAC Service** (if you have admin access):
```typescript
await rbacService.assignRole(
  sarahChenUserId,
  'TENANT_ADMIN', // or 'TENANT_OWNER'
  'TENANT',
  organizationId, // Must match currentOrganization.id EXACTLY
  adminUserId, // Who is granting the role
  adminOrganizationId, // Admin's org context
);
```

**Important**: After adding the role assignment, you may need to:
1. Clear RBAC cache: `await rbacService.invalidateUserContextCache(sarahChenUserId)`
2. Refresh the page or wait for next API call (cache expires after 5 minutes)

### Option B: Fix ID Mismatch (If IDs Don't Match)
Ensure the `organizationId` being queried matches the `scopeId` in role assignments.

### Option C: Use Workspace/Team Context (If Only Workspace Roles)
If Sarah Chen only has workspace/team roles, modify the resource context to include `workspaceId` or `teamId`:
```typescript
const resourceContext = {
  tenantId: tenantIdForRBAC,
  workspaceId: userWorkspaceId, // If she has workspace roles
  teamId: userTeamId, // If she has team roles
};
```

## Next Steps

1. **Check backend logs** for the RBAC check details
2. **Query database** for Sarah Chen's role assignments
3. **Compare IDs** between `currentOrganization.id` and role assignment `scopeId`
4. **Verify** that Sarah Chen has a non-viewer tenant role
5. **Add missing role assignment** if needed
6. **Fix ID mismatch** if IDs don't match

