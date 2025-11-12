# W1.M1 Continuation - Patch Plan

## STEP 2. PATCH PLAN

### File 1: WorkspaceService
**Path:** `services/core-api/src/modules/workspace/workspace.service.ts`

**Changes:**
1. Add import: `import { OkrTenantGuard } from '../okr/tenant-guard';`
2. **`create()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start
   - Add `OkrTenantGuard.assertSameTenant(data.organizationId, userOrganizationId)` before create
   - Add `// TODO: AuditLog(action='CREATE_WORKSPACE', targetId=created.id, actorUserId=userId)`

3. **`update()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start
   - Get existing workspace, verify `workspace.organizationId` matches `userOrganizationId`
   - Add `// TODO: AuditLog(action='UPDATE_WORKSPACE', targetId=id, actorUserId=userId)`

4. **`delete()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start
   - Get existing workspace, verify `workspace.organizationId` matches `userOrganizationId`
   - Add `// TODO: AuditLog(action='DELETE_WORKSPACE', targetId=id, actorUserId=userId)`

5. **`addMember()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start
   - Get workspace, verify `workspace.organizationId` matches `userOrganizationId`
   - Add `// TODO: AuditLog(action='ADD_WORKSPACE_MEMBER', targetId=userId, actorUserId=actorUserId, metadata={role})`

6. **`removeMember()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start
   - Get workspace, verify `workspace.organizationId` matches `userOrganizationId`
   - Add `// TODO: AuditLog(action='REMOVE_WORKSPACE_MEMBER', targetId=userId, actorUserId=actorUserId)`

---

### File 2: WorkspaceController
**Path:** `services/core-api/src/modules/workspace/workspace.controller.ts`

**Changes:**
1. **`create()` method:** Pass `req.user.organizationId` to service
2. **`update()` method:** Pass `req.user.organizationId` to service
3. **`delete()` method:** Pass `req.user.organizationId` to service
4. **`addMember()` method:** Pass `req.user.organizationId` to service
5. **`removeMember()` method:** Pass `req.user.organizationId` to service

---

### File 3: TeamService
**Path:** `services/core-api/src/modules/team/team.service.ts`

**Changes:**
1. Add import: `import { OkrTenantGuard } from '../okr/tenant-guard';`

2. **`create()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start
   - Get workspace, verify `workspace.organizationId` matches `userOrganizationId`
   - Add `// TODO: AuditLog(action='CREATE_TEAM', targetId=created.id, actorUserId=userId)`

3. **`update()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start
   - Get team with workspace, verify `team.workspace.organizationId` matches `userOrganizationId`
   - Add `// TODO: AuditLog(action='UPDATE_TEAM', targetId=id, actorUserId=userId)`

4. **`delete()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start
   - Get team with workspace, verify `team.workspace.organizationId` matches `userOrganizationId`
   - Add `// TODO: AuditLog(action='DELETE_TEAM', targetId=id, actorUserId=userId)`

5. **`addMember()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start
   - Get team with workspace, verify `team.workspace.organizationId` matches `userOrganizationId`
   - Add `// TODO: AuditLog(action='ADD_TEAM_MEMBER', targetId=data.userId, actorUserId=actorUserId, metadata={role})`

6. **`removeMember()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start
   - Get team with workspace, verify `team.workspace.organizationId` matches `userOrganizationId`
   - Add `// TODO: AuditLog(action='REMOVE_TEAM_MEMBER', targetId=userId, actorUserId=actorUserId)`

---

### File 4: TeamController
**Path:** `services/core-api/src/modules/team/team.controller.ts`

**Changes:**
1. **`create()` method:** Pass `req.user.organizationId` to service
2. **`update()` method:** Pass `req.user.organizationId` to service
3. **`delete()` method:** Pass `req.user.organizationId` to service
4. **`addMember()` method:** Pass `req.user.organizationId` to service
5. **`removeMember()` method:** Pass `req.user.organizationId` to service

---

### File 5: UserService
**Path:** `services/core-api/src/modules/user/user.service.ts`

**Changes:**
1. Add import: `import { OkrTenantGuard } from '../okr/tenant-guard';`

2. **`createUser()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start
   - Verify `data.organizationId` matches `userOrganizationId` (caller's org)
   - Add `// TODO: AuditLog(action='CREATE_USER', targetId=created.id, actorUserId=actorUserId)`

3. **`updateUser()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start
   - Get user's org membership, verify matches `userOrganizationId`
   - Add `// TODO: AuditLog(action='UPDATE_USER', targetId=userId, actorUserId=actorUserId)`

4. **`resetPassword()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start
   - Get user's org membership, verify matches `userOrganizationId`
   - Add `// TODO: AuditLog(action='RESET_PASSWORD', targetId=userId, actorUserId=actorUserId)`

---

### File 6: UserController
**Path:** `services/core-api/src/modules/user/user.controller.ts`

**Changes:**
1. **`createUser()` method:** Pass `req.user.organizationId` to service
2. **`updateUser()` method:** Pass `req.user.organizationId` to service
3. **`resetPassword()` method:** Pass `req.user.organizationId` to service

---

### File 7: RBACService
**Path:** `services/core-api/src/modules/rbac/rbac.service.ts`

**Changes:**
1. Add import: `import { OkrTenantGuard } from '../okr/tenant-guard';`

2. **`assignRole()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start (unless scopeType === 'PLATFORM')
   - Add tenant isolation based on scopeType:
     - TENANT: verify `scopeId === userOrganizationId`
     - WORKSPACE: verify workspace belongs to `userOrganizationId`
     - TEAM: verify team's workspace belongs to `userOrganizationId`
     - PLATFORM: superuser-only (already handled)
   - Replace TODO at line 323 with: `// TODO: AuditLog(action='GRANT_ROLE', targetId=userId, actorUserId=revokedBy, previousRole=null, newRole=role, scopeType=scopeType, scopeId=scopeId)`

3. **`revokeRole()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start (unless scopeType === 'PLATFORM')
   - Add tenant isolation based on scopeType (same as assignRole)
   - Replace TODO at line 351 with: `// TODO: AuditLog(action='REVOKE_ROLE', targetId=userId, actorUserId=revokedBy, previousRole=role, newRole=null, scopeType=scopeType, scopeId=scopeId)`

---

### File 8: RBACAssignmentController
**Path:** `services/core-api/src/modules/rbac/rbac-assignment.controller.ts`

**Changes:**
1. **`assignRole()` method:** Pass `req.user.organizationId` to service
2. **`revokeRole()` method:** Pass `req.user.organizationId` to service

---

### File 9: ExecWhitelistService
**Path:** `services/core-api/src/modules/rbac/exec-whitelist.service.ts`

**Changes:**
1. Add import: `import { OkrTenantGuard } from '../okr/tenant-guard';`

2. **`addToWhitelist()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start
   - Add `OkrTenantGuard.assertSameTenant(tenantId, userOrganizationId)` before update
   - Add `// TODO: AuditLog(action='ADD_TO_EXEC_WHITELIST', targetId=userId, actorUserId=actorUserId, metadata={tenantId})`

3. **`removeFromWhitelist()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start
   - Add `OkrTenantGuard.assertSameTenant(tenantId, userOrganizationId)` before update
   - Add `// TODO: AuditLog(action='REMOVE_FROM_EXEC_WHITELIST', targetId=userId, actorUserId=actorUserId, metadata={tenantId})`

4. **`setWhitelist()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start
   - Add `OkrTenantGuard.assertSameTenant(tenantId, userOrganizationId)` before update
   - Add `// TODO: AuditLog(action='SET_EXEC_WHITELIST', targetId=tenantId, actorUserId=actorUserId, metadata={userIds})`

5. **`clearWhitelist()` method:**
   - Add parameter: `userOrganizationId: string | null | undefined`
   - Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` at start
   - Add `OkrTenantGuard.assertSameTenant(tenantId, userOrganizationId)` before update
   - Add `// TODO: AuditLog(action='CLEAR_EXEC_WHITELIST', targetId=tenantId, actorUserId=actorUserId)`

---

### File 10: ExecWhitelistController (in rbac-assignment.controller.ts)
**Path:** `services/core-api/src/modules/rbac/rbac-assignment.controller.ts`

**Changes:**
1. **`addToWhitelist()` method:** Verify `tenantId === req.user.organizationId`, pass `req.user.organizationId` to service
2. **`removeFromWhitelist()` method:** Verify `tenantId === req.user.organizationId`, pass `req.user.organizationId` to service
3. **`setWhitelist()` method:** Verify `tenantId === req.user.organizationId`, pass `req.user.organizationId` to service
4. **`clearWhitelist()` method:** Verify `tenantId === req.user.organizationId`, pass `req.user.organizationId` to service

---

## Summary

**Total Files to Modify:** 10  
**Total Service Methods:** 20  
**Total Controller Methods:** 20  

**Pattern Applied:**
- ✅ Guards already present (no changes needed)
- ✅ @RequireAction already present (no changes needed)
- 🔴 Add tenant isolation to all service methods
- 🔴 Add SUPERUSER block to all service methods
- 🔴 Add AuditLog TODOs to all mutation methods





