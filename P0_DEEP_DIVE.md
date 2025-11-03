# P0 Issues Deep Dive Analysis

## 1. Tenant Isolation on Read

### SECTION A. CURRENT CALL FLOW

**Request:** `GET /objectives`

**1. Controller Method:**

```ts
// services/core-api/src/modules/okr/objective.controller.ts
@Get()
@RequireAction('view_okr')
@ApiOperation({ summary: 'Get all objectives' })
async getAll(@Query('workspaceId') workspaceId: string | undefined, @Req() req: any) {
  // Filter OKRs based on user's access
  return this.objectiveService.findAll(req.user.id, workspaceId);
}
```

**2. Auth Middleware / Guard (populates req.user):**

```ts
// services/core-api/src/modules/auth/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

```ts
// services/core-api/src/modules/auth/strategies/jwt.strategy.ts
async validate(payload: any) {
  const user = await this.authService.validateUser(payload.sub);
  return user;
}
```

```ts
// services/core-api/src/modules/auth/auth.service.ts:194-213
async validateUser(userId: string) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return null;
  }

  const { passwordHash, ...userWithoutPassword } = user;
  const nameParts = user.name.split(' ');
  
  return {
    ...userWithoutPassword,
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' ') || '',
    role: 'user',
    isSuperuser: user.isSuperuser || false,
  };
}
```

**Evidence:** `req.user` contains: `id`, `email`, `name`, `firstName`, `lastName`, `role`, `isSuperuser`. **NO `organizationId` field.**

**3. Service Method:**

```ts
// services/core-api/src/modules/okr/objective.service.ts:13-54
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

**4. Prisma Query:**

The actual query is:
```sql
SELECT * FROM objectives
WHERE workspace_id = $workspaceId OR workspace_id IS NULL
-- NO organizationId filter
```

**5. Response Shape:**

Returns array of all Objectives from ALL organizations. No tenant filtering.

### SECTION B. EXPLAIN THE PROBLEM

**Why this is dangerous:**

1. **Data Leak:** User from Organization A can see all OKRs from Organization B, C, D, etc.
2. **No tenant context:** `req.user` does NOT include `organizationId`
3. **Query has no WHERE clause for organizationId:** Line 27-28 in `objective.service.ts` shows `where: {}` with only optional `workspaceId` filter
4. **TenantIsolationGuard exists but is NOT used:** The guard exists at `services/core-api/src/modules/permissions/tenant-isolation.guard.ts` but is NOT applied to `@Controller('objectives')`

**Evidence:**
- `req.user` structure: Only has `id`, `email`, `name`, `isSuperuser` - **NO `organizationId`**
- Prisma query: `where` object has no `organizationId` field (line 16-21 in `objective.service.ts`)
- Guard not applied: `objective.controller.ts:9` shows `@UseGuards(JwtAuthGuard, RBACGuard)` - **NO `TenantIsolationGuard`**

### SECTION C. MINIMUM CODE CHANGE PROPOSAL

**Change 1: Add organizationId to req.user**

Modify JWT strategy to include user's primary organization:

```ts
// services/core-api/src/modules/auth/strategies/jwt.strategy.ts
async validate(payload: any) {
  const user = await this.authService.validateUser(payload.sub);
  if (!user) return null;
  
  // Get user's primary organization (first org they belong to)
  const orgMember = await this.prisma.organizationMember.findFirst({
    where: { userId: user.id },
    select: { organizationId: true },
  });
  
  return {
    ...user,
    organizationId: orgMember?.organizationId || null,
  };
}
```

**Change 2: Filter by organizationId in findAll**

```ts
// services/core-api/src/modules/okr/objective.service.ts:13-54
async findAll(userId: string, workspaceId?: string, organizationId?: string) {
  const where: any = {};

  // REQUIRED: Filter by organization
  if (organizationId) {
    where.organizationId = organizationId;
  } else {
    // If no org context, return empty (safety first)
    return [];
  }

  // Optional workspace filter for UI convenience (not access control)
  if (workspaceId) {
    where.workspaceId = workspaceId;
  }

  return this.prisma.objective.findMany({
    where,
    include: {
      // ... existing includes ...
    },
  });
}
```

**Change 3: Pass organizationId from controller**

```ts
// services/core-api/src/modules/okr/objective.controller.ts:14-20
@Get()
@RequireAction('view_okr')
@ApiOperation({ summary: 'Get all objectives' })
async getAll(@Query('workspaceId') workspaceId: string | undefined, @Req() req: any) {
  return this.objectiveService.findAll(
    req.user.id, 
    workspaceId,
    req.user.organizationId  // Pass org context
  );
}
```

### SECTION D. FINAL RISK RATING

**AFTER applying fix:** **P1** (acceptable for pilot with design partners)

**Rationale:** 
- Tenant isolation is enforced at query level
- Assumes single organization per user (acceptable constraint for MVP)
- Still allows global visibility within tenant (matches design goal)
- May need refinement for multi-org users later, but safe for pilot

---

## 2. Tenant Isolation on Write

### SECTION A. CURRENT CALL FLOW

**Request:** `PATCH /objectives/:id`

**1. Controller Method:**

```ts
// services/core-api/src/modules/okr/objective.controller.ts:58-68
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
```

**2. Auth Middleware (same as read):**

`req.user` populated by `JwtAuthGuard` → `JwtStrategy.validate()` → `AuthService.validateUser()`. Contains `id`, `email`, `name`, `isSuperuser`. **NO `organizationId`**.

**3. Service Method (canEdit check):**

```ts
// services/core-api/src/modules/okr/objective.service.ts:116-123
async canEdit(userId: string, objectiveId: string): Promise<boolean> {
  try {
    const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
    return this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
  } catch {
    return false;
  }
}
```

**4. RBAC Check:**

```ts
// services/core-api/src/modules/rbac/rbac.ts:289-329
function canEditOKRAction(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  if (!resourceContext.okr) {
    return false;
  }

  const okr = resourceContext.okr;
  const tenantId = okr.tenantId;

  // Owner can always edit their own OKRs
  if (okr.ownerId === userContext.userId) {
    return true;
  }

  // TENANT_OWNER can edit any OKR in their tenant
  if (hasTenantOwnerRole(userContext, tenantId)) {
    return true;
  }

  // TENANT_ADMIN can edit OKRs in their tenant (but not EXEC_ONLY unless allowed)
  if (hasTenantAdminRole(userContext, tenantId)) {
    if (okr.visibilityLevel === 'EXEC_ONLY' && !resourceContext.tenant?.allowTenantAdminExecVisibility) {
      return false;
    }
    return true;
  }

  // WORKSPACE_LEAD can edit workspace-level OKRs
  if (okr.workspaceId && hasWorkspaceLeadRole(userContext, okr.workspaceId)) {
    return true;
  }

  // TEAM_LEAD can edit team-level OKRs
  if (okr.teamId && hasTeamLeadRole(userContext, okr.teamId)) {
    return true;
  }

  return false;
}
```

**5. Resource Context Building:**

```ts
// services/core-api/src/modules/rbac/helpers.ts:13-81
export async function buildResourceContextFromOKR(
  prisma: PrismaService,
  okrId: string,
): Promise<ResourceContext> {
  const objective = await prisma.objective.findUnique({
    where: { id: okrId },
    select: {
      id: true,
      organizationId: true,  // ← OKR's org is fetched
      workspaceId: true,
      teamId: true,
      ownerId: true,
      visibilityLevel: true,
      isPublished: true,
    },
  });

  // ... builds resourceContext with okr.tenantId = objective.organizationId
}
```

**6. User Context Building (for RBAC):**

```ts
// services/core-api/src/modules/rbac/rbac.service.ts:38-170
async buildUserContext(userId: string, useCache: boolean = true): Promise<UserContext> {
  // ... loads role assignments from RoleAssignment table
  const roleAssignments = await this.prisma.roleAssignment.findMany({
    where: { userId },
  });

  // Builds tenantRoles Map with tenantId as key
  // Checks if user has TENANT_OWNER/TENANT_ADMIN in okr.tenantId
}
```

**7. Prisma Update Query:**

```ts
// services/core-api/src/modules/okr/objective.service.ts:319-325
return this.prisma.objective.update({
  where: { id },
  data,
  include: {
    keyResults: true,
  },
});
```

**No tenant check - updates OKR regardless of organization match.**

### SECTION B. EXPLAIN THE PROBLEM

**Why this is dangerous:**

1. **Cross-tenant edit possible:** User from Org A can edit Org B's OKR if:
   - They know the OKR ID
   - They have `TENANT_OWNER` role in Org B (via `RoleAssignment` table)
   - OR they're the owner (even if owner is in different org)

2. **RBAC checks tenant roles but doesn't verify user belongs to that tenant:**
   - `canEditOKRAction()` checks if user has `TENANT_OWNER` role for `okr.tenantId`
   - But it doesn't verify: "Does this user actually belong to this organization?"
   - `UserContext` is built from `RoleAssignment` table, which may have stale/cross-tenant assignments

3. **No explicit tenant membership check:**
   - Missing check: "Does user's organization match OKR's organization?"
   - Even if user has role in Org B, they shouldn't edit Org B's OKRs if they're not a member

**Evidence:**
- `canEdit()` builds `resourceContext` with `okr.tenantId` (line 106 in `objective.service.ts`)
- RBAC checks if user has role in that tenant (line 306 in `rbac.ts`)
- **BUT:** No check that user's primary organization matches OKR's organization
- Update query (line 319) executes without tenant validation

### SECTION C. MINIMUM CODE CHANGE PROPOSAL

**Add tenant membership check to canEdit/canDelete:**

```ts
// services/core-api/src/modules/okr/objective.service.ts:116-123
async canEdit(userId: string, objectiveId: string, userOrganizationId?: string): Promise<boolean> {
  try {
    const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
    
    // NEW: Verify tenant match
    if (userOrganizationId && resourceContext.okr.tenantId) {
      if (resourceContext.okr.tenantId !== userOrganizationId) {
        return false; // User's org doesn't match OKR's org
      }
    }
    
    return this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
  } catch {
    return false;
  }
}
```

**Update controller to pass organizationId:**

```ts
// services/core-api/src/modules/okr/objective.controller.ts:58-68
@Patch(':id')
@RequireAction('edit_okr')
@ApiOperation({ summary: 'Update objective' })
async update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
  const canEdit = await this.objectiveService.canEdit(
    req.user.id, 
    id,
    req.user.organizationId  // Pass user's org
  );
  if (!canEdit) {
    throw new ForbiddenException('You do not have permission to edit this OKR');
  }
  return this.objectiveService.update(id, data, req.user.id);
}
```

**Same for canDelete:**

```ts
// services/core-api/src/modules/okr/objective.service.ts:128-135
async canDelete(userId: string, objectiveId: string, userOrganizationId?: string): Promise<boolean> {
  try {
    const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
    
    // NEW: Verify tenant match
    if (userOrganizationId && resourceContext.okr.tenantId) {
      if (resourceContext.okr.tenantId !== userOrganizationId) {
        return false;
      }
    }
    
    return this.rbacService.canPerformAction(userId, 'delete_okr', resourceContext);
  } catch {
    return false;
  }
}
```

### SECTION D. FINAL RISK RATING

**AFTER applying fix:** **P1** (acceptable for pilot)

**Rationale:**
- Tenant boundary enforced before RBAC check
- Prevents cross-tenant edits even if role assignments are incorrect
- Safe for single-org-per-user assumption
- Can be refined later for multi-org users

---

## 3. RBAC Dual System

### SECTION A. CURRENT CALL FLOW

**Example: Setting a role on a user**

**Path 1: Old System (OrganizationMember table)**

```ts
// services/core-api/src/modules/organization/organization.service.ts:220-265
async addMember(organizationId: string, userId: string, role: 'ORG_ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER') {
  // ... validation ...
  
  // Check if user is already a member
  const existing = await this.prisma.organizationMember.findFirst({
    where: {
      userId,
      organizationId,
    },
  });

  if (existing) {
    // Update role if already exists
    return this.prisma.organizationMember.update({
      where: { id: existing.id },
      data: { role },
      include: {
        user: true,
        organization: true,
      },
    });
  }

  // Create new membership
  return this.prisma.organizationMember.create({
    data: {
      userId,
      organizationId,
      role,
    },
    include: {
      user: true,
      organization: true,
    },
  });
}
```

**Path 2: New System (RoleAssignment table)**

```ts
// services/core-api/src/modules/rbac/rbac.service.ts:224-299
async assignRole(
  userId: string,
  role: Role,
  scopeType: ScopeType,
  scopeId: string | null,
  _assignedBy: string,
): Promise<RoleAssignment> {
  // ... validation ...
  
  const assignment = await this.prisma.roleAssignment.upsert({
    where: {
      userId_role_scopeType_scopeId: {
        userId,
        role,
        scopeType,
        scopeId: scopeId!,
      },
    },
    create: {
      userId,
      role,
      scopeType,
      scopeId: scopeId!,
    },
    update: {
      updatedAt: new Date(),
    },
  });

  this.invalidateUserContextCache(userId);
  return this.mapPrismaToRoleAssignment(assignment);
}
```

**Example: Reading roles (old system)**

```ts
// services/core-api/src/modules/permissions/role.service.ts:44-100
async getUserRoles(userId: string): Promise<UserRole[]> {
  // ... superuser check ...
  
  const roles: UserRole[] = [];

  // Get organization memberships
  const orgMembers = await this.prisma.organizationMember.findMany({
    where: { userId },
    include: { organization: true },
  });

  for (const member of orgMembers) {
    roles.push({
      role: member.role,  // MemberRole enum
      entityType: 'ORGANIZATION',
      entityId: member.organizationId,
      organizationId: member.organizationId,
    });
  }

  // Get workspace memberships
  const workspaceMembers = await this.prisma.workspaceMember.findMany({
    where: { userId },
    include: { workspace: true },
  });

  // Get team memberships
  const teamMembers = await this.prisma.teamMember.findMany({
    where: { userId },
    include: {
      team: {
        include: {
          workspace: true,
        },
      },
    },
  });

  return roles;
}
```

**Example: Reading roles (new system)**

```ts
// services/core-api/src/modules/rbac/rbac.service.ts:38-170
async buildUserContext(userId: string, useCache: boolean = true): Promise<UserContext> {
  // ... cache check ...
  
  // Load all role assignments for this user
  const roleAssignments = await this.prisma.roleAssignment.findMany({
    where: { userId },
  });

  // Build maps of roles by scope
  const tenantRoles = new Map<string, TenantRole[]>();
  const workspaceRoles = new Map<string, WorkspaceRole[]>();
  const teamRoles = new Map<string, TeamRole[]>();

  for (const assignment of roleAssignments) {
    const role = assignment.role as Role;  // RBACRole enum

    switch (assignment.scopeType) {
      case 'TENANT':
        if (assignment.scopeId) {
          const existing = tenantRoles.get(assignment.scopeId) || [];
          tenantRoles.set(assignment.scopeId, [...existing, role as TenantRole]);
        }
        break;
      // ... workspace and team cases ...
    }
  }

  return {
    userId,
    isSuperuser,
    tenantRoles,
    workspaceRoles,
    teamRoles,
    // ...
  };
}
```

**Frontend: Reading roles (old system)**

```ts
// apps/web/src/contexts/workspace.context.tsx:131-132
setWorkspaces(userContextData.workspaces || [])
setTeams(userContextData.teams || [])
```

```ts
// apps/web/src/hooks/usePermissions.ts:4-60
export function usePermissions() {
  const { teams, team } = useWorkspace()  // ← Gets teams with role from old system
  const { user } = useAuth()

  const canCreateWorkspace = () => {
    // Check if user has ORG_ADMIN role in any team
    return teams.some(t => t.role === 'ORG_ADMIN')  // ← Reads from TeamMember.role
  }

  const canManageTeam = (teamId?: string) => {
    if (!teamId) {
      return teams.some(t => t.role === 'TEAM_LEAD' || t.role === 'ORG_ADMIN' || t.role === 'WORKSPACE_OWNER')
    }
    
    const userTeam = teams.find(t => t.id === teamId)
    if (!userTeam) return false

    return userTeam.role === 'TEAM_LEAD' || userTeam.role === 'ORG_ADMIN' || userTeam.role === 'WORKSPACE_OWNER'
  }

  const canEditOKR = (okr: { ownerId: string; teamId?: string | null }) => {
    if (okr.ownerId === user?.id) {
      return true
    }

    if (okr.teamId) {
      return canManageTeam(okr.teamId)  // ← Uses old role system
    }

    return false
  }
}
```

### SECTION B. EXPLAIN THE PROBLEM

**Why this is broken:**

1. **Two truth sources:**
   - Old: `OrganizationMember`, `WorkspaceMember`, `TeamMember` tables with `MemberRole` enum
   - New: `RoleAssignment` table with `RBACRole` enum and `ScopeType`

2. **Backend uses new system, frontend uses old:**
   - Backend RBAC (`rbac.service.ts`) reads from `RoleAssignment` table
   - Frontend (`usePermissions.ts`) reads from `teams` array which comes from old `TeamMember` table
   - Mismatch: Frontend shows user can edit, backend says no (or vice versa)

3. **Both systems can have different data:**
   - User assigned role via `organization.service.addMember()` → writes to `OrganizationMember`
   - User assigned role via `rbac.service.assignRole()` → writes to `RoleAssignment`
   - Data can drift out of sync

4. **Migration service exists but both systems still active:**
   - `rbac/migration.service.ts` exists to migrate old → new
   - But both systems are still being used simultaneously

**Evidence:**
- Backend RBAC: `rbac.service.ts:91-93` queries `RoleAssignment` table
- Backend old system: `role.service.ts:59-62` queries `OrganizationMember` table
- Frontend: `usePermissions.ts:5` reads from `teams` which has `role` field from `TeamMember` table
- Controller: `objective.controller.ts:9` uses `RBACGuard` (new system) but frontend doesn't use it

### SECTION C. MINIMUM CODE CHANGE PROPOSAL

**Recommendation: New system (`RoleAssignment`) should win**

**Step 1: Delete one example of old system usage**

```ts
// DELETE this method or mark as deprecated:
// services/core-api/src/modules/organization/organization.service.ts:220-265
// async addMember() - writes to OrganizationMember table

// REPLACE with:
async addMember(organizationId: string, userId: string, role: 'ORG_ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER') {
  // Map old role to new role
  const roleMap: Record<string, Role> = {
    'ORG_ADMIN': 'TENANT_ADMIN',
    'MEMBER': 'TENANT_VIEWER',  // Or appropriate mapping
    'VIEWER': 'TENANT_VIEWER',
  };
  
  const newRole = roleMap[role] || 'TENANT_VIEWER';
  
  // Use new system
  return this.rbacService.assignRole(
    userId,
    newRole,
    'TENANT',
    organizationId,
    'system'  // or req.user.id
  );
}
```

**Step 2: Update frontend hook to use new system**

```ts
// apps/web/src/hooks/usePermissions.ts
import { useAuth } from '@/contexts/auth.context'
import api from '@/lib/api'
import { useState, useEffect } from 'react'

export function usePermissions() {
  const { user } = useAuth()
  const [userRoles, setUserRoles] = useState<Map<string, string[]>>(new Map())  // tenantId -> roles[]
  
  useEffect(() => {
    if (user?.id) {
      // Fetch roles from new RBAC system
      api.get(`/rbac/users/${user.id}/roles`)
        .then(res => {
          // Build map: { tenantId: [roles] }
          const rolesMap = new Map()
          res.data.forEach((assignment: any) => {
            if (assignment.scopeType === 'TENANT' && assignment.scopeId) {
              const existing = rolesMap.get(assignment.scopeId) || []
              rolesMap.set(assignment.scopeId, [...existing, assignment.role])
            }
          })
          setUserRoles(rolesMap)
        })
    }
  }, [user?.id])
  
  const canEditOKR = (okr: { ownerId: string; organizationId?: string | null }) => {
    if (okr.ownerId === user?.id) {
      return true
    }
    
    // Check new RBAC system
    if (okr.organizationId) {
      const tenantRoles = userRoles.get(okr.organizationId) || []
      return tenantRoles.includes('TENANT_OWNER') || 
             tenantRoles.includes('TENANT_ADMIN') ||
             tenantRoles.includes('WORKSPACE_LEAD')
    }
    
    return false
  }
  
  return {
    canEditOKR,
    canDeleteOKR: canEditOKR,  // Same for now
    // ... other methods
  }
}
```

**Step 3: Add backend endpoint for frontend to query roles**

```ts
// services/core-api/src/modules/rbac/rbac.controller.ts (or create it)
@Get('users/:userId/roles')
@UseGuards(JwtAuthGuard, RBACGuard)
async getUserRoles(@Param('userId') userId: string, @Req() req: any) {
  // Verify user can view their own roles or is admin
  if (userId !== req.user.id && !req.user.isSuperuser) {
    throw new ForbiddenException();
  }
  
  const assignments = await this.rbacService.getUserRoleAssignments(userId);
  return assignments;
}
```

### SECTION D. FINAL RISK RATING

**AFTER applying fix:** **P1** (acceptable for pilot)

**Rationale:**
- Single source of truth established
- Frontend and backend use same system
- Can migrate old data gradually
- Still need to deprecate old tables eventually, but safe for pilot

---

## 4. Frontend Permission Enforcement

### SECTION A. CURRENT CALL FLOW

**Component: OKR List Page**

```ts
// apps/web/src/app/dashboard/okrs/page.tsx:280-330
{filteredOKRs.map((okr) => {
  const owner = availableUsers.find(u => u.id === okr.ownerId)
  const team = teams.find(t => t.id === okr.teamId)
  const workspace = workspaces.find(w => w.id === okr.workspaceId)
  return (
    <Card key={okr.id} className="hover:shadow-lg transition-shadow cursor-pointer">
      <CardHeader>
        {/* ... OKR title, description, badges ... */}
      </CardHeader>
      <CardContent>
        {/* ... Progress bar, key results count ... */}
        {/* NO EDIT/DELETE BUTTONS */}
      </CardContent>
    </Card>
  )
})}
```

**Permission Hook (exists but not used):**

```ts
// apps/web/src/hooks/usePermissions.ts:25-37
const canEditOKR = (okr: { ownerId: string; teamId?: string | null }) => {
  // Owner can always edit
  if (okr.ownerId === user?.id) {
    return true
  }

  // Team lead can edit team OKRs
  if (okr.teamId) {
    return canManageTeam(okr.teamId)
  }

  return false
}
```

**Current State:**
- OKR cards are rendered (lines 280-330)
- **NO edit/delete buttons visible**
- **NO permission checks**
- **NO disabled state**
- Permission hook exists but is **never called**

### SECTION B. EXPLAIN THE PROBLEM

**Why this is broken:**

1. **No action buttons:** Users see OKRs but have no way to edit/delete them in the list view
2. **Permission hook not used:** `usePermissions` hook exists but is never imported or called in `okrs/page.tsx`
3. **Poor UX:** Users don't know if they can edit until they navigate to detail page
4. **Permission logic mismatch:** Hook uses old role system (`teams` array), backend uses new RBAC system

**Evidence:**
- `okrs/page.tsx` imports: No `usePermissions` import (line 1-30)
- Card rendering: No buttons, no permission checks (lines 286-328)
- Hook exists but unused: `usePermissions.ts` has `canEditOKR` but it's never called

### SECTION C. MINIMUM CODE CHANGE PROPOSAL

**Add permission checks and action buttons:**

```ts
// apps/web/src/app/dashboard/okrs/page.tsx
// Add import:
import { usePermissions } from '@/hooks/usePermissions'
import { Edit, Trash2 } from 'lucide-react'

// Inside component:
const { canEditOKR, canDeleteOKR } = usePermissions()

// In the Card rendering (around line 286):
<Card key={okr.id} className="hover:shadow-lg transition-shadow">
  <CardHeader>
    {/* ... existing header content ... */}
    <div className="flex items-center justify-between">
      {/* ... existing badges ... */}
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={!canEditOKR(okr)}
          onClick={() => {/* navigate to edit */}}
          title={canEditOKR(okr) ? 'Edit OKR' : 'You do not have permission to edit this OKR'}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!canDeleteOKR(okr)}
          onClick={() => {/* delete handler */}}
          title={canDeleteOKR(okr) ? 'Delete OKR' : 'You do not have permission to delete this OKR'}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  </CardHeader>
  {/* ... rest of card ... */}
</Card>
```

**For list view (around line 336):**

```ts
<div key={okr.id} className="p-6 hover:bg-slate-50">
  <div className="flex items-center justify-between">
    {/* ... existing content ... */}
    <div className="ml-6 flex items-center gap-4">
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={!canEditOKR(okr)}
          title={canEditOKR(okr) ? 'Edit' : 'No permission'}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={!canDeleteOKR(okr)}
          title={canDeleteOKR(okr) ? 'Delete' : 'No permission'}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {/* ... existing progress display ... */}
    </div>
  </div>
</div>
```

**Note:** This assumes `usePermissions` hook is fixed to use new RBAC system (from issue #3). If not, buttons will show incorrect permissions.

### SECTION D. FINAL RISK RATING

**AFTER applying fix:** **P2** (good enough for pilot)

**Rationale:**
- Users can see what actions they can take
- Buttons are disabled with tooltips explaining why
- UX is clear and intuitive
- Depends on fixing issue #3 (RBAC dual system) for accurate permissions
- Minor polish issue, not blocking

---

## Summary of Changes Required

1. **Tenant Isolation Read:** Add `organizationId` to `req.user`, filter queries by org
2. **Tenant Isolation Write:** Add tenant match check before RBAC in `canEdit`/`canDelete`
3. **RBAC Dual System:** Standardize on `RoleAssignment` table, update frontend hook
4. **Frontend Permissions:** Add edit/delete buttons with permission checks in OKR list

**Total Risk After Fixes:** All P0 → P1/P2 (acceptable for pilot)




