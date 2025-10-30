# P0 Final Implementation Code

## 1. TenantIsolationGuard Status

**TenantIsolationGuard is never applied anywhere and can be deleted after these changes.**

Evidence: `TenantIsolationGuard` is exported from `permission.module.ts` but no controller uses `@UseGuards(TenantIsolationGuard)`. All controllers use `@UseGuards(JwtAuthGuard, RBACGuard)` only.

---

## 2. Updated Types

```ts
// services/core-api/src/modules/rbac/types.ts

// Update OKREntity interface:
export interface OKREntity {
  id: string;
  ownerId: string;
  organizationId: string | null;  // Changed from tenantId
  workspaceId?: string | null;
  teamId?: string | null;
  visibilityLevel: VisibilityLevel;
  isPublished?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ResourceContext keeps tenantId at top level (maps to organizationId):
export interface ResourceContext {
  tenantId: string;  // Maps to organizationId from DB
  workspaceId?: string | null;
  teamId?: string | null;
  okr?: OKREntity;  // Now uses organizationId internally
  targetUserId?: string;
  targetWorkspaceId?: string;
  targetTeamId?: string;
  tenant?: Tenant;
}
```

---

## 3. buildResourceContextFromOKR

```ts
// services/core-api/src/modules/rbac/helpers.ts (BEFORE)
export async function buildResourceContextFromOKR(
  prisma: PrismaService,
  okrId: string,
): Promise<ResourceContext> {
  const objective = await prisma.objective.findUnique({
    where: { id: okrId },
    select: {
      id: true,
      organizationId: true,
      workspaceId: true,
      teamId: true,
      ownerId: true,
      visibilityLevel: true,
      isPublished: true,
    },
  });

  if (!objective) {
    throw new Error(`OKR ${okrId} not found`);
  }

  const okr: OKREntity = {
    id: objective.id,
    ownerId: objective.ownerId,
    tenantId: objective.organizationId || '',
    workspaceId: objective.workspaceId,
    teamId: objective.teamId,
    visibilityLevel: objective.visibilityLevel as any,
    isPublished: objective.isPublished || false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const tenant = objective.organizationId
    ? await prisma.organization.findUnique({
        where: { id: objective.organizationId },
        select: {
          id: true,
          name: true,
          slug: true,
          allowTenantAdminExecVisibility: true,
          execOnlyWhitelist: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    : null;

  return {
    tenantId: objective.organizationId || '',
    workspaceId: objective.workspaceId,
    teamId: objective.teamId,
    okr,
    tenant: tenant
      ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          allowTenantAdminExecVisibility: tenant.allowTenantAdminExecVisibility || false,
          execOnlyWhitelist: tenant.execOnlyWhitelist as string[] | null | undefined,
          metadata: tenant.metadata as Record<string, any> | null | undefined,
          createdAt: tenant.createdAt,
          updatedAt: tenant.updatedAt,
        }
      : undefined,
  };
}
```

```ts
// services/core-api/src/modules/rbac/helpers.ts (AFTER)
export async function buildResourceContextFromOKR(
  prisma: PrismaService,
  okrId: string,
): Promise<ResourceContext> {
  const objective = await prisma.objective.findUnique({
    where: { id: okrId },
    select: {
      id: true,
      organizationId: true,
      workspaceId: true,
      teamId: true,
      ownerId: true,
      visibilityLevel: true,
      isPublished: true,
    },
  });

  if (!objective) {
    throw new Error(`OKR ${okrId} not found`);
  }

  const okr: OKREntity = {
    id: objective.id,
    ownerId: objective.ownerId,
    organizationId: objective.organizationId,  // Changed: direct mapping, no tenantId
    workspaceId: objective.workspaceId,
    teamId: objective.teamId,
    visibilityLevel: objective.visibilityLevel as any,
    isPublished: objective.isPublished || false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const tenant = objective.organizationId
    ? await prisma.organization.findUnique({
        where: { id: objective.organizationId },
        select: {
          id: true,
          name: true,
          slug: true,
          allowTenantAdminExecVisibility: true,
          execOnlyWhitelist: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    : null;

  return {
    tenantId: objective.organizationId || '',  // Top-level tenantId maps to organizationId
    workspaceId: objective.workspaceId,
    teamId: objective.teamId,
    okr,  // okr.organizationId is now the source of truth
    tenant: tenant
      ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          allowTenantAdminExecVisibility: tenant.allowTenantAdminExecVisibility || false,
          execOnlyWhitelist: tenant.execOnlyWhitelist as string[] | null | undefined,
          metadata: tenant.metadata as Record<string, any> | null | undefined,
          createdAt: tenant.createdAt,
          updatedAt: tenant.updatedAt,
        }
      : undefined,
  };
}
```

---

## 4. Final Consolidated Code

### objective.service.ts.findAll

```ts
// services/core-api/src/modules/okr/objective.service.ts
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

### objective.service.ts.canEdit

```ts
// services/core-api/src/modules/okr/objective.service.ts
async canEdit(userId: string, objectiveId: string, userOrganizationId: string | null): Promise<boolean> {
  try {
    const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
    
    // Superuser policy: superusers can READ but NOT EDIT
    if (userOrganizationId === null) {
      return false;  // Superuser cannot edit
    }
    
    // Get OKR's organizationId from resource context
    const okrOrganizationId = resourceContext.okr?.organizationId;
    
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

### objective.service.ts.canDelete

```ts
// services/core-api/src/modules/okr/objective.service.ts
async canDelete(userId: string, objectiveId: string, userOrganizationId: string | null): Promise<boolean> {
  try {
    const resourceContext = await buildResourceContextFromOKR(this.prisma, objectiveId);
    
    // Superuser policy: superusers can READ but NOT DELETE
    if (userOrganizationId === null) {
      return false;  // Superuser cannot delete
    }
    
    // Get OKR's organizationId from resource context
    const okrOrganizationId = resourceContext.okr?.organizationId;
    
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

### objective.controller.ts

```ts
// services/core-api/src/modules/okr/objective.controller.ts
@Get()
@RequireAction('view_okr')
@ApiOperation({ summary: 'Get all objectives' })
async getAll(@Query('workspaceId') workspaceId: string | undefined, @Req() req: any) {
  // Pass user's organizationId (null for superusers, string for regular users)
  return this.objectiveService.findAll(
    req.user.id, 
    workspaceId,
    req.user.organizationId  // null = superuser (see all), string = filter by org
  );
}

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

---

### visibilityPolicy.ts Update

```ts
// services/core-api/src/modules/rbac/visibilityPolicy.ts
// Update line 68 to use organizationId:
function canViewPrivate(
  userContext: UserContext,
  okr: OKREntity,
  tenant?: Tenant & { privateWhitelist?: string[] | null },
): boolean {
  // TENANT_OWNER can view private OKRs in their tenant
  const tenantId = okr.organizationId || '';  // Changed: use organizationId
  const tenantRoles = userContext.tenantRoles.get(tenantId) || [];
  if (tenantRoles.includes('TENANT_OWNER')) {
    return true;
  }
  // ... rest unchanged
}
```

### rbac.ts Update

```ts
// services/core-api/src/modules/rbac/rbac.ts
// Update canEditOKRAction (line 298):
function canEditOKRAction(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  if (!resourceContext.okr) {
    return false;
  }

  const okr = resourceContext.okr;
  const tenantId = okr.organizationId || '';  // Changed: use organizationId

  // Owner can always edit their own OKRs
  if (okr.ownerId === userContext.userId) {
    return true;
  }

  // TENANT_OWNER can edit any OKR in their tenant
  if (hasTenantOwnerRole(userContext, tenantId)) {
    return true;
  }
  // ... rest unchanged
}

// Update canDeleteOKRAction (line 343):
function canDeleteOKRAction(
  userContext: UserContext,
  resourceContext: ResourceContext,
): boolean {
  if (!resourceContext.okr) {
    return false;
  }

  const okr = resourceContext.okr;
  const tenantId = okr.organizationId || '';  // Changed: use organizationId

  // Owner can delete their own OKRs
  if (okr.ownerId === userContext.userId) {
    return true;
  }
  // ... rest unchanged
}
```

---

## 5. Remaining TODOs

1. **Multi-organization users:** Current implementation assumes single organization per user (takes first membership). Decision needed: support multi-org users now, or defer to future phase?

2. **User with no organization membership:** Currently returns empty array in `findAll`. Decision needed: should we throw error, create default org, or allow this state?

3. **OKR with null organizationId:** Currently denied in `canEdit`/`canDelete`. Decision needed: is this valid data state, or should we enforce organizationId at creation?

4. **JWT Strategy PrismaService injection:** Need to add `PrismaService` to `auth.module.ts` providers array if not already present.

5. **Key Results tenant isolation:** Should `key-result.service.ts` also get the same `canEdit`/`canDelete` organization checks? Currently only Objectives are protected.

6. **Role mapping (MEMBER → TENANT_VIEWER):** Confirm if `MEMBER` should map to `TENANT_VIEWER` or a different role when migrating from old system.

7. **Old membership tables cleanup:** After frontend migration, decide when to stop writing to `OrganizationMember`/`WorkspaceMember`/`TeamMember` tables and eventually remove them.

8. **Deprecated functions in visibilityPolicy.ts:** Functions `_canViewWorkspaceOnly`, `_canViewTeamOnly`, `_canViewManagerChain`, `_canViewExecOnly` still reference `okr.tenantId`. These are deprecated but should be updated for consistency if kept.

