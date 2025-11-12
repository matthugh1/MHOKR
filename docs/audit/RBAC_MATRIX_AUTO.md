# RBAC Matrix (Auto-Generated)

**Generated:** 2025-11-03  
**Source:** `services/core-api/src/modules/rbac/`

This document provides a comprehensive matrix of the RBAC (Role-Based Access Control) system, mapping roles to actions and scopes. All information is derived directly from the codebase with file/line citations.

## Table of Contents

1. [Role Hierarchy](#role-hierarchy)
2. [Actions by Role](#actions-by-role)
3. [Action Authorization Logic](#action-authorization-logic)
4. [Visibility Rules](#visibility-rules)
5. [Special Cases and Constraints](#special-cases-and-constraints)

---

## Role Hierarchy

**Source:** `services/core-api/src/modules/rbac/types.ts:251-269`

```
Priority Level | Role              | Scope     | Description
---------------|-------------------|-----------|-------------
100            | SUPERUSER         | PLATFORM  | Platform administrator (read-only for OKRs)
90             | TENANT_OWNER      | TENANT    | Full commercial/contractual owner
80             | TENANT_ADMIN      | TENANT    | Operational tenant administrator
70             | WORKSPACE_LEAD    | WORKSPACE | Department/functional leader
60             | WORKSPACE_ADMIN   | WORKSPACE | Workspace administrator
50             | TEAM_LEAD         | TEAM      | Team manager
40             | WORKSPACE_MEMBER  | WORKSPACE | Standard workspace member
30             | TEAM_CONTRIBUTOR  | TEAM      | Active team member
20             | TEAM_VIEWER       | TEAM      | Read-only team member
10             | TENANT_VIEWER     | TENANT    | Read-only tenant observer
```

---

## Actions by Role

### SUPERUSER (Platform-level)

**Authorization Logic:** `services/core-api/src/modules/rbac/rbac.ts:161-202`

| Action | Allowed | Line Reference | Notes |
|--------|---------|----------------|-------|
| `view_okr` | ✅ | 167 | Can view ALL OKRs |
| `view_all_okrs` | ✅ | 167 | Reporting access |
| `impersonate_user` | ✅ | 172-174 | Admin tooling |
| `export_data` | ✅ | 177-179 | Data export for support |
| `manage_users` | ✅ | 186-194 | User administration |
| `manage_workspaces` | ✅ | 186-194 | Workspace administration |
| `manage_teams` | ✅ | 186-194 | Team administration |
| `manage_tenant_settings` | ✅ | 186-194 | Tenant configuration |
| `edit_okr` | ❌ | 182-184 | **DENIED** - Read-only for OKRs |
| `delete_okr` | ❌ | 182-184 | **DENIED** - Read-only for OKRs |
| `create_okr` | ❌ | 182-184 | **DENIED** - Read-only for OKRs |
| `publish_okr` | ❌ | 182-184 | **DENIED** - Read-only for OKRs |
| `request_checkin` | ❌ | 182-184 | **DENIED** - Read-only for OKRs |
| `manage_billing` | ❌ | 196-199 | **DENIED** - Not in scope |

**Key Constraint:** SUPERUSER has read-only access to OKR content. Cannot create, edit, delete, or publish OKRs.

---

### TENANT_OWNER

**Capabilities:** `services/core-api/src/modules/rbac/rbac.ts:204-218`

| Action | Allowed | Authorization Logic | Line Reference |
|--------|---------|---------------------|----------------|
| `view_okr` | ✅ | All OKRs including PRIVATE | 712-714 |
| `edit_okr` | ✅ | Can edit ANY OKR (draft or published) | 311-313, 332-334 |
| `delete_okr` | ✅ | Can delete ANY OKR (draft or published) | 379-381, 400-402 |
| `create_okr` | ✅ | Can create OKRs anywhere in tenant | 438-444 |
| `publish_okr` | ✅ | Can publish ANY OKR | 531-533 |
| `request_checkin` | ✅ | Can request from any user | 484-490 |
| `manage_users` | ✅ | Full user management in tenant | 562-565 |
| `manage_billing` | ✅ | **ONLY role with billing access** | 600-601 |
| `manage_workspaces` | ✅ | Create, archive, rename workspaces | 625-627 |
| `manage_teams` | ✅ | Manage teams across tenant | 649-651 |
| `manage_tenant_settings` | ✅ | Configure tenant-wide policies | 699 |
| `view_all_okrs` | ✅ | View ALL OKRs including restricted | 712-714 |
| `export_data` | ✅ | Full data export | 740-742 |

**Visibility:** Can view PRIVATE OKRs (`visibilityPolicy.ts:71-74`)

---

### TENANT_ADMIN

**Capabilities:** `services/core-api/src/modules/rbac/rbac.ts:220-236`

| Action | Allowed | Authorization Logic | Line Reference | Constraints |
|--------|---------|---------------------|----------------|-------------|
| `view_okr` | ✅ | Most OKRs | 274-286 | Cannot view PRIVATE unless whitelisted |
| `edit_okr` | ✅ | Can edit published OKRs | 314-320, 336-342 | **Cannot edit EXEC_ONLY** unless `allowTenantAdminExecVisibility=true` |
| `delete_okr` | ✅ | Can delete published OKRs | 382-388, 404-410 | **Cannot delete EXEC_ONLY** unless allowed |
| `create_okr` | ✅ | Can create OKRs | 438-444 | Except if only TENANT_VIEWER |
| `publish_okr` | ✅ | Can publish OKRs | 536-538 | - |
| `request_checkin` | ✅ | Can request check-ins | 484-490 | - |
| `manage_users` | ✅ | User management | 568-575 | **Cannot demote/remove TENANT_OWNER** |
| `manage_billing` | ❌ | **DENIED** | 600-601 | Only TENANT_OWNER |
| `manage_workspaces` | ✅ | Create/edit workspaces | 630-632 | **Cannot delete workspaces** |
| `manage_teams` | ✅ | Manage teams | 653-655 | - |
| `manage_tenant_settings` | ❌ | **DENIED** | 699 | Only TENANT_OWNER |
| `view_all_okrs` | ✅ | Most OKRs | 717-719 | May not see EXEC_ONLY depending on setting |
| `export_data` | ✅ | Data export | 745-747 | - |

**Key Constraints:**
- Publish Lock: Lines 310-323, 378-390
- EXEC_ONLY restriction: Lines 316-319, 338-341, 384-387, 406-409

---

### WORKSPACE_LEAD

**Capabilities:** `services/core-api/src/modules/rbac/rbac.ts:238-251`

| Action | Allowed | Authorization Logic | Line Reference |
|--------|---------|---------------------|----------------|
| `view_okr` | ✅ | All OKRs in workspace | 274-286 |
| `edit_okr` | ✅ | Workspace-level OKRs (draft only) | 344-347 |
| `delete_okr` | ✅ | Workspace-level OKRs (draft only) | 412-415 |
| `create_okr` | ✅ | Create workspace OKRs | 448-452 |
| `publish_okr` | ✅ | Publish workspace OKRs | 541-543 |
| `request_checkin` | ✅ | Request within workspace | 493-498 |
| `manage_users` | ✅ | Add/remove users in workspace | 577-581 | **Can only add EXISTING tenant users** |
| `manage_billing` | ❌ | **DENIED** | - |
| `manage_workspaces` | ❌ | **DENIED** | - | Can manage teams within workspace |
| `manage_teams` | ✅ | Create/manage teams in workspace | 658-661 |

**Key Constraint:** Cannot edit/delete published OKRs (lines 310-323, 378-390)

---

### TEAM_LEAD

**Capabilities:** `services/core-api/src/modules/rbac/rbac.ts:253-264`

| Action | Allowed | Authorization Logic | Line Reference |
|--------|---------|---------------------|----------------|
| `view_okr` | ✅ | Team OKRs + personal OKRs of members | 274-286 |
| `edit_okr` | ✅ | Team-level OKRs (draft only) | 349-352 |
| `delete_okr` | ✅ | Team-level OKRs (draft only) | 417-423 |
| `create_okr` | ✅ | Create team OKRs | 456-461 |
| `publish_okr` | ✅ | Publish team OKRs | 545-548 |
| `request_checkin` | ✅ | Request within team | 502-507 |
| `manage_users` | ✅ | Add/remove team members | 583-586 | **Can only add EXISTING workspace members** |

**Key Constraint:** Cannot edit/delete published OKRs. Cannot edit personal OKRs of team members (lines 310-323, 378-390).

---

### WORKSPACE_MEMBER / WORKSPACE_ADMIN

| Action | Allowed | Authorization Logic | Line Reference |
|--------|---------|---------------------|----------------|
| `view_okr` | ✅ | OKRs in workspace | 274-286 |
| `edit_okr` | ✅ | **Own OKRs only** (draft) | 327-329 |
| `delete_okr` | ✅ | **Own OKRs only** (draft) | 395-397 |
| `create_okr` | ✅ | Create personal OKRs | 448-452 |
| `request_checkin` | ✅ | Request from others | 493-498 |

---

### TEAM_CONTRIBUTOR

| Action | Allowed | Authorization Logic | Line Reference |
|--------|---------|---------------------|----------------|
| `view_okr` | ✅ | Team OKRs | 274-286 |
| `edit_okr` | ✅ | **Own OKRs only** (draft) | 327-329 |
| `delete_okr` | ✅ | **Own OKRs only** (draft) | 395-397 |
| `create_okr` | ✅ | Create personal OKRs | 456-461 |
| `request_checkin` | ✅ | Request from others | 502-507 |

---

### TENANT_VIEWER

| Action | Allowed | Authorization Logic | Line Reference |
|--------|---------|---------------------|----------------|
| `view_okr` | ✅ | Published/public OKRs | 274-286 |
| `view_all_okrs` | ✅ | Published OKRs (reporting) | 722-725 |
| `export_data` | ✅ | Read-only export | 750-753 |
| `create_okr` | ❌ | **DENIED** (alone) | 441-443 |
| `request_checkin` | ❌ | **DENIED** (alone) | 486-489 |

**Key Constraint:** If user ONLY has TENANT_VIEWER role (no other roles), they cannot create OKRs or request check-ins.

---

### TEAM_VIEWER

| Action | Allowed | Authorization Logic | Line Reference |
|--------|---------|---------------------|----------------|
| `view_okr` | ✅ | Team OKRs | 274-286 |
| `create_okr` | ❌ | **DENIED** | 458-460 |
| `request_checkin` | ❌ | **DENIED** | 504-506 |

---

## Action Authorization Logic

### 1. `view_okr` - View an OKR

**Primary Function:** `services/core-api/src/modules/rbac/rbac.ts:274-287`  
**Visibility Policy:** `services/core-api/src/modules/rbac/visibilityPolicy.ts:29-54`

**Logic:**
```
IF no specific OKR provided:
  RETURN true  // All authenticated users can see lists (line 281)
ELSE:
  CHECK visibility policy (line 286)
  
Visibility Policy (visibilityPolicy.ts:29-54):
  IF SUPERUSER:
    RETURN true (line 35-36)
  IF owner:
    RETURN true (line 40-42)
  IF visibility == 'PRIVATE':
    CHECK canViewPrivate (lines 46-48)
  ELSE:
    RETURN true  // All other levels are globally visible (line 53)
```

**PRIVATE Visibility Logic** (`visibilityPolicy.ts:62-107`):
```
IF TENANT_OWNER in tenant:
  RETURN true (lines 71-74)
IF userId in tenant.privateWhitelist:
  RETURN true (lines 78-82)
IF userId in tenant.execOnlyWhitelist:
  RETURN true (lines 85-89)
IF userId in tenant.metadata.privateWhitelist:
  RETURN true (lines 94-97)
ELSE:
  RETURN false
```

---

### 2. `edit_okr` - Edit an OKR

**Primary Function:** `services/core-api/src/modules/rbac/rbac.ts:295-355`

**Publish Lock Logic** (lines 310-323):
```
IF okr.isPublished == true:
  IF TENANT_OWNER:
    RETURN true (lines 311-313)
  IF TENANT_ADMIN AND NOT (visibility == 'EXEC_ONLY' AND NOT allowTenantAdminExecVisibility):
    RETURN true (lines 314-320)
  ELSE:
    RETURN false  // All other roles BLOCKED (line 322)
```

**Draft OKR Logic** (lines 326-353):
```
IF okr.ownerId == userId:
  RETURN true (lines 327-329)
IF TENANT_OWNER:
  RETURN true (lines 332-334)
IF TENANT_ADMIN AND NOT (visibility == 'EXEC_ONLY' AND NOT allowTenantAdminExecVisibility):
  RETURN true (lines 336-342)
IF WORKSPACE_LEAD AND okr.workspaceId matches:
  RETURN true (lines 344-347)
IF TEAM_LEAD AND okr.teamId matches:
  RETURN true (lines 349-352)
ELSE:
  RETURN false
```

**Key Deny Cases:**
- SUPERUSER cannot edit ANY OKRs (line 182)
- Published OKRs locked to TENANT_OWNER/TENANT_ADMIN only (lines 310-323)
- TENANT_ADMIN cannot edit EXEC_ONLY without flag (lines 316-319, 338-341)

---

### 3. `delete_okr` - Delete an OKR

**Primary Function:** `services/core-api/src/modules/rbac/rbac.ts:363-426`

**Logic mirrors `edit_okr`** with same publish lock and role constraints (lines 378-425).

**Additional Constraint for TEAM_LEAD** (lines 417-423):
```
IF TEAM_LEAD AND okr.teamId matches:
  IF okr is team-level OKR (not personal):
    RETURN true
  ELSE:
    RETURN false  // Cannot delete personal OKRs of team members
```

---

### 4. `create_okr` - Create a New OKR

**Primary Function:** `services/core-api/src/modules/rbac/rbac.ts:431-464`

**Logic:**
```
IF has any tenant role:
  IF ONLY TENANT_VIEWER:
    RETURN false (lines 441-443)
  ELSE:
    RETURN true (line 444)
IF has workspace role in target workspace:
  RETURN true (lines 448-452)
IF has team role in target team AND NOT TEAM_VIEWER:
  RETURN true (lines 456-461)
ELSE:
  RETURN false
```

**Deny Cases:**
- SUPERUSER cannot create (line 182)
- TENANT_VIEWER alone cannot create (lines 441-443)
- TEAM_VIEWER cannot create (lines 458-460)

---

### 5. `publish_okr` - Publish/Approve an OKR

**Primary Function:** `services/core-api/src/modules/rbac/rbac.ts:516-551`

**Logic:**
```
IF TENANT_OWNER:
  RETURN true (lines 531-533)
IF TENANT_ADMIN:
  RETURN true (lines 536-538)
IF WORKSPACE_LEAD AND okr.workspaceId matches:
  RETURN true (lines 541-543)
IF TEAM_LEAD AND okr.teamId matches:
  RETURN true (lines 545-548)
ELSE:
  RETURN false
```

**Deny Cases:**
- SUPERUSER cannot publish (line 182)
- Regular members cannot publish (line 550)

---

### 6. `request_checkin` - Request Check-in

**Primary Function:** `services/core-api/src/modules/rbac/rbac.ts:472-511`

**Logic:**
```
IF has any tenant role AND NOT (ONLY TENANT_VIEWER):
  RETURN true (lines 484-490)
IF has workspace role:
  RETURN true (lines 493-498)
IF has team role AND NOT TEAM_VIEWER:
  RETURN true (lines 502-507)
ELSE:
  RETURN false
```

---

### 7. `manage_users` - User Management

**Primary Function:** `services/core-api/src/modules/rbac/rbac.ts:556-589`

**Logic:**
```
IF TENANT_OWNER:
  RETURN true (lines 562-565)
IF TENANT_ADMIN:
  RETURN true (lines 568-575)
  // Note: Cannot demote/remove TENANT_OWNER (lines 570-573)
IF WORKSPACE_LEAD in target workspace:
  RETURN true (lines 577-581)
  // Can only add EXISTING tenant users
IF TEAM_LEAD in target team:
  RETURN true (lines 583-586)
  // Can only add EXISTING workspace members
ELSE:
  RETURN false
```

---

### 8. `manage_billing` - Billing Management

**Primary Function:** `services/core-api/src/modules/rbac/rbac.ts:594-602`

**Logic:**
```
IF TENANT_OWNER:
  RETURN true (line 601)
ELSE:
  RETURN false
```

**Exclusive to TENANT_OWNER.**

---

### 9. `manage_workspaces` - Workspace Management

**Primary Function:** `services/core-api/src/modules/rbac/rbac.ts:607-637`

**Logic:**
```
IF no tenantId specified:
  IF TENANT_OWNER or TENANT_ADMIN in ANY tenant:
    RETURN true (lines 616-621)
ELSE:
  IF TENANT_OWNER:
    RETURN true (lines 625-627)
    // Can create, archive, rename workspaces
  IF TENANT_ADMIN:
    RETURN true (lines 630-632)
    // Can create/edit but NOT delete
ELSE:
  RETURN false
```

---

### 10. `manage_teams` - Team Management

**Primary Function:** `services/core-api/src/modules/rbac/rbac.ts:642-664`

**Logic:**
```
IF TENANT_OWNER:
  RETURN true (lines 649-651)
IF TENANT_ADMIN:
  RETURN true (lines 653-655)
IF WORKSPACE_LEAD in target workspace:
  RETURN true (lines 658-661)
ELSE:
  RETURN false
```

---

### 11. `impersonate_user` - User Impersonation

**Primary Function:** `services/core-api/src/modules/rbac/rbac.ts:669-675`

**Logic:**
```
IF SUPERUSER:
  RETURN true (line 674)
ELSE:
  RETURN false
```

**Exclusive to SUPERUSER.**

---

### 12. `manage_tenant_settings` - Tenant Settings

**Primary Function:** `services/core-api/src/modules/rbac/rbac.ts:680-701`

**Logic:**
```
IF no tenantId specified:
  IF TENANT_OWNER in ANY tenant OR SUPERUSER:
    RETURN true (lines 689-695)
ELSE:
  IF TENANT_OWNER in specified tenant:
    RETURN true (line 699)
ELSE:
  RETURN false
```

---

### 13. `view_all_okrs` - View All OKRs (Reporting)

**Primary Function:** `services/core-api/src/modules/rbac/rbac.ts:705-728`

**Logic:**
```
IF TENANT_OWNER:
  RETURN true (lines 712-714)
IF TENANT_ADMIN:
  RETURN true (lines 717-719)
IF TENANT_VIEWER:
  RETURN true (lines 722-725)
ELSE:
  RETURN false
```

---

### 14. `export_data` - Data Export

**Primary Function:** `services/core-api/src/modules/rbac/rbac.ts:733-756`

**Logic:**
```
IF TENANT_OWNER:
  RETURN true (lines 740-742)
IF TENANT_ADMIN:
  RETURN true (lines 745-747)
IF TENANT_VIEWER:
  RETURN true (lines 750-753)
ELSE:
  RETURN false
```

---

## Visibility Rules

### Global Visibility (Default)

**Source:** `services/core-api/src/modules/rbac/visibilityPolicy.ts:44-53`

**All visibility levels EXCEPT `PRIVATE` are globally visible:**
- `PUBLIC_TENANT` (default)
- `WORKSPACE_ONLY` (deprecated, treated as PUBLIC_TENANT)
- `TEAM_ONLY` (deprecated, treated as PUBLIC_TENANT)
- `MANAGER_CHAIN` (deprecated, treated as PUBLIC_TENANT)
- `EXEC_ONLY` (deprecated, treated as PUBLIC_TENANT)

**Key Point:** Filters control UI display, NOT backend permissions. Only PRIVATE restricts read access.

---

### PRIVATE Visibility

**Source:** `services/core-api/src/modules/rbac/visibilityPolicy.ts:62-107`

**Who can view PRIVATE OKRs:**
1. Owner (always)
2. SUPERUSER (always)
3. TENANT_OWNER of the tenant
4. Users in `tenant.privateWhitelist`
5. Users in `tenant.execOnlyWhitelist` (backward compatibility)
6. Users in `tenant.metadata.privateWhitelist`

**Use Cases:** HR, legal, M&A confidential OKRs.

---

## Special Cases and Constraints

### 1. Publish Lock (Cycle Lock)

**Source:** `services/core-api/src/modules/rbac/rbac.ts:310-323, 378-390`

**Rule:** Once an OKR is published (`isPublished = true`), ONLY `TENANT_OWNER` and `TENANT_ADMIN` can edit or delete it. All other roles (including owner, WORKSPACE_LEAD, TEAM_LEAD) are BLOCKED.

**Rationale:** Prevents users from changing OKRs after they've been locked for a cycle/quarter.

**Deny Example:**
```
User: TEAM_LEAD, owns OKR
OKR: isPublished = true
Action: edit_okr
Result: DENIED (line 322)
```

---

### 2. EXEC_ONLY Restriction for TENANT_ADMIN

**Source:** `services/core-api/src/modules/rbac/rbac.ts:316-319, 338-341, 384-387, 406-409`

**Rule:** `TENANT_ADMIN` cannot edit/delete OKRs with `visibilityLevel = 'EXEC_ONLY'` unless `tenant.allowTenantAdminExecVisibility = true`.

**Configuration:** Tenant-level setting controls this behavior.

---

### 3. Tenant Boundary Isolation

**Source:** `services/core-api/src/modules/rbac/rbac.service.ts:270-298, 406-435`

**Rule:** All role assignments and mutations must respect tenant boundaries. A user in Tenant A cannot assign roles or modify data in Tenant B (except SUPERUSER for cross-tenant operations).

**Enforcement:**
```typescript
OkrTenantGuard.assertCanMutateTenant(userOrganizationId);
OkrTenantGuard.assertSameTenant(scopeId, userOrganizationId);
```

**Lines:** 271, 276-297 (assignRole), 407, 411-434 (revokeRole)

---

### 4. SUPERUSER Read-Only for OKRs

**Source:** `services/core-api/src/modules/rbac/rbac.ts:154-160, 182-184`

**Rule:** SUPERUSER can view ALL OKRs but CANNOT create, edit, delete, or publish OKR content.

**Rationale:** Platform administrators should not modify customer strategy data.

**Allowed:**
- `view_okr`, `view_all_okrs` (lines 167-169)
- `impersonate_user` (lines 172-174)
- `export_data` (lines 177-179)
- `manage_users`, `manage_workspaces`, `manage_teams`, `manage_tenant_settings` (lines 186-194)

**Denied:**
- `edit_okr`, `delete_okr`, `create_okr`, `publish_okr`, `request_checkin` (lines 182-184)
- `manage_billing` (lines 196-199)

---

### 5. TENANT_VIEWER Role Restrictions

**Source:** `services/core-api/src/modules/rbac/rbac.ts:441-443, 486-489`

**Rule:** Users with ONLY the `TENANT_VIEWER` role (no other roles) cannot:
- Create OKRs (line 441-443)
- Request check-ins (line 486-489)

**If combined with other roles:** These restrictions do not apply.

---

### 6. TEAM_VIEWER Role Restrictions

**Source:** `services/core-api/src/modules/rbac/rbac.ts:458-460, 504-506`

**Rule:** `TEAM_VIEWER` cannot:
- Create OKRs (line 458-460)
- Request check-ins (line 504-506)

---

### 7. WORKSPACE_LEAD / TEAM_LEAD User Management Constraints

**Source:** `services/core-api/src/modules/rbac/rbac.ts:577-586`

**Rule:**
- WORKSPACE_LEAD can only add **EXISTING tenant users** to their workspace (line 580)
- TEAM_LEAD can only add **EXISTING workspace members** to their team (line 585)

**They cannot invite NEW users to the tenant.**

---

### 8. TENANT_ADMIN Cannot Demote TENANT_OWNER

**Source:** `services/core-api/src/modules/rbac/rbac.ts:569-573`

**Rule:** `TENANT_ADMIN` cannot demote or remove the `TENANT_OWNER`.

**Implementation Note:** Check should be done in service layer (line 572).

---

### 9. Manager Chain Relationships

**Source:** `services/core-api/src/modules/rbac/rbac.service.ts:136-148`

**Data Loaded:**
- `directReports`: Users who report to this user (line 137-141)
- `managerId`: This user's manager (line 144-148)

**Used For:** MANAGER_CHAIN visibility (deprecated but still loaded for potential future use).

---

## Guard Integration

### RBACGuard Usage

**Source:** `services/core-api/src/modules/rbac/rbac.guard.ts:29-261`

**Decorator-driven authorization:**

```typescript
@RequireAction('edit_okr')
@ResourceContext((req) => ({ tenantId: req.params.tenantId, okr: req.okr }))
async updateOKR() { ... }
```

**Guard Flow (lines 29-226):**
1. Extract action from `@RequireAction` decorator (lines 31-34)
2. Build resource context from `@ResourceContext` decorator or request (lines 36-38)
3. Get authenticated user (lines 46-51)
4. Build user context (line 55)
5. Check SUPERUSER early exit for special actions (lines 56-83)
6. Evaluate `can(userContext, action, resourceContext)` (line 226)
7. Throw `ForbiddenException` if denied

---

## Cache Strategy

**Source:** `services/core-api/src/modules/rbac/rbac.service.ts:43-175, 182-197`

**User Context Cache:**
- **Cache Service:** RBACCacheService (Redis-backed, lines 45-61)
- **Fallback:** In-memory cache (5-minute TTL, lines 62-80)
- **Invalidation:** On role assignment/revocation (lines 182-187, 378-379, 447)

**Authorization Checks (line 211):**
```typescript
// Don't use cache for authorization checks to ensure fresh role data
const userContext = await this.buildUserContext(userId, false);
```

**Cache cleared on role changes to prevent stale permissions.**

---

## Testing Recommendations

### Critical Deny Cases to Test

1. **SUPERUSER OKR Edit Deny**
   - User: SUPERUSER
   - Action: `edit_okr`, `create_okr`, `delete_okr`
   - Expected: DENIED (line 182)

2. **Publish Lock Deny**
   - User: TEAM_LEAD (owns OKR)
   - OKR: `isPublished = true`
   - Action: `edit_okr`
   - Expected: DENIED (line 322)

3. **PRIVATE Visibility Deny**
   - User: Regular WORKSPACE_MEMBER
   - OKR: `visibilityLevel = 'PRIVATE'`, not owned by user
   - Action: `view_okr`
   - Expected: DENIED (visibilityPolicy.ts:106)

4. **Tenant Boundary Deny**
   - User: TENANT_ADMIN in Tenant A
   - Target: Role assignment in Tenant B
   - Action: `assignRole`
   - Expected: Throw exception (rbac.service.ts:271-297)

5. **TENANT_VIEWER Create Deny**
   - User: TENANT_VIEWER (alone)
   - Action: `create_okr`
   - Expected: DENIED (line 441-443)

6. **EXEC_ONLY TENANT_ADMIN Deny**
   - User: TENANT_ADMIN
   - OKR: `visibilityLevel = 'EXEC_ONLY'`
   - Tenant: `allowTenantAdminExecVisibility = false`
   - Action: `edit_okr`
   - Expected: DENIED (lines 338-341)

---

## Endpoint Reference

### GET `/rbac/assignments/me`

**Source:** `services/core-api/src/modules/rbac/rbac-assignment.controller.ts:49-111`

Returns current user's role assignments grouped by scope.

---

### GET `/rbac/assignments/effective`

**Source:** `services/core-api/src/modules/rbac/rbac-assignment.controller.ts:113-133`  
**Service:** `services/core-api/src/modules/rbac/rbac.service.ts:259-410`

Returns effective permissions (all actions with allow/deny status) for current user at specified scopes.

**Query Parameters:**
- `tenantId` (optional)
- `workspaceId` (optional)
- `teamId` (optional)

**Response:**
```json
{
  "userId": "...",
  "isSuperuser": false,
  "scopes": [
    {
      "tenantId": "...",
      "effectiveRoles": ["TENANT_ADMIN"],
      "actionsAllowed": ["view_okr", "edit_okr", ...],
      "actionsDenied": ["manage_billing", ...]
    }
  ]
}
```

---

### POST `/rbac/assignments/assign`

**Source:** `services/core-api/src/modules/rbac/rbac-assignment.controller.ts:217-244`

Assign a role to a user (requires `manage_users` action).

---

### DELETE `/rbac/assignments/:assignmentId`

**Source:** `services/core-api/src/modules/rbac/rbac-assignment.controller.ts:246-274`

Revoke a role assignment (requires `manage_users` action).

---

## File Reference Index

| File | Lines | Purpose |
|------|-------|---------|
| `services/core-api/src/modules/rbac/types.ts` | 1-285 | Type definitions, role hierarchy, priority |
| `services/core-api/src/modules/rbac/rbac.ts` | 91-756 | Core authorization logic (can function) |
| `services/core-api/src/modules/rbac/rbac.service.ts` | 26-506 | Service layer with Prisma integration |
| `services/core-api/src/modules/rbac/visibilityPolicy.ts` | 29-327 | Visibility rules for OKRs |
| `services/core-api/src/modules/rbac/rbac.guard.ts` | 20-261 | NestJS guard for request authorization |
| `services/core-api/src/modules/rbac/rbac-assignment.controller.ts` | 38-274 | REST endpoints for role management |
| `services/core-api/src/modules/rbac/rbac-cache.service.ts` | - | Redis cache for user contexts |

---

**End of Auto-Generated RBAC Matrix**

*For updates, regenerate by running the RBAC audit script or manually reviewing the referenced source files.*

