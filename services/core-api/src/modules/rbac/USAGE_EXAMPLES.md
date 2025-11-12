# RBAC Usage Examples

## Basic Usage

### 1. Using RBAC Guard in Controllers

```typescript
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { RBACGuard } from '../rbac/rbac.guard';
import { RequireAction, RequireActionWithContext } from '../rbac/rbac.decorator';

@Controller('okrs')
@UseGuards(JwtAuthGuard, RBACGuard) // JWT first, then RBAC
export class OKRController {
  
  @Get(':id')
  @RequireAction('view_okr')
  async getOKR(@Param('id') id: string) {
    // RBAC guard will check if user can view this OKR
    // Resource context extracted from request params
    return this.okrService.findOne(id);
  }

  @Get(':tenantId/okrs/:id')
  @RequireActionWithContext('view_okr', async (req) => {
    // Load OKR from database to get full context
    const okr = await this.okrService.findOne(req.params.id);
    return {
      tenantId: req.params.tenantId,
      workspaceId: okr.workspaceId,
      teamId: okr.teamId,
      okr: {
        id: okr.id,
        ownerId: okr.ownerId,
        tenantId: okr.tenantId,
        workspaceId: okr.workspaceId,
        teamId: okr.teamId,
        visibilityLevel: okr.visibilityLevel,
      },
    };
  })
  async getOKRWithFullContext(@Param('id') id: string) {
    return this.okrService.findOne(id);
  }

  @Post()
  @RequireAction('create_okr')
  async createOKR(@Body() createDto: CreateOKRDto) {
    // Guard checks if user can create OKRs in the tenant/workspace/team
    return this.okrService.create(createDto);
  }

  @Patch(':id')
  @RequireAction('edit_okr')
  async updateOKR(@Param('id') id: string, @Body() updateDto: UpdateOKRDto) {
    return this.okrService.update(id, updateDto);
  }

  @Delete(':id')
  @RequireAction('delete_okr')
  async deleteOKR(@Param('id') id: string) {
    return this.okrService.remove(id);
  }
}
```

### 2. Manual Permission Checks in Services

```typescript
import { Injectable, ForbiddenException } from '@nestjs/common';
import { RBACService } from '../rbac/rbac.service';
import { Action, ResourceContext } from '../rbac/types';

@Injectable()
export class OKRService {
  constructor(private rbacService: RBACService) {}

  async publishOKR(userId: string, okrId: string) {
    // Load OKR
    const okr = await this.prisma.objective.findUnique({
      where: { id: okrId },
    });

    if (!okr) {
      throw new NotFoundException('OKR not found');
    }

    // Check permission
    const canPublish = await this.rbacService.canPerformAction(
      userId,
      'publish_okr',
      {
        tenantId: okr.organizationId,
        workspaceId: okr.workspaceId,
        teamId: okr.teamId,
        okr: {
          id: okr.id,
          ownerId: okr.ownerId,
          tenantId: okr.organizationId,
          workspaceId: okr.workspaceId,
          teamId: okr.teamId,
          visibilityLevel: okr.visibilityLevel,
        },
      },
    );

    if (!canPublish) {
      throw new ForbiddenException('You do not have permission to publish this OKR');
    }

    // Publish OKR
    return this.prisma.objective.update({
      where: { id: okrId },
      data: { isPublished: true },
    });
  }
}
```

### 3. Get User's Effective Roles

```typescript
@Injectable()
export class WorkspaceService {
  constructor(private rbacService: RBACService) {}

  async getUserWorkspaceRole(userId: string, workspaceId: string) {
    // Get workspace to find tenant
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    const roles = await this.rbacService.getEffectiveRolesForScope(
      userId,
      workspace.organizationId,
      workspaceId,
    );

    // Roles are sorted by priority (highest first)
    return roles[0]; // Most powerful role
  }
}
```

### 4. Role Assignment

```typescript
@Injectable()
export class UserManagementService {
  constructor(
    private rbacService: RBACService,
    private auditService: AuditService,
  ) {}

  async assignTenantAdmin(userId: string, tenantId: string, assignedBy: string) {
    // Assign role
    const assignment = await this.rbacService.assignRole(
      userId,
      'TENANT_ADMIN',
      'TENANT',
      tenantId,
      assignedBy,
    );

    // Record audit log
    await this.auditService.recordRoleChange({
      actorUserId: assignedBy,
      targetUserId: userId,
      targetType: 'TENANT',
      targetId: tenantId,
      previousRole: null,
      newRole: 'TENANT_ADMIN',
    });

    return assignment;
  }

  async revokeRole(userId: string, role: Role, scopeType: ScopeType, scopeId: string, revokedBy: string) {
    await this.rbacService.revokeRole(userId, role, scopeType, scopeId, revokedBy);
    
    // Record audit log
    await this.auditService.recordRoleChange({
      actorUserId: revokedBy,
      targetUserId: userId,
      targetType: scopeType,
      targetId: scopeId,
      previousRole: role,
      newRole: null,
    });
  }
}
```

### 5. Filtering OKRs by Visibility

```typescript
@Injectable()
export class OKRService {
  constructor(
    private prisma: PrismaService,
    private rbacService: RBACService,
  ) {}

  async getUserOKRs(userId: string, tenantId: string) {
    // Build user context
    const userContext = await this.rbacService.buildUserContext(userId);

    // Load all OKRs in tenant
    const allOKRs = await this.prisma.objective.findMany({
      where: { organizationId: tenantId },
    });

    // Filter by visibility
    const visibleOKRs = allOKRs.filter((okr) => {
      const okrEntity = {
        id: okr.id,
        ownerId: okr.ownerId,
        tenantId: okr.organizationId,
        workspaceId: okr.workspaceId,
        teamId: okr.teamId,
        visibilityLevel: okr.visibilityLevel,
        isPublished: okr.isPublished,
      };

      // Load tenant for visibility checks
      return canViewOKR(userContext, okrEntity, tenant);
    });

    return visibleOKRs;
  }
}
```

## Running Migrations

### Via REST API

```bash
# Migrate all memberships
POST /rbac/migration/all
{
  "migratedBy": "admin-user-id"
}

# Migrate single user
POST /rbac/migration/user/:userId
{
  "migratedBy": "admin-user-id"
}

# Verify migration
GET /rbac/migration/verify
```

### Via Service

```typescript
import { RBACMigrationService } from './rbac/migration.service';

@Injectable()
export class SetupService {
  constructor(private migrationService: RBACMigrationService) {}

  async runInitialMigration() {
    const result = await this.migrationService.migrateAllMemberships('system');
    console.log(`Migrated ${result.total} memberships`);
  }
}
```

## Caching

User contexts are automatically cached for 5 minutes. To invalidate:

```typescript
// Invalidate specific user
rbacService.invalidateUserContextCache(userId);

// Clear all cache
rbacService.clearCache();
```

Call `invalidateUserContextCache()` whenever roles are assigned or revoked.

## Best Practices

1. **Always use guards for route protection** - Don't rely on manual checks alone
2. **Invalidate cache when roles change** - Ensure fresh permissions
3. **Use specific actions** - Be explicit about what permission you're checking
4. **Provide full resource context** - Include all relevant IDs and OKR details
5. **Record audit logs** - Log all permission changes
6. **Handle errors gracefully** - Catch ForbiddenException and return appropriate responses







