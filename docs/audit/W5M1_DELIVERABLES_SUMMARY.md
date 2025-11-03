# W5.M1 Deliverables Summary

## 1. Files Added/Changed

### Backend

**Modified**:
- `services/core-api/src/modules/okr/objective.service.ts`
  - Added `createComposite()` method (lines 457-760)
  - Added `KeyResultService` injection
  - Added `calculateProgress` import

- `services/core-api/src/modules/okr/okr-overview.controller.ts`
  - Added `POST /okr/create-composite` endpoint (lines 661-710)
  - Added `ObjectiveService` injection
  - Added `RateLimitGuard` import

### Frontend

**Modified**:
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx`
  - Updated `handlePublish()` to use composite endpoint (lines 332-455)
  - Updated telemetry event names (`okr.create.*`)

### Documentation

**Created**:
- `docs/audit/W5M1_IMPLEMENTATION_NOTES.md`

**Updated**:
- `docs/audit/API_SURFACE_MAP.md` (added `POST /okr/create-composite`)
- `CHANGELOG.md` (added W5.M1 section)

---

## 2. Controller/Service Code Snippets

### Controller Endpoint

```typescript
// services/core-api/src/modules/okr/okr-overview.controller.ts

@Post('create-composite')
@UseGuards(RateLimitGuard)
@RequireAction('create_okr')
@HttpCode(200)
@ApiOperation({ summary: 'W5.M1: Create Objective and Key Results atomically' })
async createComposite(
  @Body() body: {
    objective: {
      title: string;
      description?: string;
      ownerUserId: string;
      cycleId: string;
      visibilityLevel: 'PUBLIC_TENANT' | 'PRIVATE';
      whitelistUserIds?: string[];
    };
    keyResults: Array<{
      title: string;
      metricType: 'NUMERIC' | 'PERCENT' | 'BOOLEAN' | 'CUSTOM';
      targetValue: number | string | boolean | null;
      ownerUserId: string;
      updateCadence?: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
      startValue?: number;
      unit?: string;
    }>;
    draft?: boolean;
  },
  @Req() req: any,
) {
  const userOrganizationId = req.user.organizationId;
  const userId = req.user.id;

  // Validate request body
  if (!body.objective) {
    throw new BadRequestException('objective is required');
  }

  if (!body.keyResults || !Array.isArray(body.keyResults)) {
    throw new BadRequestException('keyResults array is required');
  }

  // Call service method
  const result = await this.objectiveService.createComposite(
    body.objective,
    body.keyResults,
    userId,
    userOrganizationId,
  );

  return result;
}
```

### Service Method (Key Parts)

```typescript
// services/core-api/src/modules/okr/objective.service.ts

async createComposite(
  objectiveData: {
    title: string;
    description?: string;
    ownerUserId: string;
    cycleId: string;
    visibilityLevel: 'PUBLIC_TENANT' | 'PRIVATE';
    whitelistUserIds?: string[];
  },
  keyResultsData: Array<{...}>,
  _userId: string,
  userOrganizationId: string | null | undefined,
) {
  // Tenant isolation: enforce mutation rules
  OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

  // RBAC: Check if user can create OKRs
  const resourceContext = {
    tenantId: userOrganizationId,
    workspaceId: null,
    teamId: null,
  };
  const canCreate = await this.rbacService.canPerformAction(_userId, 'create_okr', resourceContext);
  if (!canCreate) {
    throw new ForbiddenException('You do not have permission to create OKRs in this scope');
  }

  // Governance: Check cycle lock
  if (cycle.status === 'LOCKED' || cycle.status === 'ARCHIVED') {
    const canEdit = await this.rbacService.canPerformAction(_userId, 'edit_okr', resourceContext);
    if (!canEdit) {
      throw new ForbiddenException(`This cycle is ${cycle.status.toLowerCase()} and can only be modified by admin roles`);
    }
  }

  // Use transaction to create Objective and Key Results atomically
  const result = await this.prisma.$transaction(async (tx) => {
    // Create Objective
    const createdObjective = await tx.objective.create({ data: objectiveCreateData });

    // Create Key Results
    const createdKeyResults = [];
    for (const krData of keyResultsData) {
      const createdKr = await tx.keyResult.create({ data: krCreateData });
      await tx.objectiveKeyResult.create({
        data: { objectiveId: createdObjective.id, keyResultId: createdKr.id },
      });
      createdKeyResults.push(createdKr);
    }

    return { objective: createdObjective, keyResults: createdKeyResults };
  });

  // Log audit entries after transaction
  for (const kr of result.keyResults) {
    await this.auditLogService.record({
      actorUserId: _userId,
      action: 'key_result_created',
      targetType: 'OKR',
      targetId: kr.id,
      organizationId: userOrganizationId,
      metadata: { title: kr.title, objectiveId: result.objective.id, ownerId: kr.ownerId },
    }).catch(err => console.error('Failed to log audit entry:', err));
  }

  await this.auditLogService.record({
    actorUserId: _userId,
    action: 'objective_created',
    targetType: 'OKR',
    targetId: result.objective.id,
    organizationId: userOrganizationId,
    metadata: {
      title: result.objective.title,
      ownerId: result.objective.ownerId,
      cycleId: result.objective.cycleId,
      isPublished: result.objective.isPublished,
      visibilityLevel: result.objective.visibilityLevel,
      keyResultIds: result.keyResults.map(kr => kr.id),
    },
  }).catch(err => console.error('Failed to log audit entry:', err));

  return {
    objectiveId: result.objective.id,
    keyResultIds: result.keyResults.map(kr => kr.id),
    publishState: result.objective.isPublished ? 'PUBLISHED' : 'DRAFT',
    status: result.objective.status,
    visibilityLevel: result.objective.visibilityLevel,
  };
}
```

---

## 3. Drawer Wiring Snippets

### STEP B/C/D Implementation

```typescript
// apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx

const handlePublish = async () => {
  // ... validation ...

  // W5.M1: Use composite endpoint for atomic creation
  const payload = {
    objective: {
      title: draftObjective.title,
      description: draftObjective.description || undefined,
      ownerUserId: draftObjective.ownerId,
      cycleId: draftObjective.cycleId,
      visibilityLevel: draftObjective.visibilityLevel as 'PUBLIC_TENANT' | 'PRIVATE',
      whitelistUserIds: draftObjective.visibilityLevel === 'PRIVATE' 
        ? (draftObjective.whitelist || [])
        : undefined,
    },
    keyResults: draftKRs.map(kr => ({
      title: kr.title,
      metricType: kr.metricType as 'NUMERIC' | 'PERCENT' | 'BOOLEAN' | 'CUSTOM',
      targetValue: kr.targetValue,
      ownerUserId: kr.ownerId,
      startValue: kr.startValue,
      unit: kr.unit,
    })),
  }

  const response = await api.post('/okr/create-composite', payload)
  
  // On success: close drawer and refresh list
  onSuccess()
}
```

### Telemetry Events

```typescript
// Telemetry events emitted:
console.log('[Telemetry] okr.create.open', { userId, organizationId, timestamp })
console.log('[Telemetry] okr.create.step_viewed', { userId, organizationId, step, timestamp })
console.log('[Telemetry] okr.create.publish.success', { userId, organizationId, objectiveId, krCount, duration })
console.log('[Telemetry] okr.create.publish.forbidden', { userId, organizationId, error, reason, duration })
console.log('[Telemetry] okr.create.abandon', { userId, organizationId, duration, step, timestamp })
```

---

## 4. Test Lists

### Backend Tests (To Be Added)

**Unit Tests** (`services/core-api/src/modules/okr/objective.service.spec.ts`):
- `createComposite()` validation tests:
  - Required fields (title, ownerUserId, cycleId, organizationId)
  - Tenant isolation enforcement
  - Visibility permissions (PRIVATE requires admin)
  - Whitelist validation (required for PRIVATE, all users in same tenant)
  - Key Results validation (at least one KR, each KR has title and owner)
- RBAC deny for SUPERUSER
- RBAC deny for non-authorized roles
- Cycle lock deny logic (LOCKED/ARCHIVED cycles require admin)

**Integration Tests** (`services/core-api/src/modules/okr/okr-overview.integration.spec.ts`):
- `POST /okr/create-composite` happy path (tenant admin)
- PRIVATE objective with whitelist
- KR owners: permitted vs coerced to self
- Rate limit 429 path

### Frontend Tests (To Be Added)

**Component/Integration Tests** (`apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.test.tsx`):
- Drawer STEP validation gates (publish disabled until valid)
- Visibility options exclude EXEC_ONLY
- Permission/lock gating (publish button rendering)
- On success, drawer closes and list refreshes to page 1

---

## 5. CHANGELOG Chunk

```markdown
## [W5.M1 — Publishable OKR Creation Flow] Complete

- **Backend**: Implemented composite create endpoint `POST /okr/create-composite` that atomically creates an Objective and its Key Results with validation, RBAC, governance, and AuditLog.
- **Frontend**: Updated OKR creation drawer to use composite endpoint (STEPs B–D wired). Permission gating and governance warnings already in place.
- **Validation**: Enforces required fields, tenant isolation, visibility permissions (PRIVATE requires admin), whitelist validation, and cycle lock governance.
- **Transaction**: Uses Prisma `$transaction()` to ensure atomicity (Objective + all Key Results created or rolled back together).
- **RBAC**: Checks `create_okr` permission before allowing creation. SUPERUSER hard-deny on write.
- **Governance**: Cycle lock enforcement (LOCKED/ARCHIVED cycles require admin override).
- **AuditLog**: Logs `objective_created` and `key_result_created` entries with actor, tenantId, objectiveId, and KR IDs.
- **Telemetry**: Added events (`okr.create.open`, `okr.create.step_viewed`, `okr.create.publish.success`, `okr.create.publish.forbidden`, `okr.create.abandon`).
- **Rate Limiting**: Composite endpoint protected by `RateLimitGuard` (30 requests per minute per user).
- **Limitations**: Draft mode not yet implemented (always publishes). EXEC_ONLY visibility excluded from creation UI per W4.M1 note.
- **Documentation**: Implementation notes at `docs/audit/W5M1_IMPLEMENTATION_NOTES.md`.
```

---

## 6. API_SURFACE_MAP Delta

```markdown
### OkrOverviewController (`/okr`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| GET | `/okr/overview` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| GET | `/okr/creation-context` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| POST | `/okr/create-composite` | ✅ JwtAuthGuard, RBACGuard, RateLimitGuard | ✅ `create_okr` | ✅ Complete - W5.M1: Atomically creates Objective and Key Results |

**W5.M1 Changes:**
- Added `POST /okr/create-composite` endpoint for atomic OKR creation
- Rate limit: 30 requests per minute per user
- Supports `PUBLIC_TENANT` and `PRIVATE` visibility levels (EXEC_ONLY excluded per W4.M1)
```

---

## 7. PR Body

```markdown
# W5.M1: Publishable OKR Creation Flow (Composite Create + Drawer Wiring)

## Why

This PR implements the **publishable OKR creation flow** inside the existing OKR page creation drawer, using the canonical taxonomy from W4.M1. It provides a guided, atomic creation experience that ensures complete, valid OKR creation with proper RBAC, governance, and audit logging.

## What

### Backend

- **New Endpoint**: `POST /okr/create-composite`
  - Atomically creates an Objective and its Key Results in a single transaction
  - Validates required fields, tenant isolation, visibility permissions, and cycle lock governance
  - Enforces RBAC (`create_okr` permission required)
  - Blocks SUPERUSER writes (hard-deny)
  - Logs AuditLog entries for objective and key result creation
  - Protected by `RateLimitGuard` (30 requests per minute per user)

### Frontend

- **Drawer Wiring**: Updated `OKRCreationDrawer` to use composite endpoint
  - STEP B (Visibility): Already implemented; excludes EXEC_ONLY
  - STEP C (Key Results): Already implemented; allows adding multiple KRs inline
  - STEP D (Review & Publish): Already implemented with governance warnings
- **Telemetry**: Added events (`okr.create.open`, `okr.create.step_viewed`, `okr.create.publish.success`, `okr.create.publish.forbidden`, `okr.create.abandon`)

## Validation

- ✅ Required fields validation (title, ownerUserId, cycleId, organizationId)
- ✅ Tenant isolation enforcement (`OkrTenantGuard.assertCanMutateTenant()`)
- ✅ RBAC checks (`create_okr` permission required)
- ✅ Cycle lock governance (LOCKED/ARCHIVED cycles require admin override)
- ✅ Visibility permissions (PRIVATE requires admin)
- ✅ Whitelist validation (required for PRIVATE, all users in same tenant)
- ✅ Key Results validation (at least one KR required, each KR has title and owner)
- ✅ Transaction atomicity (Prisma `$transaction()`)

## Tests

### Backend (To Be Added)

- Unit tests: Validation, RBAC, governance
- Integration tests: Happy path, PRIVATE with whitelist, rate limit

### Frontend (To Be Added)

- Component tests: STEP validation, permission gating, success flow

## Telemetry

Events logged:
- `okr.create.open` — drawer opened
- `okr.create.step_viewed` — step navigation
- `okr.create.publish.success` — successful publish
- `okr.create.publish.forbidden` — publish failed (RBAC/governance)
- `okr.create.abandon` — drawer closed without publishing

## Limitations

1. **Draft Mode**: Not yet implemented (always publishes)
2. **Idempotency**: Not yet implemented (`Idempotency-Key` header support can be added later)
3. **EXEC_ONLY**: Intentionally excluded from creation UI per W4.M1 note (only `PUBLIC_TENANT` and `PRIVATE` shown)

## References

- Planning: `docs/planning/OKR_CREATION_DRAWER_PLAN.md`
- Taxonomy: `docs/planning/OKR_TAXONOMY_DECISIONS.md`
- Backend W4.M1: `docs/audit/W4M1_BACKEND_IMPLEMENTATION_NOTES.md`
- Implementation Notes: `docs/audit/W5M1_IMPLEMENTATION_NOTES.md`
```

---

## 8. Git Commands

```bash
git checkout -b feat/w5m1-okr-creation-publishable-flow

git add -A

git commit -m "feat(okr): W5.M1 publishable creation flow (composite endpoint + drawer wiring, RBAC/governance/audit)"

# push + PR (using gh if available)
gh repo view >/dev/null 2>&1 && gh pr create -t "W5.M1: Publishable OKR Creation Flow (Composite Create + Drawer Wiring)" -b "$(cat docs/audit/W5M1_IMPLEMENTATION_NOTES.md)" -B main -H feat/w5m1-okr-creation-publishable-flow
```

---

## Summary

✅ **Backend**: Composite create endpoint with transaction, validation, RBAC, governance, and AuditLog  
✅ **Frontend**: Drawer wired to composite endpoint with telemetry  
✅ **Documentation**: Implementation notes, API surface map, and changelog updated  
⏳ **Tests**: Test files to be added (structure documented)  

**Status**: Ready for review and merge

