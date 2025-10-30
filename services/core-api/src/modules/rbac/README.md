# RBAC (Role-Based Access Control) System

Production-grade RBAC implementation for the multi-tenant OKR platform.

## Overview

This module implements a comprehensive Role-Based Access Control (RBAC) system with object-level access control (OLAC) for OKRs. It provides fine-grained permissions based on roles, scopes, and visibility rules.

## Architecture

### Core Components

1. **types.ts** - Type definitions for roles, scopes, visibility levels, and actions
2. **rbac.ts** - Main authorization logic with `can()` function
3. **visibilityPolicy.ts** - Object-level access control for OKRs based on visibility levels
4. **audit.ts** - Audit logging for sensitive actions

## System Hierarchy

```
Platform (SaaS)
  └─ Tenant (Customer Organization)
      └─ Workspace (Department)
          └─ Team (Squad/Group)
```

## Roles

### Platform Level (Internal Only)
- **SUPERUSER** - System-wide access, read-only for OKRs

### Tenant Level
- **TENANT_OWNER** - Full commercial/contractual owner
- **TENANT_ADMIN** - Operational admin
- **TENANT_VIEWER** - Read-only observer

### Workspace Level
- **WORKSPACE_LEAD** - Department head
- **WORKSPACE_ADMIN** - Operational admin
- **WORKSPACE_MEMBER** - Default member

### Team Level
- **TEAM_LEAD** - Team leader
- **TEAM_CONTRIBUTOR** - Active contributor
- **TEAM_VIEWER** - Read-only viewer

## Visibility Levels

OKRs can have different visibility levels:

- **PUBLIC_TENANT** - Visible to everyone in the tenant
- **WORKSPACE_ONLY** - Visible to workspace members + tenant admins
- **TEAM_ONLY** - Visible to team members + workspace lead + tenant owner
- **MANAGER_CHAIN** - Visible to owner + manager + workspace lead + tenant admins
- **EXEC_ONLY** - Visible only to whitelisted users + tenant owner

## Usage

### Basic Authorization Check

```typescript
import { can, buildUserContext } from '@/modules/rbac';

// Build user context from role assignments
const userContext = await buildUserContext(userId);

// Check if user can perform an action
const authorized = can(userContext, 'view_okr', {
  tenantId: 'tenant-123',
  workspaceId: 'workspace-456',
  okr: {
    id: 'okr-789',
    ownerId: 'user-abc',
    tenantId: 'tenant-123',
    workspaceId: 'workspace-456',
    visibilityLevel: 'TEAM_ONLY',
  },
});
```

### Get Effective Roles

```typescript
import { getEffectiveRoles } from '@/modules/rbac';

const roles = getEffectiveRoles(userContext, tenantId, workspaceId, teamId);
// Returns: ['TENANT_ADMIN', 'WORKSPACE_MEMBER', 'TEAM_LEAD']
```

### Check Visibility

```typescript
import { canViewOKR } from '@/modules/rbac/visibilityPolicy';

const canView = canViewOKR(userContext, okr, tenant);
```

### Audit Logging

```typescript
import { recordAuditEvent, createRoleChangeAuditLog } from '@/modules/rbac/audit';

const auditLog = createRoleChangeAuditLog(
  actorUserId,
  targetUserId,
  'TENANT',
  tenantId,
  null, // previous role
  'TENANT_ADMIN', // new role
);

await recordAuditEvent(auditLog);
```

## Actions

Available actions for authorization checks:

- `view_okr` - View an OKR (subject to visibility rules)
- `edit_okr` - Edit an OKR
- `delete_okr` - Delete an OKR
- `create_okr` - Create a new OKR
- `publish_okr` - Publish/approve an OKR
- `manage_users` - Invite/remove users, assign roles
- `manage_billing` - Manage tenant billing
- `manage_workspaces` - Create/edit/delete workspaces
- `manage_teams` - Create/edit/delete teams
- `impersonate_user` - Impersonate another user (superuser only)
- `manage_tenant_settings` - Configure tenant-wide policies
- `view_all_okrs` - View all OKRs (for reporting)
- `export_data` - Export data for analytics

## Role Priority

Roles are prioritized when multiple roles apply:

1. SUPERUSER (100)
2. TENANT_OWNER (90)
3. TENANT_ADMIN (80)
4. WORKSPACE_LEAD (70)
5. WORKSPACE_ADMIN (60)
6. TEAM_LEAD (50)
7. WORKSPACE_MEMBER (40)
8. TEAM_CONTRIBUTOR (30)
9. TEAM_VIEWER (20)
10. TENANT_VIEWER (10)

The highest priority role determines permissions.

## Database Schema

The system uses:

- `RoleAssignment` model for role assignments
- `VisibilityLevel` enum on Objective and KeyResult models
- `AuditLog` model for audit trail
- `RBACRole` enum for new role system

## Migration Notes

The existing `OrganizationMember`, `WorkspaceMember`, and `TeamMember` models are kept for backward compatibility. The new `RoleAssignment` model should be the source of truth going forward.

## Implementation Status

✅ Type definitions
✅ RBAC authorization logic
✅ Visibility policy
✅ Audit logging
✅ Database schema updates

## Integration Guide

### Step 1: Database Migration

First, generate and run the Prisma migration:

```bash
cd services/core-api
npx prisma migrate dev --name add_rbac_system
```

This will create:
- `RoleAssignment` table
- `AuditLog` table
- `VisibilityLevel` enum on `Objective` and `KeyResult`
- Manager relationship on `User` model

### Step 2: Import RBAC Module

Add `RBACModule` to your main app module:

```typescript
import { RBACModule } from './modules/rbac/rbac.module';

@Module({
  imports: [
    // ... other modules
    RBACModule,
  ],
})
export class AppModule {}
```

### Step 3: Run Membership Migration

Migrate existing memberships to the new `RoleAssignment` model:

```bash
# Via REST API (requires authentication)
POST /rbac/migration/all
{
  "migratedBy": "your-user-id"
}

# Or programmatically
const migrationService = app.get(RBACMigrationService);
await migrationService.migrateAllMemberships('system');
```

### Step 4: Use Guards in Controllers

Add `RBACGuard` to your controllers:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';

@Controller('okrs')
@UseGuards(JwtAuthGuard, RBACGuard)
export class OKRController {
  @Get(':id')
  @RequireAction('view_okr')
  async getOKR(@Param('id') id: string) {
    // Protected by RBAC
  }
}
```

### Step 5: Manual Permission Checks

Use `RBACService` for custom checks:

```typescript
import { RBACService } from '../rbac';

@Injectable()
export class OKRService {
  constructor(private rbacService: RBACService) {}

  async publishOKR(userId: string, okrId: string) {
    const canPublish = await this.rbacService.canPerformAction(
      userId,
      'publish_okr',
      resourceContext,
    );
    
    if (!canPublish) {
      throw new ForbiddenException();
    }
    // ... proceed
  }
}
```

### Step 6: Cache Invalidation

When roles change, invalidate the cache:

```typescript
// After assigning/revoking roles
await this.rbacService.assignRole(userId, role, scopeType, scopeId, assignedBy);
// Cache is automatically invalidated

// Manual invalidation if needed
this.rbacService.invalidateUserContextCache(userId);
```

## Helper Functions

### Context Builders

```typescript
import { ResourceContextBuilder } from '../rbac';

const builder = new ResourceContextBuilder(prisma);

// From OKR ID
const context = await builder.fromOKR(okrId);

// From request
const context = builder.fromRequest(request);

// From explicit values
const context = builder.fromValues(tenantId, workspaceId, teamId);
```

### Utility Functions

```typescript
import { hasRole, hasAnyRole, requireAction } from '../rbac/utils';

// Check specific role
const isAdmin = await hasRole(rbacService, userId, 'TENANT_ADMIN', tenantId);

// Check multiple roles
const hasPermission = await hasAnyRole(
  rbacService,
  userId,
  ['TENANT_ADMIN', 'WORKSPACE_LEAD'],
  tenantId,
  workspaceId,
);

// Require action or throw
await requireAction(rbacService, userId, 'edit_okr', resourceContext);
```

## Manager Relationships

To enable MANAGER_CHAIN visibility, set manager relationships:

```typescript
// Set a user's manager
await prisma.user.update({
  where: { id: userId },
  data: { managerId: managerUserId },
});

// The RBAC service will automatically load manager relationships
const userContext = await rbacService.buildUserContext(userId);
// userContext.managerId and userContext.directReports are populated
```

## EXEC_ONLY Whitelist

The EXEC_ONLY visibility level requires explicit whitelisting. This should be stored in tenant configuration:

```typescript
// Add execOnlyWhitelist to Organization model metadata
await prisma.organization.update({
  where: { id: tenantId },
  data: {
    metadata: {
      execOnlyWhitelist: [userId1, userId2, ...],
    },
  },
});

// Then update visibilityPolicy.ts to check this whitelist
```

## Testing

Example test setup:

```typescript
import { RBACService } from '../rbac';

describe('OKRController', () => {
  let rbacService: RBACService;

  beforeEach(async () => {
    // Setup test user with roles
    await rbacService.assignRole(
      testUserId,
      'TENANT_ADMIN',
      'TENANT',
      testTenantId,
      'test',
    );
  });

  it('should allow TENANT_ADMIN to view OKRs', async () => {
    const canView = await rbacService.canPerformAction(
      testUserId,
      'view_okr',
      { tenantId: testTenantId },
    );
    expect(canView).toBe(true);
  });
});
```

## Performance Considerations

- User contexts are cached for 5 minutes
- Cache is automatically invalidated on role changes
- Consider Redis for distributed caching in production
- Batch role checks when possible

## Next Steps

1. ✅ Database migration created
2. ✅ RBAC service implemented
3. ✅ Guards and decorators ready
4. ✅ Migration tools available
5. ✅ Caching implemented
6. ✅ Manager relationships supported
7. ⏳ Implement EXEC_ONLY whitelist check in visibilityPolicy.ts
8. ⏳ Add Redis caching for production
9. ⏳ Create admin UI for role management
10. ⏳ Add comprehensive test coverage

