# W1.M1 - Test & Validation Plan

**Date:** 2025-01-XX  
**Milestone:** W1.M1 - Role Enforcement Matrix Alignment  
**Purpose:** Manual validation steps to verify enforcement works correctly

---

## Test Scenarios

### Test 1: SUPERUSER Cannot Mutate Tenant Data

**Setup:**
1. Create a SUPERUSER account
2. Create a tenant organization (Org A) with a TENANT_ADMIN user

**Test Cases:**

#### 1.1 SUPERUSER Cannot Create Organizations
- **Action:** Log in as SUPERUSER, POST `/api/organizations`
- **Expected:** `403 Forbidden` with message "SUPERUSER is read-only; cannot modify tenant data."
- **Status:** ✅ Should pass after SuperuserController changes

#### 1.2 SUPERUSER Cannot Create/Edit/Delete OKRs
- **Action:** Log in as SUPERUSER, POST `/api/objectives`
- **Expected:** `403 Forbidden` with message "Superusers are read-only; cannot modify resources."
- **Status:** ✅ Should pass (already enforced via OkrTenantGuard)

#### 1.3 SUPERUSER Cannot Create/Edit/Delete Initiatives
- **Action:** Log in as SUPERUSER, POST `/api/initiatives`
- **Expected:** `403 Forbidden` with message "Superusers are read-only; cannot modify resources."
- **Status:** ✅ Should pass after InitiativeService changes

#### 1.4 SUPERUSER Cannot Create/Edit/Delete Workspaces
- **Action:** Log in as SUPERUSER, POST `/api/workspaces`
- **Expected:** `403 Forbidden` with message "Superusers are read-only; cannot modify resources."
- **Status:** ⚠️ Requires WorkspaceService changes

#### 1.5 SUPERUSER Cannot Create/Edit/Delete Teams
- **Action:** Log in as SUPERUSER, POST `/api/teams`
- **Expected:** `403 Forbidden` with message "Superusers are read-only; cannot modify resources."
- **Status:** ⚠️ Requires TeamService changes

#### 1.6 SUPERUSER Cannot Assign Roles
- **Action:** Log in as SUPERUSER, POST `/api/rbac/assignments/assign`
- **Expected:** `403 Forbidden` with message "Superusers are read-only; cannot modify resources."
- **Status:** ⚠️ Requires RBACService changes

---

### Test 2: Tenant Isolation Enforcement

**Setup:**
1. Create two organizations: Org A and Org B
2. Create TENANT_ADMIN user in Org A (userA)
3. Create TENANT_ADMIN user in Org B (userB)
4. Create a workspace in Org A (workspaceA)
5. Create a workspace in Org B (workspaceB)

**Test Cases:**

#### 2.1 User Cannot Create Workspace in Other Org
- **Action:** Log in as userA, POST `/api/workspaces` with `organizationId: orgB.id`
- **Expected:** `403 Forbidden` with message "You do not have permission to modify resources outside your organization."
- **Status:** ⚠️ Requires WorkspaceService changes

#### 2.2 User Cannot Update Workspace in Other Org
- **Action:** Log in as userA, PATCH `/api/workspaces/${workspaceB.id}`
- **Expected:** `403 Forbidden` with message "You do not have permission to modify resources outside your organization."
- **Status:** ⚠️ Requires WorkspaceService changes

#### 2.3 User Cannot Create Team in Other Org's Workspace
- **Action:** Log in as userA, POST `/api/teams` with `workspaceId: workspaceB.id`
- **Expected:** `403 Forbidden` with message "You do not have permission to modify resources outside your organization."
- **Status:** ⚠️ Requires TeamService changes

#### 2.4 User Cannot Add Member to Other Org's Workspace
- **Action:** Log in as userA, POST `/api/workspaces/${workspaceB.id}/members`
- **Expected:** `403 Forbidden` with message "You do not have permission to modify resources outside your organization."
- **Status:** ⚠️ Requires WorkspaceService changes

#### 2.5 User Cannot Assign Role in Other Org
- **Action:** Log in as userA, POST `/api/rbac/assignments/assign` with `scopeId: orgB.id`
- **Expected:** `403 Forbidden` with message "You do not have permission to modify resources outside your organization."
- **Status:** ⚠️ Requires RBACService changes

---

### Test 3: Missing Guards Enforcement

**Setup:**
1. Create a normal user (not superuser, not admin)

**Test Cases:**

#### 3.1 Normal User Cannot Access Migration Endpoints
- **Action:** Log in as normal user, POST `/api/rbac/migration/all`
- **Expected:** `403 Forbidden` (RBACGuard + `impersonate_user` action blocks non-superusers)
- **Status:** ✅ Should pass after RBACMigrationController changes

#### 3.2 Normal User Cannot Access Superuser Endpoints
- **Action:** Log in as normal user, POST `/api/superuser/create`
- **Expected:** `403 Forbidden` (RBACGuard + `impersonate_user` action blocks non-superusers)
- **Status:** ✅ Should pass after SuperuserController changes

---

### Test 4: AuditLog Coverage

**Setup:**
1. Create a TENANT_ADMIN user
2. Enable AuditLog queries (if AuditLog service exists)

**Test Cases:**

#### 4.1 Role Assignment Creates AuditLog
- **Action:** Log in as TENANT_ADMIN, POST `/api/rbac/assignments/assign`
- **Expected:** AuditLog entry with `action='GRANT_ROLE'`, `targetId=userId`, `actorUserId=caller.id`
- **Status:** ⚠️ Requires RBACService AuditLog implementation

#### 4.2 Organization Creation Creates AuditLog
- **Action:** Log in as TENANT_ADMIN, POST `/api/organizations`
- **Expected:** AuditLog entry with `action='CREATE_ORG'` (if implemented) or TODO comment present
- **Status:** ✅ TODO comment added (actual implementation pending)

---

## Validation Checklist

### Backend Validation

- [ ] All mutating routes have `@UseGuards(JwtAuthGuard, RBACGuard)`
- [ ] All mutating routes have `@RequireAction('<action>')` decorator
- [ ] All service methods call `OkrTenantGuard.assertCanMutateTenant()`
- [ ] All service methods call `OkrTenantGuard.assertSameTenant()` before mutations
- [ ] SUPERUSER mutations are blocked at service layer
- [ ] AuditLog TODOs are present or implemented

### Frontend Validation

- [ ] Error messages display correctly when SUPERUSER tries to mutate
- [ ] Error messages display correctly when user tries to mutate other tenant's data
- [ ] UI prevents SUPERUSER from seeing mutation buttons (if applicable)

---

## Manual Test Commands

### Test SUPERUSER Block (using curl)

```bash
# Login as SUPERUSER
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superuser@example.com","password":"password"}' \
  | jq -r '.access_token')

# Try to create organization (should fail)
curl -X POST http://localhost:3000/api/organizations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Org","slug":"test-org"}'
# Expected: 403 Forbidden

# Try to create objective (should fail)
curl -X POST http://localhost:3000/api/objectives \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Objective","organizationId":"org-123"}'
# Expected: 403 Forbidden
```

### Test Tenant Isolation (using curl)

```bash
# Login as userA (Org A)
TOKEN_A=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"usera@example.com","password":"password"}' \
  | jq -r '.access_token')

# Try to update workspace in Org B (should fail)
curl -X PATCH http://localhost:3000/api/workspaces/workspace-b-id \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"name":"Hacked Workspace"}'
# Expected: 403 Forbidden
```

---

## Known Issues from BUILD_AND_TEST_REPORT.md

### Should Be Resolved

1. **TypeScript Build Errors** - These are unrelated to W1.M1 (Prisma client regeneration issue)
2. **ESLint Errors** - Unused variables (unrelated to W1.M1)

### May Be Resolved

1. **Missing RBAC Enforcement** - Should be resolved by adding guards to RBACMigrationController and SuperuserController
2. **Missing Tenant Isolation** - Should be resolved by adding OkrTenantGuard checks to services

---

## TODOs Addressed from TODO_AUDIT.md

### Partially Addressed

1. **Check-in Request Manager Validation** (TODO at checkin-request.service.ts:49)
   - Status: ⚠️ Still TODO - not addressed in this milestone
   - Note: This is a separate issue (manager relationship validation)

2. **RBAC Audit Logging** (TODO at rbac.service.ts:323, 351)
   - Status: ⚠️ TODO comments added, implementation pending
   - Note: AuditLog service may not exist yet

3. **Frontend Visibility Alignment** (TODO at useTenantPermissions.ts:105-124)
   - Status: ❌ Not addressed - frontend is out of scope for W1.M1

4. **Multi-Org User Support** (TODO at jwt.strategy.ts:107)
   - Status: ❌ Not addressed - separate issue

---

## Success Criteria

✅ **All mutating routes have guards** - JwtAuthGuard + RBACGuard  
✅ **All mutating routes have @RequireAction** - Action matches RBAC_MATRIX.md  
✅ **All service methods enforce tenant isolation** - OkrTenantGuard.assertCanMutateTenant() + assertSameTenant()  
✅ **SUPERUSER cannot mutate tenant data** - Blocked at service layer  
✅ **AuditLog TODOs present** - Or actual implementation if AuditLog service exists  

---

**Next:** Complete remaining service implementations (WorkspaceService, TeamService, UserService, RBACService, ExecWhitelistService)

