# User Creation Auto-Context Audit Summary

## Current State

### Frontend
- **Location**: `apps/web/src/app/dashboard/settings/people/page.tsx` (lines 680-855)
- **Current Implementation**:
  - User creation dialog requires both `organizationId` and `workspaceId` to be manually selected
  - Organization selector is visible and required (lines 728-760)
  - Workspace selector is visible and required (lines 762-782)
  - Validation checks for both fields (lines 218-225)
  - Form submission includes both fields (lines 230-238)

### Backend
- **Controller**: `services/core-api/src/modules/user/user.controller.ts`
  - `POST /users` endpoint (lines 46-62)
  - Currently requires `organizationId` and `workspaceId` in body
  - Passes `req.user.organizationId` to service
  
- **Service**: `services/core-api/src/modules/user/user.service.ts`
  - `createUser()` method (lines 295-413)
  - Currently requires both `organizationId` and `workspaceId` in data
  - Enforces tenant isolation via `OkrTenantGuard`
  - Validates workspace belongs to organization
  - Creates RBAC role assignments

### Tenant Context
- **Hook**: `apps/web/src/contexts/workspace.context.tsx`
  - Provides `currentOrganization` via `useWorkspace()`
  - Provides `workspaces` array filtered by organization
  - `isSuperuser` flag available

### RBAC Inspector
- **Location**: `services/core-api/src/modules/rbac/rbac-inspector.service.ts`
- **Flag**: `user.settings.debug.rbacInspectorEnabled` (boolean)
- **Access**: Available via `RBACInspectorService.getInspectorEnabled(userId)`

### Audit Logging
- **Service**: `services/core-api/src/modules/audit/audit-log.service.ts`
- **Current Usage**: User creation already logs `CREATE_USER` action (line 403-410 in user.service.ts)

## Missing Features

1. **Auto-tenant injection**: Backend doesn't auto-inject tenant from `req.user.organizationId` when `dto.tenantId` is absent
2. **Optional workspace**: Backend requires `workspaceId`; should be optional
3. **Dev Inspector cross-tenant**: No logic to allow SUPERUSER with dev inspector to create cross-tenant users
4. **Frontend auto-context**: Form doesn't auto-detect tenant from context
5. **Workspace visibility**: Workspace selector not hidden when no workspaces exist
6. **Dev toggle UI**: No developer toggle for cross-tenant creation in frontend

## Files to Modify

### Frontend
1. `apps/web/src/app/dashboard/settings/people/page.tsx`
   - Update user creation dialog (lines 680-855)
   - Auto-detect tenant from context
   - Hide workspace selector when none exist
   - Make workspace optional
   - Add dev inspector toggle for SUPERUSER

### Backend
1. `services/core-api/src/modules/user/user.controller.ts`
   - Update `createUser()` to accept optional `tenantId`
   - Auto-inject tenant from `req.user.organizationId` if absent
   
2. `services/core-api/src/modules/user/user.service.ts`
   - Update `createUser()` signature to make `workspaceId` optional
   - Add dev inspector check for cross-tenant creation
   - Update validation logic
   - Improve audit logging

### Tests
1. `services/core-api/src/modules/users/__tests__/user.create.autocontext.spec.ts` (new)
2. `apps/web/src/app/dashboard/admin/users/__tests__/user.creation.drawer.spec.tsx` (new)

## Implementation Plan

### Step 1: Backend Changes
- Make `organizationId` optional in DTO, auto-inject from `req.user.organizationId`
- Make `workspaceId` optional
- Add dev inspector check for cross-tenant
- Update validation and audit logging

### Step 2: Frontend Changes
- Use `useWorkspace()` to get `currentOrganization`
- Hide organization selector when context exists
- Show read-only tenant info line
- Hide workspace selector when no workspaces
- Make workspace optional
- Add dev inspector toggle for SUPERUSER

### Step 3: Tests
- Backend: Auto-context, dev inspector, optional workspace
- Frontend: UI rendering, form submission


