# Role System Assessment & Simplification Analysis

## Executive Summary

This document assesses the current role system (10 roles across 4 scopes) and evaluates a proposed simplification to 3 roles: **SUPERUSER**, **TENANT_ADMIN**, and **TENANT_USER**.

**Recommendation**: **Simplify to 3 roles** with ownership-based permissions for workspace/team level control. This will dramatically reduce complexity while maintaining necessary functionality.

---

## 1. Current Role System Analysis

### 1.1 Current Roles (10 Total)

#### Platform Level (1 role)
- **SUPERUSER** - System-wide access, can view/edit everything

#### Tenant Level (3 roles)
- **TENANT_OWNER** - Full commercial/contractual owner
  - Manage billing, contracts, legal entity
  - Create/delete workspaces
  - Invite/remove any user
  - Assign all roles
  - View ALL OKRs (including PRIVATE/EXEC_ONLY)
  - Configure tenant-wide policy
  - Bypass publish/cycle locks

- **TENANT_ADMIN** - Operational admin
  - Invite/remove users
  - Assign workspace/team roles
  - Create/close OKR cycles
  - Run reporting
  - View PUBLIC/TEAM/MANAGER_CHAIN OKRs
  - May see EXEC_ONLY (configurable)
  - Cannot access billing
  - Cannot delete workspaces
  - Cannot demote TENANT_OWNER
  - Bypass publish/cycle locks

- **TENANT_VIEWER** - Read-only observer
  - View published/public OKRs
  - Export data
  - Cannot create/edit/delete

#### Workspace Level (3 roles)
- **WORKSPACE_LEAD** - Department head
  - Create/edit workspace-level OKRs
  - Approve/publish OKRs
  - Create/manage teams
  - Add/remove existing tenant users to workspace
  - View ALL OKRs in workspace
  - Cannot edit published OKRs (unless admin)

- **WORKSPACE_ADMIN** - Workspace administrator
  - Create/edit workspace OKRs
  - Manage workspace members
  - Administrative access within workspace

- **WORKSPACE_MEMBER** - Default member
  - View workspace OKRs
  - Contribute to OKRs
  - Update key results, submit check-ins

#### Team Level (3 roles)
- **TEAM_LEAD** - Team leader
  - Create/edit team OKRs
  - Approve/publish team OKRs
  - See personal OKRs of team members
  - Add/remove workspace members to team
  - Update status/confidence/RAG
  - Cannot edit published OKRs (unless admin)

- **TEAM_CONTRIBUTOR** - Active contributor
  - Contribute to team OKRs
  - Update key results

- **TEAM_VIEWER** - Read-only viewer
  - View team OKRs only

---

## 2. Current Role Usage Analysis

### 2.1 What Roles Are Actually Used?

**Analysis of codebase shows:**

1. **TENANT_OWNER** - ✅ Heavily used
   - Used in: publish lock checks, cycle lock checks, billing, tenant settings
   - Critical for: Governance, billing, tenant management

2. **TENANT_ADMIN** - ✅ Heavily used
   - Used in: publish lock checks, cycle lock checks, user management, reporting
   - Critical for: Day-to-day operations, governance

3. **TENANT_VIEWER** - ⚠️ Lightly used
   - Used in: Export data, view OKRs
   - Question: Is this role actually needed? Could regular users just not have edit permissions?

4. **WORKSPACE_LEAD** - ✅ Used
   - Used in: Edit workspace OKRs, publish OKRs, manage teams
   - Critical for: Workspace-level control

5. **WORKSPACE_ADMIN** - ❓ Rarely used
   - Used in: Some permission checks
   - Question: Is this different enough from WORKSPACE_LEAD?

6. **WORKSPACE_MEMBER** - ❓ Rarely used
   - Used in: Basic membership checks
   - Question: Could this just be "no role" (default)?

7. **TEAM_LEAD** - ✅ Used
   - Used in: Edit team OKRs, publish team OKRs
   - Critical for: Team-level control

8. **TEAM_CONTRIBUTOR** - ❓ Rarely used
   - Used in: Some permission checks
   - Question: Could this just be "no role" (default)?

9. **TEAM_VIEWER** - ❓ Rarely used
   - Used in: Some permission checks
   - Question: Is read-only at team level actually needed?

### 2.2 Key Patterns Observed

1. **Most permission checks boil down to:**
   - Is user TENANT_OWNER/ADMIN? → Full access
   - Is user OWNER of the OKR? → Can edit own OKRs
   - Is user WORKSPACE_LEAD? → Can edit workspace OKRs
   - Is user TEAM_LEAD? → Can edit team OKRs
   - Otherwise → No access

2. **Workspace/Team roles are mainly used for:**
   - Editing OKRs at that scope
   - Publishing OKRs at that scope
   - Managing members at that scope

3. **The complexity comes from:**
   - Multiple scopes (tenant/workspace/team)
   - Multiple roles per scope
   - Governance locks (publish/cycle) that override roles
   - Visibility levels that interact with roles

---

## 3. Proposed Simplified Role System

### 3.1 Three-Role Model

1. **SUPERUSER**
   - System-wide access
   - Can view/edit everything
   - Bypasses all locks

2. **TENANT_ADMIN**
   - Full control within tenant
   - Can edit all OKRs (including published)
   - Can manage users, workspaces, teams
   - Can configure tenant settings
   - Can export data
   - Bypasses publish/cycle locks

3. **TENANT_USER** (default)
   - Can create/edit own OKRs (when not published/locked)
   - Can view OKRs (subject to visibility rules)
   - Cannot edit published OKRs
   - Cannot edit OKRs in locked cycles
   - Cannot manage users/workspaces/teams
   - Can export data (if needed)

### 3.2 How Workspace/Team Control Would Work

**Option A: Ownership-Based (Recommended)**
- Workspace/Team "ownership" is determined by:
  - Who created the workspace/team
  - Or explicit assignment (workspace.ownerId, team.ownerId)
- Owners can:
  - Edit all OKRs in their workspace/team
  - Publish OKRs in their workspace/team
  - Manage members in their workspace/team
- This replaces WORKSPACE_LEAD and TEAM_LEAD roles

**Option B: Explicit Assignment**
- Add `workspace.ownerId` and `team.ownerId` fields
- Owners have same permissions as Option A
- Simpler than roles, but still explicit

**Option C: First Creator**
- First user to create workspace/team becomes owner
- Can transfer ownership
- Simplest, but less flexible

---

## 4. Comparison: Current vs Simplified

### 4.1 Permission Matrix Comparison

| Action | Current (10 roles) | Simplified (3 roles) |
|--------|-------------------|---------------------|
| **View OKR** | Complex visibility rules + role checks | Visibility rules + ownership |
| **Edit Own OKR (draft)** | Owner OR role-based | Owner OR TENANT_ADMIN |
| **Edit Own OKR (published)** | Only TENANT_OWNER/ADMIN | Only TENANT_ADMIN |
| **Edit Workspace OKR** | WORKSPACE_LEAD OR TENANT_OWNER/ADMIN | Workspace Owner OR TENANT_ADMIN |
| **Edit Team OKR** | TEAM_LEAD OR TENANT_OWNER/ADMIN | Team Owner OR TENANT_ADMIN |
| **Publish OKR** | WORKSPACE_LEAD/TEAM_LEAD OR TENANT_OWNER/ADMIN | Workspace/Team Owner OR TENANT_ADMIN |
| **Manage Users** | TENANT_OWNER/ADMIN, WORKSPACE_LEAD, TEAM_LEAD | TENANT_ADMIN, Workspace/Team Owner |
| **Manage Workspaces** | TENANT_OWNER/ADMIN | TENANT_ADMIN |
| **Manage Teams** | TENANT_OWNER/ADMIN, WORKSPACE_LEAD | TENANT_ADMIN, Workspace Owner |
| **Export Data** | TENANT_OWNER/ADMIN/VIEWER | TENANT_ADMIN, TENANT_USER |

### 4.2 Complexity Comparison

| Metric | Current System | Simplified System |
|--------|---------------|-------------------|
| **Number of Roles** | 10 | 3 |
| **Number of Scopes** | 4 | 1 (tenant only) |
| **Role Assignment Complexity** | High (4 scopes × multiple roles) | Low (1 scope × 2 roles) |
| **Permission Check Complexity** | High (multiple role checks per action) | Low (admin check + ownership check) |
| **Code Complexity** | High (many role-specific checks) | Low (simple if/else) |
| **Maintenance Burden** | High (10 roles to maintain) | Low (3 roles to maintain) |
| **User Understanding** | Low (complex role hierarchy) | High (simple: admin vs user) |

---

## 5. Pros and Cons

### 5.1 Pros of Simplification

✅ **Dramatically Reduced Complexity**
- 10 roles → 3 roles (70% reduction)
- 4 scopes → 1 scope (75% reduction)
- Much easier to understand and maintain

✅ **Easier to Reason About**
- Simple mental model: Admin vs User
- Ownership replaces workspace/team roles
- Less edge cases

✅ **Faster Development**
- Less code to write
- Less tests to maintain
- Less bugs

✅ **Better User Experience**
- Users understand their permissions immediately
- No confusion about role hierarchy
- Clear: "Are you an admin? Yes/No"

✅ **Easier Migration**
- Simpler to migrate existing users
- Clear mapping: Most users → TENANT_USER
- Admins → TENANT_ADMIN

### 5.2 Cons of Simplification

❌ **Less Granular Control**
- Can't have "workspace admin" without tenant admin
- Can't have "read-only" at workspace/team level
- All non-admins have same permissions

❌ **May Not Meet Enterprise Needs**
- Some enterprises want workspace-level admins
- Some want read-only observers
- May need to add roles back later

❌ **Ownership Model Changes**
- Need to track workspace/team ownership
- Need migration for existing workspaces/teams
- Need UI for ownership transfer

❌ **Loss of Role Hierarchy**
- Can't have "workspace lead" without tenant admin
- Can't delegate workspace management
- All management at tenant level

---

## 6. Recommendation

### 6.1 Recommended Approach: **Simplified 3-Role System**

**Rationale:**
1. **Current system is over-engineered** - 10 roles for what could be 3
2. **Most complexity is unused** - Many roles rarely used
3. **Ownership model is simpler** - "Who owns this workspace?" vs "What role do you have?"
4. **Easier to maintain** - Less code, less bugs, faster development

### 6.2 Implementation Strategy

**Phase 1: Add Ownership Fields**
- Add `workspace.ownerId` and `team.ownerId` to schema
- Migrate existing data:
  - WORKSPACE_LEAD → workspace.ownerId
  - TEAM_LEAD → team.ownerId
  - First creator if no lead exists

**Phase 2: Simplify Permission Checks**
- Replace role checks with ownership checks
- Keep TENANT_ADMIN checks
- Remove workspace/team role checks

**Phase 3: Update UI**
- Remove role assignment UI for workspace/team
- Add ownership transfer UI
- Simplify role assignment to: Admin vs User

**Phase 4: Migration**
- Map existing roles:
  - TENANT_OWNER → TENANT_ADMIN (or keep separate if billing needed)
  - TENANT_ADMIN → TENANT_ADMIN
  - WORKSPACE_LEAD → Workspace Owner
  - TEAM_LEAD → Team Owner
  - Everyone else → TENANT_USER

### 6.3 Hybrid Option (If Needed)

If you need more granularity later, you could add:
- **TENANT_VIEWER** - Read-only tenant access (if needed)
- Keep ownership model for workspace/team

This gives you 4 roles instead of 3, but still much simpler than 10.

---

## 7. Migration Plan

### 7.1 Data Migration

```sql
-- Step 1: Add ownership fields
ALTER TABLE workspaces ADD COLUMN owner_id VARCHAR;
ALTER TABLE teams ADD COLUMN owner_id VARCHAR;

-- Step 2: Migrate workspace owners
UPDATE workspaces w
SET owner_id = (
  SELECT ra.user_id
  FROM role_assignments ra
  WHERE ra.scope_type = 'WORKSPACE'
    AND ra.scope_id = w.id
    AND ra.role = 'WORKSPACE_LEAD'
  LIMIT 1
);

-- Step 3: Migrate team owners
UPDATE teams t
SET owner_id = (
  SELECT ra.user_id
  FROM role_assignments ra
  WHERE ra.scope_type = 'TEAM'
    AND ra.scope_id = t.id
    AND ra.role = 'TEAM_LEAD'
  LIMIT 1
);

-- Step 4: Migrate user roles
-- TENANT_OWNER → TENANT_ADMIN (or keep separate)
-- TENANT_ADMIN → TENANT_ADMIN
-- WORKSPACE_LEAD → Remove (use ownership)
-- TEAM_LEAD → Remove (use ownership)
-- Everyone else → TENANT_USER (or no role, default)
```

### 7.2 Code Migration

1. **Update Permission Checks**
   - Replace `hasWorkspaceLeadRole()` → `workspace.ownerId === userId`
   - Replace `hasTeamLeadRole()` → `team.ownerId === userId`
   - Keep `hasTenantAdminRole()` checks

2. **Update RBAC Logic**
   - Simplify `canEditOKRAction()` to check:
     - Is superuser? → Allow
     - Is tenant admin? → Allow
     - Is owner? → Allow (if not published/locked)
     - Is workspace owner? → Allow (if workspace OKR, not published/locked)
     - Is team owner? → Allow (if team OKR, not published/locked)
     - Otherwise → Deny

3. **Remove Unused Code**
   - Remove workspace/team role assignment code
   - Remove role checks for workspace/team roles
   - Simplify role assignment UI

---

## 8. Risk Assessment

### 8.1 High Risk Areas

1. **Existing Users with Workspace/Team Roles**
   - Risk: May lose permissions during migration
   - Mitigation: Careful migration script, test thoroughly

2. **Permission Checks**
   - Risk: May miss edge cases
   - Mitigation: Comprehensive testing, gradual rollout

3. **UI Changes**
   - Risk: Users may be confused by new ownership model
   - Mitigation: Clear UI, documentation, training

### 8.2 Low Risk Areas

1. **Tenant-Level Roles**
   - Risk: Low (keeping TENANT_ADMIN)
   - Mitigation: Minimal changes needed

2. **Superuser**
   - Risk: Low (no changes)
   - Mitigation: No changes needed

---

## 9. Success Criteria

- ✅ Reduced code complexity (fewer role checks)
- ✅ Faster permission checks (simpler logic)
- ✅ Easier to understand (3 roles vs 10)
- ✅ All existing functionality preserved
- ✅ No user permission loss during migration
- ✅ Clear ownership model for workspaces/teams

---

## 10. Next Steps

1. **Review this assessment** with team
2. **Decide on simplification** (3 roles vs keep current)
3. **If simplifying:**
   - Create detailed migration plan
   - Add ownership fields to schema
   - Update permission checks
   - Migrate data
   - Update UI
4. **If keeping current:**
   - Document role system clearly
   - Simplify permission checks where possible
   - Remove unused roles if any

---

## 11. Appendix: Current Role Usage Matrix

| Role | Used For | Can Be Replaced By |
|------|----------|-------------------|
| SUPERUSER | System admin | Keep |
| TENANT_OWNER | Billing, contracts, full control | TENANT_ADMIN (or keep if billing separation needed) |
| TENANT_ADMIN | Day-to-day operations | Keep |
| TENANT_VIEWER | Read-only access | TENANT_USER (with no edit permissions) or remove |
| WORKSPACE_LEAD | Workspace control | Workspace Owner |
| WORKSPACE_ADMIN | Workspace admin | Workspace Owner (or remove) |
| WORKSPACE_MEMBER | Default member | TENANT_USER (default) |
| TEAM_LEAD | Team control | Team Owner |
| TEAM_CONTRIBUTOR | Team contributor | TENANT_USER (default) |
| TEAM_VIEWER | Read-only team | TENANT_USER (or remove) |

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-20  
**Status**: Draft - Pending Review

