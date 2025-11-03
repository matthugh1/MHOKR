# Dual Permission Systems Analysis & Recommendations

## Executive Summary

The OKR Framework currently operates with **two parallel permission systems**:

1. **Legacy System**: `OrganizationMember`, `WorkspaceMember`, `TeamMember` tables (`MemberRole` enum)
2. **New RBAC System**: `RoleAssignment` table (`RBACRole` enum, `ScopeType`)

Both systems are actively used, causing permission mismatches, data synchronization issues, and developer confusion.

---

## Why Both Systems Exist

### Historical Context

1. **Original System (Legacy)**:
   - `OrganizationMember`, `WorkspaceMember`, `TeamMember` tables
   - Simple `MemberRole` enum: `SUPERUSER`, `ORG_ADMIN`, `WORKSPACE_OWNER`, `TEAM_LEAD`, `MEMBER`, `VIEWER`
   - Used for basic organization/workspace/team membership tracking
   - Originally designed for UI display purposes

2. **RBAC Migration**:
   - New `RoleAssignment` table introduced for more granular, action-based permissions
   - `RBACRole` enum with 10 roles: `SUPERUSER`, `TENANT_OWNER`, `TENANT_ADMIN`, `TENANT_VIEWER`, `WORKSPACE_LEAD`, `WORKSPACE_ADMIN`, `WORKSPACE_MEMBER`, `TEAM_LEAD`, `TEAM_CONTRIBUTOR`, `TEAM_VIEWER`
   - `ScopeType` enum: `PLATFORM`, `TENANT`, `WORKSPACE`, `TEAM`
   - Supports visibility-based access control (PUBLIC_TENANT, WORKSPACE_ONLY, TEAM_ONLY, PRIVATE)
   - Better performance with caching
   - Built-in audit logging

3. **Migration Status**:
   - Backend controllers migrated: OKR controllers use `RBACGuard` with `@RequireAction()`
   - Migration service exists (`rbac/migration.service.ts`) to copy data from old → new
   - **BUT**: Both systems remain active and write to different tables

---

## Current Usage Analysis

### Where Legacy System is Used

#### Backend (Still Writing):
1. **`organization.service.ts`**:
   - `addMember()` - Creates/updates `OrganizationMember` records
   - `removeMember()` - Deletes `OrganizationMember` records
   - `getMembers()` - Reads from `OrganizationMember` table

2. **`workspace.service.ts`**:
   - `addMember()` - Creates/updates `WorkspaceMember` records
   - `removeMember()` - Deletes `WorkspaceMember` records
   - `getMembers()` - Reads from `WorkspaceMember` and `TeamMember` tables

3. **`team.service.ts`**:
   - `addMember()` - Creates `TeamMember` records
   - `removeMember()` - Deletes `TeamMember` records

4. **`user.service.ts`**:
   - `getUserContext()` - Reads `teamMembers`, `workspaceMembers`, `organizationMembers` to build UI context
   - `createUser()` - Creates `OrganizationMember` and `WorkspaceMember` records during user creation

5. **`role.service.ts`**:
   - `getUserRoles()` - Queries all three legacy tables
   - `getUserOrganizationRole()` - Queries `OrganizationMember`
   - `getUserWorkspaceRole()` - Queries `WorkspaceMember` and `TeamMember`
   - `getUserTeamRole()` - Queries `TeamMember`

6. **`superuser.service.ts`**:
   - `addUserToOrganization()` - Creates `OrganizationMember` records

7. **Bootstrap scripts**:
   - `prisma/bootstrapOrg.ts` - Creates legacy membership records

#### Frontend (Still Reading):
1. **`workspace.context.tsx`**:
   - Calls `/users/me/context` endpoint
   - Gets `teams` array with `role` field from `TeamMember` table
   - Uses this for UI display and filtering

2. **UI Components**:
   - Display user roles in member lists
   - Filter workspaces/teams based on user's role
   - Show/hide buttons based on legacy role values

### Where New RBAC System is Used

#### Backend (Authorization):
1. **`rbac.service.ts`**:
   - `getUserRoleAssignments()` - Queries `RoleAssignment` table
   - `assignRole()` - Writes to `RoleAssignment` table
   - `revokeRole()` - Deletes from `RoleAssignment` table
   - `can()` - Checks permissions using `RoleAssignment` data

2. **Controllers**:
   - `objective.controller.ts` - Uses `RBACGuard` with `@RequireAction('view_okr')`, etc.
   - `key-result.controller.ts` - Uses `RBACGuard`
   - `initiative.controller.ts` - Uses `RBACGuard`

3. **Permission Checks**:
   - All OKR-related authorization uses `RoleAssignment` table

#### Frontend (Authorization):
1. **`usePermissions.ts`**:
   - Calls `/rbac/assignments/me` endpoint
   - Uses `RoleAssignment` data for permission checks (`canEditOKR`, `canDeleteOKR`, etc.)
   - ✅ **Already migrated to new system**

2. **`useTenantPermissions.ts`**:
   - Uses `usePermissions()` hook (new system)
   - ✅ **Already migrated to new system**

---

## Problems This Causes

### 1. **Data Synchronization Issues**
- User assigned role via `organization.service.addMember()` → writes to `OrganizationMember`
- User assigned role via `rbac.service.assignRole()` → writes to `RoleAssignment`
- **Result**: Data can drift out of sync. Sarah Chen has role in `RoleAssignment` but not in `OrganizationMember` (or vice versa)

### 2. **Permission Mismatches**
- Frontend UI shows buttons based on legacy `TeamMember.role` field
- Backend authorization checks `RoleAssignment` table
- **Result**: Frontend shows "Edit" button, but backend rejects request (or vice versa)

### 3. **Two Sources of Truth**
- `user.service.getUserContext()` reads from legacy tables for UI display
- `rbac.service.getUserRoleAssignments()` reads from `RoleAssignment` for authorization
- **Result**: UI shows different roles than what backend enforces

### 4. **Developer Confusion**
- New developers don't know which system to use
- Existing code uses both systems inconsistently
- Migration service exists but both systems still active

### 5. **Maintenance Burden**
- Bug fixes need to be applied to both systems
- Feature changes require updates in multiple places
- Testing requires verifying both systems work correctly

---

## Evidence from Codebase

### Frontend Uses Legacy System for UI:
```typescript
// apps/web/src/contexts/workspace.context.tsx:132
setTeams(userContextData.teams || [])  // Teams with role from TeamMember table

// apps/web/src/hooks/usePermissions.ts (OLD CODE - replaced)
const { teams } = useWorkspace()  // Gets teams with role from old system
return teams.some(t => t.role === 'ORG_ADMIN')  // Reads from TeamMember.role
```

### Backend Uses Legacy System for UI Display:
```typescript
// services/core-api/src/modules/user/user.service.ts:119-125
const teams = user.teamMembers.map(tm => ({
  id: tm.team.id,
  name: tm.team.name,
  role: tm.role,  // ← Reads from TeamMember table
  workspaceId: tm.team.workspaceId,
  workspace: tm.team.workspace.name,
}));
```

### Backend Uses New System for Authorization:
```typescript
// services/core-api/src/modules/rbac/rbac.service.ts
const assignments = await this.prisma.roleAssignment.findMany({
  where: { userId }
})  // ← Reads from RoleAssignment table
```

---

## Recommendations

### Option 1: Complete Migration (Recommended) ⭐

**Goal**: Make `RoleAssignment` the single source of truth for all permissions.

#### Phase 1: Backend Migration (2-3 weeks)

1. **Update all service methods to write to both systems** (temporary):
   - Modify `organization.service.addMember()` to also call `rbacService.assignRole()`
   - Modify `workspace.service.addMember()` to also call `rbacService.assignRole()`
   - Modify `team.service.addMember()` to also call `rbacService.assignRole()`
   - **This ensures data stays in sync during transition**

2. **Update `user.service.getUserContext()` to read from `RoleAssignment`**:
   - Map `RoleAssignment` records to teams/workspaces/organizations
   - Return role information from `RoleAssignment` instead of legacy tables
   - Keep legacy table reads for backward compatibility during transition

3. **Update `role.service.ts` to use `RoleAssignment`**:
   - Migrate `getUserRoles()`, `getUserOrganizationRole()`, etc. to read from `RoleAssignment`
   - Keep legacy methods as deprecated wrappers

4. **Run migration script**:
   - Ensure all existing data is migrated from legacy → new system
   - Verify no data loss

#### Phase 2: Frontend Migration (1 week)

1. **Update workspace context**:
   - Frontend already uses `/rbac/assignments/me` in `usePermissions.ts` ✅
   - Update `workspace.context.tsx` to use RBAC data for team roles
   - Remove dependency on legacy `TeamMember.role` field

2. **Update UI components**:
   - Replace all references to legacy role fields
   - Use RBAC roles from `usePermissions()` hook

#### Phase 3: Remove Legacy System (1 week)

1. **Mark legacy tables as deprecated**:
   - Add database comments/documentation
   - Add code comments warning against new usage

2. **Create read-only wrappers**:
   - Keep legacy table reads for backward compatibility
   - But mark methods as `@Deprecated()`

3. **Remove write operations**:
   - Remove all `create()`, `update()`, `delete()` calls to legacy tables
   - Replace with `rbacService.assignRole()` / `revokeRole()`

4. **Schedule database cleanup** (future):
   - After 6+ months of monitoring, consider removing legacy tables
   - But keep migration scripts for historical data

#### Benefits:
- ✅ Single source of truth
- ✅ Consistent permissions across frontend/backend
- ✅ Better performance (caching)
- ✅ More granular roles
- ✅ Built-in audit logging

#### Risks:
- ⚠️ Requires careful migration to avoid data loss
- ⚠️ Need to test all permission checks thoroughly
- ⚠️ Temporary increase in writes (both systems) during transition

---

### Option 2: Bridge Pattern (Temporary Solution)

**Goal**: Keep both systems but sync them automatically.

#### Implementation:
1. **Create a sync service**:
   - Listen to changes in legacy tables
   - Automatically create/update `RoleAssignment` records
   - Listen to changes in `RoleAssignment` table
   - Automatically update legacy tables (if needed)

2. **Update frontend**:
   - Always use `RoleAssignment` for authorization checks
   - Use legacy tables only for UI display (until migrated)

3. **Backend**:
   - Continue using `RoleAssignment` for authorization
   - Sync writes to both systems

#### Benefits:
- ✅ Less risky than full migration
- ✅ Can be done incrementally
- ✅ Maintains backward compatibility

#### Drawbacks:
- ⚠️ Still maintains two systems
- ⚠️ Sync logic can fail, causing drift
- ⚠️ Additional complexity

---

### Option 3: Keep Both Systems (Not Recommended)

**Goal**: Use legacy for UI display, new for authorization.

#### Implementation:
1. **Clear separation**:
   - Legacy tables: UI display only
   - `RoleAssignment`: Authorization only

2. **Documentation**:
   - Clear documentation of which system to use when
   - Code comments marking each usage

3. **Sync on writes**:
   - When assigning roles, write to both systems

#### Benefits:
- ✅ Minimal code changes
- ✅ Backward compatible

#### Drawbacks:
- ❌ Still two sources of truth
- ❌ Confusing for developers
- ❌ Maintenance burden
- ❌ Risk of data drift

---

## Recommended Path Forward

### Immediate Actions (This Week):

1. **Document current state**:
   - ✅ This document created
   - Create migration checklist

2. **Fix immediate bug** (Sarah Chen):
   - Ensure `RoleAssignment` has correct role
   - Update `user.service.getUserContext()` to read from `RoleAssignment` for team roles
   - This fixes the button visibility issue

### Short Term (Next 2-3 Weeks):

1. **Phase 1: Backend Migration** (Option 1):
   - Update service methods to write to both systems
   - Update `getUserContext()` to read from `RoleAssignment`
   - Run migration script for all existing data

2. **Phase 2: Frontend Migration**:
   - Update workspace context to use RBAC data
   - Remove legacy role field dependencies

### Long Term (Next 3-6 Months):

1. **Phase 3: Remove Legacy Writes**:
   - Mark all legacy write operations as deprecated
   - Replace with `rbacService` calls
   - Monitor for 2-3 months

2. **Future: Remove Legacy Tables**:
   - After extended monitoring period
   - Create database migration to drop legacy tables
   - Keep migration scripts for historical reference

---

## Migration Checklist

### Backend:
- [ ] Update `organization.service.addMember()` to also write to `RoleAssignment`
- [ ] Update `workspace.service.addMember()` to also write to `RoleAssignment`
- [ ] Update `team.service.addMember()` to also write to `RoleAssignment`
- [ ] Update `user.service.getUserContext()` to read from `RoleAssignment` for roles
- [ ] Update `role.service.ts` methods to use `RoleAssignment`
- [ ] Run migration script: `POST /rbac/migration/all`
- [ ] Verify migration: `GET /rbac/migration/verify`
- [ ] Test all permission checks

### Frontend:
- [ ] Update `workspace.context.tsx` to get roles from RBAC endpoint
- [ ] Remove references to `TeamMember.role` field
- [ ] Test UI permission checks (buttons, filters, etc.)

### Testing:
- [ ] Test user role assignment (all scopes)
- [ ] Test permission checks (view, edit, delete OKRs)
- [ ] Test UI display (member lists, role badges)
- [ ] Test authorization (backend guards)
- [ ] Test data synchronization (assign role, verify both systems)

### Documentation:
- [ ] Update API documentation
- [ ] Update developer guide
- [ ] Add code comments marking legacy usage
- [ ] Create migration guide for future developers

---

## Conclusion

The dual permission system is a **technical debt** from an incomplete migration. The recommended path forward is **Option 1: Complete Migration** to make `RoleAssignment` the single source of truth. This will:

1. Eliminate permission mismatches
2. Reduce developer confusion
3. Improve maintainability
4. Provide better performance with caching
5. Enable more granular permissions

The migration can be done incrementally with minimal risk by:
- Writing to both systems during transition
- Reading from new system while keeping legacy reads as fallback
- Gradually removing legacy writes
- Eventually removing legacy tables

**Priority**: High - This affects core functionality and user experience (as seen with Sarah Chen's button visibility issue).

