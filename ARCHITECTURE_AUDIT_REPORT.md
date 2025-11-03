# OKR Application Architecture Audit Report

**Date:** 2024-12-19  
**Reviewer:** Senior Product + Architecture Review  
**Scope:** Full-stack audit (Backend, Database, Frontend, API, Permissions)

---

## PART 1. WHAT A REAL OKR SYSTEM NEEDS

### A. Core Domain Model

**Required Entities:**

1. **Company / Organisation / Tenant**
   - Multi-tenant isolation (critical for B2B SaaS)
   - Configuration, settings, billing metadata

2. **Workspace / Department / Function**
   - Hierarchical workspaces (parent-child relationships)
   - Belongs to organization/tenant

3. **Team**
   - Belongs to workspace
   - Multiple teams per workspace

4. **User**
   - Multi-tenant membership (can belong to multiple orgs)
   - Profile, authentication, manager relationships

5. **Objective / Key Result / Initiative**
   - Objectives with parent-child relationships (cascade)
   - Key Results linked to Objectives (many-to-many or one-to-many)
   - Initiatives linked to Objectives or Key Results
   - Status: ON_TRACK, AT_RISK, OFF_TRACK, COMPLETED, CANCELLED
   - Progress percentage (0-100)
   - Owner assignment
   - Time periods (MONTHLY, QUARTERLY, ANNUAL, CUSTOM) with start/end dates

6. **Alignment / Cascading Links**
   - Parent-child relationships between Objectives
   - "Contributes-to" relationships (child OKR supports parent)
   - Visual cascade map/tree view

7. **Time Periods / Cycles / Quarters**
   - Period enum: MONTHLY, QUARTERLY, ANNUAL, CUSTOM
   - Start/end dates per OKR
   - Ability to filter/report by period

8. **Tags / Strategic Themes / KPIs**
   - Optional tagging for grouping
   - Strategic themes for alignment

9. **Comments / Updates / Confidence / Progress History**
   - Check-ins for Key Results (value, confidence, notes, blockers)
   - Activity log/audit trail
   - Comments on OKRs (discussion threads)
   - History of changes (who changed what, when)

### B. Governance / Roles / Permissions

**Roles Hierarchy:**
- **Superuser** (platform-level, cross-tenant admin)
- **Tenant Owner** (organization owner, full control)
- **Tenant Admin** (organization admin, manage users/workspaces)
- **Workspace Owner/Lead** (workspace-level control)
- **Team Lead** (team-level control)
- **Member** (can create/edit own OKRs)
- **Viewer** (read-only)

**Visibility Model:**
- **Default:** Everyone can READ all OKRs (transparency)
- **Exception:** PRIVATE OKRs (HR, legal, M&A) with explicit whitelist
- **UI Filters:** Display filtering (by workspace/team/owner) is UI-only, not permission-based

**Control Model:**
- Who can CREATE OKRs at which scope (org/workspace/team)
- Who can EDIT/UPDATE progress (owner + role-based managers)
- Who can CASCADE/ALIGN OKRs (create parent-child links)
- Who can DELETE OKRs (owner + workspace/org admins)
- Who can MANAGE users and roles (admins at each scope)

**Auditability:**
- Audit log: who changed what, when
- Activity history: track all OKR changes
- Check-in history: progress updates over time

### C. UX Workflows

1. **Login & Context Header**
   - User identity display
   - Current organization/workspace context
   - Permission indicators

2. **Global OKR Tree / Cascade View**
   - Visual hierarchy showing parent-child relationships
   - Interactive tree/graph view

3. **Filtered Views**
   - "My Organization / My Workspace / My Team / My OKRs"
   - Filter by period, owner, workspace, team

4. **Create / Edit OKR**
   - Owner selection
   - Scope assignment (org/workspace/team)
   - Parent alignment (link to parent OKR)
   - Visibility level (PUBLIC_TENANT vs PRIVATE)
   - Period and dates

5. **Role & User Management**
   - Invite users
   - Assign roles at org/workspace/team levels
   - Remove users
   - View user permissions

6. **Progress Check-ins**
   - Update KR value
   - Set confidence level
   - Add notes and blockers
   - View check-in history

7. **Reporting / Export**
   - Progress roll-ups (company/workspace/team progress)
   - At-risk OKRs dashboard
   - Export to CSV/PDF

### D. Analytics / Reporting Expectations

1. **Progress Roll-up**
   - Aggregate progress across OKRs
   - Company-level, workspace-level, team-level roll-ups
   - Period-based reporting (Q1, Q2, etc.)

2. **Ownership Gaps**
   - OKRs with no active owner
   - Unassigned OKRs

3. **Risk Surfacing**
   - AT_RISK and OFF_TRACK KRs across org
   - Progress vs time elapsed analysis

4. **Misalignment Detection**
   - OKRs that don't map to any higher-level objective
   - Orphaned OKRs (no parent, no children)

5. **Activity History**
   - Recent changes across all OKRs
   - Who updated what, when

6. **Audit Trail**
   - Compliance-ready audit log
   - Role changes, permission changes, OKR changes

### E. Technical / Platform Expectations

1. **Multi-tenant Safety**
   - Tenant scoping on ALL queries
   - No data leaks between tenants
   - Organization ID filtering enforced

2. **RBAC Implementation**
   - Centralized policy engine
   - Consistent checks across all routes
   - Not ad-hoc per-route logic

3. **Versioning / History**
   - Activity log table
   - Check-in history
   - Audit log for compliance

4. **Seed Data / Fixtures**
   - Realistic test data
   - Users with different roles
   - OKRs across teams/workspaces

5. **API Boundaries**
   - No direct SQL in React components
   - Service layer separation
   - Proper DTOs/validation

6. **Input Validation & Security**
   - Auth on all endpoints
   - Authorization checks (RBAC)
   - Field validation (dates, required fields)
   - SQL injection prevention (Prisma parameterized queries)

7. **Performance**
   - Indexed queries for list views
   - Efficient hierarchy queries
   - Pagination for large datasets

8. **Delete Strategy**
   - Soft-delete vs hard-delete
   - Cascade handling (what happens to children when parent deleted)

9. **Consistent IDs & Foreign Keys**
   - Proper cascade relationships
   - Foreign key constraints
   - CUID or UUID for IDs

---

## PART 2. AUDIT OUR CODEBASE AGAINST CHECKLIST

### A. Core Domain Model - Status: ✅ MOSTLY COMPLETE

**✅ What Exists:**

1. **Organization / Workspace / Team Hierarchy**
   - ✅ `Organization` model (`schema.prisma:17-31`)
   - ✅ `Workspace` model with `parentWorkspaceId` for hierarchy (`schema.prisma:33-51`)
   - ✅ `Team` model (`schema.prisma:53-65`)
   - ✅ Proper foreign key relationships

2. **User Model**
   - ✅ `User` model with manager relationships (`schema.prisma:67-95`)
   - ✅ `managerId` and `directReports` for manager chain
   - ✅ `isSuperuser` flag

3. **Objective / Key Result / Initiative**
   - ✅ `Objective` model (`schema.prisma:178-215`)
   - ✅ `KeyResult` model (`schema.prisma:217-246`)
   - ✅ `Initiative` model (`schema.prisma:263-285`)
   - ✅ `ObjectiveKeyResult` junction table for many-to-many (`schema.prisma:249-261`)
   - ✅ Status enum: `ON_TRACK`, `AT_RISK`, `OFF_TRACK`, `COMPLETED`, `CANCELLED` (`schema.prisma:294-300`)
   - ✅ Progress field (Float)
   - ✅ Owner assignment (`ownerId`)
   - ✅ Period enum: `MONTHLY`, `QUARTERLY`, `ANNUAL`, `CUSTOM` (`schema.prisma:287-292`)
   - ✅ Start/end dates

4. **Cascading Links**
   - ✅ `parentId` and `children` relationships (`schema.prisma:190-192`)
   - ✅ Self-referential relationship for cascade

5. **Time Periods**
   - ✅ Period enum exists
   - ✅ Start/end dates on Objectives
   - ✅ Optional period on KeyResults

6. **Check-ins**
   - ✅ `CheckIn` model (`schema.prisma:420-434`)
   - ✅ Fields: `value`, `confidence`, `note`, `blockers`, `createdAt`
   - ✅ Linked to `KeyResult` via `keyResultId`

**❌ What's Missing:**

1. **Tags / Strategic Themes**
   - ❌ No tagging system in schema
   - ❌ No strategic themes model

2. **Comments System**
   - ❌ No comment/thread model
   - ❌ Activity model exists but may not track comments (`schema.prisma:436-448`)

### B. Governance / Roles / Permissions - Status: ⚠️ PARTIALLY IMPLEMENTED, DUAL SYSTEMS

**✅ What Exists:**

1. **Dual Role Systems (PROBLEM):**
   - ⚠️ **Old System:** `MemberRole` enum with `TeamMember`, `WorkspaceMember`, `OrganizationMember` tables (`schema.prisma:97-152`)
     - Roles: `SUPERUSER`, `ORG_ADMIN`, `WORKSPACE_OWNER`, `TEAM_LEAD`, `MEMBER`, `VIEWER`
   - ⚠️ **New System:** `RBACRole` enum with `RoleAssignment` table (`schema.prisma:333-348`)
     - Roles: `SUPERUSER`, `TENANT_OWNER`, `TENANT_ADMIN`, `TENANT_VIEWER`, `WORKSPACE_LEAD`, `WORKSPACE_ADMIN`, `WORKSPACE_MEMBER`, `TEAM_LEAD`, `TEAM_CONTRIBUTOR`, `TEAM_VIEWER`
   - ⚠️ **Migration service exists** (`rbac/migration.service.ts`) but both systems coexist

2. **Visibility Model:**
   - ✅ `VisibilityLevel` enum (`schema.prisma:320-327`)
   - ✅ `PUBLIC_TENANT` (default, globally visible)
   - ✅ `PRIVATE` (restricted, whitelist-based)
   - ✅ Deprecated levels kept for backward compatibility

3. **RBAC Implementation:**
   - ✅ Centralized RBAC service (`rbac/rbac.service.ts`)
   - ✅ Permission checks via `RBACGuard` and `@RequireAction()` decorator
   - ✅ Visibility policy (`rbac/visibilityPolicy.ts`)

4. **Audit Logging:**
   - ✅ `AuditLog` model (`schema.prisma:381-404`)
   - ✅ `Activity` model (`schema.prisma:436-448`)
   - ✅ `PermissionAudit` model (`schema.prisma:154-172`)

**❌ What's Missing / Issues:**

1. **Role System Confusion:**
   - ❌ Two role systems in parallel creates confusion
   - ❌ Old `MemberRole` tables still used in some places
   - ❌ New `RoleAssignment` table may not be fully wired through

2. **Role UI:**
   - ⚠️ Frontend `usePermissions` hook uses old role system (`apps/web/src/hooks/usePermissions.ts`)
   - ⚠️ Backend RBAC uses new system
   - ❌ Potential mismatch between frontend and backend role checks

### C. UX Workflows - Status: ⚠️ PARTIALLY IMPLEMENTED

**✅ What Exists:**

1. **Login & Context:**
   - ✅ Auth context (`apps/web/src/contexts/auth.context.tsx`)
   - ✅ Workspace context (`apps/web/src/contexts/workspace.context.tsx`)
   - ✅ User display in header

2. **OKR List/Grid View:**
   - ✅ OKRs page with filters (`apps/web/src/app/dashboard/okrs/page.tsx`)
   - ✅ Filter by workspace, team, owner, period
   - ✅ Grid and list view modes

3. **Create/Edit OKR:**
   - ✅ Builder page (`apps/web/src/app/dashboard/builder/page.tsx`)
   - ✅ Visual builder with nodes
   - ✅ Owner, scope, period selection

4. **Progress Check-ins:**
   - ✅ Check-in endpoint (`key-result.controller.ts:89-102`)
   - ✅ Check-in service (`key-result.service.ts:277-309`)

**❌ What's Missing:**

1. **Global OKR Tree / Cascade View:**
   - ❌ No dedicated cascade/tree view page
   - ⚠️ Builder has nodes but may not show full hierarchy

2. **Role & User Management UI:**
   - ❌ No visible user management screen found
   - ❌ No invite user flow visible
   - ⚠️ Backend endpoints exist (`user.service.ts`, `organization.service.ts`) but no UI

3. **Check-in UI:**
   - ❌ No visible check-in form/UI in frontend
   - ⚠️ Backend endpoint exists but may not be used

4. **Reporting Dashboard:**
   - ❌ No reporting/analytics page
   - ❌ No progress roll-up views
   - ❌ No at-risk dashboard

### D. Analytics / Reporting - Status: ❌ NOT IMPLEMENTED

**❌ What's Missing:**

1. **Progress Roll-up:**
   - ❌ No service/endpoint for calculating aggregated progress
   - ❌ No roll-up queries
   - ❌ No period-based reporting endpoints

2. **Ownership Gaps:**
   - ❌ No query for unassigned OKRs
   - ❌ No detection of OKRs with inactive owners

3. **Risk Surfacing:**
   - ❌ No endpoint for at-risk OKRs
   - ❌ No progress vs time analysis endpoint
   - ⚠️ `determineOKRStatus` utility exists (`packages/utils/src/index.ts:39-58`) but not used in reporting

4. **Misalignment Detection:**
   - ❌ No query for orphaned OKRs
   - ❌ No validation that OKRs have parents

5. **Activity History:**
   - ✅ `Activity` model exists (`schema.prisma:436-448`)
   - ❌ No endpoint to query activity history
   - ❌ No service populating activity log (may be unused)

6. **Audit Trail:**
   - ✅ `AuditLog` model exists
   - ❌ No audit log query endpoint
   - ⚠️ Audit log may not be populated in all cases

### E. Technical / Platform - Status: ⚠️ MIXED (GOOD FOUNDATIONS, CRITICAL GAPS)

**✅ What Exists:**

1. **API Boundaries:**
   - ✅ Service layer separation
   - ✅ Controllers use services
   - ✅ No direct SQL in frontend

2. **Input Validation:**
   - ✅ Date validation in `objective.service.ts:175-213`
   - ✅ Required field checks
   - ✅ Prisma for SQL injection prevention

3. **Database Schema:**
   - ✅ Proper foreign keys
   - ✅ Indexes on key fields
   - ✅ Cascade delete rules

4. **RBAC Framework:**
   - ✅ Centralized `RBACService`
   - ✅ Guard-based authorization
   - ✅ Permission decorators

5. **Seed Data:**
   - ✅ Seed script exists (`prisma/seed.ts`)

**❌ Critical Issues:**

1. **❌ MULTI-TENANT ISOLATION MISSING:**
   - **CRITICAL:** `objective.service.ts:findAll()` does NOT filter by `organizationId`
   - **CRITICAL:** Returns ALL OKRs globally without tenant scoping
   - **CRITICAL:** `key-result.service.ts:findAll()` also lacks tenant filtering
   - ⚠️ `TenantIsolationGuard` exists (`permissions/tenant-isolation.guard.ts`) but NOT used on OKR endpoints
   - **DATA LEAK RISK:** Users from Org A can see Org B's OKRs

2. **Role System Duplication:**
   - ⚠️ Two role systems exist in parallel
   - ⚠️ Frontend uses old system, backend uses new system
   - ⚠️ Migration exists but both systems still active

3. **Performance:**
   - ⚠️ No pagination on list endpoints
   - ⚠️ `findAll()` returns all OKRs (could be thousands)

4. **Activity Logging:**
   - ⚠️ `Activity` model exists but may not be populated
   - ⚠️ No automatic activity tracking on OKR changes

5. **Comments:**
   - ❌ No comment model
   - ❌ No discussion threads

---

## PART 3. VISIBILITY VS CONTROL (CRITICAL AUDIT)

### Summary: ⚠️ ALIGNED WITH MODEL BUT HAS ISSUES

**Model Goal:** Everyone can SEE all OKRs, but only some can ACT on them.

### 1. READ PATHS (GET /okrs, GET /objectives)

**✅ GOOD: Global Visibility Model**

```13:54:services/core-api/src/modules/okr/objective.service.ts
async findAll(_userId: string, workspaceId?: string) {
    // Return all OKRs globally - filtering happens in UI, not backend
    // Only PRIVATE OKRs are restricted (handled by canView() check on individual access)
    const where: any = {};

    // Optional workspace filter for UI convenience (not access control)
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    // Note: We no longer filter by user's accessible scopes.
    // All OKRs are globally visible by default.
    // VisibilityLevel = PRIVATE is the only exception (checked per-OKR via canView())

    return this.prisma.objective.findMany({
      where,
      include: {
        keyResults: {
          include: {
            keyResult: true,
          },
        },
        team: true,
        organization: true,
        workspace: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        parent: {
          select: {
            id: true,
            title: true,
          },
        },
        children: true,
      },
    });
  }
```

**✅ GOOD:** Comments indicate intentional global visibility  
**✅ GOOD:** PRIVATE OKRs are checked per-item via `canView()` (`objective.controller.ts:26-30`)

**❌ CRITICAL ISSUE: NO TENANT ISOLATION**

- **Problem:** `findAll()` returns OKRs from ALL organizations, not just the user's tenant
- **Evidence:** No `where.organizationId` filter in the query
- **Impact:** Multi-tenant data leak - Org A users can see Org B's OKRs
- **Location:** `objective.service.ts:13-54`

**⚠️ PARTIAL:** Individual OKR access (`GET /objectives/:id`) checks `canView()` which respects PRIVATE visibility, but still doesn't enforce tenant boundaries

### 2. WRITE PATHS (POST/PATCH/DELETE)

**✅ GOOD: Centralized Permission Checks**

```58:80:services/core-api/src/modules/okr/objective.controller.ts
@Patch(':id')
  @RequireAction('edit_okr')
  @ApiOperation({ summary: 'Update objective' })
  async update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    // Check if user can edit this OKR
    const canEdit = await this.objectiveService.canEdit(req.user.id, id);
    if (!canEdit) {
      throw new ForbiddenException('You do not have permission to edit this OKR');
    }
    return this.objectiveService.update(id, data, req.user.id);
  }

  @Delete(':id')
  @RequireAction('delete_okr')
  @ApiOperation({ summary: 'Delete objective' })
  async delete(@Param('id') id: string, @Req() req: any) {
    // Check if user can delete this OKR
    const canDelete = await this.objectiveService.canDelete(req.user.id, id);
    if (!canDelete) {
      throw new ForbiddenException('You do not have permission to delete this OKR');
    }
    return this.objectiveService.delete(id);
  }
```

**✅ GOOD:** Permission checks are centralized:
- `canEdit()` calls `rbacService.canPerformAction('edit_okr')` (`objective.service.ts:116-123`)
- `canDelete()` calls `rbacService.canPerformAction('delete_okr')` (`objective.service.ts:128-135`)
- `canCreateInWorkspace()` checks workspace access (`objective.service.ts:140-157`)

**✅ GOOD:** RBAC logic is centralized in `rbac/rbac.ts`:
- `canEditOKRAction()` checks owner, tenant roles, workspace roles, team roles (`rbac.ts:289-329`)
- `canDeleteOKRAction()` has similar checks (`rbac.ts:334-377`)

**⚠️ ISSUE:** Tenant isolation not enforced on write paths
- User from Org A could theoretically edit/delete Org B's OKRs if they know the ID
- Should add tenant check: "does this OKR belong to my organization?"

### 3. FRONTEND

**✅ GOOD: Not Hiding OKRs Based on Role**

```79:118:apps/web/src/app/dashboard/okrs/page.tsx
// Apply filters
  const filteredOKRs = okrs.filter(okr => {
    // Period filter
    if (selectedPeriod !== 'all' && selectedPeriodOption) {
      if (okr.startDate && okr.endDate) {
        if (!doesOKRMatchPeriod(okr.startDate, okr.endDate, selectedPeriodOption)) {
          return false
        }
      } else {
        return false
      }
    }
    
    // Workspace filter
    if (filterWorkspaceId !== 'all' && okr.workspaceId !== filterWorkspaceId) {
      return false
    }
    
    // Team filter
    if (filterTeamId !== 'all' && okr.teamId !== filterTeamId) {
      return false
    }
    
    // Owner filter
    if (filterOwnerId !== 'all' && okr.ownerId !== filterOwnerId) {
      return false
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesTitle = okr.title?.toLowerCase().includes(query)
      const matchesDescription = okr.description?.toLowerCase().includes(query)
      const matchesOwner = okr.owner?.name?.toLowerCase().includes(query)
      if (!matchesTitle && !matchesDescription && !matchesOwner) {
        return false
      }
    }
    
    return true
  })
```

**✅ GOOD:** Filters are UI-only (workspace, team, owner, period) - not permission-based hiding

**❌ BAD: Not Disabling Action Buttons**

- **Problem:** OKR cards/list items don't show edit/delete buttons conditionally
- **Evidence:** `okrs/page.tsx` renders OKRs but doesn't check `canEditOKR()` or `canDeleteOKR()` to disable buttons
- **Impact:** Users see OKRs but have no way to know if they can edit/delete until they try
- **Expected:** Should show edit/delete buttons but disable them if user lacks permission

**⚠️ PARTIAL:** `usePermissions` hook exists (`apps/web/src/hooks/usePermissions.ts`) but:
- Uses old role system (`teams` from workspace context)
- Not used in OKR list page to disable actions
- Only checks `ownerId` and `teamId`, doesn't use backend RBAC

### Summary: Visibility vs Control

**READ PATHS:**
- ✅ Aligned with model: global visibility, PRIVATE exceptions
- ❌ **CRITICAL:** No tenant isolation - data leak risk

**WRITE PATHS:**
- ✅ Centralized permission checks
- ✅ RBAC framework is consistent
- ⚠️ Tenant isolation should be added as additional check

**FRONTEND:**
- ✅ Not hiding OKRs (good)
- ❌ Not disabling action buttons based on permissions (bad UX)
- ⚠️ Permission checks use old role system, may not match backend

---

## PART 4. DATA & RELATIONSHIP HEALTH

### Checklist:

**1. Do Objectives / KRs link to a reporting period / quarter?**

**✅ YES:** 
- `Objective.period` field exists (`schema.prisma:195`)
- `Objective.startDate` and `endDate` exist (`schema.prisma:196-197`)
- `KeyResult.period` is optional (`schema.prisma:231`)
- Period enum: `MONTHLY`, `QUARTERLY`, `ANNUAL`, `CUSTOM`

**⚠️ PARTIAL:** Can store period, but:
- No queries filtered by period for reporting
- No roll-up calculations by period
- Frontend filters by period but backend doesn't enforce

**2. Do Objectives link to parent Objectives?**

**✅ YES:**
- `Objective.parentId` exists (`schema.prisma:190`)
- `Objective.children` relationship exists (`schema.prisma:192`)
- Self-referential relationship properly set up

**✅ GOOD:** Can query parent and children:
```45:51:services/core-api/src/modules/okr/objective.service.ts
parent: {
          select: {
            id: true,
            title: true,
          },
        },
        children: true,
```

**⚠️ PARTIAL:** 
- No validation that cascade makes sense (e.g., child's period matches parent)
- No query to detect orphaned OKRs (no parent, no children)

**3. Do we track status, confidence, progress %?**

**✅ YES:**
- `Objective.status` (`ON_TRACK`, `AT_RISK`, `OFF_TRACK`, `COMPLETED`, `CANCELLED`) (`schema.prisma:198`)
- `Objective.progress` (Float, 0-100) (`schema.prisma:199`)
- `KeyResult.status` and `progress` (`schema.prisma:227-228`)
- `CheckIn.confidence` (Int) (`schema.prisma:426`)

**✅ GOOD:** Status enum exists and is used

**4. Do we have audit history / check-in history?**

**✅ YES - Check-ins:**
- `CheckIn` model tracks KR updates (`schema.prisma:420-434`)
- Fields: `value`, `confidence`, `note`, `blockers`, `createdAt`
- Linked to `KeyResult` via `keyResultId`

**⚠️ PARTIAL - Activity Log:**
- `Activity` model exists (`schema.prisma:436-448`)
- **BUT:** No evidence it's populated on OKR changes
- No service that writes to Activity table on updates

**✅ YES - Audit Log:**
- `AuditLog` model exists (`schema.prisma:381-404`)
- Tracks: `action`, `targetType`, `targetId`, `actorUserId`, `timestamp`
- Used for role changes and impersonation

**5. Can more than one person contribute to a KR?**

**❌ NO:**
- `KeyResult.ownerId` is single owner (`schema.prisma:221`)
- No `contributors` or `collaborators` field
- `CheckIn.userId` tracks who made the check-in, but only one owner

**Impact:** Can't assign multiple people to own a KR

**6. Can we assign OKRs to Workspaces and Teams, not just users?**

**✅ YES:**
- `Objective.organizationId` (optional) (`schema.prisma:182`)
- `Objective.workspaceId` (optional) (`schema.prisma:184`)
- `Objective.teamId` (optional) (`schema.prisma:186`)
- `Objective.ownerId` (required) (`schema.prisma:188`)

**✅ GOOD:** OKRs can be scoped to org/workspace/team AND have an owner

**7. Additional Observations:**

**⚠️ ISSUE: Progress Roll-up Not Calculated**
- Objective has `progress` field but no automatic calculation from Key Results
- No service that aggregates KR progress into Objective progress
- Manual updates required

**⚠️ ISSUE: Status Not Auto-Updated**
- Status field exists but `determineOKRStatus()` utility (`packages/utils/src/index.ts:39-58`) may not be called automatically
- Status updates likely manual

**✅ GOOD: Many-to-Many Objectives ↔ Key Results**
- `ObjectiveKeyResult` junction table allows KRs to support multiple Objectives
- Good for alignment use cases

---

## PART 5. ROLE / USER MANAGEMENT

### Checklist:

**1. Do we have Org-level roles (Tenant Owner, Org Admin)?**

**✅ YES - Two Systems:**

**Old System:**
- `OrganizationMember` table (`schema.prisma:138-152`)
- Roles: `ORG_ADMIN`, `MEMBER`, `VIEWER` (via `MemberRole` enum)

**New System:**
- `RoleAssignment` table (`schema.prisma:333-348`)
- Roles: `TENANT_OWNER`, `TENANT_ADMIN`, `TENANT_VIEWER` (via `RBACRole` enum)
- Scope: `TENANT` with `scopeId = organizationId`

**⚠️ ISSUE:** Both systems exist, causing confusion

**2. Do we have Workspace-level roles (Workspace Owner, Member, Viewer)?**

**✅ YES - Two Systems:**

**Old System:**
- `WorkspaceMember` table (`schema.prisma:122-136`)
- Roles: `WORKSPACE_OWNER`, `MEMBER`, `VIEWER`

**New System:**
- `RoleAssignment` with scope `WORKSPACE`
- Roles: `WORKSPACE_LEAD`, `WORKSPACE_ADMIN`, `WORKSPACE_MEMBER`

**⚠️ ISSUE:** Role names differ (OWNER vs LEAD, MEMBER vs ADMIN)

**3. Do we have Team-level roles (Team Lead, Member)?**

**✅ YES - Two Systems:**

**Old System:**
- `TeamMember` table (`schema.prisma:97-111`)
- Roles: `TEAM_LEAD`, `MEMBER`, `VIEWER`

**New System:**
- `RoleAssignment` with scope `TEAM`
- Roles: `TEAM_LEAD`, `TEAM_CONTRIBUTOR`, `TEAM_VIEWER`

**⚠️ ISSUE:** Old system uses `MEMBER`, new uses `TEAM_CONTRIBUTOR`

**4. Can one user hold different roles in different scopes?**

**✅ YES:**
- `RoleAssignment` table supports multiple assignments per user
- Unique constraint: `userId_role_scopeType_scopeId` allows same role at different scopes
- User can be `TENANT_ADMIN` in Org A and `TEAM_CONTRIBUTOR` in Team B

**✅ GOOD:** Multi-scope role support exists

**5. Is there a UI flow for "Add User" that assigns roles?**

**❌ NO:**
- No visible user management UI component
- Backend endpoints exist:
  - `organization.service.ts:addMember()` (`organization.service.ts:220-265`)
  - `workspace.service.ts` (likely has add member)
  - `user.service.ts:createUser()` (`user.service.ts:145-230`)
- **BUT:** No frontend page/component found

**6. Does the backend persist role assignments?**

**✅ YES:**
- `rbac.service.ts:assignRole()` persists to `RoleAssignment` table (`rbac.service.ts:224-299`)
- `organization.service.ts:addMember()` persists to `OrganizationMember` table
- Both systems persist, but to different tables

**7. Is there a Superuser concept?**

**✅ YES:**
- `User.isSuperuser` boolean field (`schema.prisma:74`)
- `RBACRole.SUPERUSER` for platform-level access
- Superuser handling in RBAC (`rbac.ts:97-99`, `visibilityPolicy.ts:34-37`)

**✅ GOOD:** Superuser can view everything but cannot edit/delete (read-only admin)

### Summary: Role / User Management

**✅ STRENGTHS:**
- Role hierarchy exists at all levels
- Multi-scope roles supported
- Superuser concept implemented
- Backend APIs exist for role assignment

**❌ GAPS:**
- **CRITICAL:** Two role systems in parallel (old `MemberRole` tables vs new `RoleAssignment` table)
- **CRITICAL:** Frontend uses old system, backend uses new system (mismatch)
- No UI for user/role management
- No invite flow (email invitations)
- Migration service exists but both systems still active

---

## PART 6. GAPS / RISKS / PRIORITY

### P0 (MUST FIX BEFORE PRODUCTION)

**1. ❌ MULTI-TENANT DATA LEAK**

**Issue:** `GET /objectives` returns OKRs from ALL organizations, not tenant-scoped.

**Evidence:**
```13:27:services/core-api/src/modules/okr/objective.service.ts
async findAll(_userId: string, workspaceId?: string) {
    // Return all OKRs globally - filtering happens in UI, not backend
    // Only PRIVATE OKRs are restricted (handled by canView() check on individual access)
    const where: any = {};

    // Optional workspace filter for UI convenience (not access control)
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    // Note: We no longer filter by user's accessible scopes.
    // All OKRs are globally visible by default.
```

**Impact:** Users from Org A can see Org B's OKRs. Critical security/data privacy violation.

**Fix Required:**
- Add tenant/organization filtering to `findAll()` queries
- Use `TenantIsolationGuard` or extract user's organization from context
- Filter by `organizationId` in WHERE clause
- Apply to: `objective.service.ts:findAll()`, `key-result.service.ts:findAll()`

**2. ❌ TENANT ISOLATION ON WRITE PATHS**

**Issue:** Users can edit/delete OKRs from other organizations if they know the ID.

**Evidence:** `canEdit()` and `canDelete()` check roles but don't verify tenant ownership.

**Fix Required:**
- Add tenant check: "does this OKR belong to my organization?"
- Fail authorization if OKR's `organizationId` doesn't match user's organization
- Apply to: `objective.service.ts:canEdit()`, `canDelete()`, `key-result.service.ts:canEdit()`

**3. ⚠️ ROLE SYSTEM MISMATCH**

**Issue:** Frontend uses old `MemberRole` system, backend uses new `RBACRole` system.

**Evidence:**
- Frontend: `usePermissions.ts` reads from `teams` (old `TeamMember` table)
- Backend: `rbac.service.ts` uses `RoleAssignment` table

**Impact:** Permission checks may be inconsistent, users may see incorrect permissions.

**Fix Required:**
- Migrate frontend to use new RBAC system
- Or complete migration to new system and remove old tables
- Ensure frontend permission checks match backend

**4. ❌ NO TENANT-SCOPED QUERIES**

**Issue:** No way to get user's organization context in service layer.

**Evidence:** `findAll()` doesn't receive organization context, queries are global.

**Fix Required:**
- Pass organization context from controller/guard to service
- Use `TenantIsolationGuard` to set `request.userOrganizations`
- Filter all queries by organization membership

### P1 (WILL BITE IN 2-3 MONTHS)

**1. ⚠️ NO PROGRESS ROLL-UP / REPORTING**

**Issue:** No endpoints or services for:
- Company-level progress roll-up
- Workspace-level progress aggregation
- Period-based reporting (Q1, Q2, etc.)
- At-risk OKR dashboard

**Impact:** Can't provide leadership dashboards, can't do quarterly reviews.

**Fix Required:**
- Create reporting service
- Add endpoints: `GET /reports/company-progress`, `GET /reports/at-risk`, etc.
- Aggregate Objective progress from Key Results
- Period-based filtering

**2. ⚠️ NO ACTIVITY LOG POPULATION**

**Issue:** `Activity` model exists but may not be populated on OKR changes.

**Evidence:** No service calls found that write to `Activity` table on create/update/delete.

**Impact:** No history of who changed what, when. Compliance risk.

**Fix Required:**
- Add activity logging to `objective.service.ts:create()`, `update()`, `delete()`
- Add activity logging to `key-result.service.ts`
- Populate `Activity` table on all OKR mutations

**3. ⚠️ NO ORPHANED OKR DETECTION**

**Issue:** No validation that OKRs have proper parent-child relationships.

**Impact:** Cascade view may show broken hierarchies, misalignment goes undetected.

**Fix Required:**
- Add query to find OKRs with no parent and no children (if that's invalid)
- Add validation on cascade link creation
- Add reporting endpoint for misalignment detection

**4. ⚠️ NO COMMENTS SYSTEM**

**Issue:** No way for users to discuss OKRs, add context, ask questions.

**Impact:** Users will use workarounds (e.g., put comments in description field).

**Fix Required:**
- Add `Comment` model linked to `Objective` and `KeyResult`
- Add comment endpoints: `POST /objectives/:id/comments`, `GET /objectives/:id/comments`
- Add comment UI component

**5. ⚠️ NO MULTI-OWNER KEY RESULTS**

**Issue:** Key Results can only have one owner, but some KRs need multiple contributors.

**Impact:** Teams can't properly assign shared ownership.

**Fix Required:**
- Add `KRContributor` junction table (many-to-many)
- Or add `contributors` array field
- Update UI to show multiple owners

**6. ⚠️ STATUS NOT AUTO-UPDATED**

**Issue:** `determineOKRStatus()` utility exists but may not be called automatically.

**Impact:** Status may be stale, requires manual updates.

**Fix Required:**
- Call `determineOKRStatus()` on check-in creation
- Auto-update Objective status based on KR statuses
- Add scheduled job to recalculate statuses

### P2 (ANNOYING / ROADMAP)

**1. ⚠️ NO PAGINATION**

**Issue:** `findAll()` returns all OKRs, no pagination.

**Impact:** Performance will degrade with large datasets (1000+ OKRs).

**Fix Required:**
- Add pagination (limit/offset or cursor-based)
- Add `page` and `limit` query params
- Return pagination metadata (total, page, hasMore)

**2. ⚠️ NO SEED DATA FOR MULTI-TENANT**

**Issue:** Seed script may not create realistic multi-tenant test data.

**Impact:** Hard to test tenant isolation, role scenarios.

**Fix Required:**
- Create seed data with 2+ organizations
- Users with different roles across orgs
- OKRs across multiple tenants

**3. ⚠️ NO EXPORT FUNCTIONALITY**

**Issue:** No CSV/PDF export for OKRs.

**Impact:** Users can't do offline analysis, can't share with stakeholders.

**Fix Required:**
- Add export endpoints: `GET /objectives/export?format=csv`
- Generate CSV/PDF with OKR data
- Include progress, status, ownership

**4. ⚠️ NO TAGS / STRATEGIC THEMES**

**Issue:** Can't tag OKRs or group by strategic themes.

**Impact:** Hard to find related OKRs, can't track themes across org.

**Fix Required:**
- Add `Tag` model and `ObjectiveTag` junction table
- Add tag filtering to queries
- Add tag UI in create/edit forms

**5. ⚠️ FRONTEND PERMISSION UX**

**Issue:** OKR list doesn't show which actions user can perform.

**Impact:** Users don't know if they can edit/delete until they try.

**Fix Required:**
- Add edit/delete buttons to OKR cards
- Disable buttons using `usePermissions` hook
- Show tooltip explaining why disabled
- Or hide buttons entirely if no permission

**6. ⚠️ NO USER INVITATION FLOW**

**Issue:** No email invitation system for adding users.

**Impact:** Manual user creation, no self-service onboarding.

**Fix Required:**
- Add invitation model (`Invitation` table)
- Add invite endpoint: `POST /invitations`
- Send email with invite link
- Accept invitation flow in frontend

---

## SUMMARY

### ✅ STRENGTHS

1. **Solid Data Model:** Objectives, Key Results, Initiatives, Check-ins all modeled correctly
2. **Cascade Support:** Parent-child relationships exist for strategic alignment
3. **RBAC Framework:** Centralized permission system exists (though dual systems cause confusion)
4. **Visibility Model:** Aligned with transparency goals (global visibility, PRIVATE exceptions)
5. **Check-in System:** Progress tracking via check-ins with confidence/notes
6. **Audit Infrastructure:** Audit log and activity models exist (though may not be populated)

### ❌ CRITICAL GAPS (P0)

1. **Multi-tenant data leak** - No organization filtering on queries
2. **Tenant isolation missing** - Write paths don't verify tenant ownership
3. **Role system mismatch** - Frontend and backend use different systems
4. **No tenant context** - Services don't receive organization context

### ⚠️ MAJOR GAPS (P1)

1. **No reporting/analytics** - Can't do progress roll-ups or dashboards
2. **Activity log not populated** - History tracking incomplete
3. **No comments system** - Can't discuss OKRs
4. **No multi-owner KRs** - Can't assign multiple contributors
5. **Status not auto-updated** - Requires manual maintenance

### 📋 MINOR GAPS (P2)

1. No pagination
2. No export functionality
3. No tags/strategic themes
4. Frontend permission UX incomplete
5. No user invitation flow

---

**RECOMMENDATION:** Fix P0 issues immediately before any production deployment. P1 issues should be addressed within 2-3 months. P2 can be prioritized based on customer feedback.




