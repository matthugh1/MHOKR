# OKR Screen Current State Audit

**Generated:** 2025-01-XX  
**Scope:** Frontend UI & data flow of the OKR screen and its backing data model

---

## 1. UI Inventory

### 1.1 Page Header Section
- **Title**: "Objectives & Key Results"
- **Subtitle**: "Aligned execution. Live progress. Governance state at a glance."
- **Badges** (displayed in PageHeader):
  - Viewing timeframe badge (e.g., "Viewing: Q4 2025")
  - Active cycle badge (e.g., "Active Cycle: Q4 2025")
  - Locked warning badge (if any cycle is LOCKED)
- **Actions**:
  - "New Objective" button (conditional on `canCreateObjective` flag from backend)
  - "Visual Builder" link (always visible)

**Source:** `apps/web/src/app/dashboard/okrs/page.tsx:640-688`

### 1.2 Active Cycle Banner
- Displays active cycle information:
  - Cycle name (e.g., "Q4 2025")
  - Cycle status badge (LOCKED, ACTIVE, DRAFT, ARCHIVED)
  - Date range (formatted as "MMM DD → MMM DD")
  - Lock warning message (if cycle is LOCKED and user is not tenant admin)

**Source:** `apps/web/src/app/dashboard/okrs/page.tsx:702-730`

### 1.3 Filter Header Section
- **Status Filter Chips** (sticky header):
  - "All statuses" (default)
  - "On track" (ON_TRACK)
  - "At risk" (AT_RISK)
  - "Blocked" (BLOCKED)
  - "Completed" (COMPLETED)
  - "Cancelled" (CANCELLED)

**Source:** `apps/web/src/app/dashboard/okrs/page.tsx:734-814`

- **Cycle Filter Dropdown**:
  - "All cycles" option
  - List of active cycles from `/reports/cycles/active` endpoint

**Source:** `apps/web/src/app/dashboard/okrs/page.tsx:816-833`

### 1.4 Filters and Search Section
- **Search Input**: Text search across OKR titles, descriptions, and owner names
- **Workspace Filter**: Dropdown select (All Workspaces / specific workspace)
- **Team Filter**: Dropdown select (All Teams / specific team)
- **Owner Filter**: Dropdown select (All Owners / specific user)
- **Cycle Selector**: Custom component (CycleSelector) that shows:
  - Active cycles from API
  - Legacy periods (hardcoded: Q4 2025, Q1 2026, Q2 2026)
- **Clear Filters Button**: Only visible when filters are active

**Source:** `apps/web/src/app/dashboard/okrs/page.tsx:838-926`

### 1.5 Objective Row (Collapsed State)
Each objective row displays:
- **Title**: Truncated if long
- **Badges**:
  - Status badge (On track / At risk / Blocked / Completed / Cancelled)
  - Publication badge (Published / Draft)
  - Cycle badge (cycle name, e.g., "Q4 2025")
  - Active chip (if cycle status is ACTIVE)
  - Owner chip (avatar + name)
- **Progress Bar**: Horizontal progress bar (color-coded by status)
- **Micro-metrics**:
  - Check-in discipline pill ("All check-ins on time" / "Overdue check-ins")
  - Update freshness pill ("No recent update" / "Updated recently")
- **Action Buttons**:
  - "+ KR" button (add key result)
  - "+ Initiative" button (add initiative)
  - "Edit" button (conditional on `canEdit` flag)
  - Menu button (MoreVertical icon) with dropdown:
    - "Delete Objective" (conditional on `canDelete` flag)
    - "View history"
- **Expand/Collapse Chevron**: Rotates on expand

**Source:** `apps/web/src/components/okr/ObjectiveRow.tsx:257-444`

### 1.6 Objective Row (Expanded State)
When expanded, displays:
- **Key Results Section**:
  - Header: "Key Results"
  - Each KR shows:
    - Title
    - Status badge
    - Check-in cadence badge (if set)
    - Overdue badge (if overdue)
    - Progress bar
    - Progress label (e.g., "45 of 100 %")
    - "Check in" button (conditional on `canCheckInOnKeyResult` flag)
    - "+ Initiative" button (conditional on `canEditKeyResult` flag)
  - Empty state: "No Key Results yet" with "+ Add Key Result" button
- **Initiatives Section**:
  - Header: "Initiatives"
  - Each initiative shows:
    - Title
    - Status badge (In progress / Not started / Blocked / Complete)
    - Due date label (formatted as "Due in X days (MMM DD)" or "Overdue")
    - Linked KR indicator (if linked to a key result)
  - Empty state: "No initiatives yet" with "+ New Initiative" button
  - Always shows "+ New Initiative" button at bottom (even if initiatives exist)

**Source:** `apps/web/src/components/okr/ObjectiveRow.tsx:447-642`

### 1.7 Pagination Controls
- **Page Info**: "Showing X - Y of Z objectives"
- **Previous Button**: Disabled on first page
- **Page Number**: "Page N of M"
- **Next Button**: Disabled on last page

**Source:** `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:549-578`

### 1.8 Modals/Drawers
- **New Objective Modal**: `NewObjectiveModal` component
- **Edit Objective Modal**: `EditObjectiveModal` component
- **New Key Result Modal**: `NewKeyResultModal` component
- **New Initiative Modal**: `NewInitiativeModal` component
- **New Check-In Modal**: `NewCheckInModal` component
- **OKR Creation Drawer**: `OKRCreationDrawer` component
- **Activity Timeline Drawer**: `ActivityDrawer` component
- **Publish Lock Warning Modal**: `PublishLockWarningModal` component
- **Delete Confirmation Dialog**: AlertDialog component

**Source:** `apps/web/src/app/dashboard/okrs/page.tsx:1018-1197`

---

## 2. Data Flow

### 2.1 Primary Data Source: `/okr/overview`

**Endpoint:** `GET /okr/overview`

**Request Parameters:**
- `organizationId` (required): Current organization ID
- `page` (optional, default: 1): Page number
- `pageSize` (optional, default: 20, max: 50): Items per page
- `cycleId` (optional): Filter by cycle ID
- `status` (optional): Filter by status (ON_TRACK, AT_RISK, BLOCKED, COMPLETED, CANCELLED)

**Request Location:** `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:247`

**Response Shape:**
```typescript
{
  page: number
  pageSize: number
  totalCount: number
  canCreateObjective: boolean
  objectives: Array<{
    objectiveId: string
    title: string
    status: string
    visibilityLevel: string
    cycleStatus: string
    isPublished: boolean
    progress: number
    ownerId: string
    owner: {
      id: string
      name: string
      email: string
    } | null
    cycle: {
      id: string
      name: string
      status: string
    } | null
    canEdit: boolean
    canDelete: boolean
    keyResults: Array<{
      keyResultId: string
      title: string
      status: string
      progress: number
      canCheckIn: boolean
      startValue: number
      targetValue: number
      currentValue: number
      unit: string | null
      ownerId: string
      initiatives: Array<{
        id: string
        title: string
        status: string
        dueDate: string | null
        keyResultId: string | null
      }>
    }>
    initiatives: Array<{
      id: string
      title: string
      status: string
      dueDate: string | null
      keyResultId: string | null
    }>
  }>
}
```

**Response Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:471-491`

### 2.2 Supporting Endpoints

#### `/reports/cycles/active`
- **Purpose**: Load active cycles for cycle selector and banner
- **Called From**: `apps/web/src/app/dashboard/okrs/page.tsx:200`
- **Response**: Array of cycles with `id`, `name`, `status`, `startDate`, `endDate`, `organizationId`
- **Source:** `services/core-api/src/modules/okr/okr-reporting.controller.ts:122-128`

#### `/reports/check-ins/overdue`
- **Purpose**: Load overdue check-ins for KR overdue badges
- **Called From**: `apps/web/src/app/dashboard/okrs/page.tsx:222`
- **Response**: Array of `{ krId: string, objectiveId: string }`
- **Source:** `services/core-api/src/modules/okr/okr-reporting.controller.ts:166-173`

#### `/users`
- **Purpose**: Load available users for owner filter
- **Called From**: `apps/web/src/app/dashboard/okrs/page.tsx:186`
- **Response**: Array of user objects

#### `/activity/objectives/:id` and `/activity/key-results/:id`
- **Purpose**: Load activity timeline for objective/KR
- **Called From**: `apps/web/src/app/dashboard/okrs/page.tsx:472-533`

### 2.3 Mutation Endpoints (Called from Modals)

- `POST /objectives` - Create objective
- `PATCH /objectives/:id` - Update objective
- `DELETE /objectives/:id` - Delete objective
- `POST /key-results` - Create key result
- `POST /key-results/:id/check-in` - Create check-in
- `POST /initiatives` - Create initiative

**Source:** `apps/web/src/app/dashboard/okrs/page.tsx:1022-1184`

---

## 3. State Sources

### 3.1 Status
- **Source**: `objectives.status` field from database
- **Enum**: `OKRStatus` = `ON_TRACK | AT_RISK | OFF_TRACK | COMPLETED | CANCELLED`
- **Default**: `ON_TRACK`
- **Schema Location**: `services/core-api/prisma/schema.prisma:302-308`
- **Response Field**: `objective.status` in `/okr/overview` response
- **UI Display**: Status badge chips and objective row status badge

### 3.2 Draft/Published (`isPublished`)
- **Source**: `objectives.isPublished` field from database
- **Type**: `Boolean` (default: `false`)
- **Schema Location**: `services/core-api/prisma/schema.prisma:206`
- **Response Field**: `objective.isPublished` in `/okr/overview` response
- **UI Display**: "Published" / "Draft" badge in objective row
- **Governance**: When `isPublished === true`, only TENANT_ADMIN/TENANT_OWNER can edit/delete

### 3.3 Cycle
- **Source**: `objectives.cycleId` FK → `cycles.id`
- **Schema Location**: `services/core-api/prisma/schema.prisma:191-192`
- **Response Field**: `objective.cycle` object in `/okr/overview` response
- **UI Display**: Cycle badge (e.g., "Q4 2025") with optional "(draft)" suffix
- **Cycle Status**: `CycleStatus` enum = `DRAFT | ACTIVE | LOCKED | ARCHIVED`
- **Schema Location**: `services/core-api/prisma/schema.prisma:172-177`
- **Governance**: When cycle status is `LOCKED` or `ARCHIVED`, only TENANT_ADMIN/TENANT_OWNER can edit/delete

### 3.4 Period
- **Source**: `objectives.period` field from database
- **Enum**: `Period` = `MONTHLY | QUARTERLY | ANNUAL | CUSTOM`
- **Schema Location**: `services/core-api/prisma/schema.prisma:295-300`
- **Note**: Period is stored but NOT displayed in the OKR list UI. It appears to be used for validation of date ranges but not for filtering or display.
- **UNKNOWN**: How period relates to cycles in practice. Both exist in schema.

### 3.5 Visibility Level
- **Source**: `objectives.visibilityLevel` field from database
- **Enum**: `VisibilityLevel` = `PUBLIC_TENANT | PRIVATE | WORKSPACE_ONLY | TEAM_ONLY | MANAGER_CHAIN | EXEC_ONLY`
- **Schema Location**: `services/core-api/prisma/schema.prisma:335-342`
- **Response Field**: `objective.visibilityLevel` in `/okr/overview` response
- **UI Display**: NOT directly displayed as a badge. Visibility is enforced server-side; visible objectives are filtered out before reaching the UI.
- **Enforcement**: Server-side visibility filtering in `OkrVisibilityService.canUserSeeObjective()`
- **Source**: `services/core-api/src/modules/okr/okr-visibility.service.ts:40-105`

---

## 4. Permission Flags Applied

### 4.1 Backend-Provided Flags

The `/okr/overview` endpoint returns these flags computed server-side:

- **`canEdit`** (per objective): Combines RBAC check + governance locks (publish lock + cycle lock)
- **`canDelete`** (per objective): Same as `canEdit`
- **`canCheckIn`** (per key result): RBAC check + governance locks from parent objective
- **`canCreateObjective`** (envelope-level): RBAC check + cycle lock check if `cycleId` provided

**Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:236-467`

### 4.2 Frontend Permission Checks

The frontend also applies permission checks using `useTenantPermissions` hook:

- **`canEditObjective(objective)`**: Checks RBAC + publish lock + cycle lock
- **`canDeleteObjective(objective)`**: Same as `canEditObjective`
- **`canEditKeyResult(keyResult)`**: Checks RBAC + parent objective publish/cycle locks
- **`canCheckInOnKeyResult(keyResult)`**: Same as `canEditKeyResult` (for now)

**Source:** `apps/web/src/hooks/useTenantPermissions.ts:216-322`

**Note**: Frontend checks are for UX only (hiding buttons). Backend is source of truth for enforcement.

---

## 5. Governance Hooks Used

### 5.1 Publish Lock
- **Condition**: `objective.isPublished === true`
- **Effect**: Only TENANT_ADMIN/TENANT_OWNER can edit/delete
- **Backend Check**: `OkrGovernanceService.checkPublishLockForObjective()`
- **Source**: `services/core-api/src/modules/okr/okr-governance.service.ts:40-66`
- **UI Check**: `useTenantPermissions.canEditObjective()` / `canDeleteObjective()`
- **UI Display**: Shows `PublishLockWarningModal` when user tries to edit locked objective
- **Source**: `apps/web/src/app/dashboard/okrs/page.tsx:345-369, 966-998`

### 5.2 Cycle Lock
- **Condition**: `cycle.status === 'LOCKED'` or `cycle.status === 'ARCHIVED'`
- **Effect**: Only TENANT_ADMIN/TENANT_OWNER can edit/delete objectives in locked cycles
- **Backend Check**: `OkrGovernanceService.checkCycleLockForObjective()`
- **Source**: `services/core-api/src/modules/okr/okr-governance.service.ts:127-182`
- **UI Check**: `useTenantPermissions.canEditObjective()` / `canDeleteObjective()`
- **UI Display**: Shows cycle status badge (LOCKED) and warning message in Active Cycle Banner
- **Source**: `apps/web/src/app/dashboard/okrs/page.tsx:717-722`

### 5.3 SUPERUSER Read-Only
- **Condition**: `user.organizationId === null` (SUPERUSER)
- **Effect**: SUPERUSER cannot edit/delete/create OKRs (read-only)
- **Backend Check**: Multiple places check `actingUser.organizationId === null`
- **Source Examples**: 
  - `services/core-api/src/modules/okr/okr-governance.service.ts:53-55`
  - `services/core-api/src/modules/okr/okr-overview.controller.ts:460-462`

---

## 6. Performance: Pagination & Virtualisation

### 6.1 Server-Side Pagination
- **Endpoint**: `/okr/overview?page=N&pageSize=20`
- **Page Size**: 20 objectives per page (hardcoded in frontend)
- **Max Page Size**: 50 (backend validation)
- **Location**: `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:211, 247`
- **Backend Implementation**: 
  - Fetches ALL objectives matching filters
  - Applies visibility filtering
  - Applies pagination slice AFTER visibility filtering
  - **Source**: `services/core-api/src/modules/okr/okr-overview.controller.ts:199-202`

### 6.2 Client-Side Virtualisation
- **Component**: `OKRListVirtualised`
- **Technique**: Window-based virtualisation (only renders visible rows + buffer)
- **Estimated Row Height**: 120px
- **Buffer Rows**: 2 rows above/below viewport
- **Location**: `apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx:68-192`

### 6.3 Client-Side Filtering
- **Filters Applied**: Workspace, Team, Owner, Search Query, Timeframe
- **Location**: `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:357-409`
- **Note**: Visibility filtering is server-side. Client-side filtering applies workspace/team/owner/search/timeframe filters that backend doesn't support yet.

---

## 7. Known Unknowns

### 7.1 Period vs Cycle Relationship
- **Observation**: `objectives.period` field exists (enum: MONTHLY, QUARTERLY, ANNUAL, CUSTOM)
- **Observation**: `objectives.cycleId` FK exists → `cycles.id`
- **Unknown**: How do these relate? Can an objective have both? Do they overlap?
- **Evidence**: 
  - Schema shows both fields: `services/core-api/prisma/schema.prisma:200, 191`
  - Frontend doesn't display period anywhere in OKR list UI
  - Period is used for date range validation in objective creation/update
  - **Source**: `services/core-api/src/modules/okr/objective.service.ts:267-284`

### 7.2 Pillar Display
- **Observation**: `objectives.pillarId` FK exists → `strategic_pillars.id`
- **Observation**: Frontend shows `availablePillars={[]}` (empty array) in modals
- **Unknown**: Are pillars actually used? Is there a pillar filter or display?
- **Evidence**: 
  - Schema: `services/core-api/prisma/schema.prisma:189-190`
  - Frontend: `apps/web/src/app/dashboard/okrs/page.tsx:1043, 1080`
  - Reporting endpoint exists: `GET /reports/pillars`
  - **Source**: `services/core-api/src/modules/okr/okr-reporting.controller.ts:137-143`

### 7.3 Planned Cycle ID
- **Observation**: Frontend code references `plannedCycleId` in `mapObjectiveToViewModel`
- **Unknown**: Does `plannedCycleId` field exist in database schema?
- **Evidence**: 
  - Frontend: `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:63`
  - Schema: NOT FOUND in `services/core-api/prisma/schema.prisma`
  - This may be a vestigial field or planned feature

### 7.4 Visibility Level Deprecation
- **Observation**: Schema shows `WORKSPACE_ONLY`, `TEAM_ONLY`, `MANAGER_CHAIN`, `EXEC_ONLY` as DEPRECATED
- **Unknown**: Are these still in use? Should they be treated as `PUBLIC_TENANT`?
- **Evidence**: 
  - Schema: `services/core-api/prisma/schema.prisma:338-341`
  - Comment says: "DEPRECATED: Kept for backward compatibility, treated as PUBLIC_TENANT"
  - Backend visibility service: Uses `canViewOKR` policy which may handle these
  - **Source**: `services/core-api/src/modules/okr/okr-visibility.service.ts:104`

### 7.5 Legacy Periods
- **Observation**: Frontend has hardcoded `legacyPeriods` array
- **Unknown**: Are legacy periods still used? Should they be removed?
- **Evidence**: 
  - Frontend: `apps/web/src/app/dashboard/okrs/page.tsx:313-318`
  - Comment says: "[phase6-polish]: hydrate from backend once periods endpoint exists"
  - No backend endpoint found for periods

### 7.6 Key Result Visibility Inheritance
- **Observation**: Key Results inherit visibility from parent Objective
- **Unknown**: Can Key Results have different visibility than their parent?
- **Evidence**: 
  - Schema shows `key_results.visibilityLevel` field
  - Backend uses parent objective visibility: `services/core-api/src/modules/okr/okr-visibility.service.ts:129-135`
  - Frontend also uses parent visibility: `apps/web/src/hooks/useTenantPermissions.ts:192-214`

---

## 8. Evidence File References

- Frontend OKR Page: `apps/web/src/app/dashboard/okrs/page.tsx`
- Frontend Container: `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx`
- Frontend Virtualised List: `apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx`
- Frontend Objective Row: `apps/web/src/components/okr/ObjectiveRow.tsx`
- Frontend Badge Component: `apps/web/src/components/okr/OkrBadge.tsx`
- Frontend Permissions Hook: `apps/web/src/hooks/useTenantPermissions.ts`
- Backend Overview Controller: `services/core-api/src/modules/okr/okr-overview.controller.ts`
- Backend Visibility Service: `services/core-api/src/modules/okr/okr-visibility.service.ts`
- Backend Governance Service: `services/core-api/src/modules/okr/okr-governance.service.ts`
- Backend Reporting Controller: `services/core-api/src/modules/okr/okr-reporting.controller.ts`
- Database Schema: `services/core-api/prisma/schema.prisma`

