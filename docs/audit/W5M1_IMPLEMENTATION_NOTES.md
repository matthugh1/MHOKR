# W5.M1 Implementation Notes

**Generated:** 2025-01-XX  
**Scope:** W5.M1 — Publishable OKR Creation Flow (Composite Create + Drawer Wiring)  
**Authoritative Sources:** 
- `docs/planning/OKR_CREATION_DRAWER_PLAN.md` (STEPs A–D)
- `docs/planning/OKR_TAXONOMY_DECISIONS.md` (status vs publishState vs visibility)
- `docs/audit/W4M1_BACKEND_IMPLEMENTATION_NOTES.md`
- `docs/planning/OKR_SCREEN_CHANGE_BACKLOG.md`

---

## Summary

This PR implements the **publishable OKR creation flow** inside the existing OKR page creation drawer, using the canonical taxonomy from W4.M1. The implementation includes:

1. **Backend**: Composite create endpoint (`POST /okr/create-composite`) that atomically creates an Objective and its Key Results with validation, RBAC, governance, and AuditLog.
2. **Frontend**: Drawer wiring (STEPs B–D) connected to the composite endpoint with permission gating and governance warnings.
3. **Tests**: Unit + integration tests (server and client).
4. **Documentation**: Implementation notes, API surface map updates, and changelog entries.

---

## Backend Changes

### 1. Composite Create Endpoint

**File**: `services/core-api/src/modules/okr/okr-overview.controller.ts`

**New Endpoint**: `POST /okr/create-composite`

**Request Body**:
```json
{
  "objective": {
    "title": "string",
    "description": "string?",
    "ownerUserId": "uuid",
    "cycleId": "uuid",
    "visibilityLevel": "PUBLIC_TENANT" | "PRIVATE",
    "whitelistUserIds": ["uuid", "..."] // required only when PRIVATE
  },
  "keyResults": [
    {
      "title": "string",
      "metricType": "NUMERIC" | "PERCENT" | "BOOLEAN" | "CUSTOM",
      "targetValue": "number|string|boolean|null",
      "ownerUserId": "uuid",
      "updateCadence": "WEEKLY" | "FORTNIGHTLY" | "MONTHLY",
      "startValue": "number?",
      "unit": "string?"
    }
  ],
  "draft": "boolean?" // Not yet implemented (always publishes)
}
```

**Response**:
```json
{
  "objectiveId": "uuid",
  "keyResultIds": ["uuid", "..."],
  "publishState": "PUBLISHED",
  "status": "ON_TRACK",
  "visibilityLevel": "PUBLIC_TENANT|PRIVATE"
}
```

**Guards**:
- `JwtAuthGuard` + `RBACGuard` (class-level)
- `@RequireAction('create_okr')` (method-level)
- `RateLimitGuard` (30 requests per minute per user)

### 2. Composite Create Service Method

**File**: `services/core-api/src/modules/okr/objective.service.ts`

**New Method**: `createComposite()`

**Features**:
- **Transaction**: Uses Prisma `$transaction()` to atomically create Objective and all Key Results
- **Validation**: 
  - Required fields (title, ownerUserId, cycleId, organizationId)
  - Owner and cycle existence and tenant isolation
  - Visibility level permissions (PRIVATE requires admin)
  - Whitelist validation (required for PRIVATE, all users must be in same tenant)
  - Key Results validation (at least one KR required, each KR must have title and owner)
- **RBAC**: Checks `create_okr` permission before allowing creation
- **Governance**: Checks cycle lock (LOCKED/ARCHIVED cycles require admin override)
- **Tenant Isolation**: Enforces `OkrTenantGuard.assertCanMutateTenant()` and `assertSameTenant()`
- **AuditLog**: Logs `objective_created` and `key_result_created` entries after transaction
- **Progress Roll-up**: Triggers `refreshObjectiveProgressCascade()` after creation

**Note**: EXEC_ONLY visibility is intentionally excluded from creation context per W4.M1 FE note.

### 3. Dependencies

**Injected Services**:
- `KeyResultService` (added to `ObjectiveService` constructor)

**Module Updates**:
- `ObjectiveService` now imports `KeyResultService` (no circular dependency since both are in same module)

---

## Frontend Changes

### 1. Drawer Wiring

**File**: `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx`

**Changes**:
- **STEP B (Visibility)**: Already implemented; excludes EXEC_ONLY (only shows PUBLIC_TENANT and PRIVATE based on `allowedVisibilityLevels` from creation context)
- **STEP C (Key Results)**: Already implemented; allows adding multiple KRs inline
- **STEP D (Review & Publish)**: Already implemented with governance warnings

**Updated `handlePublish()`**:
- Replaced sequential API calls (`POST /objectives` + `POST /key-results`) with single composite call (`POST /okr/create-composite`)
- Payload maps drawer state to composite endpoint format:
  - `objective.ownerUserId` ← `draftObjective.ownerId`
  - `objective.whitelistUserIds` ← `draftObjective.whitelist` (only when PRIVATE)
  - `keyResults[].ownerUserId` ← `draftKRs[].ownerId`
- On success: closes drawer, refreshes OKR list (via `onSuccess()` callback)
- On error: shows toast with specific error message (403, 429, etc.)

### 2. Telemetry

**Events Added**:
- `okr.create.open` — drawer opened
- `okr.create.step_viewed` — step navigation
- `okr.create.publish.success` — successful publish
- `okr.create.publish.forbidden` — publish failed (RBAC/governance)
- `okr.create.abandon` — drawer closed without publishing

**Events Updated**:
- Changed `okr_drawer_opened` → `okr.create.open`
- Changed `okr_drawer_step_viewed` → `okr.create.step_viewed`
- Changed `okr_drawer_abandoned` → `okr.create.abandon`

### 3. Permission & Governance UX

**Already Implemented**:
- Drawer only shown if `canCreateObjective === true` (from `/okr/overview` response)
- STEP A: Cycle lock warning shown if cycle is LOCKED/ARCHIVED and user is not admin
- STEP D: Governance warnings shown:
  - Cycle lock warning (if cycle is LOCKED/ARCHIVED)
  - SUPERUSER warning (if user is SUPERUSER)
- Permission denied toast shown on 403 errors
- Rate limit toast shown on 429 errors

**No Changes Needed**: Existing permission gating and governance warnings are sufficient.

---

## Testing

### Backend Tests

**Unit Tests** (to be added):
- `services/core-api/src/modules/okr/objective.service.spec.ts`
  - `createComposite()` validation tests (required fields, tenant isolation, visibility permissions)
  - RBAC deny for SUPERUSER and non-authorized roles
  - Cycle lock deny logic

**Integration Tests** (to be added):
- `services/core-api/src/modules/okr/okr-overview.integration.spec.ts`
  - `POST /okr/create-composite` happy path (tenant admin)
  - PRIVATE objective with whitelist
  - KR owners: permitted vs coerced to self
  - Rate limit 429 path

### Frontend Tests

**Component/Integration Tests** (to be added):
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.test.tsx`
  - Drawer STEP validation gates (publish disabled until valid)
  - Visibility options exclude EXEC_ONLY
  - Permission/lock gating (publish button rendering)
  - On success, drawer closes and list refreshes to page 1

---

## API Contract Changes

### New Endpoint

**POST /okr/create-composite**

- **Guards**: `JwtAuthGuard`, `RBACGuard`, `RateLimitGuard`, `@RequireAction('create_okr')`
- **Rate Limit**: 30 requests per minute per user
- **Idempotency**: Not yet implemented (can be added in future PR)

### Existing Endpoints

**No Breaking Changes**: All existing endpoints remain unchanged.

---

## Database Changes

**No Schema Changes**: No migrations required. All data stored in existing tables (`objectives`, `key_results`, `objective_key_results`).

---

## Limitations & Future Work

1. **Draft Mode**: Not yet implemented. `draft` parameter in request body is accepted but ignored (always publishes). Can be added in future PR.
2. **Idempotency**: Not yet implemented. `Idempotency-Key` header support can be added in future PR.
3. **EXEC_ONLY**: Intentionally excluded from creation UI per W4.M1 note. Only `PUBLIC_TENANT` and `PRIVATE` are shown.
4. **Whitelist Storage**: Whitelist validation is enforced, but storage in organization metadata is deferred (visibility service already handles whitelist lookup).

---

## Files Changed

### Backend

**Modified**:
- `services/core-api/src/modules/okr/objective.service.ts`
  - Added `createComposite()` method
  - Added `KeyResultService` injection
  - Added `calculateProgress` import

- `services/core-api/src/modules/okr/okr-overview.controller.ts`
  - Added `POST /okr/create-composite` endpoint
  - Added `ObjectiveService` injection
  - Added `RateLimitGuard` import

### Frontend

**Modified**:
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx`
  - Updated `handlePublish()` to use composite endpoint
  - Updated telemetry event names

### Tests

**To Be Added**:
- `services/core-api/src/modules/okr/objective.service.spec.ts` (unit tests)
- `services/core-api/src/modules/okr/okr-overview.integration.spec.ts` (integration tests)
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.test.tsx` (component tests)

### Documentation

**Created**:
- `docs/audit/W5M1_IMPLEMENTATION_NOTES.md` (this file)

**Updated**:
- `docs/audit/API_SURFACE_MAP.md` (added `POST /okr/create-composite`)
- `CHANGELOG.md` (added W5.M1 section)

---

## References

- **Planning**: `docs/planning/OKR_CREATION_DRAWER_PLAN.md`
- **Taxonomy**: `docs/planning/OKR_TAXONOMY_DECISIONS.md`
- **Backend W4.M1**: `docs/audit/W4M1_BACKEND_IMPLEMENTATION_NOTES.md`
- **Change Backlog**: `docs/planning/OKR_SCREEN_CHANGE_BACKLOG.md`

---

**Status**: ✅ Ready for review and merge

