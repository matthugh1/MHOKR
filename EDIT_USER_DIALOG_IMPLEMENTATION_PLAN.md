# Edit User Dialog - Implementation Plan

## Analysis Summary

After analyzing the edit user dialog in `apps/web/src/app/dashboard/settings/people/page.tsx`, I've identified several areas where functionality is not properly wired up or uses outdated patterns.

---

## Issues Identified

### 1. **Name and Email Fields Are Disabled** ❌
**Location:** Lines 1185, 1189  
**Current State:** Both fields are read-only (`disabled` attribute)  
**Expected:** Should be editable with save functionality  
**Backend Support:** ✅ `PATCH /users/:id` endpoint exists (`user.service.ts:629`)

### 2. **Role Assignment Uses Legacy Role Names** ❌
**Location:** Lines 1614-1617, 1678-1680, 1728-1731  
**Current State:** Uses legacy roles (`MEMBER`, `ORG_ADMIN`, `VIEWER`, `WORKSPACE_OWNER`)  
**Expected:** Should use RBAC roles (`TENANT_OWNER`, `TENANT_ADMIN`, `TENANT_VIEWER`, `WORKSPACE_LEAD`, `WORKSPACE_ADMIN`, `WORKSPACE_MEMBER`, `TEAM_LEAD`, `TEAM_CONTRIBUTOR`, `TEAM_VIEWER`)  
**Backend Support:** ✅ Backend maps legacy roles to RBAC, but frontend should use RBAC directly

### 3. **"Assign Role" Button Shows TODO** ❌
**Location:** Line 1231-1245  
**Current State:** Shows toast message "Role assignment UI coming soon"  
**Expected:** Should open a dialog to assign/edit roles using RBAC system  
**Backend Support:** ✅ `POST /rbac/assign` endpoint exists (`rbac.service.ts:435`)

### 4. **No Way to Edit Existing Role Assignments** ❌
**Location:** Lines 1442-1459, 1490-1507, 1534-1549  
**Current State:** Only shows remove button, no edit capability  
**Expected:** Should be able to change roles without removing and re-adding  
**Backend Support:** ✅ Backend updates role if assignment exists (`organization.service.ts:531`, `workspace.service.ts:627`, `team.service.ts:247`)

### 5. **Role Selection Doesn't Match RBAC System** ❌
**Location:** All role selection dropdowns  
**Current State:** Limited role options, doesn't show all available RBAC roles  
**Expected:** Show all appropriate RBAC roles for each scope level  
**Backend Support:** ✅ Full RBAC role support exists

### 6. **Missing Role Assignment Update Functionality** ❌
**Location:** Throughout role assignment dialogs  
**Current State:** Can only add or remove, cannot update existing assignments  
**Expected:** Should be able to change a user's role in an existing assignment  
**Backend Support:** ✅ Backend handles updates automatically when assignment exists

### 7. **No Direct RBAC Role Assignment** ❌
**Location:** All assignment handlers  
**Current State:** Uses legacy endpoints (`/organizations/:id/members`, `/workspaces/:id/members`, `/teams/:id/members`)  
**Expected:** Should use RBAC endpoints directly (`/rbac/assign`) for better control  
**Backend Support:** ✅ RBAC endpoints exist and are preferred

---

## Implementation Plan

### Phase 1: Enable Name and Email Editing ✅ HIGH PRIORITY

**Tasks:**
1. Remove `disabled` attribute from Name and Email inputs
2. Add state management for edited values
3. Add "Save" button for user info section
4. Implement `handleUpdateUserInfo` function
5. Call `PATCH /users/:id` endpoint
6. Show success/error toasts
7. Refresh user data after successful update

**Files to Modify:**
- `apps/web/src/app/dashboard/settings/people/page.tsx`

**Estimated Effort:** 1-2 hours

---

### Phase 2: Update Role Selection to Use RBAC Roles ✅ HIGH PRIORITY

**Tasks:**
1. Create role mapping constants for each scope:
   - **Tenant:** `TENANT_OWNER`, `TENANT_ADMIN`, `TENANT_VIEWER`
   - **Workspace:** `WORKSPACE_LEAD`, `WORKSPACE_ADMIN`, `WORKSPACE_MEMBER`
   - **Team:** `TEAM_LEAD`, `TEAM_CONTRIBUTOR`, `TEAM_VIEWER`
2. Update all role selection dropdowns to use RBAC roles
3. Update role descriptions to match RBAC roles
4. Update `handleAssignToOrg`, `handleAssignToWorkspace`, `handleAssignToTeam` to use RBAC roles
5. Map RBAC roles to legacy format for backend compatibility (if needed)

**Files to Modify:**
- `apps/web/src/app/dashboard/settings/people/page.tsx`

**Estimated Effort:** 2-3 hours

---

### Phase 3: Implement Role Assignment Dialog ✅ HIGH PRIORITY

**Tasks:**
1. Create new `RoleAssignmentDialog` component
2. Support assigning roles at Tenant, Workspace, and Team levels
3. Show available roles based on scope type
4. Allow selecting organization/workspace/team
5. Use RBAC endpoint: `POST /rbac/assign`
6. Handle both create and update scenarios
7. Show role descriptions with tooltips
8. Validate permissions before showing dialog

**Files to Create:**
- `apps/web/src/components/user/RoleAssignmentDialog.tsx`

**Files to Modify:**
- `apps/web/src/app/dashboard/settings/people/page.tsx`

**Estimated Effort:** 4-5 hours

---

### Phase 4: Add Edit Role Functionality ✅ MEDIUM PRIORITY

**Tasks:**
1. Add "Edit Role" button next to each role badge in the drawer
2. Open role assignment dialog in "edit" mode
3. Pre-populate with current role
4. Update existing assignment instead of creating new one
5. Use same RBAC endpoint (backend handles update automatically)
6. Refresh user data after update

**Files to Modify:**
- `apps/web/src/app/dashboard/settings/people/page.tsx`
- `apps/web/src/components/user/RoleAssignmentDialog.tsx` (if created)

**Estimated Effort:** 2-3 hours

---

### Phase 5: Migrate to Direct RBAC Endpoints ✅ MEDIUM PRIORITY

**Tasks:**
1. Replace legacy endpoints with RBAC endpoints:
   - `POST /organizations/:id/members` → `POST /rbac/assign`
   - `POST /workspaces/:id/members` → `POST /rbac/assign`
   - `POST /teams/:id/members` → `POST /rbac/assign`
2. Update request payloads to match RBAC format:
   ```typescript
   {
     userId: string,
     role: Role, // RBAC role
     scopeType: 'TENANT' | 'WORKSPACE' | 'TEAM',
     scopeId: string
   }
   ```
3. Update error handling for new endpoint
4. Test all assignment flows

**Files to Modify:**
- `apps/web/src/app/dashboard/settings/people/page.tsx`

**Estimated Effort:** 2-3 hours

---

### Phase 6: Improve Role Display and Management ✅ LOW PRIORITY

**Tasks:**
1. Show role badges with proper RBAC role names
2. Add tooltips explaining each role's permissions
3. Group roles by scope in the drawer
4. Show effective permissions summary
5. Add visual indicators for role hierarchy
6. Improve role removal confirmation dialogs

**Files to Modify:**
- `apps/web/src/app/dashboard/settings/people/page.tsx`

**Estimated Effort:** 2-3 hours

---

## Technical Details

### Backend Endpoints Available

1. **Update User Info:**
   - `PATCH /users/:id` - Update name/email
   - Requires: `manage_users` permission

2. **RBAC Role Assignment:**
   - `POST /rbac/assign` - Assign/update role
   - Payload: `{ userId, role, scopeType, scopeId }`
   - Requires: `manage_users` permission

3. **Legacy Endpoints (Still Work, But Should Migrate):**
   - `POST /organizations/:id/members` - Maps to RBAC internally
   - `POST /workspaces/:id/members` - Maps to RBAC internally
   - `POST /teams/:id/members` - Maps to RBAC internally

### RBAC Role Mapping

**Tenant Level:**
- `ORG_ADMIN` → `TENANT_ADMIN`
- `MEMBER` → `TENANT_VIEWER` (or `TENANT_ADMIN` depending on context)
- `VIEWER` → `TENANT_VIEWER`

**Workspace Level:**
- `WORKSPACE_OWNER` → `WORKSPACE_LEAD`
- `MEMBER` → `WORKSPACE_MEMBER`
- `VIEWER` → `WORKSPACE_MEMBER` (or `WORKSPACE_VIEWER` if exists)

**Team Level:**
- `TEAM_LEAD` → `TEAM_LEAD`
- `MEMBER` → `TEAM_CONTRIBUTOR`
- `WORKSPACE_ADMIN` → `WORKSPACE_ADMIN` (workspace-level role)
- `ORG_ADMIN` → `TENANT_ADMIN` (tenant-level role)

---

## Implementation Order

1. **Phase 1** - Enable Name/Email editing (Quick win, high value)
2. **Phase 2** - Update role selection to RBAC (Foundation for other work)
3. **Phase 3** - Implement role assignment dialog (Core functionality)
4. **Phase 4** - Add edit role functionality (Enhancement)
5. **Phase 5** - Migrate to RBAC endpoints (Technical improvement)
6. **Phase 6** - Improve UI/UX (Polish)

---

## Testing Checklist

- [ ] Can edit user name and save changes
- [ ] Can edit user email and save changes
- [ ] Email validation works correctly
- [ ] Error handling for duplicate emails
- [ ] Can assign tenant-level RBAC roles
- [ ] Can assign workspace-level RBAC roles
- [ ] Can assign team-level RBAC roles
- [ ] Can edit existing role assignments
- [ ] Can remove role assignments
- [ ] Role descriptions are accurate
- [ ] Permissions are enforced correctly
- [ ] Superuser can manage cross-tenant users
- [ ] Regular admins can only manage their tenant

---

## Estimated Total Effort

**Total:** 13-19 hours

**Breakdown:**
- Phase 1: 1-2 hours
- Phase 2: 2-3 hours
- Phase 3: 4-5 hours
- Phase 4: 2-3 hours
- Phase 5: 2-3 hours
- Phase 6: 2-3 hours

---

## Notes

- Backend already supports all required functionality
- Main work is updating frontend to use RBAC system properly
- Legacy endpoints still work but should be migrated for consistency
- Role assignment automatically updates if assignment exists (backend handles this)
- Need to ensure proper permission checks before showing edit options

