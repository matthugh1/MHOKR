# Role Simplification Implementation Plan
## From 10 Roles to 3 Roles + Ownership Model

**Version**: 1.0  
**Status**: Ready for Implementation  
**Estimated Duration**: 2-3 weeks  
**Risk Level**: Medium

---

## Table of Contents

1. [Overview](#overview)
2. [Phase 1: Schema Changes](#phase-1-schema-changes)
3. [Phase 2: Backend Code Changes](#phase-2-backend-code-changes)
4. [Phase 3: Migration Scripts](#phase-3-migration-scripts)
5. [Phase 4: Frontend Changes](#phase-4-frontend-changes)
6. [Phase 5: Testing](#phase-5-testing)
7. [Phase 6: Rollout](#phase-6-rollout)
8. [Rollback Plan](#rollback-plan)

---

## Overview

### Goal
Simplify role system from 10 roles across 4 scopes to 3 roles (SUPERUSER, TENANT_ADMIN, TENANT_USER) with ownership-based permissions for workspaces and teams.

### New Role Model

| Role | Scope | Capabilities |
|------|-------|--------------|
| **SUPERUSER** | Platform | Full system access, can view/edit everything |
| **TENANT_ADMIN** | Tenant | Full control within tenant, bypass locks, manage everything |
| **TENANT_USER** | Tenant | Default user, can edit own OKRs (when not published/locked), view others |

### Ownership Model

- **Workspace Owner**: Can edit all workspace OKRs, publish workspace OKRs, manage workspace members
- **Team Owner**: Can edit all team OKRs, publish team OKRs, manage team members
- **OKR Owner**: Can edit own OKRs (when not published/locked)

---

## Phase 1: Schema Changes

### 1.1 Add Ownership Fields

**File**: `services/core-api/prisma/schema.prisma`

**Changes**:
```prisma
model Workspace {
  id                String           @id @default(cuid())
  name              String
  tenantId          String
  tenant            Organization     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  ownerId           String?          // NEW: Workspace owner
  owner              User?           @relation("WorkspaceOwner", fields: [ownerId], references: [id], onDelete: SetNull) // NEW
  parentWorkspaceId String?
  parentWorkspace   Workspace?       @relation("WorkspaceHierarchy", fields: [parentWorkspaceId], references: [id], onDelete: SetNull)
  childWorkspaces   Workspace[]      @relation("WorkspaceHierarchy")
  teams             Team[]
  objectives        Objective[]
  aiConversations   AIConversation[]
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  @@index([tenantId])
  @@index([parentWorkspaceId])
  @@index([ownerId]) // NEW
  @@map("workspaces")
}

model Team {
  id          String       @id @default(cuid())
  name        String
  workspaceId String
  workspace   Workspace    @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  ownerId     String?      // NEW: Team owner
  owner       User?        @relation("TeamOwner", fields: [ownerId], references: [id], onDelete: SetNull) // NEW
  objectives  Objective[]
  keyResults  KeyResult[]
  initiatives Initiative[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([workspaceId])
  @@index([ownerId]) // NEW
  @@map("teams")
}

model User {
  // ... existing fields ...
  ownedWorkspaces Workspace[] @relation("WorkspaceOwner") // NEW
  ownedTeams      Team[]      @relation("TeamOwner") // NEW
  // ... rest of fields ...
}
```

### 1.2 Update RBACRole Enum (Optional - Keep for Migration)

**Decision**: Keep all roles in enum for backward compatibility during migration, but mark deprecated roles as deprecated in code comments.

```prisma
enum RBACRole {
  // Platform level (internal only)
  SUPERUSER

  // Tenant level
  TENANT_OWNER    // Keep for billing separation (optional)
  TENANT_ADMIN    // Primary admin role
  TENANT_VIEWER   // Deprecated - use TENANT_USER with no edit permissions

  // Workspace level - DEPRECATED: Use workspace.ownerId instead
  WORKSPACE_LEAD  // DEPRECATED
  WORKSPACE_ADMIN // DEPRECATED
  WORKSPACE_MEMBER // DEPRECATED

  // Team level - DEPRECATED: Use team.ownerId instead
  TEAM_LEAD       // DEPRECATED
  TEAM_CONTRIBUTOR // DEPRECATED
  TEAM_VIEWER     // DEPRECATED
}
```

### 1.3 Migration Steps

1. Create migration file:
```bash
npx prisma migrate dev --name add_workspace_team_ownership
```

2. Verify migration:
```sql
-- Check that ownerId columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name IN ('workspaces', 'teams') 
  AND column_name = 'owner_id';
```

---

## Phase 2: Backend Code Changes

### 2.1 Update RBAC Permission Logic

**File**: `services/core-api/src/modules/rbac/rbac.ts`

#### 2.1.1 Simplify canEditOKRAction

**Current Logic** (lines 262-370):
- Checks TENANT_OWNER, TENANT_ADMIN, WORKSPACE_LEAD, TEAM_LEAD roles
- Complex role hierarchy

**New Logic**:
```typescript
function canEditOKRAction(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  if (!resourceContext.okr) {
    return false;
  }

  const okr = resourceContext.okr;
  const tenantId = resourceContext.tenantId || okr.tenantId || '';

  // SUPERUSER: Full access
  if (userContext.isSuperuser) {
    return true;
  }

  // PUBLISH LOCK: If OKR is published, only TENANT_ADMIN can edit
  if (okr.isPublished === true || 
      okr.state === 'PUBLISHED' || 
      okr.state === 'COMPLETED' || 
      okr.state === 'CANCELLED' || 
      okr.state === 'ARCHIVED') {
    // Only TENANT_ADMIN can edit published OKRs
    const hasAdmin = hasTenantAdminRole(userContext, tenantId);
    if (hasAdmin) {
      // Check EXEC_ONLY visibility restriction
      if (okr.visibilityLevel === 'EXEC_ONLY' && !resourceContext.tenant?.allowTenantAdminExecVisibility) {
        return false;
      }
      return true;
    }
    return false;
  }

  // CYCLE LOCK: Check if cycle is locked (if cycle exists)
  // TODO: Add cycle lock check here or in governance service

  // Owner can always edit their own OKRs
  const isOwner = okr.ownerId === userContext.userId || 
    (okr as any).allOwnerIds?.includes(userContext.userId);
  if (isOwner) {
    return true;
  }

  // TENANT_ADMIN can edit any OKR in their tenant
  const hasAdmin = hasTenantAdminRole(userContext, tenantId);
  if (hasAdmin) {
    if (okr.visibilityLevel === 'EXEC_ONLY' && !resourceContext.tenant?.allowTenantAdminExecVisibility) {
      return false;
    }
    return true;
  }

  // Workspace owner can edit workspace OKRs
  if (okr.workspaceId && resourceContext.workspace?.ownerId === userContext.userId) {
    return true;
  }

  // Team owner can edit team OKRs
  if (okr.teamId && resourceContext.team?.ownerId === userContext.userId) {
    return true;
  }

  return false;
}
```

#### 2.1.2 Simplify canDeleteOKRAction

**Similar changes** - replace workspace/team role checks with ownership checks.

#### 2.1.3 Simplify canPublishOKRAction

**New Logic**:
```typescript
function canPublishOKRAction(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  if (!resourceContext.okr) {
    return false;
  }

  const okr = resourceContext.okr;
  const tenantId = resourceContext.tenantId || okr.tenantId || '';

  // SUPERUSER: Full access
  if (userContext.isSuperuser) {
    return true;
  }

  // TENANT_ADMIN can publish any OKR
  if (hasTenantAdminRole(userContext, tenantId)) {
    return true;
  }

  // Workspace owner can publish workspace OKRs
  if (okr.workspaceId && resourceContext.workspace?.ownerId === userContext.userId) {
    return true;
  }

  // Team owner can publish team OKRs
  if (okr.teamId && resourceContext.team?.ownerId === userContext.userId) {
    return true;
  }

  return false;
}
```

#### 2.1.4 Simplify canManageUsers

**New Logic**:
```typescript
function canManageUsers(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  const tenantId = resourceContext.tenantId;

  // TENANT_ADMIN can manage any user in their tenant
  if (hasTenantAdminRole(userContext, tenantId)) {
    return true;
  }

  // Workspace owner can manage workspace members
  if (resourceContext.workspaceId && resourceContext.workspace?.ownerId === userContext.userId) {
    return true;
  }

  // Team owner can manage team members
  if (resourceContext.teamId && resourceContext.team?.ownerId === userContext.userId) {
    return true;
  }

  return false;
}
```

### 2.2 Update Resource Context Builder

**File**: `services/core-api/src/modules/rbac/helpers.ts` or `context-builder.ts`

**Changes**: Ensure workspace and team ownership is loaded in resource context:

```typescript
export async function buildResourceContextFromOKR(
  prisma: PrismaService,
  okrId: string,
): Promise<ResourceContext> {
  // ... existing code to load OKR ...

  // Load workspace with owner if workspaceId exists
  let workspace = null;
  if (okr.workspaceId) {
    workspace = await prisma.workspace.findUnique({
      where: { id: okr.workspaceId },
      select: {
        id: true,
        name: true,
        tenantId: true,
        ownerId: true, // NEW: Include ownerId
      },
    });
  }

  // Load team with owner if teamId exists
  let team = null;
  if (okr.teamId) {
    team = await prisma.team.findUnique({
      where: { id: okr.teamId },
      select: {
        id: true,
        name: true,
        workspaceId: true,
        ownerId: true, // NEW: Include ownerId
      },
    });
  }

  // ... rest of context building ...
}
```

### 2.3 Update Objective Service

**File**: `services/core-api/src/modules/okr/objective.service.ts`

**Changes**: Remove workspace/team role checks, rely on ownership:

```typescript
// Remove these checks:
// - hasWorkspaceLeadRole()
// - hasTeamLeadRole()

// Replace with ownership checks (already handled in RBAC layer)
```

### 2.4 Update Key Result Service

**File**: `services/core-api/src/modules/okr/key-result.service.ts`

**Similar changes** - remove workspace/team role checks.

### 2.5 Update Workspace Service

**File**: `services/core-api/src/modules/workspace/workspace.service.ts` (if exists)

**Changes**: 
- Add methods to set/get workspace owner
- Update permission checks to use ownership

```typescript
async setWorkspaceOwner(workspaceId: string, ownerId: string, actorUserId: string): Promise<void> {
  // Check actor has permission (TENANT_ADMIN or current owner)
  const workspace = await this.prisma.workspace.findUnique({
    where: { id: workspaceId },
  });

  if (!workspace) {
    throw new NotFoundException(`Workspace ${workspaceId} not found`);
  }

  // Check permission
  const userContext = await this.rbacService.buildUserContext(actorUserId, false);
  const tenantId = workspace.tenantId;
  
  const isTenantAdmin = hasTenantAdminRole(userContext, tenantId);
  const isCurrentOwner = workspace.ownerId === actorUserId;

  if (!isTenantAdmin && !isCurrentOwner) {
    throw new ForbiddenException('Only tenant admin or current owner can change workspace ownership');
  }

  // Update owner
  await this.prisma.workspace.update({
    where: { id: workspaceId },
    data: { ownerId },
  });

  // Audit log
  await this.auditLogService.log({
    actorUserId,
    action: 'CHANGE_WORKSPACE_OWNER',
    targetType: 'WORKSPACE',
    targetId: workspaceId,
    metadata: { previousOwnerId: workspace.ownerId, newOwnerId: ownerId },
  });
}
```

### 2.6 Update Team Service

**File**: `services/core-api/src/modules/team/team.service.ts` (if exists)

**Similar changes** - add setTeamOwner method.

### 2.7 Remove Deprecated Role Assignment Code

**Files to Update**:
- `services/core-api/src/modules/rbac/rbac-assignment.controller.ts`
- `services/core-api/src/modules/rbac/rbac.service.ts`

**Changes**:
- Remove endpoints for assigning workspace/team roles
- Keep tenant role assignment (TENANT_ADMIN, TENANT_USER)
- Add endpoints for setting workspace/team ownership

```typescript
// NEW: Set workspace owner
@Post('workspaces/:workspaceId/owner')
@RequireAction('manage_workspaces')
async setWorkspaceOwner(
  @Param('workspaceId') workspaceId: string,
  @Body() body: { ownerId: string },
  @Req() req: any,
) {
  await this.workspaceService.setWorkspaceOwner(workspaceId, body.ownerId, req.user.id);
  return { success: true };
}

// NEW: Set team owner
@Post('teams/:teamId/owner')
@RequireAction('manage_teams')
async setTeamOwner(
  @Param('teamId') teamId: string,
  @Body() body: { ownerId: string },
  @Req() req: any,
) {
  await this.teamService.setTeamOwner(teamId, body.ownerId, req.user.id);
  return { success: true };
}
```

---

## Phase 3: Migration Scripts

### 3.1 Data Migration Script

**File**: `services/core-api/scripts/migrate-to-simplified-roles.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateToSimplifiedRoles() {
  console.log('Starting role simplification migration...');

  // Step 1: Migrate workspace owners
  console.log('Step 1: Migrating workspace owners...');
  const workspaceLeads = await prisma.roleAssignment.findMany({
    where: {
      scopeType: 'WORKSPACE',
      role: 'WORKSPACE_LEAD',
    },
  });

  for (const assignment of workspaceLeads) {
    if (assignment.scopeId) {
      await prisma.workspace.update({
        where: { id: assignment.scopeId },
        data: { ownerId: assignment.userId },
      });
      console.log(`  Set workspace ${assignment.scopeId} owner to ${assignment.userId}`);
    }
  }

  // Step 2: Migrate team owners
  console.log('Step 2: Migrating team owners...');
  const teamLeads = await prisma.roleAssignment.findMany({
    where: {
      scopeType: 'TEAM',
      role: 'TEAM_LEAD',
    },
  });

  for (const assignment of teamLeads) {
    if (assignment.scopeId) {
      await prisma.team.update({
        where: { id: assignment.scopeId },
        data: { ownerId: assignment.userId },
      });
      console.log(`  Set team ${assignment.scopeId} owner to ${assignment.userId}`);
    }
  }

  // Step 3: Set default owners for workspaces without owners
  console.log('Step 3: Setting default workspace owners...');
  const workspacesWithoutOwners = await prisma.workspace.findMany({
    where: { ownerId: null },
    include: {
      objectives: {
        take: 1,
        orderBy: { createdAt: 'asc' },
        select: { ownerId: true },
      },
    },
  });

  for (const workspace of workspacesWithoutOwners) {
    // Use first objective creator as default owner, or first tenant admin
    let defaultOwnerId: string | null = null;

    if (workspace.objectives.length > 0) {
      defaultOwnerId = workspace.objectives[0].ownerId;
    } else {
      // Find first tenant admin for this tenant
      const tenantAdmin = await prisma.roleAssignment.findFirst({
        where: {
          scopeType: 'TENANT',
          scopeId: workspace.tenantId,
          role: { in: ['TENANT_OWNER', 'TENANT_ADMIN'] },
        },
      });
      if (tenantAdmin) {
        defaultOwnerId = tenantAdmin.userId;
      }
    }

    if (defaultOwnerId) {
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { ownerId: defaultOwnerId },
      });
      console.log(`  Set default owner for workspace ${workspace.id} to ${defaultOwnerId}`);
    }
  }

  // Step 4: Set default owners for teams without owners
  console.log('Step 4: Setting default team owners...');
  const teamsWithoutOwners = await prisma.team.findMany({
    where: { ownerId: null },
    include: {
      objectives: {
        take: 1,
        orderBy: { createdAt: 'asc' },
        select: { ownerId: true },
      },
      workspace: {
        select: { ownerId: true },
      },
    },
  });

  for (const team of teamsWithoutOwners) {
    let defaultOwnerId: string | null = null;

    // Prefer team objective creator
    if (team.objectives.length > 0) {
      defaultOwnerId = team.objectives[0].ownerId;
    }
    // Fallback to workspace owner
    else if (team.workspace?.ownerId) {
      defaultOwnerId = team.workspace.ownerId;
    }
    // Fallback to first tenant admin
    else {
      const workspace = await prisma.workspace.findUnique({
        where: { id: team.workspaceId },
        select: { tenantId: true },
      });
      if (workspace) {
        const tenantAdmin = await prisma.roleAssignment.findFirst({
          where: {
            scopeType: 'TENANT',
            scopeId: workspace.tenantId,
            role: { in: ['TENANT_OWNER', 'TENANT_ADMIN'] },
          },
        });
        if (tenantAdmin) {
          defaultOwnerId = tenantAdmin.userId;
        }
      }
    }

    if (defaultOwnerId) {
      await prisma.team.update({
        where: { id: team.id },
        data: { ownerId: defaultOwnerId },
      });
      console.log(`  Set default owner for team ${team.id} to ${defaultOwnerId}`);
    }
  }

  // Step 5: Convert TENANT_VIEWER to TENANT_USER (or remove role)
  console.log('Step 5: Converting TENANT_VIEWER roles...');
  const tenantViewers = await prisma.roleAssignment.findMany({
    where: {
      scopeType: 'TENANT',
      role: 'TENANT_VIEWER',
    },
  });

  // Option A: Remove TENANT_VIEWER role (users become TENANT_USER by default)
  // Option B: Convert to TENANT_USER role
  // For now, we'll remove it (users without roles are TENANT_USER by default)
  for (const assignment of tenantViewers) {
    await prisma.roleAssignment.delete({
      where: { id: assignment.id },
    });
    console.log(`  Removed TENANT_VIEWER role for user ${assignment.userId} in tenant ${assignment.scopeId}`);
  }

  // Step 6: Remove deprecated workspace/team role assignments
  console.log('Step 6: Removing deprecated workspace/team role assignments...');
  const deprecatedRoles = [
    'WORKSPACE_LEAD',
    'WORKSPACE_ADMIN',
    'WORKSPACE_MEMBER',
    'TEAM_LEAD',
    'TEAM_CONTRIBUTOR',
    'TEAM_VIEWER',
  ];

  const deleted = await prisma.roleAssignment.deleteMany({
    where: {
      scopeType: { in: ['WORKSPACE', 'TEAM'] },
      role: { in: deprecatedRoles },
    },
  });

  console.log(`  Deleted ${deleted.count} deprecated role assignments`);

  console.log('Migration completed successfully!');
}

migrateToSimplifiedRoles()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### 3.2 Verification Script

**File**: `services/core-api/scripts/verify-role-migration.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyMigration() {
  console.log('Verifying role migration...');

  // Check workspaces without owners
  const workspacesWithoutOwners = await prisma.workspace.count({
    where: { ownerId: null },
  });
  console.log(`Workspaces without owners: ${workspacesWithoutOwners}`);

  // Check teams without owners
  const teamsWithoutOwners = await prisma.team.count({
    where: { ownerId: null },
  });
  console.log(`Teams without owners: ${teamsWithoutOwners}`);

  // Check remaining deprecated role assignments
  const deprecatedRoles = await prisma.roleAssignment.count({
    where: {
      scopeType: { in: ['WORKSPACE', 'TEAM'] },
      role: { in: ['WORKSPACE_LEAD', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER', 'TEAM_LEAD', 'TEAM_CONTRIBUTOR', 'TEAM_VIEWER'] },
    },
  });
  console.log(`Remaining deprecated role assignments: ${deprecatedRoles}`);

  // Check tenant role distribution
  const tenantRoles = await prisma.roleAssignment.groupBy({
    by: ['role'],
    where: { scopeType: 'TENANT' },
    _count: true,
  });
  console.log('Tenant role distribution:', tenantRoles);

  console.log('Verification completed!');
}

verifyMigration()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

## Phase 4: Frontend Changes

### 4.1 Update Permission Hooks

**File**: `apps/web/src/hooks/usePermissions.ts`

**Changes**: Remove workspace/team role checks, simplify to tenant roles only:

```typescript
// Remove workspace/team role arrays from RolesByScope interface
interface RolesByScope {
  tenant: Array<{ tenantId: string; roles: string[] }>
  // Remove: workspace and team arrays
}

// Update canEditOKR to check ownership instead of roles
const canEditOKR = useMemo(() => {
  return (okr: OKR & { workspace?: { ownerId?: string }, team?: { ownerId?: string } }): boolean => {
    if (!okr) return false;

    // Superuser: always true
    if (isSuperuser) return true;

    // Owner shortcut
    if (okr.ownerId === user?.id) return true;

    // Tenant admin
    if (okr.tenantId) {
      const tenantRoles = rolesByScope.tenant.find(t => t.tenantId === okr.tenantId);
      if (tenantRoles && (tenantRoles.roles.includes('TENANT_OWNER') || tenantRoles.roles.includes('TENANT_ADMIN'))) {
        return true;
      }
    }

    // Workspace owner
    if (okr.workspaceId && okr.workspace?.ownerId === user?.id) {
      return true;
    }

    // Team owner
    if (okr.teamId && okr.team?.ownerId === user?.id) {
      return true;
    }

    return false;
  };
}, [isSuperuser, user?.id, rolesByScope]);
```

### 4.2 Update Workspace/Team Management UI

**Files to Update**:
- `apps/web/src/app/dashboard/settings/workspaces/page.tsx`
- `apps/web/src/app/dashboard/settings/teams/page.tsx`

**Changes**:
- Remove role assignment UI
- Add ownership transfer UI
- Show current owner
- Allow changing owner (if user is tenant admin or current owner)

```typescript
// Example: Workspace settings component
function WorkspaceSettings({ workspace }: { workspace: Workspace }) {
  const { user } = useAuth();
  const permissions = usePermissions();
  const isTenantAdmin = permissions.isTenantAdminOrOwner(workspace.tenantId);
  const isOwner = workspace.ownerId === user?.id;

  return (
    <div>
      <h2>Workspace Owner</h2>
      <p>Current owner: {workspace.owner?.name || 'Not set'}</p>
      
      {(isTenantAdmin || isOwner) && (
        <TransferOwnershipButton
          workspaceId={workspace.id}
          currentOwnerId={workspace.ownerId}
        />
      )}
    </div>
  );
}
```

### 4.3 Update Role Assignment UI

**File**: `apps/web/src/app/dashboard/settings/people/page.tsx`

**Changes**:
- Remove workspace/team role assignment
- Simplify to: Admin vs User (at tenant level only)
- Show workspace/team ownership separately

```typescript
// Simplified role assignment
function UserRoleAssignment({ userId, tenantId }: Props) {
  const [isAdmin, setIsAdmin] = useState(false);

  const handleRoleChange = async (newIsAdmin: boolean) => {
    if (newIsAdmin) {
      await assignRole(userId, 'TENANT_ADMIN', tenantId);
    } else {
      await removeRole(userId, 'TENANT_ADMIN', tenantId);
    }
  };

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={isAdmin}
          onChange={(e) => handleRoleChange(e.target.checked)}
        />
        Tenant Administrator
      </label>
      <p className="text-sm text-gray-500">
        Administrators can edit all OKRs, manage users, and bypass publish locks.
      </p>
    </div>
  );
}
```

### 4.4 Update API Client

**File**: `apps/web/src/lib/api.ts` or similar

**Changes**: Add endpoints for ownership management:

```typescript
// Add new endpoints
export const workspaceApi = {
  setOwner: (workspaceId: string, ownerId: string) =>
    api.post(`/workspaces/${workspaceId}/owner`, { ownerId }),
  
  getOwner: (workspaceId: string) =>
    api.get(`/workspaces/${workspaceId}/owner`),
};

export const teamApi = {
  setOwner: (teamId: string, ownerId: string) =>
    api.post(`/teams/${teamId}/owner`, { ownerId }),
  
  getOwner: (teamId: string) =>
    api.get(`/teams/${teamId}/owner`),
};
```

---

## Phase 5: Testing

### 5.1 Unit Tests

**Files to Update**:
- `services/core-api/src/modules/rbac/rbac.spec.ts`
- `services/core-api/src/modules/okr/objective.service.spec.ts`

**Test Cases**:

1. **Permission Checks**:
   - ✅ TENANT_ADMIN can edit all OKRs
   - ✅ TENANT_USER can edit own OKRs (when not published)
   - ✅ TENANT_USER cannot edit published OKRs
   - ✅ Workspace owner can edit workspace OKRs
   - ✅ Team owner can edit team OKRs
   - ✅ Non-owner cannot edit workspace/team OKRs

2. **Ownership Management**:
   - ✅ Tenant admin can set workspace owner
   - ✅ Workspace owner can transfer ownership
   - ✅ Team owner can transfer ownership
   - ✅ Regular user cannot change ownership

3. **Migration**:
   - ✅ Workspace leads become workspace owners
   - ✅ Team leads become team owners
   - ✅ Default owners set correctly

### 5.2 Integration Tests

**File**: `services/core-api/src/modules/rbac/rbac.integration.spec.ts`

**Test Scenarios**:

1. **End-to-End Permission Flow**:
   - Create workspace with owner
   - Create OKR in workspace
   - Verify owner can edit
   - Verify non-owner cannot edit
   - Verify tenant admin can edit

2. **Ownership Transfer**:
   - Transfer workspace ownership
   - Verify permissions update
   - Verify audit log created

### 5.3 Manual Testing Checklist

- [ ] Workspace owner can edit workspace OKRs
- [ ] Team owner can edit team OKRs
- [ ] Tenant admin can edit all OKRs
- [ ] Regular user can edit own OKRs
- [ ] Regular user cannot edit published OKRs
- [ ] Workspace ownership can be transferred
- [ ] Team ownership can be transferred
- [ ] UI shows correct ownership
- [ ] Role assignment UI simplified
- [ ] Migration script runs successfully
- [ ] No permissions lost during migration

---

## Phase 6: Rollout

### 6.1 Pre-Rollout Checklist

- [ ] All code changes completed
- [ ] All tests passing
- [ ] Migration script tested on staging
- [ ] Rollback plan documented
- [ ] Team trained on new system
- [ ] Documentation updated

### 6.2 Rollout Steps

1. **Deploy Schema Changes** (Low Risk)
   - Add `ownerId` columns (nullable)
   - No data changes yet
   - Verify columns exist

2. **Deploy Code Changes** (Medium Risk)
   - Deploy backend with new permission logic
   - Keep old role checks as fallback during transition
   - Deploy frontend with new UI

3. **Run Migration Script** (High Risk)
   - Run on staging first
   - Verify all workspaces/teams have owners
   - Run on production during low-traffic window
   - Monitor for errors

4. **Remove Fallback Code** (Low Risk)
   - After migration verified, remove old role checks
   - Clean up deprecated code

5. **Monitor** (Ongoing)
   - Monitor error logs
   - Check for permission denials
   - Verify ownership transfers work

### 6.3 Rollout Timeline

| Phase | Duration | Risk | Dependencies |
|-------|----------|------|--------------|
| Schema Changes | 1 day | Low | None |
| Backend Code | 3-5 days | Medium | Schema changes |
| Frontend Code | 2-3 days | Low | Backend API ready |
| Testing | 2-3 days | Low | All code complete |
| Migration Script | 1 day | High | All code deployed |
| Production Rollout | 1 day | High | Testing complete |
| **Total** | **10-13 days** | | |

---

## Rollback Plan

### 7.1 Rollback Triggers

- Migration script fails
- Users report permission issues
- Error rate increases significantly
- Data integrity issues

### 7.2 Rollback Steps

1. **Immediate Rollback** (if migration fails):
   ```sql
   -- Revert schema changes (if needed)
   -- Keep ownerId columns (they're nullable, won't break anything)
   ```

2. **Code Rollback**:
   - Revert to previous code version
   - Old role checks still work (roles still in DB)
   - Users can continue working

3. **Data Rollback** (if needed):
   - Restore from backup
   - Re-run old role assignment logic

### 7.3 Rollback Testing

- Test rollback on staging
- Verify old system still works
- Document rollback procedure

---

## Success Metrics

### 8.1 Code Metrics

- ✅ Reduced role checks by 70%
- ✅ Simplified permission logic
- ✅ Reduced code complexity

### 8.2 User Metrics

- ✅ No permission loss during migration
- ✅ Users understand new system
- ✅ Support tickets decrease

### 8.3 Performance Metrics

- ✅ Permission checks faster (simpler logic)
- ✅ Reduced database queries
- ✅ Better caching

---

## Risk Mitigation

### 9.1 High Risks

1. **Migration Data Loss**
   - Mitigation: Backup before migration, test on staging

2. **Permission Denials**
   - Mitigation: Keep old role checks as fallback initially

3. **Ownership Not Set**
   - Mitigation: Default owner logic, verification script

### 9.2 Medium Risks

1. **UI Confusion**
   - Mitigation: Clear UI, documentation, training

2. **Performance Issues**
   - Mitigation: Load testing, monitoring

---

## Documentation Updates

### 10.1 Code Documentation

- Update RBAC README
- Document ownership model
- Update API documentation

### 10.2 User Documentation

- Update user guide
- Explain new permission model
- Provide migration guide for admins

---

## Next Steps

1. **Review this plan** with team
2. **Get approval** for schema changes
3. **Create tickets** for each phase
4. **Start with Phase 1** (schema changes)
5. **Iterate** based on feedback

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-20  
**Status**: Ready for Implementation

