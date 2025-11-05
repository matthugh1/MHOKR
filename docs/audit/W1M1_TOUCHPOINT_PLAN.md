# W1.M1 - Touchpoint Plan

**Date:** 2025-01-XX  
**Milestone:** W1.M1 - Role Enforcement Matrix Alignment  
**Purpose:** Complete checklist of files that must change to close security gaps

---

## Files Requiring Changes

### 🔴 CRITICAL - Missing Guards

#### 1. RBACMigrationController
**File:** `services/core-api/src/modules/rbac/migration.controller.ts`
- **Add:** `@UseGuards(JwtAuthGuard, RBACGuard)` (replace single guard)
- **Add:** `@RequireAction('impersonate_user')` to POST routes (superuser-only action)
- **Change:** Add tenant isolation check in service layer (migration should not mutate tenant data)

#### 2. SuperuserController
**File:** `services/core-api/src/modules/superuser/superuser.controller.ts`
- **Add:** `@UseGuards(JwtAuthGuard, RBACGuard)` (replace single guard)
- **Add:** `@RequireAction('impersonate_user')` to all mutating routes (superuser-only)
- **Change:** Block SUPERUSER from mutating organizations (service layer)

---

### 🔴 CRITICAL - Missing Tenant Isolation (17 routes)

#### 3. InitiativeService
**File:** `services/core-api/src/modules/okr/initiative.service.ts`
- **Methods:** `create()`, `update()`, `delete()`
- **Add:** `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start of each method
- **Add:** `OkrTenantGuard.assertSameTenant(resourceOrgId, userOrgId)` before mutations
- **Add:** Extract `userOrganizationId` from request context (via controller)

#### 4. OrganizationService
**File:** `services/core-api/src/modules/organization/organization.service.ts`
- **Methods:** `create()`, `update()`, `delete()`, `addMember()`, `removeMember()`
- **Add:** `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start of each method
- **Add:** `OkrTenantGuard.assertSameTenant(resourceOrgId, userOrgId)` before mutations
- **Add:** Extract `userOrganizationId` from request context (via controller)

#### 5. WorkspaceService
**File:** `services/core-api/src/modules/workspace/workspace.service.ts`
- **Methods:** `create()`, `update()`, `delete()`, `addMember()`, `removeMember()`
- **Add:** `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start of each method
- **Add:** `OkrTenantGuard.assertSameTenant(resourceOrgId, userOrgId)` before mutations
- **Add:** Extract `userOrganizationId` from request context (via controller)

#### 6. TeamService
**File:** `services/core-api/src/modules/team/team.service.ts`
- **Methods:** `create()`, `update()`, `delete()`, `addMember()`, `removeMember()`
- **Add:** `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start of each method
- **Add:** `OkrTenantGuard.assertSameTenant(resourceOrgId, userOrgId)` before mutations
- **Add:** Extract `userOrganizationId` from request context (via controller)

#### 7. UserService
**File:** `services/core-api/src/modules/user/user.service.ts`
- **Methods:** `createUser()`, `updateUser()`, `resetPassword()`
- **Add:** `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start of each method
- **Add:** `OkrTenantGuard.assertSameTenant(resourceOrgId, userOrgId)` before mutations
- **Add:** Extract `userOrganizationId` from request context (via controller)

#### 8. RBACService
**File:** `services/core-api/src/modules/rbac/rbac.service.ts`
- **Methods:** `assignRole()`, `revokeRole()`
- **Add:** `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start of each method
- **Add:** Tenant isolation check based on scopeType/scopeId
- **Add:** Extract `userOrganizationId` from request context (via controller)

#### 9. ExecWhitelistService
**File:** `services/core-api/src/modules/rbac/exec-whitelist.service.ts`
- **Methods:** `addToWhitelist()`, `removeFromWhitelist()`, `setWhitelist()`, `clearWhitelist()`
- **Add:** `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start of each method
- **Add:** `OkrTenantGuard.assertSameTenant(tenantId, userOrganizationId)` before mutations
- **Add:** Extract `userOrganizationId` from request context (via controller)

#### 10. SuperuserService
**File:** `services/core-api/src/modules/superuser/superuser.service.ts`
- **Methods:** `createOrganization()`, `addUserToOrganization()`, `removeUserFromOrganization()`
- **Add:** Block SUPERUSER from mutating organizations (SUPERUSER is read-only per RBAC_MATRIX.md)
- **Change:** These methods should throw ForbiddenException if called by SUPERUSER

---

### ⚠️ MEDIUM - Missing AuditLog

#### 11. RBACService (AuditLog TODOs)
**File:** `services/core-api/src/modules/rbac/rbac.service.ts`
- **Methods:** `assignRole()` (line 323), `revokeRole()` (line 351)
- **Add:** AuditLog entries or TODO comments if AuditLog service not available
- **Pattern:** `// TODO: AuditLog(action='GRANT_ROLE', ...)` or actual implementation

#### 12. CheckInRequestService (AuditLog)
**File:** `services/core-api/src/modules/okr/checkin-request.service.ts`
- **Methods:** `createRequests()`, `submitResponse()`
- **Add:** `// TODO: AuditLog(action='CREATE_CHECKIN_REQUEST', ...)` or actual implementation

#### 13. ObjectiveService (AuditLog)
**File:** `services/core-api/src/modules/okr/objective.service.ts`
- **Methods:** `update()` (if publish changes), `delete()`
- **Add:** `// TODO: AuditLog(action='PUBLISH_OKR'/'DELETE_OKR', ...)` or actual implementation

#### 14. KeyResultService (AuditLog)
**File:** `services/core-api/src/modules/okr/key-result.service.ts`
- **Methods:** `createCheckIn()`
- **Add:** `// TODO: AuditLog(action='CREATE_CHECKIN', ...)` or actual implementation

#### 15. OrganizationService (AuditLog)
**File:** `services/core-api/src/modules/organization/organization.service.ts`
- **Methods:** `create()`, `update()`, `delete()`, `addMember()`, `removeMember()`
- **Add:** `// TODO: AuditLog(action='CREATE_ORG'/'UPDATE_ORG'/'DELETE_ORG'/'ADD_MEMBER'/'REMOVE_MEMBER', ...)` or actual implementation

#### 16. WorkspaceService (AuditLog)
**File:** `services/core-api/src/modules/workspace/workspace.service.ts`
- **Methods:** `create()`, `update()`, `delete()`, `addMember()`, `removeMember()`
- **Add:** `// TODO: AuditLog(action='CREATE_WORKSPACE'/'UPDATE_WORKSPACE'/'DELETE_WORKSPACE'/'ADD_MEMBER'/'REMOVE_MEMBER', ...)` or actual implementation

#### 17. TeamService (AuditLog)
**File:** `services/core-api/src/modules/team/team.service.ts`
- **Methods:** `create()`, `update()`, `delete()`, `addMember()`, `removeMember()`
- **Add:** `// TODO: AuditLog(action='CREATE_TEAM'/'UPDATE_TEAM'/'DELETE_TEAM'/'ADD_MEMBER'/'REMOVE_MEMBER', ...)` or actual implementation

#### 18. UserService (AuditLog)
**File:** `services/core-api/src/modules/user/user.service.ts`
- **Methods:** `createUser()`, `updateUser()`, `resetPassword()`
- **Add:** `// TODO: AuditLog(action='CREATE_USER'/'UPDATE_USER'/'RESET_PASSWORD', ...)` or actual implementation

#### 19. SuperuserService (AuditLog)
**File:** `services/core-api/src/modules/superuser/superuser.service.ts`
- **Methods:** `promoteToSuperuser()`, `revokeSuperuser()`, `impersonateUser()`
- **Add:** `// TODO: AuditLog(action='PROMOTE_SUPERUSER'/'REVOKE_SUPERUSER'/'IMPERSONATE_USER', ...)` or actual implementation

---

### ⚠️ MEDIUM - Controller Updates (Pass userOrganizationId)

#### 20. InitiativeController
**File:** `services/core-api/src/modules/okr/initiative.controller.ts`
- **Change:** Pass `req.user.organizationId` to service methods (`create()`, `update()`, `delete()`)

#### 21. OrganizationController
**File:** `services/core-api/src/modules/organization/organization.controller.ts`
- **Change:** Pass `req.user.organizationId` to service methods (`create()`, `update()`, `delete()`, `addMember()`, `removeMember()`)
- **Note:** For `update()` and `delete()`, verify tenant match before calling service

#### 22. WorkspaceController
**File:** `services/core-api/src/modules/workspace/workspace.controller.ts`
- **Change:** Pass `req.user.organizationId` to service methods (`create()`, `update()`, `delete()`, `addMember()`, `removeMember()`)
- **Note:** For `update()` and `delete()`, verify tenant match before calling service

#### 23. TeamController
**File:** `services/core-api/src/modules/team/team.controller.ts`
- **Change:** Pass `req.user.organizationId` to service methods (`create()`, `update()`, `delete()`, `addMember()`, `removeMember()`)
- **Note:** For `update()` and `delete()`, verify tenant match before calling service

#### 24. UserController
**File:** `services/core-api/src/modules/user/user.controller.ts`
- **Change:** Pass `req.user.organizationId` to service methods (`createUser()`, `updateUser()`, `resetPassword()`)

#### 25. RBACAssignmentController
**File:** `services/core-api/src/modules/rbac/rbac-assignment.controller.ts`
- **Change:** Pass `req.user.organizationId` to service methods (`assignRole()`, `revokeRole()`)

#### 26. ExecWhitelistController
**File:** `services/core-api/src/modules/rbac/rbac-assignment.controller.ts` (ExecWhitelistController section)
- **Change:** Pass `req.user.organizationId` to service methods (`addToWhitelist()`, `removeFromWhitelist()`, `setWhitelist()`, `clearWhitelist()`)
- **Change:** Verify `tenantId` matches `req.user.organizationId` before calling service

---

## Summary

**Total Files to Modify:** 26  
**Critical Priority:** 10 files (missing guards, tenant isolation, SUPERUSER blocks)  
**Medium Priority:** 16 files (AuditLog, controller updates)

**Estimated Changes:**
- Controller guards: 2 files
- Service tenant isolation: 8 files
- Service SUPERUSER blocks: 1 file
- AuditLog TODOs: 9 files
- Controller parameter passing: 7 files

---

## Implementation Order

1. **Phase 1:** Add missing guards (RBACMigrationController, SuperuserController)
2. **Phase 2:** Add tenant isolation to services (InitiativeService, OrganizationService, WorkspaceService, TeamService, UserService, RBACService, ExecWhitelistService)
3. **Phase 3:** Block SUPERUSER mutations (SuperuserService)
4. **Phase 4:** Update controllers to pass userOrganizationId
5. **Phase 5:** Add AuditLog TODOs (or implement if AuditLog service exists)

---

**Next:** See STEP 4 for code modifications.



