# Refactor Examples

This document shows example code for how pages should be refactored to use the new structure.

---

## Example: ObjectiveViewModel Mapper

**File:** `apps/web/src/app/dashboard/okrs/page.tsx`

**Before:** Inline transformation in render

```typescript
// ❌ Before: Inline transformation
{filteredOKRs.map((okr) => {
  const owner = availableUsers.find(u => u.id === okr.ownerId)
  const canEdit = permissions.canEditOKR({ ... })
  const canDelete = permissions.canDeleteOKR({ ... })
  const isPublished = okr.isPublished === true
  const canAdminTenant = permissions.isTenantAdminOrOwner(okr.organizationId)
  const canEditPublished = isPublished ? canAdminTenant : canEdit
  const canDeletePublished = isPublished ? canAdminTenant : canDelete
  
  return (
    <ObjectiveCard
      title={okr.title}
      ownerName={owner?.name || 'Unknown'}
      status={okr.status || 'ON_TRACK'}
      progressPct={Math.round(okr.progress || 0)}
      isPublished={isPublished}
      canEdit={canEditPublished}
      canDelete={canDeletePublished}
      // ...
    />
  )
})}
```

**After:** Explicit view model mapper

```typescript
// ✅ After: Explicit view model mapper
interface ObjectiveViewModel {
  id: string
  title: string
  ownerName: string
  status: ObjectiveStatus
  progressPct: number
  isPublished: boolean
  cycleStatus: string | null
  canEdit: boolean
  canDelete: boolean
  nextCheckInDue?: string
}

function mapToObjectiveViewModel(
  okr: any,
  availableUsers: any[],
  tenantPermissions: ReturnType<typeof useTenantPermissions>,
): ObjectiveViewModel {
  const owner = availableUsers.find(u => u.id === okr.ownerId)
  
  return {
    id: okr.id,
    title: okr.title,
    ownerName: owner?.name || owner?.email || 'Unknown',
    status: (okr.status || 'ON_TRACK') as ObjectiveStatus,
    progressPct: Math.round(okr.progress || 0),
    isPublished: okr.isPublished === true,
    cycleStatus: okr.cycle?.status || null,
    canEdit: tenantPermissions.canEdit({
      id: okr.id,
      ownerId: okr.ownerId,
      organizationId: okr.organizationId,
      workspaceId: okr.workspaceId,
      teamId: okr.teamId,
      isPublished: okr.isPublished,
      cycleStatus: okr.cycle?.status || null,
    }),
    canDelete: tenantPermissions.canDelete({
      id: okr.id,
      ownerId: okr.ownerId,
      organizationId: okr.organizationId,
      workspaceId: okr.workspaceId,
      teamId: okr.teamId,
      isPublished: okr.isPublished,
      cycleStatus: okr.cycle?.status || null,
    }),
    nextCheckInDue: okr.keyResults?.find((kr: any) => kr.keyResult?.checkInCadence)?.keyResult?.lastCheckInAt,
  }
}

// In component:
const tenantPermissions = useTenantPermissions()
const viewModels = useMemo(() => 
  filteredOKRs.map(okr => mapToObjectiveViewModel(okr, availableUsers, tenantPermissions)),
  [filteredOKRs, availableUsers, tenantPermissions]
)

// In render:
{viewModels.map((vm) => (
  <ObjectiveCard
    key={vm.id}
    title={vm.title}
    ownerName={vm.ownerName}
    status={vm.status}
    progressPct={vm.progressPct}
    isPublished={vm.isPublished}
    canEdit={vm.canEdit}
    canDelete={vm.canDelete}
    nextCheckInDue={vm.nextCheckInDue}
    onOpenHistory={() => handleOpenActivityDrawer('OBJECTIVE', vm.id, vm.title)}
    onEdit={() => handleEditOKR(vm.id)}
    onDelete={() => handleDeleteOKR(vm.id)}
  />
))}
```

---

## Example: Updated okrs/page.tsx Structure

**File:** `apps/web/src/app/dashboard/okrs/page.tsx`

**Key Changes:**
1. Use `useTenantPermissions()` instead of inline permission checks
2. Remove publish lock checks from `handleEditOKR` and `handleDeleteOKR` (handled by hook)
3. Use view model mapper
4. Keep ActivityDrawer state management in page (correct ownership)

```typescript
export default function OKRsPage() {
  // ... existing state ...
  
  const tenantPermissions = useTenantPermissions() // ✅ New hook
  
  // ✅ Simplified handlers (no inline publish lock checks)
  const handleEditOKR = (okrId: string) => {
    // Permission check is handled by canEdit in hook
    router.push(`/dashboard/builder?okrId=${okrId}`)
  }

  const handleDeleteOKR = async (okr: any) => {
    // Permission check is handled by canDelete in hook
    setPendingDeleteOkr({ id: okr.id, title: okr.title })
  }

  // ✅ View model mapper
  const viewModels = useMemo(() => 
    filteredOKRs.map(okr => mapToObjectiveViewModel(okr, availableUsers, tenantPermissions)),
    [filteredOKRs, availableUsers, tenantPermissions]
  )

  // ✅ Render using view models
  return (
    // ... render viewModels ...
  )
}
```

---

## Example: Updated analytics/page.tsx

**File:** `apps/web/src/app/dashboard/analytics/page.tsx`

**Key Changes:**
1. Use `useTenantPermissions().canExport()` instead of `useTenantAdmin()`

```typescript
export default function AnalyticsPage() {
  const tenantPermissions = useTenantPermissions() // ✅ New hook
  
  // ✅ Use canExport from hook
  {tenantPermissions.canExport() && (
    <Button
      onClick={handleExportCSV}
      disabled={exporting || loading}
      variant="outline"
    >
      <Download className="h-4 w-4 mr-2" />
      {exporting ? 'Exporting...' : 'Export CSV'}
    </Button>
  )}
}
```

---

## Example: Updated ObjectiveService.update()

**File:** `services/core-api/src/modules/okr/objective.service.ts`

**Before:** Inline publish lock and cycle lock checks

```typescript
// ❌ Before: Inline checks
async update(id: string, data: any, userId: string, userOrganizationId: string | null) {
  const objective = await this.prisma.objective.findUnique({ where: { id } })
  
  // CYCLE LOCK: Inline check
  const cycleLock = await this.checkCycleLock(id, userId, userOrganizationId)
  if (cycleLock.locked) {
    throw new ForbiddenException(`Cycle locked: ${cycleLock.cycleName}`)
  }
  
  // PUBLISH LOCK: Inline check
  if (objective.isPublished === true) {
    if (userOrganizationId === null) {
      throw new ForbiddenException('Superusers are read-only')
    }
    const resourceContext = await buildResourceContextFromOKR(this.prisma, id)
    const canEdit = await this.rbacService.canPerformAction(userId, 'edit_okr', resourceContext)
    if (!canEdit) {
      throw new ForbiddenException('Published OKR can only be modified by admin roles')
    }
  }
  
  // ... update logic ...
}
```

**After:** Delegate to governance service

```typescript
// ✅ After: Delegate to governance service
async update(id: string, data: any, userId: string, userOrganizationId: string | null) {
  // Check all locks via governance service
  const locks = await this.governanceService.checkAllLocksForObjective(id, userId, userOrganizationId)
  if (locks.locked) {
    throw new ForbiddenException(
      locks.cycleName 
        ? `This cycle (${locks.cycleName}) is locked and can only be modified by admin roles`
        : locks.reason || 'This OKR is locked and can only be modified by admin roles'
    )
  }
  
  // Tenant isolation check
  const objective = await this.prisma.objective.findUnique({ where: { id } })
  this.tenantGuard.assertTenantMatch(userOrganizationId, objective.organizationId)
  
  // ... update logic ...
}
```

---

## Example: Updated ObjectiveService.findAll()

**File:** `services/core-api/src/modules/okr/objective.service.ts`

**Before:** Inline tenant isolation logic

```typescript
// ❌ Before: Inline tenant isolation
async findAll(_userId: string, workspaceId: string | undefined, userOrganizationId: string | null, pillarId?: string) {
  const where: any = {}
  
  if (userOrganizationId === null) {
    // Superuser: no org filter
  } else if (userOrganizationId && userOrganizationId !== '') {
    where.organizationId = userOrganizationId
  } else {
    return []
  }
  
  // ... rest of query ...
}
```

**After:** Use tenant guard

```typescript
// ✅ After: Use tenant guard
async findAll(_userId: string, workspaceId: string | undefined, userOrganizationId: string | null, pillarId?: string) {
  // Check if user can view
  if (!this.tenantGuard.canView(userOrganizationId)) {
    return []
  }
  
  // Build tenant where clause
  const where: any = {}
  const tenantWhere = this.tenantGuard.buildTenantWhereClause(userOrganizationId)
  if (tenantWhere) {
    Object.assign(where, tenantWhere)
  }
  
  // Optional filters
  if (workspaceId) {
    where.workspaceId = workspaceId
  }
  if (pillarId) {
    where.pillarId = pillarId
  }
  
  // ... rest of query ...
}
```

---

## Summary

These examples show:

1. **Backend:** Services delegate to specialized services (governance, tenant guard) instead of inline logic
2. **Frontend:** Pages use `useTenantPermissions()` hook instead of inline permission checks
3. **View Models:** Explicit mapper functions transform API data to clean props for components
4. **Consistency:** Frontend permission logic mirrors backend logic






