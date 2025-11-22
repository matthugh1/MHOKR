# OKR Visibility Analysis: frederic.laziou

## Summary

**User:** frederic.laziou@puzzel.com  
**Issue:** User can only see "My OKRs" and not all tenant OKRs  
**Root Cause:** The user has `TENANT_ADMIN` role, so they SHOULD be able to see all OKRs. The issue is likely one of:
1. The scope filter is set to "my" in the URL/state
2. The frontend isn't detecting the tenant role correctly
3. The permissions API isn't returning the role correctly

## User's Current Roles

Based on database query:
- **User ID:** `cmi8y692c000vgdswpb9431qq`
- **Superuser:** NO
- **Primary Organization:** Organization 15229 (`cmi8y69070001gdswg5f9rdop`)
- **Tenant-Level Roles:** `TENANT_ADMIN` (Organization 15229)

## How OKR Visibility Works

### Scope Filtering

The OKR page has three scope options:

1. **"My OKRs"** (`scope=my`)
   - Shows only OKRs owned by the current user
   - Always available to all users

2. **"Team/Workspace OKRs"** (`scope=team-workspace`)
   - Shows OKRs in workspaces/teams where user has roles
   - Available if user has `WORKSPACE_*` or `TEAM_*` roles

3. **"Company OKRs"** (`scope=tenant`)
   - Shows ALL OKRs in the tenant/organization
   - Available if user has:
     - `TENANT_VIEWER` role
     - `TENANT_ADMIN` role ✅ (frederic.laziou has this)
     - `TENANT_OWNER` role
     - `SUPERUSER` status

### Frontend Logic

The frontend determines available scopes in `apps/web/src/app/dashboard/okrs/page.tsx`:

```typescript
// "Tenant" if user has any tenant-level role
if (currentOrganization?.id) {
  const tenantRoles = permissions.rolesByScope?.tenant?.find(
    (t) => t.tenantId === currentOrganization.id
  )
  const hasTenantRole = tenantRoles !== undefined && tenantRoles.roles.length > 0
  
  if (hasTenantRole || isSuperuser || isTenantAdminForCurrentOrg) {
    scopes.push('tenant')
  }
}
```

**Key Requirements:**
1. `currentOrganization?.id` must be set
2. `permissions.rolesByScope?.tenant` must include an entry matching the current organization ID
3. That entry must have at least one role (`TENANT_VIEWER`, `TENANT_ADMIN`, or `TENANT_OWNER`)

### Default Scope Behavior

The default scope is determined by:
1. If URL has `?scope=...` parameter and it's valid → use that
2. Otherwise, default to `'my'` (first available scope)

**This means:** If the URL doesn't have `scope=tenant`, it will default to `scope=my`, which only shows the user's own OKRs.

## Why frederic.laziou Can Only See "My OKRs"

### Most Likely Causes

1. **URL Scope Parameter**
   - The URL might have `?scope=my` or no scope parameter
   - Default behavior sets scope to `'my'` if not specified
   - **Solution:** User needs to click the "Company OKRs" button or add `?scope=tenant` to the URL

2. **Permissions API Not Loading**
   - The `/rbac/assignments/me` endpoint might not be returning the tenant role
   - Or the frontend permissions hook might not be loading correctly
   - **Check:** Open browser DevTools → Network tab → Look for `/rbac/assignments/me` request → Verify it returns tenant roles

3. **Organization ID Mismatch**
   - The `currentOrganization.id` might not match the `tenantId` in the role assignment
   - **Check:** Verify the organization ID matches `cmi8y69070001gdswg5f9rdop`

4. **Permissions Hook Loading State**
   - While permissions are loading, the tenant scope might not be available
   - The code has optimistic loading that includes tenant scope, but there might be a race condition

## Diagnostic Steps

### 1. Check Browser Console

Open browser DevTools (F12) and check:
- Are there any errors in the console?
- Look for `[OKR Page] Tenant scope check:` log messages (in development mode)
- Check if `permissions.rolesByScope?.tenant` has the expected data

### 2. Check Network Requests

In DevTools → Network tab:
- Find the request to `/rbac/assignments/me`
- Verify the response includes:
  ```json
  {
    "roles": {
      "tenant": [
        {
          "tenantId": "cmi8y69070001gdswg5f9rdop",
          "roles": ["TENANT_ADMIN"]
        }
      ]
    }
  }
  ```

### 3. Check URL Parameters

Look at the current URL:
- If it has `?scope=my`, that's why only "My OKRs" are shown
- If it has no scope parameter, it defaults to `'my'`
- To see all OKRs, the URL should have `?scope=tenant`

### 4. Check Current Organization

Verify the user is viewing the correct organization:
- The organization ID should be `cmi8y69070001gdswg5f9rdop` (Organization 15229)
- If a different organization is selected, the tenant roles won't match

## Solutions

### Immediate Fix

1. **Manually set scope in URL:**
   - Add `?scope=tenant` to the URL
   - Or click the "Company OKRs" button in the filter bar (if it's visible)

2. **Verify permissions are loading:**
   - Check browser console for errors
   - Verify `/rbac/assignments/me` returns correct roles

### Long-term Fix

If the tenant scope button isn't appearing even though the user has `TENANT_ADMIN`:

1. **Check permissions hook:**
   - Verify `usePermissions()` is returning `rolesByScope.tenant` correctly
   - Check if there's a timing issue with loading

2. **Check organization context:**
   - Verify `currentOrganization?.id` matches the tenant role's `tenantId`
   - Ensure the user is viewing the correct organization

3. **Check RBAC service:**
   - Verify `getUserRoleAssignments()` returns the tenant role
   - Check if there's any filtering that might exclude it

## Code References

- **Frontend scope logic:** `apps/web/src/app/dashboard/okrs/page.tsx:171-228`
- **Permissions hook:** `apps/web/src/hooks/usePermissions.ts`
- **RBAC assignments endpoint:** `services/core-api/src/modules/rbac/rbac-assignment.controller.ts:52-114`
- **Backend scope filtering:** `services/core-api/src/modules/okr/okr-overview.controller.ts:144-207`

## Fix Applied

I've updated the code to add more robust checks for tenant scope availability:

1. **Added fallback check for any tenant role** - If the user has any tenant-level role (even if org ID doesn't match exactly), the tenant scope will be available
2. **Added `canAdministerTenant` check** - Uses `permissions.isTenantAdminOrOwner()` as an additional fallback
3. **Enhanced debug logging** - More detailed logging in development mode to help diagnose issues

The changes are in `apps/web/src/app/dashboard/okrs/page.tsx` around lines 189-225.

## Next Steps for Debugging

If the button still doesn't appear after this fix:

1. **Check browser console** - Look for `[OKR Page] Tenant scope check:` log messages
2. **Check Network tab** - Verify `/rbac/assignments/me` returns:
   ```json
   {
     "roles": {
       "tenant": [
         {
           "tenantId": "cmi8y69070001gdswg5f9rdop",
           "roles": ["TENANT_ADMIN"]
         }
       ]
     }
   }
   ```
3. **Verify organization ID** - Ensure `currentOrganization.id` matches the tenant ID in the role assignment

## Conclusion

frederic.laziou **should** be able to see all tenant OKRs because they have `TENANT_ADMIN` role. The fix adds multiple fallback checks to ensure the tenant scope button appears even if there are minor data mismatches. If the button still doesn't appear, check the browser console logs to see which check is failing.

