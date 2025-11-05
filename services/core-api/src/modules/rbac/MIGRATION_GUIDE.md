# Migration Guide: PermissionService to RBAC

This guide helps you migrate from the old `PermissionService` to the new RBAC system.

## Overview

The new RBAC system provides:
- ✅ More granular roles (10 roles vs 6)
- ✅ Visibility-based access control
- ✅ Better performance with caching
- ✅ Type-safe authorization checks
- ✅ Audit logging built-in

## Step-by-Step Migration

### 1. Database Migration

Run the Prisma migration to add new tables and fields:

```bash
cd services/core-api
npx prisma migrate dev --name add_rbac_system
```

### 2. Migrate Role Assignments

Run the migration service to populate `RoleAssignment` from existing memberships:

```bash
POST /rbac/migration/all
{
  "migratedBy": "your-user-id"
}
```

### 3. Update Module Imports

Replace `PermissionModule` with `RBACModule`:

```typescript
// Before
import { PermissionModule } from './modules/permissions/permission.module';

// After
import { RBACModule } from './modules/rbac/rbac.module';

@Module({
  imports: [
    RBACModule, // Replace PermissionModule
  ],
})
```

### 4. Update Service Dependencies

Replace `PermissionService` with `RBACService`:

```typescript
// Before
import { PermissionService } from '../permissions/permission.service';

constructor(
  private permissionService: PermissionService,
) {}

// After
import { RBACService } from '../rbac/rbac.service';
import { ResourceContextBuilder } from '../rbac/context-builder';

constructor(
  private rbacService: RBACService,
  private contextBuilder: ResourceContextBuilder,
) {}
```

### 5. Update Permission Checks

#### Old Pattern:
```typescript
const hasPermission = await this.permissionService.hasPermission(
  userId,
  Permission.OKR_VIEW,
  { organizationId, workspaceId, teamId },
);
```

#### New Pattern:
```typescript
const resourceContext = this.contextBuilder.fromValues(
  organizationId,
  workspaceId,
  teamId,
);

const canView = await this.rbacService.canPerformAction(
  userId,
  'view_okr',
  resourceContext,
);
```

### 6. Update Guards

#### Old Pattern:
```typescript
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission(Permission.OKR_VIEW)
```

#### New Pattern:
```typescript
@UseGuards(JwtAuthGuard, RBACGuard)
@RequireAction('view_okr')
```

### 7. Role Mapping

Old roles map to new roles as follows:

| Old Role | New Role | Notes |
|----------|----------|-------|
| `SUPERUSER` | `SUPERUSER` | Same |
| `ORG_ADMIN` | `TENANT_ADMIN` | Note: `TENANT_OWNER` must be manually assigned |
| `WORKSPACE_OWNER` | `WORKSPACE_LEAD` | |
| `TEAM_LEAD` | `TEAM_LEAD` | Same |
| `MEMBER` | `WORKSPACE_MEMBER` (workspace) or `TEAM_CONTRIBUTOR` (team) | Context-dependent |
| `VIEWER` | `TENANT_VIEWER` (tenant) or `TEAM_VIEWER` (team) | Context-dependent |

### 8. Action Mapping

Old permissions map to new actions:

| Old Permission | New Action |
|----------------|------------|
| `Permission.OKR_VIEW` | `'view_okr'` |
| `Permission.OKR_CREATE` | `'create_okr'` |
| `Permission.OKR_EDIT_OWN` | `'edit_okr'` (owner check in service) |
| `Permission.OKR_EDIT_TEAM` | `'edit_okr'` (scope check) |
| `Permission.OKR_DELETE_OWN` | `'delete_okr'` (owner check) |
| `Permission.TEAM_MANAGE` | `'manage_teams'` |
| `Permission.WORKSPACE_MANAGE` | `'manage_workspaces'` |
| `Permission.ORGANIZATION_MANAGE` | `'manage_users'` |

### 9. Visibility Levels

New feature: OKRs now have visibility levels. Set defaults:

```typescript
// When creating OKRs, set visibility level
const objective = await this.prisma.objective.create({
  data: {
    // ... other fields
    visibilityLevel: 'PUBLIC_TENANT', // or 'WORKSPACE_ONLY', 'TEAM_ONLY', etc.
    isPublished: false, // Draft vs published
  },
});
```

### 10. Update Tests

Replace test helpers:

```typescript
// Before
import { PermissionService } from '../permissions/permission.service';

// After
import { RBACService } from '../rbac/rbac.service';
import { createRBACTestHelper } from '../rbac/test-utils';

const testHelper = createRBACTestHelper(prisma, rbacService);

// Setup test user
await testHelper.createTenantAdmin(userId, tenantId);
```

## Common Patterns

### Pattern 1: View OKR List (with visibility filtering)

```typescript
async findAll(userId: string, tenantId: string) {
  const userContext = await this.rbacService.buildUserContext(userId);
  const objectives = await this.prisma.objective.findMany({
    where: { organizationId: tenantId },
  });

  // Filter by visibility
  return objectives.filter(obj => {
    // Owner can always view
    if (obj.ownerId === userId) return true;
    
    // Check visibility
    return canViewOKR(userContext, {
      id: obj.id,
      ownerId: obj.ownerId,
      tenantId: obj.organizationId,
      visibilityLevel: obj.visibilityLevel,
      // ...
    });
  });
}
```

### Pattern 2: Check Permission Before Action

```typescript
async updateOKR(id: string, userId: string, data: any) {
  const resourceContext = await this.contextBuilder.fromOKR(id);
  
  await requireAction(
    this.rbacService,
    userId,
    'edit_okr',
    resourceContext,
  );

  return this.prisma.objective.update({ where: { id }, data });
}
```

### Pattern 3: Check Role Instead of Permission

```typescript
import { hasRole } from '../rbac/utils';

const isAdmin = await hasRole(
  this.rbacService,
  userId,
  'TENANT_ADMIN',
  tenantId,
);
```

## Backward Compatibility

The old `PermissionService` and `PermissionGuard` can coexist with the new RBAC system during migration. However, for consistency, migrate services one at a time:

1. Start with new services (use RBAC)
2. Migrate critical services (OKR services)
3. Migrate remaining services
4. Remove old permission system

## Verification Checklist

- [ ] Database migration completed
- [ ] Role assignments migrated
- [ ] All services updated to use RBACService
- [ ] All guards updated to use RBACGuard
- [ ] Tests updated and passing
- [ ] Visibility levels set on existing OKRs
- [ ] Manager relationships set up (if using MANAGER_CHAIN)
- [ ] Cache invalidation working correctly

## Rollback Plan

If you need to rollback:

1. Keep both systems in place during migration
2. Use feature flags to switch between systems
3. Old `PermissionService` will continue to work
4. Database migration can be reversed (but data loss)

## Need Help?

See:
- `README.md` - Full RBAC documentation
- `USAGE_EXAMPLES.md` - Code examples
- `integration-example.ts` - Complete service example





