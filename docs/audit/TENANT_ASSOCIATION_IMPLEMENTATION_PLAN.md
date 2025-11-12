# Tenant Association Fixes - Complete Implementation Plan

**Date**: 2025-01-XX  
**Status**: Implementation Plan  
**Priority**: P0 (Critical Security Fixes)

---

## Overview

This plan addresses tenant association issues across all layers of the application stack:
1. **Database** - Schema migrations and RLS policies
2. **Prisma** - Schema updates and client regeneration
3. **Backend** - Service, controller, and DTO updates
4. **Frontend** - API calls and type definitions

---

## Phase 1: Database Migrations (P0 - Critical)

### Step 1.1: Run Database Migration Script

**File**: `services/core-api/prisma/migrations/FIX_TENANT_ASSOCIATION_ISSUES.sql`

**Actions**:
1. Backup database before running migration
2. Run migration script in staging environment first
3. Verify all fixes applied successfully
4. Run verification queries from analysis report

**Expected Changes**:
- `objectives.tenantId` becomes NOT NULL
- `activities` table gets `tenantId` column (NOT NULL)
- `user_layouts` table gets `tenantId` column (NOT NULL)
- RLS enabled on `initiatives`, `activities`, `user_layouts`
- `key_results` RLS policies optimized

**Verification**:
```sql
-- Check for NULL values
SELECT COUNT(*) FROM objectives WHERE "tenantId" IS NULL; -- Should be 0
SELECT COUNT(*) FROM activities WHERE "tenantId" IS NULL; -- Should be 0
SELECT COUNT(*) FROM user_layouts WHERE "tenantId" IS NULL; -- Should be 0

-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('activities', 'user_layouts', 'initiatives');
```

---

## Phase 2: Prisma Schema Updates

### Step 2.1: Update Prisma Schema

**File**: `services/core-api/prisma/schema.prisma`

#### Changes Required:

**1. Update `Objective` model** (Line 190):
```prisma
// BEFORE:
tenantId        String? // For organization-level OKRs

// AFTER:
tenantId        String // For organization-level OKRs (NOT NULL)
```

**2. Update `Activity` model** (Line 511):
```prisma
// BEFORE:
model Activity {
  id         String         @id @default(cuid())
  entityType EntityType
  entityId   String
  userId     String
  action     ActivityAction
  metadata   Json?
  createdAt  DateTime       @default(now())

  @@index([entityType, entityId])
  @@index([userId])
  @@map("activities")
}

// AFTER:
model Activity {
  id         String         @id @default(cuid())
  entityType EntityType
  entityId   String
  userId     String
  tenantId   String // Tenant scoping: activity belongs to one organization
  tenant     Organization   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  action     ActivityAction
  metadata   Json?
  createdAt  DateTime       @default(now())

  @@index([entityType, entityId])
  @@index([userId])
  @@index([tenantId])
  @@map("activities")
}
```

**3. Update `UserLayout` model** (Line 610):
```prisma
// BEFORE:
model UserLayout {
  id         String     @id @default(cuid())
  userId     String
  entityType EntityType // OBJECTIVE, KEY_RESULT, INITIATIVE
  entityId   String // The ID of the OKR entity
  positionX  Float
  positionY  Float
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt

  @@unique([userId, entityType, entityId])
  @@index([userId])
  @@index([entityId])
  @@map("user_layouts")
}

// AFTER:
model UserLayout {
  id         String         @id @default(cuid())
  userId     String
  entityType EntityType // OBJECTIVE, KEY_RESULT, INITIATIVE
  entityId   String // The ID of the OKR entity
  tenantId   String // Tenant scoping: layout belongs to one organization
  tenant     Organization   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  positionX  Float
  positionY  Float
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt

  @@unique([userId, entityType, entityId])
  @@index([userId])
  @@index([entityId])
  @@index([tenantId])
  @@map("user_layouts")
}
```

**4. Update `Organization` model** to include new relations:
```prisma
model Organization {
  // ... existing fields ...
  activities     Activity[]     // Add this relation
  userLayouts    UserLayout[]    // Add this relation
  // ... rest of model ...
}
```

### Step 2.2: Generate Prisma Client

**Command**:
```bash
cd services/core-api
npx prisma generate
```

**Verification**:
- Check that TypeScript types are updated
- Verify no compilation errors in backend

---

## Phase 3: Backend Service Updates

### Step 3.1: Update ActivityService

**File**: `services/core-api/src/modules/activity/activity.service.ts`

#### Changes Required:

**1. Update `createActivity` method** to accept and set `tenantId`:
```typescript
async createActivity(data: {
  entityType: EntityType;
  entityId: string;
  userId: string;
  tenantId: string; // ADD THIS - required parameter
  action: string;
  metadata?: any;
}) {
  // Validate tenantId is provided
  if (!data.tenantId) {
    throw new BadRequestException('tenantId is required when creating activity');
  }

  return this.prisma.activity.create({
    data: {
      ...data,
      action: data.action as any,
      tenantId: data.tenantId, // Explicitly set tenantId
    },
  });
}
```

**2. Update `getRecentForObjective`** to use direct tenantId filter:
```typescript
async getRecentForObjective(
  objectiveId: string,
  userOrganizationId: string | null | undefined,
  limit: number = 20,
  offset: number = 0,
  actionFilter?: string,
  userIdFilter?: string,
) {
  // First verify the objective exists and get its tenantId for tenant isolation
  const objective = await this.prisma.objective.findUnique({
    where: { id: objectiveId },
    select: { tenantId: true },
  });

  if (!objective || !objective.tenantId) {
    return [];
  }

  // Tenant isolation check
  if (userOrganizationId === null) {
    // Superuser: can view all
  } else if (userOrganizationId && objective.tenantId === userOrganizationId) {
    // Normal user: must match org
  } else {
    // No access or org mismatch
    return [];
  }

  // Build where clause with filters - NOW USE DIRECT tenantId
  const where: any = {
    entityType: 'OBJECTIVE',
    entityId: objectiveId,
    tenantId: objective.tenantId, // ADD THIS - direct tenant filter
  };

  // ... rest of method unchanged ...
}
```

**3. Update `getRecentForKeyResult`** to use direct tenantId:
```typescript
async getRecentForKeyResult(
  keyResultId: string,
  userOrganizationId: string | null | undefined,
  limit: number = 20,
  offset: number = 0,
  actionFilter?: string,
  userIdFilter?: string,
) {
  // Get key result with tenantId directly
  const keyResult = await this.prisma.keyResult.findUnique({
    where: { id: keyResultId },
    select: { tenantId: true },
  });

  if (!keyResult || !keyResult.tenantId) {
    return [];
  }

  // Tenant isolation check
  if (userOrganizationId === null) {
    // Superuser: can view all
  } else if (userOrganizationId && keyResult.tenantId === userOrganizationId) {
    // Normal user: must match org
  } else {
    // No access or org mismatch
    return [];
  }

  // Build where clause - USE DIRECT tenantId
  const where: any = {
    entityType: 'KEY_RESULT',
    entityId: keyResultId,
    tenantId: keyResult.tenantId, // ADD THIS - direct tenant filter
  };

  // ... rest of method unchanged ...
}
```

**4. Update `getRecentActivityForUserScope`** to use tenantId filter:
```typescript
async getRecentActivityForUserScope(
  userId: string, 
  userOrganizationId: string | null | undefined
): Promise<Array<{...}>> {
  // Tenant isolation: if user has no org, return empty
  if (userOrganizationId === undefined || userOrganizationId === '') {
    return [];
  }

  // Build tenant filter for activities
  const activityWhere: any = {};
  if (userOrganizationId !== null) {
    activityWhere.tenantId = userOrganizationId; // ADD THIS - direct tenant filter
  }
  // Superuser (null): no filter, see all orgs

  // Get Objectives owned by user in scope
  const ownedObjectives = await this.prisma.objective.findMany({
    where: {
      ownerId: userId,
      ...(userOrganizationId !== null ? { tenantId: userOrganizationId } : {}),
    },
    select: { id: true },
  });
  const ownedObjectiveIds = ownedObjectives.map((o) => o.id);

  // Get Key Results owned by user in scope
  const ownedKeyResults = await this.prisma.keyResult.findMany({
    where: {
      ownerId: userId,
      ...(userOrganizationId !== null ? { tenantId: userOrganizationId } : {}), // Use direct tenantId
    },
    select: { id: true },
  });
  const ownedKeyResultIds = ownedKeyResults.map((kr) => kr.id);

  // Query activities with tenant filter
  const activities = await this.prisma.activity.findMany({
    where: {
      ...activityWhere, // ADD THIS - tenant filter
      OR: [
        { userId: userId },
        {
          entityType: 'OBJECTIVE',
          entityId: { in: ownedObjectiveIds },
        },
        {
          entityType: 'KEY_RESULT',
          entityId: { in: ownedKeyResultIds },
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // ... rest unchanged ...
}
```

### Step 3.2: Update All Services That Create Activities

**Files to Update**:
- `services/core-api/src/modules/okr/objective.service.ts`
- `services/core-api/src/modules/okr/key-result.service.ts`
- `services/core-api/src/modules/okr/initiative.service.ts`
- Any other services that call `activityService.createActivity()`

#### Pattern for Updates:

**BEFORE**:
```typescript
await this.activityService.createActivity({
  entityType: 'OBJECTIVE',
  entityId: createdObjective.id,
  userId: _userId,
  action: 'CREATED',
  metadata: { ... },
});
```

**AFTER**:
```typescript
await this.activityService.createActivity({
  entityType: 'OBJECTIVE',
  entityId: createdObjective.id,
  userId: _userId,
  tenantId: createdObjective.tenantId!, // ADD THIS - get from created entity
  action: 'CREATED',
  metadata: { ... },
});
```

**Specific Updates Needed**:

1. **`objective.service.ts`** (Line ~406):
   - Update all `createActivity` calls to include `tenantId: createdObjective.tenantId!`
   - Ensure `tenantId` is available from created/updated objective

2. **`key-result.service.ts`**:
   - Find all `createActivity` calls
   - Add `tenantId` from the key result being created/updated

3. **`initiative.service.ts`**:
   - Find all `createActivity` calls
   - Add `tenantId` from the initiative being created/updated

### Step 3.3: Update LayoutService

**File**: `services/core-api/src/modules/layout/layout.service.ts`

#### Changes Required:

**1. Update `saveUserLayout`** to set tenantId:
```typescript
async saveUserLayout(
  userId: string, 
  layouts: LayoutPosition[],
  userTenantId: string | null | undefined // ADD THIS parameter
) {
  if (!layouts || layouts.length === 0) {
    throw new BadRequestException('Layouts array cannot be empty');
  }

  // Tenant isolation check
  if (userTenantId === undefined || userTenantId === '') {
    throw new ForbiddenException('No tenant context available');
  }

  // Validate all entity types and IDs exist AND get their tenantIds
  const entityTenantIds: Map<string, string> = new Map();
  for (const layout of layouts) {
    const tenantId = await this.validateEntityExistsAndGetTenantId(
      layout.entityType, 
      layout.entityId
    );
    entityTenantIds.set(`${layout.entityType}:${layout.entityId}`, tenantId);
  }

  // Verify all entities belong to user's tenant (unless superuser)
  if (userTenantId !== null) {
    for (const layout of layouts) {
      const entityTenantId = entityTenantIds.get(`${layout.entityType}:${layout.entityId}`);
      if (entityTenantId !== userTenantId) {
        throw new ForbiddenException(
          `Entity ${layout.entityType}:${layout.entityId} does not belong to your organization`
        );
      }
    }
  }

  // Use upsert for each layout position - include tenantId
  const results = await Promise.all(
    layouts.map(layout =>
      this.prisma.userLayout.upsert({
        where: {
          userId_entityType_entityId: {
            userId,
            entityType: layout.entityType,
            entityId: layout.entityId,
          },
        },
        update: {
          positionX: layout.positionX,
          positionY: layout.positionY,
          tenantId: entityTenantIds.get(`${layout.entityType}:${layout.entityId}`)!, // ADD THIS
        },
        create: {
          userId,
          entityType: layout.entityType,
          entityId: layout.entityId,
          tenantId: entityTenantIds.get(`${layout.entityType}:${layout.entityId}`)!, // ADD THIS
          positionX: layout.positionX,
          positionY: layout.positionY,
        },
      })
    )
  );

  return {
    message: `Successfully saved ${results.length} layout positions`,
    count: results.length,
  };
}
```

**2. Update `getUserLayout`** to filter by tenantId:
```typescript
async getUserLayout(
  userId: string, 
  entityType?: EntityType, 
  entityIds?: string[],
  userTenantId?: string | null | undefined // ADD THIS parameter
) {
  const where: any = { userId };
  
  // ADD tenant filter
  if (userTenantId !== null && userTenantId !== undefined) {
    where.tenantId = userTenantId;
  }
  // Superuser (null): no tenant filter
  
  if (entityType) {
    where.entityType = entityType;
  }
  
  if (entityIds && entityIds.length > 0) {
    where.entityId = { in: entityIds };
  }

  // ... rest unchanged ...
}
```

**3. Add new helper method**:
```typescript
private async validateEntityExistsAndGetTenantId(
  entityType: EntityType, 
  entityId: string
): Promise<string> {
  let tenantId: string | null = null;

  switch (entityType) {
    case EntityType.OBJECTIVE:
      const objective = await this.prisma.objective.findUnique({
        where: { id: entityId },
        select: { id: true, tenantId: true },
      });
      if (!objective) {
        throw new NotFoundException(`Objective with ID ${entityId} not found`);
      }
      tenantId = objective.tenantId;
      break;
    case EntityType.KEY_RESULT:
      const keyResult = await this.prisma.keyResult.findUnique({
        where: { id: entityId },
        select: { id: true, tenantId: true },
      });
      if (!keyResult) {
        throw new NotFoundException(`KeyResult with ID ${entityId} not found`);
      }
      tenantId = keyResult.tenantId;
      break;
    case EntityType.INITIATIVE:
      const initiative = await this.prisma.initiative.findUnique({
        where: { id: entityId },
        select: { id: true, tenantId: true },
      });
      if (!initiative) {
        throw new NotFoundException(`Initiative with ID ${entityId} not found`);
      }
      tenantId = initiative.tenantId;
      break;
    default:
      throw new BadRequestException(`Invalid entity type: ${entityType}`);
  }

  if (!tenantId) {
    throw new BadRequestException(`Entity ${entityType}:${entityId} has no tenant association`);
  }

  return tenantId;
}
```

**4. Update `deleteUserLayout`** and `clearUserLayouts`** to include tenant filter:
```typescript
async deleteUserLayout(
  userId: string, 
  entityType: EntityType, 
  entityId: string,
  userTenantId?: string | null | undefined // ADD THIS
) {
  const where: any = { userId, entityType, entityId };
  
  // ADD tenant filter
  if (userTenantId !== null && userTenantId !== undefined) {
    where.tenantId = userTenantId;
  }
  
  const deleted = await this.prisma.userLayout.deleteMany({ where });
  // ... rest unchanged ...
}

async clearUserLayouts(
  userId: string,
  userTenantId?: string | null | undefined // ADD THIS
) {
  const where: any = { userId };
  
  // ADD tenant filter
  if (userTenantId !== null && userTenantId !== undefined) {
    where.tenantId = userTenantId;
  }
  
  const deleted = await this.prisma.userLayout.deleteMany({ where });
  // ... rest unchanged ...
}
```

### Step 3.4: Update Controllers

**File**: `services/core-api/src/modules/layout/layout.controller.ts`

#### Changes Required:

**1. Update all endpoints** to pass `userTenantId`:
```typescript
@Post()
async saveLayout(
  @Body() body: SaveLayoutRequest,
  @Req() req: any, // Get tenantId from request
) {
  const userTenantId = req.user?.tenantId; // Get from JWT
  return this.layoutService.saveUserLayout(
    req.user.id,
    body.layouts,
    userTenantId // ADD THIS
  );
}

@Get()
async getLayout(
  @Query('entityType') entityType?: EntityType,
  @Query('entityIds') entityIds?: string[],
  @Req() req: any,
) {
  const userTenantId = req.user?.tenantId; // Get from JWT
  return this.layoutService.getUserLayout(
    req.user.id,
    entityType,
    entityIds ? entityIds.split(',') : undefined,
    userTenantId // ADD THIS
  );
}
```

**File**: `services/core-api/src/modules/activity/activity.controller.ts`

**No changes needed** - controller already passes `userOrganizationId` correctly.

---

## Phase 4: Backend Middleware Updates

### Step 4.1: Update Tenant Isolation Middleware

**File**: `services/core-api/src/common/prisma/tenant-isolation.middleware.ts`

#### Changes Required:

**Add `activities` and `userLayouts` to tenant-scoped models**:
```typescript
const tenantScopedModels = [
  'objective',
  'keyResult',
  'workspace',
  'team',
  'cycle',
  'initiative',
  'checkInRequest',
  'strategicPillar',
  'activity',      // ADD THIS
  'userLayout',    // ADD THIS
];
```

**File**: `services/core-api/src/common/prisma/prisma.service.ts`

**Add to tenant-scoped models list** (Line ~16):
```typescript
const tenantScopedModels = [
  'objective', 'keyResult', 'workspace', 'team', 'cycle', 
  'initiative', 'checkInRequest', 'strategicPillar', 'organization',
  'activity',      // ADD THIS
  'userLayout',    // ADD THIS
];
```

---

## Phase 5: Frontend Updates

### Step 5.1: Update TypeScript Types

**Files to Check**:
- `apps/web/src/types/*.ts` or similar type definition files
- Any files that define Activity or UserLayout types

#### Changes Required:

**1. Update Activity type** (if defined):
```typescript
// BEFORE:
interface Activity {
  id: string;
  entityType: EntityType;
  entityId: string;
  userId: string;
  action: string;
  metadata?: any;
  createdAt: Date;
}

// AFTER:
interface Activity {
  id: string;
  entityType: EntityType;
  entityId: string;
  userId: string;
  tenantId: string; // ADD THIS
  action: string;
  metadata?: any;
  createdAt: Date;
}
```

**2. Update UserLayout type** (if defined):
```typescript
// BEFORE:
interface UserLayout {
  id: string;
  userId: string;
  entityType: EntityType;
  entityId: string;
  positionX: number;
  positionY: number;
  createdAt: Date;
  updatedAt: Date;
}

// AFTER:
interface UserLayout {
  id: string;
  userId: string;
  entityType: EntityType;
  entityId: string;
  tenantId: string; // ADD THIS
  positionX: number;
  positionY: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Step 5.2: Verify Frontend API Calls

**Files to Check**:
- `apps/web/src/app/dashboard/builder/page.tsx` (uses userLayout)
- `apps/web/src/components/activity-drawer.tsx` (uses activities)
- `apps/web/src/app/dashboard/okrs/page.tsx` (uses activities)

#### Verification:

**1. Activity API calls** - Should work without changes (backend handles tenant filtering)

**2. Layout API calls** - Should work without changes (backend handles tenant filtering)

**No frontend changes required** - Backend handles tenant isolation automatically via:
- RLS policies (database level)
- Middleware filtering (application level)
- Service-level validation

---

## Phase 6: Testing & Verification

### Step 6.1: Unit Tests

**Files to Update**:
- `services/core-api/src/modules/activity/activity.service.spec.ts` (if exists)
- `services/core-api/src/modules/layout/layout.service.spec.ts` (if exists)

#### Test Cases to Add:

**ActivityService**:
1. `createActivity` requires tenantId
2. `getRecentForObjective` filters by tenantId
3. `getRecentForKeyResult` filters by tenantId
4. `getRecentActivityForUserScope` filters by tenantId

**LayoutService**:
1. `saveUserLayout` sets tenantId correctly
2. `saveUserLayout` rejects cross-tenant entities
3. `getUserLayout` filters by tenantId
4. `deleteUserLayout` respects tenant boundaries

### Step 6.2: Integration Tests

**Test Scenarios**:
1. Create activity with tenantId - verify stored correctly
2. Query activities - verify tenant isolation works
3. Save layout with tenantId - verify stored correctly
4. Query layouts - verify tenant isolation works
5. Cross-tenant access attempts - verify blocked

### Step 6.3: Manual Testing Checklist

- [ ] Create objective → verify activity created with tenantId
- [ ] Create key result → verify activity created with tenantId
- [ ] View activities → verify only see own tenant's activities
- [ ] Save layout → verify tenantId set correctly
- [ ] View layouts → verify only see own tenant's layouts
- [ ] Superuser → verify can see all tenants (read-only)
- [ ] Cross-tenant access → verify blocked

---

## Phase 7: Deployment

### Step 7.1: Pre-Deployment Checklist

- [ ] Database migration tested in staging
- [ ] Prisma schema updated and client regenerated
- [ ] All backend services updated
- [ ] All controllers updated
- [ ] Middleware updated
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing complete
- [ ] Code review approved

### Step 7.2: Deployment Steps

1. **Database Migration**:
   ```bash
   # Backup production database
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   
   # Run migration
   psql $DATABASE_URL -f services/core-api/prisma/migrations/FIX_TENANT_ASSOCIATION_ISSUES.sql
   ```

2. **Deploy Backend**:
   ```bash
   cd services/core-api
   npx prisma generate
   npm run build
   # Deploy to production
   ```

3. **Deploy Frontend**:
   ```bash
   cd apps/web
   npm run build
   # Deploy to production
   ```

4. **Verify Deployment**:
   - Check application logs for errors
   - Run verification queries
   - Test critical user flows

---

## Rollback Plan

If issues occur:

1. **Database Rollback**:
   ```sql
   -- Revert RLS policies
   ALTER TABLE activities DISABLE ROW LEVEL SECURITY;
   ALTER TABLE user_layouts DISABLE ROW LEVEL SECURITY;
   
   -- Make tenantId nullable again (if needed)
   ALTER TABLE objectives ALTER COLUMN "tenantId" DROP NOT NULL;
   ALTER TABLE activities ALTER COLUMN "tenantId" DROP NOT NULL;
   ALTER TABLE user_layouts ALTER COLUMN "tenantId" DROP NOT NULL;
   ```

2. **Code Rollback**:
   - Revert backend code changes
   - Revert Prisma schema
   - Redeploy previous version

---

## Timeline Estimate

- **Phase 1 (Database)**: 2-4 hours
- **Phase 2 (Prisma)**: 1 hour
- **Phase 3 (Backend Services)**: 4-6 hours
- **Phase 4 (Middleware)**: 1 hour
- **Phase 5 (Frontend)**: 1 hour (verification only)
- **Phase 6 (Testing)**: 4-6 hours
- **Phase 7 (Deployment)**: 2 hours

**Total**: ~15-20 hours

---

## Risk Assessment

**Low Risk**:
- Prisma schema updates (well-tested)
- Frontend changes (minimal)

**Medium Risk**:
- Backend service updates (requires careful testing)
- Database migration (backup required)

**Mitigation**:
- Comprehensive testing in staging
- Database backup before migration
- Gradual rollout if possible
- Monitoring after deployment

---

## Success Criteria

- [ ] All database migrations applied successfully
- [ ] No NULL tenantId values in objectives, activities, user_layouts
- [ ] RLS policies working correctly
- [ ] All backend services updated and tested
- [ ] No cross-tenant data leakage possible
- [ ] Application functioning normally
- [ ] Performance not degraded

---

## Notes

- This plan addresses P0 and P1 issues from the analysis
- P2 issues (audit_logs, permission_audits) deferred to future phase
- All changes maintain backward compatibility where possible
- Tenant isolation enforced at multiple layers (defense-in-depth)

---

**Next Steps**: Review this plan, assign tasks, and begin Phase 1 implementation.

