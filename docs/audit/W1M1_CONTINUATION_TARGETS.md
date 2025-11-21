# W1.M1 Continuation - Target Confirmation

## STEP 1. CONFIRM TARGETS

### WorkspaceController + WorkspaceService

| HTTP Method | Route | Controller Method | Service Method | @RequireAction | Tenant Isolation | SUPERUSER Block | AuditLog |
|-------------|-------|-------------------|----------------|----------------|------------------|-----------------|----------|
| POST | `/workspaces` | `create()` | `WorkspaceService.create()` | ✅ `manage_workspaces` | ❌ Missing | ❌ Missing | ❌ Missing |
| PATCH | `/workspaces/:id` | `update()` | `WorkspaceService.update()` | ✅ `manage_workspaces` | ❌ Missing | ❌ Missing | ❌ Missing |
| DELETE | `/workspaces/:id` | `delete()` | `WorkspaceService.delete()` | ✅ `manage_workspaces` | ❌ Missing | ❌ Missing | ❌ Missing |
| POST | `/workspaces/:id/members` | `addMember()` | `WorkspaceService.addMember()` | ✅ `manage_users` | ❌ Missing | ❌ Missing | ❌ Missing |
| DELETE | `/workspaces/:id/members/:userId` | `removeMember()` | `WorkspaceService.removeMember()` | ✅ `manage_users` | ❌ Missing | ❌ Missing | ❌ Missing |

**Notes:**
- Controllers already have guards and @RequireAction ✅
- Need to add tenant isolation by verifying workspace belongs to user's org
- Need to block SUPERUSER mutations
- Need AuditLog TODOs for member management

---

### TeamController + TeamService

| HTTP Method | Route | Controller Method | Service Method | @RequireAction | Tenant Isolation | SUPERUSER Block | AuditLog |
|-------------|-------|-------------------|----------------|----------------|------------------|-----------------|----------|
| POST | `/teams` | `create()` | `TeamService.create()` | ✅ `manage_teams` | ❌ Missing | ❌ Missing | ❌ Missing |
| PATCH | `/teams/:id` | `update()` | `TeamService.update()` | ✅ `manage_teams` | ❌ Missing | ❌ Missing | ❌ Missing |
| DELETE | `/teams/:id` | `delete()` | `TeamService.delete()` | ✅ `manage_teams` | ❌ Missing | ❌ Missing | ❌ Missing |
| POST | `/teams/:id/members` | `addMember()` | `TeamService.addMember()` | ✅ `manage_users` | ❌ Missing | ❌ Missing | ❌ Missing |
| DELETE | `/teams/:id/members/:userId` | `removeMember()` | `TeamService.removeMember()` | ✅ `manage_users` | ❌ Missing | ❌ Missing | ❌ Missing |

**Notes:**
- Controllers already have guards and @RequireAction ✅
- Need to add tenant isolation by verifying team's workspace belongs to user's org
- Need to block SUPERUSER mutations
- Need AuditLog TODOs for member management

---

### UserController + UserService

| HTTP Method | Route | Controller Method | Service Method | @RequireAction | Tenant Isolation | SUPERUSER Block | AuditLog |
|-------------|-------|-------------------|----------------|----------------|------------------|-----------------|----------|
| POST | `/users` | `createUser()` | `UserService.createUser()` | ✅ `manage_users` | ❌ Missing | ❌ Missing | ❌ Missing |
| PATCH | `/users/:id` | `updateUser()` | `UserService.updateUser()` | ✅ `manage_users` | ❌ Missing | ❌ Missing | ❌ Missing |
| POST | `/users/:id/reset-password` | `resetPassword()` | `UserService.resetPassword()` | ✅ `manage_users` | ❌ Missing | ❌ Missing | ❌ Missing |

**Notes:**
- Controllers already have guards and @RequireAction ✅
- `createUser()` already validates org/workspace belong together, but doesn't check caller's org
- Need to add tenant isolation: verify caller's org matches user's org (or org being created in)
- Need to block SUPERUSER mutations
- Need AuditLog TODOs for password resets and user management

---

### RBACAssignmentController + RBACService

| HTTP Method | Route | Controller Method | Service Method | @RequireAction | Tenant Isolation | SUPERUSER Block | AuditLog |
|-------------|-------|-------------------|----------------|----------------|------------------|-----------------|----------|
| POST | `/rbac/assignments/assign` | `assignRole()` | `RBACService.assignRole()` | ✅ `manage_users` | ❌ Missing | ❌ Missing | ⚠️ TODO exists |
| DELETE | `/rbac/assignments/:id` | `revokeRole()` | `RBACService.revokeRole()` | ✅ `manage_users` | ❌ Missing | ❌ Missing | ⚠️ TODO exists |

**Notes:**
- Controllers already have guards and @RequireAction ✅
- Need tenant isolation based on scopeType:
  - TENANT scope: verify scopeId matches user's org
  - WORKSPACE scope: verify workspace belongs to user's org
  - TEAM scope: verify team's workspace belongs to user's org
  - PLATFORM scope: superuser-only (already handled)
- Need to block SUPERUSER mutations (except PLATFORM scope)
- Need to update AuditLog TODOs (lines 323, 351)

---

### ExecWhitelistController + ExecWhitelistService

| HTTP Method | Route | Controller Method | Service Method | @RequireAction | Tenant Isolation | SUPERUSER Block | AuditLog |
|-------------|-------|-------------------|----------------|----------------|------------------|-----------------|----------|
| POST | `/rbac/whitelist/:tenantId/add` | `addToWhitelist()` | `ExecWhitelistService.addToWhitelist()` | ✅ `manage_tenant_settings` | ❌ Missing | ❌ Missing | ❌ Missing |
| POST | `/rbac/whitelist/:tenantId/remove` | `removeFromWhitelist()` | `ExecWhitelistService.removeFromWhitelist()` | ✅ `manage_tenant_settings` | ❌ Missing | ❌ Missing | ❌ Missing |
| POST | `/rbac/whitelist/:tenantId/set` | `setWhitelist()` | `ExecWhitelistService.setWhitelist()` | ✅ `manage_tenant_settings` | ❌ Missing | ❌ Missing | ❌ Missing |
| DELETE | `/rbac/whitelist/:tenantId` | `clearWhitelist()` | `ExecWhitelistService.clearWhitelist()` | ✅ `manage_tenant_settings` | ❌ Missing | ❌ Missing | ❌ Missing |

**Notes:**
- Controllers already have guards and @RequireAction ✅
- Need tenant isolation: verify `tenantId` matches `req.user.organizationId`
- Need to block SUPERUSER mutations
- Need AuditLog TODOs for whitelist changes (privileged operation)

---

## Summary

**Total Routes:** 20  
**Routes with Guards:** ✅ 20 (100%)  
**Routes with @RequireAction:** ✅ 20 (100%)  
**Routes Needing Tenant Isolation:** 🔴 20 (100%)  
**Routes Needing SUPERUSER Block:** 🔴 20 (100%)  
**Routes Needing AuditLog:** 🔴 18 (90%) - 2 have TODOs

**All targets confirmed. Proceeding to STEP 2.**







