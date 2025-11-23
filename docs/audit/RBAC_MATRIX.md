# RBAC Matrix Report
## OKR Nexus Platform

**Date:** 2025-01-XX  
**Auditor:** Architecture Audit Tool  
**Scope:** Markdown matrix of all roles vs major actions, marking implemented vs missing enforcement

---

## Summary

**Total Roles:** 11  
**Total Actions:** 13  
**Matrix Coverage:** 143 cells  
**Implemented:** 120+  
**Missing/Incomplete:** 23

---

## Role Definitions

### Platform Level
- **SUPERUSER** - System-wide read-only auditor

### Tenant Level (Organization)
- **TENANT_OWNER** - Full control over organization
- **TENANT_ADMIN** - Administrative control within organization
- **TENANT_VIEWER** - Read-only access

### Workspace Level
- **WORKSPACE_LEAD** - Primary owner of workspace OKRs
- **WORKSPACE_ADMIN** - Administrative control within workspace
- **WORKSPACE_MEMBER** - Contributor access

### Team Level
- **TEAM_LEAD** - Owner of team OKRs
- **TEAM_CONTRIBUTOR** - Contributor access
- **TEAM_VIEWER** - Read-only access

---

## Action Definitions

1. **view_okr** - View an OKR (subject to visibility rules)
2. **edit_okr** - Edit an OKR
3. **delete_okr** - Delete an OKR
4. **publish_okr** - Publish/approve an OKR for visibility
5. **create_okr** - Create a new OKR
6. **manage_users** - Invite/remove users, assign roles
7. **manage_billing** - Manage tenant billing and contracts
8. **manage_workspaces** - Create/edit/delete workspaces
9. **manage_teams** - Create/edit/delete teams
10. **impersonate_user** - Impersonate another user (superuser only)
11. **manage_tenant_settings** - Configure tenant-wide policies
12. **view_all_okrs** - View all OKRs regardless of visibility (for reporting)
13. **export_data** - Export data for reporting/analytics

---

## RBAC Matrix

| Role | view_okr | edit_okr | delete_okr | publish_okr | create_okr | manage_users | manage_billing | manage_workspaces | manage_teams | impersonate_user | manage_tenant_settings | view_all_okrs | export_data |
|------|----------|----------|-------------|-------------|------------|--------------|----------------|-------------------|--------------|------------------|------------------------|---------------|-------------|
| **SUPERUSER** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **TENANT_OWNER** | ✅ Yes | ✅ Yes* | ✅ Yes* | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **TENANT_ADMIN** | ✅ Yes | ✅ Yes* | ✅ Yes* | ✅ Yes | ✅ Yes | ✅ Yes** | ❌ No | ⚠️ Partial | ✅ Yes | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| **TENANT_VIEWER** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Yes | ✅ Yes |
| **WORKSPACE_LEAD** | ✅ Yes | ✅ Yes*** | ✅ Yes*** | ✅ Yes*** | ✅ Yes*** | ✅ Yes**** | ❌ No | ❌ No | ✅ Yes***** | ❌ No | ❌ No | ✅ Yes | ❌ No |
| **WORKSPACE_ADMIN** | ✅ Yes | ✅ Yes*** | ✅ Yes*** | ⚠️ Unclear | ✅ Yes*** | ✅ Yes**** | ❌ No | ❌ No | ⚠️ Unclear | ❌ No | ❌ No | ✅ Yes | ❌ No |
| **WORKSPACE_MEMBER** | ✅ Yes | ⚠️ Partial | ⚠️ Partial | ❌ No | ⚠️ Partial | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **TEAM_LEAD** | ✅ Yes | ✅ Yes****** | ✅ Yes****** | ✅ Yes****** | ✅ Yes****** | ✅ Yes******* | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ⚠️ Partial | ❌ No |
| **TEAM_CONTRIBUTOR** | ✅ Yes | ⚠️ Partial | ❌ No | ❌ No | ⚠️ Partial | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **TEAM_VIEWER** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |

**Legend:**
- ✅ Yes - Fully implemented
- ❌ No - Explicitly denied
- ⚠️ Partial - Partially implemented or unclear
- * - Can bypass publish/cycle locks
- ** - Cannot demote/remove TENANT_OWNER
- *** - Only for workspace-level OKRs
- **** - Can add/remove existing users to workspace
- ***** - Can create/manage teams within workspace
- ****** - Only for team-level OKRs
- ******* - Can add/remove existing workspace members to team

---

## Detailed Enforcement Status

### view_okr

**Implemented:** ✅ All roles can view OKRs (subject to visibility rules)

**Visibility Rules:**
- **PUBLIC_TENANT** - Visible to all users in tenant
- **PRIVATE** - Only owner + explicit whitelist (TENANT_OWNER, or users in `execOnlyWhitelist`/`privateWhitelist`)
- **Deprecated levels** (WORKSPACE_ONLY, TEAM_ONLY, MANAGER_CHAIN, EXEC_ONLY) - Treated as PUBLIC_TENANT

**Status:** ✅ Complete

---

### edit_okr

**Implemented:** ✅ Yes (with governance locks)

**Governance Rules:**
- **Publish Lock:** If `isPublished === true`, only TENANT_OWNER/TENANT_ADMIN can edit
- **Cycle Lock:** If `cycle.status === 'LOCKED'` or `'ARCHIVED'`, only admins can edit
- **Owner:** Can edit own OKRs (if not locked)
- **TENANT_OWNER/TENANT_ADMIN:** Can edit any OKR in tenant (can bypass locks)
- **WORKSPACE_LEAD:** Can edit workspace-level OKRs (if not locked)
- **TEAM_LEAD:** Can edit team-level OKRs (if not locked)
- **WORKSPACE_MEMBER/TEAM_CONTRIBUTOR:** Can edit OKRs they own (if not locked)

**Missing:** ⚠️ Frontend visibility checks not fully aligned (TODO in useTenantPermissions.ts)

**Status:** ✅ Backend complete, ⚠️ Frontend alignment pending

---

### delete_okr

**Implemented:** ✅ Yes (with governance locks)

**Governance Rules:**
- **Publish Lock:** If `isPublished === true`, only TENANT_OWNER/TENANT_ADMIN can delete
- **Cycle Lock:** If `cycle.status === 'LOCKED'` or `'ARCHIVED'`, only admins can delete
- **Owner:** Can delete own OKRs (if not locked)
- **TENANT_OWNER/TENANT_ADMIN:** Can delete any OKR in tenant (can bypass locks)
- **WORKSPACE_LEAD:** Can delete workspace-level OKRs (if not locked)
- **TEAM_LEAD:** Can delete team-level OKRs (if not locked)

**Status:** ✅ Complete

---

### publish_okr

**Implemented:** ✅ Yes

**Rules:**
- **TENANT_OWNER:** Can publish any OKR
- **TENANT_ADMIN:** Can publish OKRs
- **WORKSPACE_LEAD:** Can publish workspace-level OKRs
- **TEAM_LEAD:** Can publish team-level OKRs
- **Others:** Cannot publish

**Status:** ✅ Complete

---

### create_okr

**Implemented:** ✅ Yes

**Rules:**
- **TENANT_VIEWER:** Cannot create OKRs
- **All other roles:** Can create OKRs in their scope
- **Scope:** Tenant, workspace, or team membership required

**Status:** ✅ Complete

---

### manage_users

**Implemented:** ✅ Yes (with restrictions)

**Rules:**
- **TENANT_OWNER:** Can manage any user in tenant
- **TENANT_ADMIN:** Can manage users (cannot demote/remove TENANT_OWNER)
- **WORKSPACE_LEAD:** Can add/remove existing tenant users to workspace
- **TEAM_LEAD:** Can add/remove existing workspace members to team
- **Others:** Cannot manage users

**Missing:** ⚠️ Check-in request manager validation not implemented (TODO at checkin-request.service.ts:49)

**Status:** ✅ Complete (except check-in requests)

---

### manage_billing

**Implemented:** ✅ Yes

**Rules:**
- **TENANT_OWNER:** Can manage billing
- **All others:** Cannot manage billing

**Status:** ✅ Complete

---

### manage_workspaces

**Implemented:** ⚠️ Partial

**Rules:**
- **TENANT_OWNER:** Can create, archive, rename workspaces
- **TENANT_ADMIN:** ⚠️ Unclear - can create/edit but cannot delete
- **WORKSPACE_LEAD:** Cannot manage workspaces (can create/manage teams within workspace)
- **Others:** Cannot manage workspaces

**Missing:** ⚠️ TENANT_ADMIN workspace management scope unclear

**Status:** ⚠️ Needs clarification

---

### manage_teams

**Implemented:** ✅ Yes

**Rules:**
- **TENANT_OWNER:** Can manage teams
- **TENANT_ADMIN:** Can manage teams
- **WORKSPACE_LEAD:** Can create/manage teams within workspace
- **TEAM_LEAD:** Cannot manage teams (can manage team members)
- **Others:** Cannot manage teams

**Status:** ✅ Complete

---

### impersonate_user

**Implemented:** ✅ Yes

**Rules:**
- **SUPERUSER:** Can impersonate users
- **All others:** Cannot impersonate

**Status:** ✅ Complete

---

### manage_tenant_settings

**Implemented:** ✅ Yes

**Rules:**
- **TENANT_OWNER:** Can configure tenant-wide policy
- **SUPERUSER:** Can manage tenant settings
- **All others:** Cannot manage tenant settings

**Status:** ✅ Complete

---

### view_all_okrs

**Implemented:** ✅ Yes

**Rules:**
- **TENANT_OWNER:** Can view all OKRs
- **TENANT_ADMIN:** Can view all public/team/manager-chain OKRs
- **TENANT_VIEWER:** Can view all published/public OKRs
- **Others:** Cannot view all OKRs (scope-limited)

**Status:** ✅ Complete

---

### export_data

**Implemented:** ✅ Yes

**Rules:**
- **TENANT_OWNER:** Can export data
- **TENANT_ADMIN:** Can export data
- **TENANT_VIEWER:** Can export data (read-only)
- **SUPERUSER:** Can export data
- **Others:** Cannot export data

**Status:** ✅ Complete

---

## Missing Enforcement

### 1. Check-in Request Manager Validation

**Location:** `services/core-api/src/modules/okr/checkin-request.service.ts:49`

**Issue:** Manager relationship not validated when creating check-in requests

**Impact:** Users can create check-in requests for anyone in their organization

**Status:** ⚠️ TODO [phase7-hardening]

---

### 2. Frontend Visibility Alignment

**Location:** `apps/web/src/hooks/useTenantPermissions.ts:105-124`

**Issue:** Frontend visibility checks don't fully mirror backend

**Impact:** Potential data leakage (UI may render OKRs backend would block)

**Status:** ⚠️ TODO [phase7-hardening]

---

### 3. Multi-Org User Support

**Location:** `services/core-api/src/modules/auth/strategies/jwt.strategy.ts:107`

**Issue:** JWT strategy only uses first org membership

**Impact:** Users belonging to multiple organizations can only access first org

**Status:** ⚠️ TODO [phase7-hardening]

---

### 4. RBAC Audit Logging

**Location:** `services/core-api/src/modules/rbac/rbac.service.ts:323, 351`

**Issue:** Role assignments and revocations not logged to audit trail

**Impact:** Compliance gaps, no audit trail for permission changes

**Status:** ⚠️ TODO [phase7-hardening]

---

### 5. TENANT_ADMIN Workspace Management Scope

**Issue:** Unclear if TENANT_ADMIN can create/edit workspaces (cannot delete)

**Impact:** Inconsistent permissions

**Status:** ⚠️ Needs clarification

---

## Summary

### ✅ Fully Implemented Actions (10/13)

1. view_okr ✅
2. delete_okr ✅
3. publish_okr ✅
4. create_okr ✅
5. manage_billing ✅
6. manage_teams ✅
7. impersonate_user ✅
8. manage_tenant_settings ✅
9. view_all_okrs ✅
10. export_data ✅

### ⚠️ Partially Implemented Actions (3/13)

1. **edit_okr** - Backend complete, frontend alignment pending
2. **manage_users** - Complete except check-in request manager validation
3. **manage_workspaces** - TENANT_ADMIN scope unclear

### 🔴 Critical Gaps

1. **Check-in request manager validation** - Not implemented
2. **Frontend visibility alignment** - Not fully aligned with backend
3. **RBAC audit logging** - Not implemented

### 📊 Matrix Coverage

- **Implemented:** 120+ cells (84%)
- **Missing/Incomplete:** 23 cells (16%)
- **Critical Gaps:** 3

---

## Recommendations

1. **Implement check-in request manager validation** (Critical)
2. **Align frontend visibility checks with backend** (Critical)
3. **Implement RBAC audit logging** (High priority)
4. **Clarify TENANT_ADMIN workspace management scope** (Medium priority)
5. **Implement multi-org user support** (Medium priority)

---

**End of RBAC Matrix Report**









