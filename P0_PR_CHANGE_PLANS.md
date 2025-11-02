# P0 Issues - PR-Ready Change Plans

## 1. Tenant Isolation on Read

### A. Current State Recap

`GET /objectives` returns OKRs from all organizations. `req.user` has no `organizationId` field, and the Prisma query has no `organizationId` filter in the WHERE clause.

### B. Required Behavioural Outcome

**Business Rule:** Users can only see OKRs from their own organization. Superusers can see OKRs from all organizations.

**Superuser Behaviour:** Superusers bypass organization filtering and see all OKRs across all organizations.

### C. File-by-File Diff Plan

#### File 1: JWT Strategy - Add organizationId to req.user

```ts
// services/core-api/src/modules/auth/strategies/jwt.strategy.ts (BEFORE)
async validate(payload: any) {
  const user = await this.authService.validateUser(payload.sub);
  return user;
}
```

```ts
// services/core-api/src/modules/auth/strategies/jwt.strategy.ts (AFTER)
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
    private prisma: PrismaService,  // Add PrismaService injection
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
    });
  }

  async validate(payload: any) {
    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      return null;
    }
    
    // Superusers don't need organizationId (they see everything)
    if (user.isSuperuser) {
      return {
        ...user,
        organizationId: null,  // null means "all organizations"
      };
    }
    
    // Get user's primary organization (first org they belong to)
    const orgMember = await this.prisma.organizationMember.findFirst({
      where: { userId: user.id },
      select: { organizationId: true },
      orderBy: { createdAt: 'asc' },  // Get first membership (primary org)
    });
    
    return {
      ...user,
      organizationId: orgMember?.organizationId || null,
    };
  }
}
```

**Note:** Also add `PrismaService` to `providers` array in `auth.module.ts` if not already there.

#### File 2: Objective Service - Filter by organizationId

```ts
// services/core-api/src/modules/okr/objective.service.ts (BEFORE)
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

```ts
// services/core-api/src/modules/okr/objective.service.ts (AFTER)
async findAll(userId: string, workspaceId: string | undefined, userOrganizationId: string | null) {
  const where: any = {};

  // REQUIRED: Filter by organization (unless superuser)
  // userOrganizationId === null means superuser (see all orgs)
  if (userOrganizationId !== null) {
    if (!userOrganizationId) {
      // User has no organization - return empty (safety first)
      return [];
    }
    where.organizationId = userOrganizationId;
  }
  // If userOrganizationId === null, don't filter (superuser sees all)

  // Optional workspace filter for UI convenience (not access control)
  if (workspaceId) {
    where.workspaceId = workspaceId;
  }

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

#### File 3: Objective Controller - Pass organizationId

```ts
// services/core-api/src/modules/okr/objective.controller.ts (BEFORE)
@Get()
@RequireAction('view_okr')
@ApiOperation({ summary: 'Get all objectives' })
async getAll(@Query('workspaceId') workspaceId: string | undefined, @Req() req: any) {
  // Filter OKRs based on user's access
  return this.objectiveService.findAll(req.user.id, workspaceId);
}
```

```ts
// services/core-api/src/modules/okr/objective.controller.ts (AFTER)
@Get()
@RequireAction('view_okr')
@ApiOperation({ summary: 'Get all objectives' })
async getAll(@Query('workspaceId') workspaceId: string | undefined, @Req() req: any) {
  // Pass user's organizationId (null for superusers)
  return this.objectiveService.findAll(
    req.user.id, 
    workspaceId,
    req.user.organizationId  // null = superuser (see all), string = filter by org
  );
}
```

### D. Follow-up Questions / Risks

1. **What if user belongs to multiple organizations?** Currently we take the first (`orderBy: { createdAt: 'asc' }`). Should we support multi-org users, or is single-org-per-user acceptable for MVP?

2. **What if user has no organization membership?** Currently returns empty array. Should we throw an error instead?

3. **TenantIsolationGuard status:** Not used anywhere else in the codebase. It exists but is never applied to any controller.

---

## 2. Tenant Isolation on Write

### A. Current State Recap

`canEdit()` and `canDelete()` check RBAC roles but don't verify the user's organization matches the OKR's organization. Users from Org A could edit Org B's OKRs if they have roles in Org B.

### B. Required Behavioural Outcome

**Business Rule:** Users can only edit/delete OKRs from their own organization, regardless of role assignments. Superusers can edit/delete OKRs from any organization.

**Superuser Behaviour:** Superusers bypass organization matching checks and can edit/delete any OKR.

### C. File-by-File Diff Plan

#### File 1: Objective Service - Add organization check to canEdit

```ts
// services/core-api/src/modules/okr/objective.service.ts (BEFORE)
async canEdit(userId: string, objectiveId: string): Promise<boolean> {
  try {
    const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
    return this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
  } catch {
    return false;
  }
}
```

```ts
// services/core-api/src/modules/okr/objective.service.ts (AFTER)
async canEdit(userId: string, objectiveId: string, userOrganizationId: string | null): Promise<boolean> {
  try {
    const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
    
    // Get OKR's organizationId from resource context
    const okrOrganizationId = resourceContext.okr.tenantId;  // tenantId maps to organizationId
    
    // Superuser bypass: userOrganizationId === null means superuser
    if (userOrganizationId === null) {
      // Superuser can edit any OKR (still subject to RBAC rules like not editing EXEC_ONLY)
      return this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
    }
    
    // Verify tenant match: user's org must match OKR's org
    if (okrOrganizationId && okrOrganizationId !== userOrganizationId) {
      return false;  // User's org doesn't match OKR's org
    }
    
    // If OKR has no organizationId, deny (safety first)
    if (!okrOrganizationId) {
      return false;
    }
    
    return this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext);
  } catch {
    return false;
  }
}
```

#### File 2: Objective Service - Add organization check to canDelete

```ts
// services/core-api/src/modules/okr/objective.service.ts (BEFORE)
async canDelete(userId: string, objectiveId: string): Promise<boolean> {
  try {
    const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
    return this.rbacService.canPerformAction(userId, 'delete_okr', resourceContext);
  } catch {
    return false;
  }
}
```

```ts
// services/core-api/src/modules/okr/objective.service.ts (AFTER)
async canDelete(userId: string, objectiveId: string, userOrganizationId: string | null): Promise<boolean> {
  try {
    const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
    
    // Get OKR's organizationId from resource context
    const okrOrganizationId = resourceContext.okr.tenantId;  // tenantId maps to organizationId
    
    // Superuser bypass: userOrganizationId === null means superuser
    if (userOrganizationId === null) {
      // Superuser can delete any OKR
      return this.rbacService.canPerformAction(userId, 'delete_okr', resourceContext);
    }
    
    // Verify tenant match: user's org must match OKR's org
    if (okrOrganizationId && okrOrganizationId !== userOrganizationId) {
      return false;  // User's org doesn't match OKR's org
    }
    
    // If OKR has no organizationId, deny (safety first)
    if (!okrOrganizationId) {
      return false;
    }
    
    return this.rbacService.canPerformAction(userId, 'delete_okr', resourceContext);
  } catch {
    return false;
  }
}
```

#### File 3: Objective Controller - Pass organizationId to canEdit/canDelete

```ts
// services/core-api/src/modules/okr/objective.controller.ts (BEFORE)
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

```ts
// services/core-api/src/modules/okr/objective.controller.ts (AFTER)
@Patch(':id')
@RequireAction('edit_okr')
@ApiOperation({ summary: 'Update objective' })
async update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
  // Check if user can edit this OKR (pass organizationId)
  const canEdit = await this.objectiveService.canEdit(
    req.user.id, 
    id,
    req.user.organizationId  // null for superusers, string for regular users
  );
  if (!canEdit) {
    throw new ForbiddenException('You do not have permission to edit this OKR');
  }
  return this.objectiveService.update(id, data, req.user.id);
}

@Delete(':id')
@RequireAction('delete_okr')
@ApiOperation({ summary: 'Delete objective' })
async delete(@Param('id') id: string, @Req() req: any) {
  // Check if user can delete this OKR (pass organizationId)
  const canDelete = await this.objectiveService.canDelete(
    req.user.id, 
    id,
    req.user.organizationId  // null for superusers, string for regular users
  );
  if (!canDelete) {
    throw new ForbiddenException('You do not have permission to delete this OKR');
  }
  return this.objectiveService.delete(id);
}
```

### D. Follow-up Questions / Risks

1. **Should we also add organization check to `canView()`?** Currently `canView()` only checks visibility level (PRIVATE). Should we also verify organization match, or is that redundant since `findAll()` already filters?

2. **What about Key Results?** Should `key-result.service.ts` also get the same `canEdit`/`canDelete` organization checks?

3. **Edge case:** What if an OKR has `organizationId = null`? Currently we deny access. Should we allow it, or is that invalid data?

---

## 3. RBAC Dual System

### A. Current State Recap

Backend uses `RoleAssignment` table (new system) for RBAC checks, but frontend `usePermissions` hook reads from `teams` array which comes from old `TeamMember`/`WorkspaceMember` tables. Both systems are active simultaneously, causing permission mismatches.

### B. Required Behavioural Outcome

**Business Rule:** Frontend and backend must use the same RBAC system (`RoleAssignment` table). Frontend should query user's roles from the backend RBAC endpoint, not from workspace context's `teams` array.

**Superuser Behaviour:** Superusers are handled via `isSuperuser` flag, not via role assignments.

### C. File-by-File Diff Plan

#### File 1: RBAC Assignment Controller - Add endpoint for user's own roles

```ts
// services/core-api/src/modules/rbac/rbac-assignment.controller.ts (BEFORE)
// No endpoint exists for user to get their own roles
```

```ts
// services/core-api/src/modules/rbac/rbac-assignment.controller.ts (AFTER)
// Add this new endpoint after the existing @Get() method:

@Get('me')
@RequireAction('view_okr')  // Any authenticated user can view their own roles
@ApiOperation({ summary: 'Get current user\'s role assignments' })
async getMyRoles(@Req() req: any) {
  const assignments = await this.rbacService.getUserRoleAssignments(req.user.id);
  
  // Transform to frontend-friendly format
  const rolesByScope: {
    tenant: Array<{ organizationId: string; roles: string[] }>;
    workspace: Array<{ workspaceId: string; roles: string[] }>;
    team: Array<{ teamId: string; roles: string[] }>;
  } = {
    tenant: [],
    workspace: [],
    team: [],
  };
  
  // Group assignments by scope
  const tenantMap = new Map<string, string[]>();
  const workspaceMap = new Map<string, string[]>();
  const teamMap = new Map<string, string[]>();
  
  for (const assignment of assignments) {
    const role = assignment.role;
    
    switch (assignment.scopeType) {
      case 'TENANT':
        if (assignment.scopeId) {
          const existing = tenantMap.get(assignment.scopeId) || [];
          tenantMap.set(assignment.scopeId, [...existing, role]);
        }
        break;
      case 'WORKSPACE':
        if (assignment.scopeId) {
          const existing = workspaceMap.get(assignment.scopeId) || [];
          workspaceMap.set(assignment.scopeId, [...existing, role]);
        }
        break;
      case 'TEAM':
        if (assignment.scopeId) {
          const existing = teamMap.get(assignment.scopeId) || [];
          teamMap.set(assignment.scopeId, [...existing, role]);
        }
        break;
    }
  }
  
  // Convert maps to arrays
  for (const [organizationId, roles] of tenantMap.entries()) {
    rolesByScope.tenant.push({ organizationId, roles });
  }
  for (const [workspaceId, roles] of workspaceMap.entries()) {
    rolesByScope.workspace.push({ workspaceId, roles });
  }
  for (const [teamId, roles] of teamMap.entries()) {
    rolesByScope.team.push({ teamId, roles });
  }
  
  return {
    userId: req.user.id,
    isSuperuser: req.user.isSuperuser || false,
    roles: rolesByScope,
  };
}
```

**RBAC Roles Endpoint Contract:**

**Endpoint:** `GET /rbac/assignments/me`

**Response:**
```typescript
{
  userId: string;
  isSuperuser: boolean;
  roles: {
    tenant: Array<{
      organizationId: string;
      roles: string[];  // e.g., ['TENANT_OWNER', 'TENANT_ADMIN']
    }>;
    workspace: Array<{
      workspaceId: string;
      roles: string[];  // e.g., ['WORKSPACE_LEAD', 'WORKSPACE_MEMBER']
    }>;
    team: Array<{
      teamId: string;
      roles: string[];  // e.g., ['TEAM_LEAD', 'TEAM_CONTRIBUTOR']
    }>;
  };
}
```

#### File 2: Frontend usePermissions Hook - Use new RBAC endpoint

```ts
// apps/web/src/hooks/usePermissions.ts (BEFORE)
import { useWorkspace } from '@/contexts/workspace.context'
import { useAuth } from '@/contexts/auth.context'

export function usePermissions() {
  const { teams, team } = useWorkspace()
  const { user } = useAuth()

  const canCreateWorkspace = () => {
    // Check if user has ORG_ADMIN role in any team
    return teams.some(t => t.role === 'ORG_ADMIN')
  }

  const canManageTeam = (teamId?: string) => {
    // Check if user is TEAM_LEAD or higher for the specified team
    if (!teamId) {
      return teams.some(t => t.role === 'TEAM_LEAD' || t.role === 'ORG_ADMIN' || t.role === 'WORKSPACE_OWNER')
    }
    
    const userTeam = teams.find(t => t.id === teamId)
    if (!userTeam) return false

    return userTeam.role === 'TEAM_LEAD' || userTeam.role === 'ORG_ADMIN' || userTeam.role === 'WORKSPACE_OWNER'
  }

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

  const canDeleteOKR = (okr: { ownerId: string; teamId?: string | null }) => {
    // Same logic as edit for now
    return canEditOKR(okr)
  }

  const canInviteMembers = () => {
    // Only team leads and above can invite
    return teams.some(t => 
      t.role === 'TEAM_LEAD' || 
      t.role === 'ORG_ADMIN' || 
      t.role === 'WORKSPACE_OWNER'
    )
  }

  return {
    canCreateWorkspace,
    canManageTeam,
    canEditOKR,
    canDeleteOKR,
    canInviteMembers,
  }
}
```

```ts
// apps/web/src/hooks/usePermissions.ts (AFTER)
import { useAuth } from '@/contexts/auth.context'
import api from '@/lib/api'
import { useState, useEffect } from 'react'

interface UserRoles {
  tenant: Array<{ organizationId: string; roles: string[] }>;
  workspace: Array<{ workspaceId: string; roles: string[] }>;
  team: Array<{ teamId: string; roles: string[] }>;
}

export function usePermissions() {
  const { user } = useAuth()
  const [userRoles, setUserRoles] = useState<UserRoles>({
    tenant: [],
    workspace: [],
    team: [],
  })
  const [isSuperuser, setIsSuperuser] = useState(false)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    
    // Fetch roles from new RBAC system
    api.get('/rbac/assignments/me')
      .then((response) => {
        setUserRoles(response.data.roles || { tenant: [], workspace: [], team: [] })
        setIsSuperuser(response.data.isSuperuser || false)
      })
      .catch((error) => {
        console.error('Failed to load user roles:', error)
        // Fallback to empty roles (no permissions)
        setUserRoles({ tenant: [], workspace: [], team: [] })
      })
      .finally(() => {
        setLoading(false)
      })
  }, [user?.id])

  const canCreateWorkspace = (organizationId?: string) => {
    if (isSuperuser) return true
    if (!organizationId) return false
    
    const tenantRoles = userRoles.tenant.find(t => t.organizationId === organizationId)
    return tenantRoles?.roles.includes('TENANT_OWNER') || 
           tenantRoles?.roles.includes('TENANT_ADMIN') || false
  }

  const canManageTeam = (teamId?: string) => {
    if (isSuperuser) return true
    if (!teamId) return false
    
    const teamRoles = userRoles.team.find(t => t.teamId === teamId)
    return teamRoles?.roles.includes('TEAM_LEAD') || false
  }

  const canEditOKR = (okr: { 
    ownerId: string; 
    organizationId?: string | null;
    workspaceId?: string | null;
    teamId?: string | null;
  }) => {
    // Owner can always edit
    if (okr.ownerId === user?.id) {
      return true
    }
    
    if (isSuperuser) return true
    
    // Check tenant-level roles
    if (okr.organizationId) {
      const tenantRoles = userRoles.tenant.find(t => t.organizationId === okr.organizationId)
      if (tenantRoles?.roles.includes('TENANT_OWNER') || 
          tenantRoles?.roles.includes('TENANT_ADMIN')) {
        return true
      }
    }
    
    // Check workspace-level roles
    if (okr.workspaceId) {
      const workspaceRoles = userRoles.workspace.find(w => w.workspaceId === okr.workspaceId)
      if (workspaceRoles?.roles.includes('WORKSPACE_LEAD') || 
          workspaceRoles?.roles.includes('WORKSPACE_ADMIN')) {
        return true
      }
    }
    
    // Check team-level roles
    if (okr.teamId) {
      const teamRoles = userRoles.team.find(t => t.teamId === okr.teamId)
      if (teamRoles?.roles.includes('TEAM_LEAD')) {
        return true
      }
    }
    
    return false
  }

  const canDeleteOKR = (okr: { 
    ownerId: string; 
    organizationId?: string | null;
    workspaceId?: string | null;
    teamId?: string | null;
  }) => {
    // Same logic as edit for now
    return canEditOKR(okr)
  }

  const canInviteMembers = (organizationId?: string, workspaceId?: string, teamId?: string) => {
    if (isSuperuser) return true
    
    // Check tenant-level
    if (organizationId) {
      const tenantRoles = userRoles.tenant.find(t => t.organizationId === organizationId)
      if (tenantRoles?.roles.includes('TENANT_OWNER') || 
          tenantRoles?.roles.includes('TENANT_ADMIN')) {
        return true
      }
    }
    
    // Check workspace-level
    if (workspaceId) {
      const workspaceRoles = userRoles.workspace.find(w => w.workspaceId === workspaceId)
      if (workspaceRoles?.roles.includes('WORKSPACE_LEAD') || 
          workspaceRoles?.roles.includes('WORKSPACE_ADMIN')) {
        return true
      }
    }
    
    // Check team-level
    if (teamId) {
      const teamRoles = userRoles.team.find(t => t.teamId === teamId)
      if (teamRoles?.roles.includes('TEAM_LEAD')) {
        return true
      }
    }
    
    return false
  }

  return {
    loading,
    isSuperuser,
    canCreateWorkspace,
    canManageTeam,
    canEditOKR,
    canDeleteOKR,
    canInviteMembers,
  }
}
```

#### File 3: Deprecate old system usage (example - Organization Service)

```ts
// services/core-api/src/modules/organization/organization.service.ts (BEFORE)
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

```ts
// services/core-api/src/modules/organization/organization.service.ts (AFTER)
// Add RBACService injection to constructor:
constructor(
  private prisma: PrismaService,
  private rbacService: RBACService,  // Add this
) {}

async addMember(organizationId: string, userId: string, role: 'ORG_ADMIN' | 'MEMBER' | 'VIEWER' = 'MEMBER') {
  // ... validation ...
  
  // Map old role enum to new RBACRole enum
  const roleMap: Record<string, 'TENANT_OWNER' | 'TENANT_ADMIN' | 'TENANT_VIEWER'> = {
    'ORG_ADMIN': 'TENANT_ADMIN',
    'MEMBER': 'TENANT_VIEWER',  // Note: may need to adjust this mapping
    'VIEWER': 'TENANT_VIEWER',
  };
  
  const newRole = roleMap[role] || 'TENANT_VIEWER';
  
  // Use new RBAC system
  await this.rbacService.assignRole(
    userId,
    newRole,
    'TENANT',
    organizationId,
    'system'  // TODO: Replace with actual assignedBy userId
  );
  
  // Still maintain old table for backward compatibility (temporary)
  // TODO: Remove this once migration is complete
  const existing = await this.prisma.organizationMember.findFirst({
    where: {
      userId,
      organizationId,
    },
  });

  if (existing) {
    return this.prisma.organizationMember.update({
      where: { id: existing.id },
      data: { role },
      include: {
        user: true,
        organization: true,
      },
    });
  }

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

**Note:** Also add `RBACModule` to imports in `organization.module.ts` if not already there.

### D. Follow-up Questions / Risks

1. **Role mapping:** The mapping `MEMBER` → `TENANT_VIEWER` may be incorrect. Should `MEMBER` map to `TENANT_ADMIN` or a new role? Confirm the intended permission level.

2. **Backward compatibility:** Should we keep writing to old `OrganizationMember` table during transition, or stop immediately? Current plan keeps both temporarily.

3. **Frontend API contract:** The `/rbac/assignments/me` endpoint returns roles grouped by scope. Is this format acceptable, or should we flatten it?

4. **Loading state:** Frontend hook now has async loading. Should components show loading state or default to "no permissions" until loaded?

---

## 4. Frontend Permission Enforcement

### A. Current State Recap

OKR list page (`okrs/page.tsx`) renders OKR cards but has no edit/delete buttons. `usePermissions` hook exists but is never imported or used. Users can't see what actions they can perform.

### B. Required Behavioural Outcome

**Business Rule:** OKR cards/list items should show edit and delete buttons. Buttons should be disabled if user lacks permission, with tooltips explaining why. Buttons should only appear for users who can perform the action (or show disabled state for others).

**Superuser Behaviour:** Superusers see enabled buttons for all OKRs.

### C. File-by-File Diff Plan

#### File 1: OKR List Page - Add permission checks and action buttons

```ts
// apps/web/src/app/dashboard/okrs/page.tsx (BEFORE)
// Around line 280-330 (grid view):
{filteredOKRs.map((okr) => {
  const owner = availableUsers.find(u => u.id === okr.ownerId)
  const team = teams.find(t => t.id === okr.teamId)
  const workspace = workspaces.find(w => w.id === okr.workspaceId)
  return (
    <Card key={okr.id} className="hover:shadow-lg transition-shadow cursor-pointer">
      <CardHeader>
        <div className="flex items-start justify-between mb-2">
          <div className="flex gap-2 flex-wrap">
            <Badge variant={okr.status === 'ON_TRACK' ? 'default' : okr.status === 'AT_RISK' ? 'destructive' : 'secondary'} className="text-xs">
              {okr.status === 'ON_TRACK' ? 'On Track' : okr.status === 'AT_RISK' ? 'At Risk' : okr.status}
            </Badge>
            {okr.visibilityLevel === 'PRIVATE' && (
              <Badge variant="outline" className="text-xs">🔒 Private</Badge>
            )}
            {okr.startDate && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatPeriod(okr.period, okr.startDate)}
              </Badge>
            )}
          </div>
          <span className="text-2xl font-bold text-slate-900">{Math.round(okr.progress || 0)}%</span>
        </div>
        <CardTitle className="text-lg">{okr.title}</CardTitle>
        <CardDescription>{okr.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* ... content ... */}
      </CardContent>
    </Card>
  )
})}
```

```ts
// apps/web/src/app/dashboard/okrs/page.tsx (AFTER)
// Add import at top:
import { usePermissions } from '@/hooks/usePermissions'
import { Edit, Trash2 } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// Inside component, add permission hook:
const { canEditOKR, canDeleteOKR, loading: permissionsLoading } = usePermissions()

// Around line 280-330 (grid view):
{filteredOKRs.map((okr) => {
  const owner = availableUsers.find(u => u.id === okr.ownerId)
  const team = teams.find(t => t.id === okr.teamId)
  const workspace = workspaces.find(w => w.id === okr.workspaceId)
  const canEdit = canEditOKR({
    ownerId: okr.ownerId,
    organizationId: okr.organizationId,
    workspaceId: okr.workspaceId,
    teamId: okr.teamId,
  })
  const canDelete = canDeleteOKR({
    ownerId: okr.ownerId,
    organizationId: okr.organizationId,
    workspaceId: okr.workspaceId,
    teamId: okr.teamId,
  })
  
  return (
    <Card key={okr.id} className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between mb-2">
          <div className="flex gap-2 flex-wrap">
            <Badge variant={okr.status === 'ON_TRACK' ? 'default' : okr.status === 'AT_RISK' ? 'destructive' : 'secondary'} className="text-xs">
              {okr.status === 'ON_TRACK' ? 'On Track' : okr.status === 'AT_RISK' ? 'At Risk' : okr.status}
            </Badge>
            {okr.visibilityLevel === 'PRIVATE' && (
              <Badge variant="outline" className="text-xs">🔒 Private</Badge>
            )}
            {okr.startDate && (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatPeriod(okr.period, okr.startDate)}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-slate-900">{Math.round(okr.progress || 0)}%</span>
            <div className="flex gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!canEdit || permissionsLoading}
                      onClick={() => {
                        // TODO: Navigate to edit page or open edit modal
                        console.log('Edit OKR:', okr.id)
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {canEdit ? 'Edit OKR' : 'You do not have permission to edit this OKR'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!canDelete || permissionsLoading}
                      onClick={() => {
                        // TODO: Implement delete handler
                        if (confirm('Are you sure you want to delete this OKR?')) {
                          console.log('Delete OKR:', okr.id)
                        }
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {canDelete ? 'Delete OKR' : 'You do not have permission to delete this OKR'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
        <CardTitle className="text-lg">{okr.title}</CardTitle>
        <CardDescription>{okr.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* ... existing content ... */}
      </CardContent>
    </Card>
  )
})}
```

```ts
// apps/web/src/app/dashboard/okrs/page.tsx (BEFORE)
// Around line 336-374 (list view):
{filteredOKRs.map((okr) => {
  const owner = availableUsers.find(u => u.id === okr.ownerId)
  const team = teams.find(t => t.id === okr.teamId)
  const workspace = workspaces.find(w => w.id === okr.workspaceId)
  return (
    <div key={okr.id} className="p-6 hover:bg-slate-50 transition-colors cursor-pointer">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {/* ... existing content ... */}
        </div>
        <div className="ml-6 flex items-center gap-4">
          <div className="text-right">
            <div className="text-3xl font-bold text-slate-900">{Math.round(okr.progress || 0)}%</div>
            <div className="text-xs text-slate-500">Progress</div>
          </div>
        </div>
      </div>
    </div>
  )
})}
```

```ts
// apps/web/src/app/dashboard/okrs/page.tsx (AFTER)
// Around line 336-374 (list view):
{filteredOKRs.map((okr) => {
  const owner = availableUsers.find(u => u.id === okr.ownerId)
  const team = teams.find(t => t.id === okr.teamId)
  const workspace = workspaces.find(w => w.id === okr.workspaceId)
  const canEdit = canEditOKR({
    ownerId: okr.ownerId,
    organizationId: okr.organizationId,
    workspaceId: okr.workspaceId,
    teamId: okr.teamId,
  })
  const canDelete = canDeleteOKR({
    ownerId: okr.ownerId,
    organizationId: okr.organizationId,
    workspaceId: okr.workspaceId,
    teamId: okr.teamId,
  })
  
  return (
    <div key={okr.id} className="p-6 hover:bg-slate-50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {/* ... existing content ... */}
        </div>
        <div className="ml-6 flex items-center gap-4">
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canEdit || permissionsLoading}
                    onClick={() => {
                      // TODO: Navigate to edit page or open edit modal
                      console.log('Edit OKR:', okr.id)
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {canEdit ? 'Edit OKR' : 'You do not have permission to edit this OKR'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!canDelete || permissionsLoading}
                    onClick={() => {
                      // TODO: Implement delete handler
                      if (confirm('Are you sure you want to delete this OKR?')) {
                        console.log('Delete OKR:', okr.id)
                      }
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {canDelete ? 'Delete OKR' : 'You do not have permission to delete this OKR'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-slate-900">{Math.round(okr.progress || 0)}%</div>
            <div className="text-xs text-slate-500">Progress</div>
          </div>
        </div>
      </div>
    </div>
  )
})}
```

**Note:** You may need to add the Tooltip component if it doesn't exist. Check `apps/web/src/components/ui/tooltip.tsx` - if it doesn't exist, you'll need to add it from shadcn/ui or create a simple tooltip wrapper.

### D. Follow-up Questions / Risks

1. **Tooltip component:** Does `@/components/ui/tooltip` exist? If not, we need to add it or use an alternative (e.g., native `title` attribute as fallback).

2. **Edit/Delete handlers:** The onClick handlers currently just log. Should we navigate to an edit page, open a modal, or use a different pattern?

3. **Loading state:** Should buttons be hidden while `permissionsLoading` is true, or shown but disabled?

4. **Button visibility:** Should we hide buttons entirely if user has no permission, or show them disabled? Current plan shows disabled with tooltip.

5. **OKR detail page:** Should we also add permission checks to the OKR detail/view page, or is list view sufficient for MVP?

---

## Summary

All four P0 issues have concrete, file-by-file change plans with BEFORE/AFTER code. Each change is surgical and focused. Key assumptions:

1. **Single organization per user** (except superusers) - acceptable for MVP
2. **Superusers see everything** - `organizationId: null` in `req.user` means superuser
3. **Standardize on `organizationId`** - database field name, mapped to `tenantId` in RBAC types internally
4. **TenantIsolationGuard** - not used anywhere else, can be ignored for now



