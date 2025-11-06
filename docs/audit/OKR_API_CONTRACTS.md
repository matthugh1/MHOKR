# OKR API Contracts

**Generated:** 2025-01-XX  
**Scope:** Backend API contracts that feed the OKR screen

---

## 1. GET /okr/overview

### 1.1 Request Contract

**Endpoint:** `GET /okr/overview`

**Authentication:** Required (JWT Bearer token)

**Authorization:** Requires `view_okr` action

**Query Parameters:**
- `organizationId` (required, string): Organization ID for tenant filtering
- `page` (optional, number, default: 1): Page number (must be >= 1)
- `pageSize` (optional, number, default: 20, max: 50): Items per page
- `cycleId` (optional, string): Filter by cycle ID
- `status` (optional, string, enum): Filter by objective status
  - Valid values: `ON_TRACK`, `AT_RISK`, `BLOCKED`, `COMPLETED`, `CANCELLED`

**Request Example:**
```
GET /okr/overview?organizationId=cmhesnyvx00004xhjjxs272gs&page=1&pageSize=20&cycleId=abc123&status=ON_TRACK
```

**Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:39-98`

---

### 1.2 Response Contract

**Success Response (200 OK):**

```typescript
{
  page: number                    // Current page number
  pageSize: number                // Items per page
  totalCount: number              // Total count AFTER visibility filtering
  canCreateObjective: boolean    // Whether user can create objectives in this context
  objectives: Array<{
    objectiveId: string
    title: string
    status: string                // OKRStatus enum value
    visibilityLevel: string      // VisibilityLevel enum value
    cycleStatus: string           // CycleStatus enum value or 'NONE' if no cycle
    isPublished: boolean
    progress: number              // Float, 0-100
    ownerId: string
    owner: {
      id: string
      name: string
      email: string
    } | null
    cycle: {
      id: string
      name: string
      status: string              // CycleStatus enum value
    } | null
    canEdit: boolean              // Computed server-side: RBAC + governance locks
    canDelete: boolean            // Computed server-side: RBAC + governance locks
    keyResults: Array<{
      keyResultId: string
      title: string
      status: string              // OKRStatus enum value
      progress: number            // Float, 0-100
      canCheckIn: boolean         // Computed server-side: RBAC + governance locks
      startValue: number
      targetValue: number
      currentValue: number
      unit: string | null
      ownerId: string
      initiatives: Array<{
        id: string
        title: string
        status: string            // InitiativeStatus enum value
        dueDate: string | null    // ISO 8601 date string
        keyResultId: string | null
      }>
    }>
    initiatives: Array<{
      id: string
      title: string
      status: string              // InitiativeStatus enum value
      dueDate: string | null      // ISO 8601 date string
      keyResultId: string | null
    }>
  }>
}
```

**Error Responses:**

- `400 Bad Request`: 
  - Missing `organizationId` parameter
  - Invalid `page` value (< 1)
  - Invalid `pageSize` value (< 1 or > 50)
  - Invalid `status` enum value

- `401 Unauthorized`: Missing or invalid JWT token

- `403 Forbidden`: User lacks `view_okr` permission OR user's organization doesn't match requested `organizationId`

**Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:236-491`

---

### 1.3 Server-Side Behavior

#### 1.3.1 Tenant Isolation
- Validates user's `organizationId` matches requested `organizationId`
- Exception: SUPERUSER (`organizationId === null`) can access any organization
- **Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:60-67`

#### 1.3.2 Visibility Filtering
- Fetches ALL objectives matching filters (cycleId, status)
- Applies visibility filtering via `OkrVisibilityService.canUserSeeObjective()`
- Only returns objectives visible to requester
- **Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:100-163`

#### 1.3.3 Pagination
- Calculates `totalCount` AFTER visibility filtering
- Applies pagination slice to visible objectives
- **Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:165-202`

#### 1.3.4 Permission Flags
- Computes `canEdit` / `canDelete` per objective:
  - RBAC check: `canPerformAction(userId, 'edit_okr', resourceContext)`
  - Governance check: `checkAllLocksForObjective()` (publish lock + cycle lock)
  - **Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:238-266`

- Computes `canCheckIn` per key result:
  - RBAC check: `canPerformAction(userId, 'edit_okr', resourceContext)`
  - Governance check: `checkAllLocksForKeyResult()` (publish lock + cycle lock from parent)
  - **Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:292-316`

- Computes `canCreateObjective` (envelope-level):
  - RBAC check: `canPerformAction(userId, 'create_okr', resourceContext)`
  - Cycle lock check: If `cycleId` provided and cycle is LOCKED/ARCHIVED, require admin override
  - SUPERUSER check: If `userOrganizationId === null`, deny creation (read-only)
  - **Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:377-467`

#### 1.3.5 Key Result Visibility
- Filters key results by visibility using `OkrVisibilityService.canUserSeeKeyResult()`
- Key results inherit visibility from parent objective
- **Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:268-289`

#### 1.3.6 Initiative Loading
- Loads initiatives directly linked to objectives
- Loads initiatives linked to key results (for visible KRs only)
- **Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:204-227`

---

## 2. GET /reports/cycles/active

### 2.1 Request Contract

**Endpoint:** `GET /reports/cycles/active`

**Authentication:** Required (JWT Bearer token)

**Authorization:** Requires `view_okr` action

**Query Parameters:** None (uses `req.user.organizationId`)

**Source:** `services/core-api/src/modules/okr/okr-reporting.controller.ts:122-128`

---

### 2.2 Response Contract

**Success Response (200 OK):**

```typescript
Array<{
  id: string
  name: string                    // e.g., "Q4 2025"
  status: string                  // CycleStatus enum value
  startDate: string               // ISO 8601 date string
  endDate: string                 // ISO 8601 date string
  organizationId: string
}>
```

**Source:** `services/core-api/src/modules/okr/okr-reporting.service.ts` (implementation not shown, but returns cycles for user's organization)

---

## 3. GET /reports/check-ins/overdue

### 3.1 Request Contract

**Endpoint:** `GET /reports/check-ins/overdue`

**Authentication:** Required (JWT Bearer token)

**Authorization:** Requires `view_okr` action

**Query Parameters:** None (uses `req.user.organizationId` and `req.user.id`)

**Source:** `services/core-api/src/modules/okr/okr-reporting.controller.ts:166-173`

---

### 3.2 Response Contract

**Success Response (200 OK):**

```typescript
Array<{
  krId: string                    // Key Result ID
  objectiveId: string             // Parent Objective ID
  // ... other fields (not documented in source)
}>
```

**Note:** Frontend only uses `krId` and `objectiveId` fields.

**Source:** `apps/web/src/app/dashboard/okrs/page.tsx:222-235`

---

## 4. GET /okr/creation-context

### 4.1 Request Contract

**Endpoint:** `GET /okr/creation-context`

**Authentication:** Required (JWT Bearer token)

**Authorization:** Requires `view_okr` action

**Query Parameters:**
- `organizationId` (required, string): Organization ID

**Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:494-647`

---

### 4.2 Response Contract

**Success Response (200 OK):**

```typescript
{
  allowedVisibilityLevels: string[]      // Array of VisibilityLevel enum values user can use
  allowedOwners: Array<{                  // Users in same tenant
    id: string
    name: string
    email: string
  }>
  canAssignOthers: boolean               // Whether user can assign others as owner
  availableCycles: Array<{               // Cycles user can create OKRs in
    id: string
    name: string
    status: string                       // CycleStatus enum value
  }>
}
```

**Note:** This endpoint is called by the OKR Creation Drawer, not directly by the main OKR list page.

**Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:641-647`

---

## 5. RBAC Actions Used

### 5.1 Actions Required by OKR Screen

- **`view_okr`**: Required for all read endpoints
  - `/okr/overview`
  - `/reports/cycles/active`
  - `/reports/check-ins/overdue`
  - `/okr/creation-context`

- **`create_okr`**: Required for creating objectives
  - Checked via `canCreateObjective` flag in `/okr/overview` response
  - Also checked in `/okr/creation-context`

- **`edit_okr`**: Required for editing objectives/key results
  - Checked via `canEdit` / `canDelete` flags per objective
  - Checked via `canCheckIn` flag per key result
  - Used as proxy for admin override (bypassing publish/cycle locks)

- **`delete_okr`**: Required for deleting objectives
  - Checked via `canDelete` flag per objective

**Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:40, 239-244, 393`

---

### 5.2 Actions NOT Implemented for OKR Screen

- **`canCreateKeyResult`**: NOT IMPLEMENTED
  - No separate flag for key result creation
  - Frontend uses `canEditObjective` to determine if user can add KRs
  - **Evidence:** No `canCreateKeyResult` flag in `/okr/overview` response

- **`canCreateInitiative`**: NOT IMPLEMENTED
  - No separate flag for initiative creation
  - Frontend uses `canEditObjective` / `canEditKeyResult` to determine if user can add initiatives

---

## 6. Governance on API

### 6.1 Publish Lock Enforcement

**Location:** `services/core-api/src/modules/okr/okr-governance.service.ts:40-66`

**Check:** `checkPublishLockForObjective()`

**Logic:**
- If `objective.isPublished === true`:
  - SUPERUSER (`organizationId === null`) → reject (read-only)
  - Check RBAC: require `edit_okr` permission (TENANT_ADMIN/TENANT_OWNER)
  - If no permission → throw `ForbiddenException`

**Applied In:**
- `/okr/overview` endpoint: Checks before setting `canEdit` / `canDelete` flags
- **Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:246-262`

---

### 6.2 Cycle Lock Enforcement

**Location:** `services/core-api/src/modules/okr/okr-governance.service.ts:127-182`

**Check:** `checkCycleLockForObjective()`

**Logic:**
- If `cycle.status === 'LOCKED'` or `cycle.status === 'ARCHIVED'`:
  - SUPERUSER (`organizationId === null`) → reject (read-only)
  - Check RBAC: require `edit_okr` permission (TENANT_ADMIN/TENANT_OWNER)
  - If no permission → throw `ForbiddenException`

**Applied In:**
- `/okr/overview` endpoint: Checks before setting `canEdit` / `canDelete` flags
- `/okr/overview` endpoint: Checks before setting `canCreateObjective` flag (if `cycleId` provided)
- **Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:246-262, 432-457`

---

### 6.3 SUPERUSER Read-Only Policy

**Enforcement Points:**

1. **Publish Lock:** SUPERUSER cannot edit published OKRs
   - **Source:** `services/core-api/src/modules/okr/okr-governance.service.ts:53-55`

2. **Cycle Lock:** SUPERUSER cannot edit OKRs in locked cycles
   - **Source:** `services/core-api/src/modules/okr/okr-governance.service.ts:164-166`

3. **Creation:** SUPERUSER cannot create OKRs
   - **Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:460-462`

**Rationale:** SUPERUSER is read-only for audit/compliance purposes.

---

## 7. Visibility Enforcement

### 7.1 Server-Side Visibility Filtering

**Service:** `OkrVisibilityService.canUserSeeObjective()`

**Location:** `services/core-api/src/modules/okr/okr-visibility.service.ts:40-105`

**Logic:**
1. Tenant isolation: If `requesterOrgId !== null` and `objective.organizationId !== requesterOrgId`, deny
2. SUPERUSER: If `userContext.isSuperuser === true`, allow
3. Owner rule: If `objective.ownerId === requesterUserId`, allow
4. PRIVATE visibility:
   - Allow if requester is TENANT_OWNER/TENANT_ADMIN
   - Allow if requester is in whitelist (`execOnlyWhitelist` or `metadata.privateWhitelist`)
   - Allow if requester is owner (already checked)
   - Otherwise deny
5. All other visibility levels: Allow (PUBLIC_TENANT, EXEC_ONLY, etc. are treated as visible)

**Applied In:**
- `/okr/overview` endpoint: Filters objectives before pagination
- **Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:128-163`

---

### 7.2 Key Result Visibility Inheritance

**Service:** `OkrVisibilityService.canUserSeeKeyResult()`

**Location:** `services/core-api/src/modules/okr/okr-visibility.service.ts:115-135`

**Logic:**
- Key Results inherit visibility from parent Objective
- Calls `canUserSeeObjective()` with parent objective data

**Applied In:**
- `/okr/overview` endpoint: Filters key results per objective
- **Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:273-289`

---

## 8. Evidence File References

- Overview Controller: `services/core-api/src/modules/okr/okr-overview.controller.ts`
- Visibility Service: `services/core-api/src/modules/okr/okr-visibility.service.ts`
- Governance Service: `services/core-api/src/modules/okr/okr-governance.service.ts`
- Reporting Controller: `services/core-api/src/modules/okr/okr-reporting.controller.ts`

