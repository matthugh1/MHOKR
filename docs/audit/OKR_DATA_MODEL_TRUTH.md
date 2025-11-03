# OKR Data Model Truth

**Generated:** 2025-01-XX  
**Schema Source:** `services/core-api/prisma/schema.prisma`

---

## 1. Tables & Columns

### 1.1 OBJECTIVES Table (`objectives`)

**Primary Key:** `id` (String, cuid)

**Columns:**
- `id` (String, PK, cuid)
- `title` (String, NOT NULL)
- `description` (String?, Text, nullable)
- `organizationId` (String?, nullable) - FK → `organizations.id`
- `workspaceId` (String?, nullable) - FK → `workspaces.id`
- `teamId` (String?, nullable) - FK → `teams.id`
- `pillarId` (String?, nullable) - FK → `strategic_pillars.id`
- `cycleId` (String?, nullable) - FK → `cycles.id`
- `ownerId` (String, NOT NULL) - FK → `users.id`
- `parentId` (String?, nullable) - FK → `objectives.id` (self-referential)
- `period` (Period enum, NOT NULL) - `MONTHLY | QUARTERLY | ANNUAL | CUSTOM`
- `startDate` (DateTime, NOT NULL)
- `endDate` (DateTime, NOT NULL)
- `status` (OKRStatus enum, NOT NULL, default: `ON_TRACK`)
- `progress` (Float, NOT NULL, default: 0)
- `visibilityLevel` (VisibilityLevel enum, NOT NULL, default: `PUBLIC_TENANT`)
- `isPublished` (Boolean, NOT NULL, default: false)
- `positionX` (Float?, nullable)
- `positionY` (Float?, nullable)
- `createdAt` (DateTime, NOT NULL, default: now())
- `updatedAt` (DateTime, NOT NULL, updatedAt)

**Indexes:**
- `@@index([organizationId])`
- `@@index([workspaceId])`
- `@@index([teamId])`
- `@@index([ownerId])`
- `@@index([parentId])`
- `@@index([pillarId])`
- `@@index([cycleId])`
- `@@index([visibilityLevel])`
- `@@index([isPublished])`

**Relations:**
- `organization` → `Organization` (many-to-one)
- `workspace` → `Workspace` (many-to-one)
- `team` → `Team` (many-to-one)
- `pillar` → `StrategicPillar` (many-to-one)
- `cycle` → `Cycle` (many-to-one)
- `owner` → `User` (many-to-one via `ObjectiveOwner` relation)
- `parent` → `Objective` (self-referential, many-to-one)
- `children` → `Objective[]` (self-referential, one-to-many)
- `keyResults` → `ObjectiveKeyResult[]` (one-to-many)
- `initiatives` → `Initiative[]` (one-to-many)

**Schema Location:** `services/core-api/prisma/schema.prisma:179-222`

---

### 1.2 KEY_RESULTS Table (`key_results`)

**Primary Key:** `id` (String, cuid)

**Columns:**
- `id` (String, PK, cuid)
- `title` (String, NOT NULL)
- `description` (String?, Text, nullable)
- `ownerId` (String, NOT NULL) - FK → `users.id`
- `metricType` (MetricType enum, NOT NULL) - `INCREASE | DECREASE | REACH | MAINTAIN`
- `startValue` (Float, NOT NULL)
- `targetValue` (Float, NOT NULL)
- `currentValue` (Float, NOT NULL)
- `unit` (String?, nullable)
- `status` (OKRStatus enum, NOT NULL, default: `ON_TRACK`)
- `progress` (Float, NOT NULL, default: 0)
- `visibilityLevel` (VisibilityLevel enum, NOT NULL, default: `PUBLIC_TENANT`)
- `isPublished` (Boolean, NOT NULL, default: false)
- `checkInCadence` (CheckInCadence enum?, nullable) - `WEEKLY | BIWEEKLY | MONTHLY | NONE`
- `period` (Period enum?, nullable) - `MONTHLY | QUARTERLY | ANNUAL | CUSTOM`
- `startDate` (DateTime?, nullable)
- `endDate` (DateTime?, nullable)
- `positionX` (Float?, nullable)
- `positionY` (Float?, nullable)
- `createdAt` (DateTime, NOT NULL, default: now())
- `updatedAt` (DateTime, NOT NULL, updatedAt)

**Indexes:**
- `@@index([ownerId])`
- `@@index([visibilityLevel])`
- `@@index([isPublished])`

**Relations:**
- `owner` → `User` (many-to-one, via FK `ownerId`)
- `objectives` → `ObjectiveKeyResult[]` (many-to-many via junction table)
- `checkIns` → `CheckIn[]` (one-to-many)
- `integrations` → `KRIntegration[]` (one-to-many)

**Schema Location:** `services/core-api/prisma/schema.prisma:224-254`

**Note:** Key Results are linked to Objectives via junction table `objective_key_results` (many-to-many relationship).

---

### 1.3 OBJECTIVE_KEY_RESULTS Junction Table (`objective_key_results`)

**Primary Key:** `id` (String, cuid)

**Columns:**
- `id` (String, PK, cuid)
- `objectiveId` (String, NOT NULL) - FK → `objectives.id`
- `keyResultId` (String, NOT NULL) - FK → `key_results.id`
- `createdAt` (DateTime, NOT NULL, default: now())

**Unique Constraint:**
- `@@unique([objectiveId, keyResultId])` - Prevents duplicate links

**Indexes:**
- `@@index([objectiveId])`
- `@@index([keyResultId])`

**Relations:**
- `objective` → `Objective` (many-to-one)
- `keyResult` → `KeyResult` (many-to-one)

**Schema Location:** `services/core-api/prisma/schema.prisma:256-269`

---

### 1.4 INITIATIVES Table (`initiatives`)

**Primary Key:** `id` (String, cuid)

**Columns:**
- `id` (String, PK, cuid)
- `title` (String, NOT NULL)
- `description` (String?, Text, nullable)
- `keyResultId` (String?, nullable) - FK → `key_results.id`
- `objectiveId` (String?, nullable) - FK → `objectives.id`
- `ownerId` (String, NOT NULL) - FK → `users.id`
- `status` (InitiativeStatus enum, NOT NULL) - `NOT_STARTED | IN_PROGRESS | COMPLETED | BLOCKED`
- `period` (Period enum?, nullable) - `MONTHLY | QUARTERLY | ANNUAL | CUSTOM`
- `startDate` (DateTime?, nullable)
- `endDate` (DateTime?, nullable)
- `dueDate` (DateTime?, nullable)
- `positionX` (Float?, nullable)
- `positionY` (Float?, nullable)
- `createdAt` (DateTime, NOT NULL, default: now())
- `updatedAt` (DateTime, NOT NULL, updatedAt)

**Indexes:**
- `@@index([keyResultId])`
- `@@index([objectiveId])`
- `@@index([ownerId])`

**Relations:**
- `objective` → `Objective` (many-to-one, optional)
- `keyResult` → `KeyResult` (via FK `keyResultId`, optional)

**Schema Location:** `services/core-api/prisma/schema.prisma:271-293`

**Note:** Initiatives can be linked to EITHER an Objective OR a Key Result (or both?), but not neither. Both `objectiveId` and `keyResultId` are nullable, but at least one should be set in practice.

---

### 1.5 CYCLES Table (`cycles`)

**Primary Key:** `id` (String, cuid)

**Columns:**
- `id` (String, PK, cuid)
- `organizationId` (String, NOT NULL) - FK → `organizations.id`
- `name` (String, NOT NULL) - e.g., "Q1 2025"
- `status` (CycleStatus enum, NOT NULL, default: `DRAFT`)
- `startDate` (DateTime, NOT NULL)
- `endDate` (DateTime, NOT NULL)
- `createdAt` (DateTime, NOT NULL, default: now())
- `updatedAt` (DateTime, NOT NULL, updatedAt)

**Indexes:**
- `@@index([organizationId])`
- `@@index([status])`

**Relations:**
- `organization` → `Organization` (many-to-one)
- `objectives` → `Objective[]` (one-to-many)

**Schema Location:** `services/core-api/prisma/schema.prisma:155-170`

**Cycle Status Enum:**
- `DRAFT` - Cycle is being planned, OKRs can be freely edited
- `ACTIVE` - Cycle is active, normal edit rules apply
- `LOCKED` - Cycle is locked, only TENANT_OWNER/TENANT_ADMIN can edit OKRs
- `ARCHIVED` - Cycle is archived, read-only for all users

**Schema Location:** `services/core-api/prisma/schema.prisma:172-177`

---

### 1.6 STRATEGIC_PILLARS Table (`strategic_pillars`)

**Primary Key:** `id` (String, cuid)

**Columns:**
- `id` (String, PK, cuid)
- `organizationId` (String, NOT NULL) - FK → `organizations.id`
- `name` (String, NOT NULL)
- `description` (String?, Text, nullable)
- `color` (String?, nullable) - Hex color for badge/visual representation
- `createdAt` (DateTime, NOT NULL, default: now())
- `updatedAt` (DateTime, NOT NULL, updatedAt)

**Indexes:**
- `@@index([organizationId])`

**Relations:**
- `organization` → `Organization` (many-to-one)
- `objectives` → `Objective[]` (one-to-many)

**Schema Location:** `services/core-api/prisma/schema.prisma:134-147`

---

### 1.7 PERIODS Table

**NOT FOUND**

**Evidence:**
- `Period` is an enum, not a table: `services/core-api/prisma/schema.prisma:295-300`
- Objectives have `period` field (enum value)
- Key Results have `period` field (enum value, nullable)
- Initiatives have `period` field (enum value, nullable)
- No `periods` table exists in schema

**Conclusion:** Periods are enum values, not entities. There is no periods table.

---

### 1.8 VISIBILITY/WHITELIST Tables

**NOT FOUND** (whitelists stored in Organization JSON)

**Evidence:**
- `organizations.execOnlyWhitelist` (JSONB) - Array of user IDs
- `organizations.metadata` (JSONB) - May contain whitelist data
- No separate `visibility_whitelists` table

**Schema Location:** `services/core-api/prisma/schema.prisma:22`

---

## 2. Relations

### 2.1 Objective Relations

- **Objective 1-N KeyResult**: Via `objective_key_results` junction table
  - `objective_key_results.objectiveId` → `objectives.id`
  - `objective_key_results.keyResultId` → `key_results.id`
  - **Many-to-many**: A Key Result can belong to multiple Objectives (though UI suggests 1-1)

- **Objective 1-N Initiative**: Via `initiatives.objectiveId`
  - `initiatives.objectiveId` → `objectives.id`
  - **One-to-many**: Direct FK

- **Objective N-1 Organization**: Via `objectives.organizationId`
  - `objectives.organizationId` → `organizations.id`
  - **Many-to-one**: Direct FK

- **Objective N-1 Workspace**: Via `objectives.workspaceId`
  - `objectives.workspaceId` → `workspaces.id`
  - **Many-to-one**: Direct FK (nullable)

- **Objective N-1 Team**: Via `objectives.teamId`
  - `objectives.teamId` → `teams.id`
  - **Many-to-one**: Direct FK (nullable)

- **Objective N-1 StrategicPillar**: Via `objectives.pillarId`
  - `objectives.pillarId` → `strategic_pillars.id`
  - **Many-to-one**: Direct FK (nullable)

- **Objective N-1 Cycle**: Via `objectives.cycleId`
  - `objectives.cycleId` → `cycles.id`
  - **Many-to-one**: Direct FK (nullable)

- **Objective N-1 User (Owner)**: Via `objectives.ownerId`
  - `objectives.ownerId` → `users.id`
  - **Many-to-one**: Direct FK (NOT NULL)

- **Objective Self-Referential (Parent-Child)**: Via `objectives.parentId`
  - `objectives.parentId` → `objectives.id`
  - **Many-to-one**: Direct FK (nullable)
  - **Purpose**: Hierarchical OKRs (cascading objectives)

### 2.2 Key Result Relations

- **KeyResult N-M Objective**: Via `objective_key_results` junction table
  - See Objective 1-N KeyResult above

- **KeyResult N-1 User (Owner)**: Via `key_results.ownerId`
  - `key_results.ownerId` → `users.id`
  - **Many-to-one**: Direct FK (NOT NULL)

- **KeyResult 1-N CheckIn**: Via `check_ins.keyResultId`
  - `check_ins.keyResultId` → `key_results.id`
  - **One-to-many**: Direct FK

- **KeyResult 1-N Initiative**: Via `initiatives.keyResultId`
  - `initiatives.keyResultId` → `key_results.id`
  - **One-to-many**: Direct FK (nullable)

### 2.3 Initiative Relations

- **Initiative N-1 Objective**: Via `initiatives.objectiveId`
  - `initiatives.objectiveId` → `objectives.id`
  - **Many-to-one**: Direct FK (nullable)

- **Initiative N-1 KeyResult**: Via `initiatives.keyResultId`
  - `initiatives.keyResultId` → `key_results.id`
  - **Many-to-one**: Direct FK (nullable)

- **Initiative N-1 User (Owner)**: Via `initiatives.ownerId`
  - `initiatives.ownerId` → `users.id`
  - **Many-to-one**: Direct FK (NOT NULL)

**Note**: Both `objectiveId` and `keyResultId` can be set on an initiative (initiative can support both objective and key result). At least one should be set.

---

## 3. Enums/States

### 3.1 OKRStatus Enum

**Values:**
- `ON_TRACK`
- `AT_RISK`
- `OFF_TRACK`
- `COMPLETED`
- `CANCELLED`

**Used In:**
- `objectives.status` (default: `ON_TRACK`)
- `key_results.status` (default: `ON_TRACK`)

**Schema Location:** `services/core-api/prisma/schema.prisma:302-308`

---

### 3.2 VisibilityLevel Enum

**Values:**
- `PUBLIC_TENANT` - Default: Visible to everyone (filtered in UI, not blocked by backend)
- `PRIVATE` - Only owner + explicit whitelist (HR, legal, M&A confidential OKRs)
- `WORKSPACE_ONLY` - **DEPRECATED**: Kept for backward compatibility, treated as PUBLIC_TENANT
- `TEAM_ONLY` - **DEPRECATED**: Kept for backward compatibility, treated as PUBLIC_TENANT
- `MANAGER_CHAIN` - **DEPRECATED**: Kept for backward compatibility, treated as PUBLIC_TENANT
- `EXEC_ONLY` - **DEPRECATED**: Kept for backward compatibility, treated as PUBLIC_TENANT

**Used In:**
- `objectives.visibilityLevel` (default: `PUBLIC_TENANT`)
- `key_results.visibilityLevel` (default: `PUBLIC_TENANT`)

**Schema Location:** `services/core-api/prisma/schema.prisma:335-342`

---

### 3.3 CycleStatus Enum

**Values:**
- `DRAFT` - Cycle is being planned, OKRs can be freely edited
- `ACTIVE` - Cycle is active, normal edit rules apply
- `LOCKED` - Cycle is locked, only TENANT_OWNER/TENANT_ADMIN can edit OKRs
- `ARCHIVED` - Cycle is archived, read-only for all users

**Used In:**
- `cycles.status` (default: `DRAFT`)

**Schema Location:** `services/core-api/prisma/schema.prisma:172-177`

---

### 3.4 Period Enum

**Values:**
- `MONTHLY`
- `QUARTERLY`
- `ANNUAL`
- `CUSTOM`

**Used In:**
- `objectives.period` (NOT NULL)
- `key_results.period` (nullable)
- `initiatives.period` (nullable)

**Schema Location:** `services/core-api/prisma/schema.prisma:295-300`

**Note:** This is an enum, not a table. No `periods` table exists.

---

### 3.5 InitiativeStatus Enum

**Values:**
- `NOT_STARTED`
- `IN_PROGRESS`
- `COMPLETED`
- `BLOCKED`

**Used In:**
- `initiatives.status` (NOT NULL)

**Schema Location:** `services/core-api/prisma/schema.prisma:317-322`

---

### 3.6 CheckInCadence Enum

**Values:**
- `WEEKLY`
- `BIWEEKLY`
- `MONTHLY`
- `NONE`

**Used In:**
- `key_results.checkInCadence` (nullable)

**Schema Location:** `services/core-api/prisma/schema.prisma:324-329`

---

### 3.7 MetricType Enum

**Values:**
- `INCREASE`
- `DECREASE`
- `REACH`
- `MAINTAIN`

**Used In:**
- `key_results.metricType` (NOT NULL)

**Schema Location:** `services/core-api/prisma/schema.prisma:310-315`

---

### 3.8 Publish State (`isPublished`)

**Type:** Boolean (NOT an enum)

**Values:**
- `true` - Published (locked for editing unless admin)
- `false` - Draft (default)

**Used In:**
- `objectives.isPublished` (default: `false`)
- `key_results.isPublished` (default: `false`)

**Schema Location:** `services/core-api/prisma/schema.prisma:206, 237`

---

## 4. Contradictions

### 4.1 Period vs Cycle Confusion

**Contradiction:**
- `objectives.period` exists (enum: MONTHLY, QUARTERLY, ANNUAL, CUSTOM)
- `objectives.cycleId` exists (FK → cycles.id)
- Both seem to represent time periods but serve different purposes

**Evidence:**
- Period is used for date range validation (e.g., quarterly should be ~90 days)
- Cycle represents OKR planning cycles (e.g., "Q1 2025") with governance status
- Frontend doesn't display period anywhere in OKR list UI
- Cycle is displayed prominently

**Possible Resolution:**
- Period may be legacy or used for validation only
- Cycle is the operational concept for planning/execution

**Location:** `services/core-api/prisma/schema.prisma:200, 191`

---

### 4.2 Pillar Table Exists but Not Used in UI

**Contradiction:**
- `strategic_pillars` table exists
- `objectives.pillarId` FK exists
- Frontend shows `availablePillars={[]}` (empty array)
- No pillar filter or display in OKR list UI

**Evidence:**
- Schema: `services/core-api/prisma/schema.prisma:134-147, 189-190`
- Frontend: `apps/web/src/app/dashboard/okrs/page.tsx:1043, 1080`
- Reporting endpoint exists: `GET /reports/pillars`

**Possible Resolution:**
- Pillars may be planned feature not yet implemented in UI
- Or used only in reporting/analytics, not in list view

---

### 4.3 Key Result Visibility vs Inheritance

**Contradiction:**
- `key_results.visibilityLevel` field exists (default: `PUBLIC_TENANT`)
- Backend uses parent objective visibility: `OkrVisibilityService.canUserSeeKeyResult()` checks parent objective
- Frontend also uses parent visibility: `useTenantPermissions.canSeeKeyResult()` checks parent objective

**Evidence:**
- Schema: `services/core-api/prisma/schema.prisma:236`
- Backend: `services/core-api/src/modules/okr/okr-visibility.service.ts:129-135`
- Frontend: `apps/web/src/hooks/useTenantPermissions.ts:192-214`

**Possible Resolution:**
- KR visibility field may be vestigial
- Or planned for future use (independent KR visibility)
- Currently always inherits from parent objective

---

### 4.4 Initiative Can Link to Both Objective AND Key Result

**Contradiction:**
- `initiatives.objectiveId` (nullable)
- `initiatives.keyResultId` (nullable)
- Both can be set simultaneously
- UI suggests initiatives are linked to one parent (objective OR key result)

**Evidence:**
- Schema: `services/core-api/prisma/schema.prisma:275-276`
- Frontend modals: `NewInitiativeModal` accepts either `objectiveId` OR `keyResultId`

**Possible Resolution:**
- Allowed for flexibility (initiative can support both)
- UI enforces one parent at creation time
- Database allows both for flexibility

---

### 4.5 Objective-KeyResult Many-to-Many vs UI Expectation

**Contradiction:**
- Schema: `objective_key_results` junction table allows many-to-many
- UI: Assumes one-to-many (one objective → many key results)
- Frontend code: `keyResults` array under objective suggests 1-N

**Evidence:**
- Schema: `services/core-api/prisma/schema.prisma:256-269`
- Frontend: `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx:107-124`

**Possible Resolution:**
- Junction table allows flexibility (future: shared key results across objectives)
- Current UI assumes 1-N relationship
- Backend query pattern: `objective.keyResults` suggests 1-N expectation

---

## 5. Evidence File References

- Database Schema: `services/core-api/prisma/schema.prisma`
- Baseline Migration: `services/core-api/prisma/migrations/20251102100826_baseline/migration.sql`

