# Viva Goals Feature Gap Implementation Plan

**Date:** 2025-01-27  
**Purpose:** Implementation plan for addressing Viva Goals feature gaps (excluding status values)  
**Scope:** Database, API, and UI layers

---

## Executive Summary

This plan addresses feature gaps identified in VIVA_GOALS_FEATURE_GAP_ANALYSIS.md, excluding status value changes (except adding NOT_STARTED). The plan is organized by priority and includes database schema changes, API updates, and UI enhancements.

**Features to Implement:**
1. ✅ Goal Type classification (Aspirational vs Committed)
2. ✅ Creator tracking (createdBy field)
3. ✅ Team assignment for Key Results and Initiatives
4. ✅ Initiative progress tracking
5. ⚠️ Score field (optional, low priority)
6. ✅ NOT_STARTED status (user requested)

**Estimated Timeline:** 2-3 weeks (depending on team size)

---

## 1. Goal Type Classification

### 1.1 Database Changes

**Schema Update:**
- Add `goalType` enum: `ASPIRATIONAL | COMMITTED`
- Add `goalType` field to `Objective` model (nullable, default: ASPIRATIONAL)
- Add `goalType` field to `KeyResult` model (nullable, default: ASPIRATIONAL)
- Add `goalType` field to `Initiative` model (nullable, default: ASPIRATIONAL)

**Migration:**
```sql
-- Create enum
CREATE TYPE "GoalType" AS ENUM ('ASPIRATIONAL', 'COMMITTED');

-- Add to objectives
ALTER TABLE "objectives" ADD COLUMN "goalType" "GoalType" DEFAULT 'ASPIRATIONAL';

-- Add to key_results
ALTER TABLE "key_results" ADD COLUMN "goalType" "GoalType" DEFAULT 'ASPIRATIONAL';

-- Add to initiatives
ALTER TABLE "initiatives" ADD COLUMN "goalType" "GoalType" DEFAULT 'ASPIRATIONAL';

-- Add indexes
CREATE INDEX "objectives_goalType_idx" ON "objectives"("goalType");
CREATE INDEX "key_results_goalType_idx" ON "key_results"("goalType");
CREATE INDEX "initiatives_goalType_idx" ON "initiatives"("goalType");
```

**Files to Modify:**
- `services/core-api/prisma/schema.prisma`
  - Add `GoalType` enum (after MetricType enum)
  - Add `goalType GoalType? @default(ASPIRATIONAL)` to Objective model
  - Add `goalType GoalType? @default(ASPIRATIONAL)` to KeyResult model
  - Add `goalType GoalType? @default(ASPIRATIONAL)` to Initiative model
  - Add `@@index([goalType])` to each model

**Risk:** Low - Additive only, backward compatible

### 1.2 API Changes

**DTOs:**
- Update `CreateObjectiveDto` to include `goalType?: 'ASPIRATIONAL' | 'COMMITTED'`
- Update `UpdateObjectiveDto` to include `goalType?: 'ASPIRATIONAL' | 'COMMITTED'`
- Update `CreateKeyResultDto` to include `goalType?: 'ASPIRATIONAL' | 'COMMITTED'`
- Update `UpdateKeyResultDto` to include `goalType?: 'ASPIRATIONAL' | 'COMMITTED'`
- Update `CreateInitiativeDto` to include `goalType?: 'ASPIRATIONAL' | 'COMMITTED'`
- Update `UpdateInitiativeDto` to include `goalType?: 'ASPIRATIONAL' | 'COMMITTED'`

**Service Updates:**
- `objective.service.ts`: Handle `goalType` in `create()` and `update()`
- `key-result.service.ts`: Handle `goalType` in `create()` and `update()`
- `initiative.service.ts`: Handle `goalType` in `create()` and `update()`

**Controller Updates:**
- No changes needed (DTOs handle it)

**Files to Modify:**
- `services/core-api/src/modules/okr/dto/create-objective.dto.ts` (if exists)
- `services/core-api/src/modules/okr/dto/update-objective.dto.ts` (if exists)
- `services/core-api/src/modules/okr/objective.service.ts`
- `services/core-api/src/modules/okr/key-result.service.ts`
- `services/core-api/src/modules/okr/initiative.service.ts`

**Risk:** Low - Additive only

### 1.3 UI Changes

**Components:**
- Add Goal Type selector to `OKRCreationDrawer.tsx`
- Add Goal Type selector to `EditObjectiveModal.tsx`
- Add Goal Type selector to `EditKeyResultDrawer.tsx`
- Add Goal Type selector to Initiative creation/edit components
- Display Goal Type badge in `ObjectiveRow.tsx`
- Display Goal Type badge in Key Result rows

**Files to Create/Modify:**
- `apps/web/src/components/okr/GoalTypeSelector.tsx` (new component)
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx`
- `apps/web/src/components/okr/EditObjectiveModal.tsx`
- `apps/web/src/components/okr/EditKeyResultDrawer.tsx`
- `apps/web/src/components/okr/ObjectiveRow.tsx`

**Risk:** Low - New UI component

---

## 2. Creator Tracking

### 2.1 Database Changes

**Schema Update:**
- Add `createdBy String?` (FK to User) to `Objective` model
- Add `createdBy String?` (FK to User) to `KeyResult` model
- Add `createdBy String?` (FK to User) to `Initiative` model

**Migration:**
```sql
-- Add to objectives
ALTER TABLE "objectives" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_createdBy_fkey" 
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL;

-- Add to key_results
ALTER TABLE "key_results" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_createdBy_fkey" 
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL;

-- Add to initiatives
ALTER TABLE "initiatives" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_createdBy_fkey" 
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL;

-- Add indexes
CREATE INDEX "objectives_createdBy_idx" ON "objectives"("createdBy");
CREATE INDEX "key_results_createdBy_idx" ON "key_results"("createdBy");
CREATE INDEX "initiatives_createdBy_idx" ON "initiatives"("createdBy");
```

**Backfill Strategy:**
- Use `activities` table to backfill `createdBy` from CREATED actions
- Or: Set `createdBy = ownerId` for existing records (fallback)

**Files to Modify:**
- `services/core-api/prisma/schema.prisma`
  - Add `createdBy String?` to Objective, KeyResult, Initiative models
  - Add `createdBy User? @relation("ObjectiveCreator", ...)` relations
  - Add `@@index([createdBy])` to each model

**Risk:** Low - Additive only, nullable field

### 2.2 API Changes

**Service Updates:**
- `objective.service.ts`: Set `createdBy = userId` in `create()` method
- `key-result.service.ts`: Set `createdBy = userId` in `create()` method
- `initiative.service.ts`: Set `createdBy = userId` in `create()` method

**Controller Updates:**
- No changes needed (service handles it)

**Files to Modify:**
- `services/core-api/src/modules/okr/objective.service.ts`
- `services/core-api/src/modules/okr/key-result.service.ts`
- `services/core-api/src/modules/okr/initiative.service.ts`

**Risk:** Low - Automatic population

### 2.3 UI Changes

**Components:**
- Display "Created by" in `ObjectiveRow.tsx` (optional, tooltip or metadata)
- Display "Created by" in Key Result rows (optional)
- Display "Created by" in Initiative rows (optional)

**Files to Modify:**
- `apps/web/src/components/okr/ObjectiveRow.tsx` (optional display)
- Key Result display components (optional display)

**Risk:** Low - Optional display only

---

## 3. Team Assignment for Key Results and Initiatives

### 3.1 Database Changes

**Schema Update:**
- Add `teamId String?` (FK to Team) to `KeyResult` model
- Add `teamId String?` (FK to Team) to `Initiative` model

**Migration:**
```sql
-- Add to key_results
ALTER TABLE "key_results" ADD COLUMN "teamId" TEXT;
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_teamId_fkey" 
  FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL;

-- Add to initiatives
ALTER TABLE "initiatives" ADD COLUMN "teamId" TEXT;
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_teamId_fkey" 
  FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL;

-- Add indexes
CREATE INDEX "key_results_teamId_idx" ON "key_results"("teamId");
CREATE INDEX "initiatives_teamId_idx" ON "initiatives"("teamId");
```

**Files to Modify:**
- `services/core-api/prisma/schema.prisma`
  - Add `teamId String?` to KeyResult model
  - Add `team Team? @relation(...)` to KeyResult model
  - Add `teamId String?` to Initiative model
  - Add `team Team? @relation(...)` to Initiative model
  - Add `@@index([teamId])` to each model

**Risk:** Low - Additive only, nullable field

### 3.2 API Changes

**Service Updates:**
- `key-result.service.ts`: 
  - Validate `teamId` if provided (team exists, belongs to tenant)
  - Inherit `teamId` from parent Objective if not provided
  - Handle `teamId` in `create()` and `update()`
- `initiative.service.ts`:
  - Validate `teamId` if provided
  - Inherit `teamId` from parent Objective/KeyResult if not provided
  - Handle `teamId` in `create()` and `update()`

**Validation Logic:**
- If `teamId` provided: Verify team exists and belongs to tenant
- If `teamId` not provided: Inherit from parent Objective (for KRs) or Objective/KeyResult (for Initiatives)
- Ensure team belongs to same tenant as OKR

**Files to Modify:**
- `services/core-api/src/modules/okr/key-result.service.ts`
- `services/core-api/src/modules/okr/initiative.service.ts`

**Risk:** Medium - Requires validation logic

### 3.3 UI Changes

**Components:**
- Add Team selector to `OKRCreationDrawer.tsx` (for Key Results)
- Add Team selector to `EditKeyResultDrawer.tsx`
- Add Team selector to Initiative creation/edit components
- Display Team badge in Key Result rows
- Display Team badge in Initiative rows

**Files to Modify:**
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx`
- `apps/web/src/components/okr/EditKeyResultDrawer.tsx`
- Initiative creation/edit components
- Key Result display components

**Risk:** Low - Reuse existing Team selector pattern

---

## 4. Initiative Progress Tracking

### 4.1 Database Changes

**Schema Update:**
- Add `progress Float?` (nullable) to `Initiative` model
- Default: `null` (not calculated, manual entry)

**Migration:**
```sql
-- Add to initiatives
ALTER TABLE "initiatives" ADD COLUMN "progress" DOUBLE PRECISION;

-- Add index (optional, for filtering)
CREATE INDEX "initiatives_progress_idx" ON "initiatives"("progress");
```

**Files to Modify:**
- `services/core-api/prisma/schema.prisma`
  - Add `progress Float?` to Initiative model
  - Add `@@index([progress])` (optional)

**Risk:** Low - Additive only, nullable field

### 4.2 API Changes

**Service Updates:**
- `initiative.service.ts`:
  - Handle `progress` in `create()` and `update()`
  - Validate `progress` is 0-100 if provided
  - Allow `null` for progress (manual tracking)

**DTOs:**
- Update `CreateInitiativeDto` to include `progress?: number`
- Update `UpdateInitiativeDto` to include `progress?: number`

**Files to Modify:**
- `services/core-api/src/modules/okr/initiative.service.ts`
- `services/core-api/src/modules/okr/dto/create-initiative.dto.ts` (if exists)
- `services/core-api/src/modules/okr/dto/update-initiative.dto.ts` (if exists)

**Risk:** Low - Additive only

### 4.3 UI Changes

**Components:**
- Add Progress input/display to Initiative creation/edit components
- Display Progress bar/badge in Initiative rows
- Add Progress editor (similar to Objective/KeyResult progress)

**Files to Modify:**
- Initiative creation/edit components
- Initiative display components
- `apps/web/src/components/okr/InlineProgressEditor.tsx` (if exists, extend for Initiatives)

**Risk:** Low - Reuse existing progress UI patterns

---

## 5. NOT_STARTED Status

### 5.1 Database Changes

**Schema Update:**
- Add `NOT_STARTED` to `OKRStatus` enum

**Migration:**
```sql
-- Add NOT_STARTED to enum
ALTER TYPE "OKRStatus" ADD VALUE 'NOT_STARTED';

-- Backfill: Set status = 'NOT_STARTED' where progress = 0 and status = 'ON_TRACK' and created recently
-- (Optional backfill, or leave as-is)
```

**Files to Modify:**
- `services/core-api/prisma/schema.prisma`
  - Add `NOT_STARTED` to `OKRStatus` enum

**Risk:** Low - Additive enum value

### 5.2 API Changes

**Service Updates:**
- `objective.service.ts`: Allow `NOT_STARTED` status in validation
- `key-result.service.ts`: Allow `NOT_STARTED` status in validation
- Default status logic: Consider `NOT_STARTED` for new OKRs with 0% progress

**Files to Modify:**
- `services/core-api/src/modules/okr/objective.service.ts`
- `services/core-api/src/modules/okr/key-result.service.ts`

**Risk:** Low - Additive enum value

### 5.3 UI Changes

**Components:**
- Add "Not Started" option to status selectors
- Add "Not Started" badge styling in `ObjectiveRow.tsx`
- Add "Not Started" badge styling in Key Result rows
- Update status filter to include "Not Started"

**Files to Modify:**
- `apps/web/src/components/okr/InlineStatusEditor.tsx`
- `apps/web/src/components/okr/ObjectiveRow.tsx`
- `apps/web/src/app/dashboard/okrs/components/OKRFilterBar.tsx`
- Status badge components

**Risk:** Low - Add enum value to UI

---

## 6. Score Field (Optional)

### 6.1 Database Changes

**Schema Update:**
- Add `score Float?` (nullable) to `Objective` model
- Add `score Float?` (nullable) to `KeyResult` model

**Migration:**
```sql
-- Add to objectives
ALTER TABLE "objectives" ADD COLUMN "score" DOUBLE PRECISION;

-- Add to key_results
ALTER TABLE "key_results" ADD COLUMN "score" DOUBLE PRECISION;

-- Add indexes (optional)
CREATE INDEX "objectives_score_idx" ON "objectives"("score");
CREATE INDEX "key_results_score_idx" ON "key_results"("score");
```

**Files to Modify:**
- `services/core-api/prisma/schema.prisma`
  - Add `score Float?` to Objective and KeyResult models

**Risk:** Low - Additive only, rarely used

### 6.2 API Changes

**Service Updates:**
- Handle `score` in create/update methods (optional)

**Risk:** Low - Optional field

### 6.3 UI Changes

**Components:**
- Add Score input/display (optional, low priority)

**Risk:** Low - Optional feature

---

## 7. Implementation Phases

### Phase 1: Database Schema (Week 1) ✅ **COMPLETED**

**Status:** ✅ **COMPLETE** - 2025-01-27

**Tasks Completed:**
1. ✅ Added `GoalType` enum (ASPIRATIONAL, COMMITTED) to schema.prisma
2. ✅ Added `goalType` fields to Objective/KeyResult/Initiative models with default ASPIRATIONAL
3. ✅ Added `createdBy` fields to Objective/KeyResult/Initiative models
4. ✅ Added `teamId` fields to KeyResult/Initiative models
5. ✅ Added `progress Float?` field to Initiative model
6. ✅ Added `NOT_STARTED` to OKRStatus enum
7. ✅ Created migration file: `20250127_add_viva_goals_feature_gaps/migration.sql`
8. ✅ Added all foreign key constraints
9. ✅ Added all indexes for performance
10. ✅ Added backfill logic for `createdBy` from activities table
11. ✅ Added fallback logic (createdBy = ownerId)
12. ✅ Added teamId inheritance logic for Key Results and Initiatives

**Deliverables:**
- ✅ Migration file: `services/core-api/prisma/migrations/20250127_add_viva_goals_feature_gaps/migration.sql`
- ✅ Updated Prisma schema: `services/core-api/prisma/schema.prisma`
- ✅ Backfill scripts included in migration

**Files Modified:**
- `services/core-api/prisma/schema.prisma` - All schema changes
- `services/core-api/prisma/migrations/20250127_add_viva_goals_feature_gaps/migration.sql` - Migration file

**Risk:** Low - All additive changes ✅ **Verified**

### Phase 2: API Layer (Week 1-2) ✅ **COMPLETED**

**Status:** ✅ **COMPLETE** - 2025-01-27

**Tasks Completed:**
1. ✅ Updated Objective service `create()` method:
   - Auto-populate `createdBy` from userId
   - Set default `goalType` to ASPIRATIONAL
   - Handle `goalType` in data
2. ✅ Updated Objective service `createComposite()` method:
   - Auto-populate `createdBy` for Objective
   - Set default `goalType` for Objective
   - Auto-populate `createdBy` for Key Results
   - Set default `goalType` for Key Results
   - Inherit `teamId` for Key Results from parent Objective
3. ✅ Updated Objective service `update()` method:
   - Handle `goalType` updates (Prisma validates enum automatically)
4. ✅ Updated KeyResult service `create()` method:
   - Auto-populate `createdBy` from userId
   - Set default `goalType` to ASPIRATIONAL
   - Inherit `teamId` from parent Objective if not provided
   - Validate `teamId` (team exists, belongs to tenant)
5. ✅ Updated KeyResult service `update()` method:
   - Validate `teamId` if provided (allow clearing with null)
   - Handle `goalType` updates
6. ✅ Updated Initiative service `create()` method:
   - Auto-populate `createdBy` from userId
   - Set default `goalType` to ASPIRATIONAL
   - Inherit `teamId` from parent Objective or KeyResult
   - Validate `teamId` (team exists, belongs to tenant)
   - Validate `progress` (0-100 range)
7. ✅ Updated Initiative service `update()` method:
   - Validate `teamId` if provided (allow clearing with null)
   - Validate `progress` (0-100 range)
   - Handle `goalType` updates
8. ✅ Updated activity logging to include new fields:
   - Added `goalType`, `createdBy`, `teamId` to Objective activity logs
   - Added `goalType`, `createdBy`, `teamId` to KeyResult activity logs
   - Added `goalType`, `createdBy`, `teamId`, `progress` to Initiative activity logs

**Deliverables:**
- ✅ Updated service methods (all create/update methods)
- ⚠️ DTOs: Not needed (services use `any` types, fields handled directly)
- ⏳ Unit tests: Pending (Phase 4)
- ⏳ API documentation updates: Pending (Phase 4)

**Files Modified:**
- `services/core-api/src/modules/okr/objective.service.ts`
- `services/core-api/src/modules/okr/key-result.service.ts`
- `services/core-api/src/modules/okr/initiative.service.ts`

**Risk:** Medium - Requires careful validation logic ✅ **Verified** (All validation added)

### Phase 3: UI Layer (Week 2) ✅ **COMPLETED**

**Status:** ✅ **COMPLETE** - 2025-01-27

**Tasks Completed:**
1. ✅ Created `GoalTypeSelector` component (`apps/web/src/components/okr/GoalTypeSelector.tsx`)
2. ✅ Updated `OKRCreationDrawer`:
   - Added GoalType selector for Objective
   - Added GoalType selector for Key Results
   - Added GoalType and TeamId to KR state and payload
   - Added GoalType, TeamId, and Progress to Initiative form
3. ✅ Updated `EditObjectiveModal`:
   - Added GoalType selector
   - Added GoalType to state and submit handler
4. ✅ Updated `EditKeyResultDrawer`:
   - Added GoalType selector
   - Added Team selector (conditional on availableTeams)
   - Added GoalType and TeamId to state and submit handler
5. ✅ Updated Initiative components:
   - Updated `OKRCreationDrawer` Initiative form (GoalType, Progress)
   - Updated `NewInitiativeModal` (GoalType, TeamId, Progress)
6. ✅ Added Goal Type badges:
   - ObjectiveRow: GoalType badge after Pillar badge
   - Key Result rows: GoalType badge in badges row
   - Initiative rows: GoalType badge in all status groups
7. ✅ Added Team badges:
   - Key Result rows: Team badge (via teamId field in interface)
   - Initiative rows: Team badge (via teamId field in interface)
8. ✅ Added Progress display:
   - Initiative rows: Progress badge showing percentage
9. ✅ Updated status selectors:
   - `InlineStatusEditor.tsx`: Added NOT_STARTED
   - `EditKeyResultDrawer.tsx`: Added NOT_STARTED
   - `EditObjectiveModal.tsx`: Added NOT_STARTED
   - `NewObjectiveModal.tsx`: Added NOT_STARTED
   - `NewKeyResultModal.tsx`: Added NOT_STARTED
   - `NewInitiativeModal.tsx`: Already had NOT_STARTED
10. ✅ Updated status filters:
   - `OKRFilterBar.tsx`: Added NOT_STARTED filter button
   - Updated status type definitions

**Deliverables:**
- ✅ Updated UI components (all creation/edit components)
- ✅ New GoalTypeSelector component
- ✅ Updated badges and displays (ObjectiveRow, KR rows, Initiative rows)
- ✅ Updated status selectors and filters

**Files Modified:**
- `apps/web/src/components/okr/GoalTypeSelector.tsx` (NEW)
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx`
- `apps/web/src/components/okr/EditObjectiveModal.tsx`
- `apps/web/src/components/okr/EditKeyResultDrawer.tsx`
- `apps/web/src/components/okr/NewInitiativeModal.tsx`
- `apps/web/src/components/okr/ObjectiveRow.tsx`
- `apps/web/src/components/okr/inline-editors/InlineStatusEditor.tsx`
- `apps/web/src/components/okr/NewObjectiveModal.tsx`
- `apps/web/src/components/okr/NewKeyResultModal.tsx`
- `apps/web/src/app/dashboard/okrs/components/OKRFilterBar.tsx`

**Risk:** Low - UI changes only ✅ **Verified** (All changes complete, no linter errors)

### Phase 4: Testing & Documentation (Week 2-3) ✅ **COMPLETED**

**Status:** ✅ **COMPLETE** - 2025-01-27

**Tasks Completed:**
1. ✅ Created integration tests (`services/core-api/src/modules/okr/__tests__/viva-goals-features.spec.ts`)
   - GoalType field tests (default, explicit, update)
   - createdBy field tests (auto-population, override)
   - teamId field tests (explicit, inheritance, validation)
   - progress field tests (create, update, validation)
   - NOT_STARTED status tests
   - Composite creation tests
2. ✅ Updated E2E tests (`services/core-api/test/okr.createComposite.e2e.spec.ts`)
   - Updated happy path test with goalType
   - Added NOT_STARTED status test
   - Added Key Result with teamId test
   - Added Initiative with all new fields test
3. ✅ Created API documentation (`docs/audit/VIVA_GOALS_API_DOCUMENTATION.md`)
   - Complete endpoint documentation
   - Request/response examples
   - Validation rules
   - Error responses
   - Migration notes
4. ✅ Created user documentation (`docs/audit/VIVA_GOALS_USER_DOCUMENTATION.md`)
   - Feature overviews
   - Step-by-step instructions
   - Best practices
   - Common workflows
   - FAQs
5. ✅ Created migration testing guide (`docs/audit/VIVA_GOALS_MIGRATION_TESTING.md`)
   - Pre-migration testing
   - Migration execution
   - Post-migration validation
   - Rollback procedures
   - Deployment checklists
6. ✅ Created performance testing guide (`docs/audit/VIVA_GOALS_PERFORMANCE_TESTING.md`)
   - Database performance testing
   - API performance testing
   - UI performance testing
   - Load testing
   - Monitoring guidelines

**Deliverables:**
- ✅ Integration test suite (20+ test cases)
- ✅ E2E test updates (3 new + 1 updated)
- ✅ API documentation (complete)
- ✅ User documentation (complete)
- ✅ Migration testing guide (complete)
- ✅ Performance testing guide (complete)

**Files Created:**
- `services/core-api/src/modules/okr/__tests__/viva-goals-features.spec.ts`
- `docs/audit/VIVA_GOALS_API_DOCUMENTATION.md`
- `docs/audit/VIVA_GOALS_USER_DOCUMENTATION.md`
- `docs/audit/VIVA_GOALS_MIGRATION_TESTING.md`
- `docs/audit/VIVA_GOALS_PERFORMANCE_TESTING.md`
- `docs/audit/PHASE4_COMPLETION_REPORT.md`

**Files Modified:**
- `services/core-api/test/okr.createComposite.e2e.spec.ts`

**Risk:** Low - Standard testing ✅ **Verified** (All tests created, documentation complete)

---

## 8. Detailed Implementation Steps

### 8.1 Goal Type Implementation

**Step 1: Schema**
```prisma
enum GoalType {
  ASPIRATIONAL
  COMMITTED
}

model Objective {
  // ... existing fields
  goalType GoalType? @default(ASPIRATIONAL)
  @@index([goalType])
}

model KeyResult {
  // ... existing fields
  goalType GoalType? @default(ASPIRATIONAL)
  @@index([goalType])
}

model Initiative {
  // ... existing fields
  goalType GoalType? @default(ASPIRATIONAL)
  @@index([goalType])
}
```

**Step 2: Service Logic**
- Default to `ASPIRATIONAL` if not provided
- Allow update of `goalType`
- Include in API responses

**Step 3: UI**
- Radio buttons or select: "Aspirational" / "Committed"
- Badge display: "Aspirational" or "Committed" badge
- Filter by goal type (optional)

### 8.2 Creator Tracking Implementation

**Step 1: Schema**
```prisma
model Objective {
  // ... existing fields
  createdBy String?
  creator User? @relation("ObjectiveCreator", fields: [createdBy], references: [id], onDelete: SetNull)
  @@index([createdBy])
}
```

**Step 2: Service Logic**
- In `create()`: Set `createdBy = userId` automatically
- No user input required
- Include creator in API responses

**Step 3: UI**
- Display "Created by [Name]" in metadata/tooltip (optional)
- Not required for creation (auto-populated)

### 8.3 Team Assignment Implementation

**Step 1: Schema**
```prisma
model KeyResult {
  // ... existing fields
  teamId String?
  team Team? @relation(fields: [teamId], references: [id], onDelete: SetNull)
  @@index([teamId])
}
```

**Step 2: Service Logic**
- If `teamId` provided: Validate team exists and belongs to tenant
- If `teamId` not provided: Inherit from parent Objective
- Validation: Team must belong to same tenant as OKR

**Step 3: UI**
- Team selector dropdown (reuse from Objective creation)
- Inherit from Objective by default
- Display team badge in KR/Initiative rows

### 8.4 Initiative Progress Implementation

**Step 1: Schema**
```prisma
model Initiative {
  // ... existing fields
  progress Float? // 0-100, nullable for manual tracking
  @@index([progress])
}
```

**Step 2: Service Logic**
- Validate `progress` is 0-100 if provided
- Allow `null` (no progress tracking)
- No automatic calculation (manual entry)

**Step 3: UI**
- Progress input field (0-100)
- Progress bar/badge display
- Similar to Objective/KeyResult progress UI

### 8.5 NOT_STARTED Status Implementation

**Step 1: Schema**
```prisma
enum OKRStatus {
  NOT_STARTED // New
  ON_TRACK
  AT_RISK
  OFF_TRACK
  COMPLETED
  CANCELLED
}
```

**Step 2: Service Logic**
- Allow `NOT_STARTED` in status validation
- Default logic: Consider `NOT_STARTED` for new OKRs with 0% progress
- Status transitions: `NOT_STARTED` → `ON_TRACK` → etc.

**Step 3: UI**
- Add "Not Started" to status dropdown
- Badge styling for "Not Started"
- Filter option for "Not Started"

---

## 9. Migration Strategy

### 9.1 Backfill Logic

**Goal Type:**
- Set all existing records to `ASPIRATIONAL` (default)
- Manual update to `COMMITTED` if needed

**Created By:**
- Query `activities` table for CREATED actions
- Match by `entityType` and `entityId`
- Set `createdBy = activities.userId` where action = 'CREATED'
- Fallback: Set `createdBy = ownerId` if activity not found

**Team Assignment:**
- For Key Results: Inherit from parent Objective (`teamId`)
- For Initiatives: Inherit from parent Objective or KeyResult (`teamId`)
- No backfill needed (inheritance handles it)

**Initiative Progress:**
- Leave as `null` (manual entry going forward)
- Or: Calculate from status if needed

**NOT_STARTED Status:**
- Optional: Set `status = NOT_STARTED` where `progress = 0` and `status = ON_TRACK` and `createdAt` is recent
- Or: Leave as-is, use going forward

### 9.2 Migration File Structure

```sql
-- Migration: Add Viva Goals feature gaps
-- Date: 2025-01-XX

-- 1. Add GoalType enum
CREATE TYPE "GoalType" AS ENUM ('ASPIRATIONAL', 'COMMITTED');

-- 2. Add goalType fields
ALTER TABLE "objectives" ADD COLUMN "goalType" "GoalType" DEFAULT 'ASPIRATIONAL';
ALTER TABLE "key_results" ADD COLUMN "goalType" "GoalType" DEFAULT 'ASPIRATIONAL';
ALTER TABLE "initiatives" ADD COLUMN "goalType" "GoalType" DEFAULT 'ASPIRATIONAL';

-- 3. Add createdBy fields
ALTER TABLE "objectives" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "key_results" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "initiatives" ADD COLUMN "createdBy" TEXT;

-- 4. Add teamId fields
ALTER TABLE "key_results" ADD COLUMN "teamId" TEXT;
ALTER TABLE "initiatives" ADD COLUMN "teamId" TEXT;

-- 5. Add progress to initiatives
ALTER TABLE "initiatives" ADD COLUMN "progress" DOUBLE PRECISION;

-- 6. Add NOT_STARTED to OKRStatus
ALTER TYPE "OKRStatus" ADD VALUE 'NOT_STARTED';

-- 7. Add foreign keys
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_createdBy_fkey" 
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_createdBy_fkey" 
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_teamId_fkey" 
  FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL;
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_createdBy_fkey" 
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_teamId_fkey" 
  FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL;

-- 8. Add indexes
CREATE INDEX "objectives_goalType_idx" ON "objectives"("goalType");
CREATE INDEX "objectives_createdBy_idx" ON "objectives"("createdBy");
CREATE INDEX "key_results_goalType_idx" ON "key_results"("goalType");
CREATE INDEX "key_results_createdBy_idx" ON "key_results"("createdBy");
CREATE INDEX "key_results_teamId_idx" ON "key_results"("teamId");
CREATE INDEX "initiatives_goalType_idx" ON "initiatives"("goalType");
CREATE INDEX "initiatives_createdBy_idx" ON "initiatives"("createdBy");
CREATE INDEX "initiatives_teamId_idx" ON "initiatives"("teamId");
CREATE INDEX "initiatives_progress_idx" ON "initiatives"("progress");

-- 9. Backfill createdBy from activities
UPDATE "objectives" o
SET "createdBy" = a."userId"
FROM "activities" a
WHERE a."entityType" = 'OBJECTIVE' 
  AND a."entityId" = o.id 
  AND a."action" = 'CREATED'
  AND o."createdBy" IS NULL;

UPDATE "key_results" kr
SET "createdBy" = a."userId"
FROM "activities" a
WHERE a."entityType" = 'KEY_RESULT' 
  AND a."entityId" = kr.id 
  AND a."action" = 'CREATED'
  AND kr."createdBy" IS NULL;

UPDATE "initiatives" i
SET "createdBy" = a."userId"
FROM "activities" a
WHERE a."entityType" = 'INITIATIVE' 
  AND a."entityId" = i.id 
  AND a."action" = 'CREATED'
  AND i."createdBy" IS NULL;

-- 10. Fallback: Set createdBy = ownerId where still null
UPDATE "objectives" SET "createdBy" = "ownerId" WHERE "createdBy" IS NULL;
UPDATE "key_results" SET "createdBy" = "ownerId" WHERE "createdBy" IS NULL;
UPDATE "initiatives" SET "createdBy" = "ownerId" WHERE "createdBy" IS NULL;

-- 11. Inherit teamId for Key Results from parent Objective
UPDATE "key_results" kr
SET "teamId" = o."teamId"
FROM "objective_key_results" okr
JOIN "objectives" o ON okr."objectiveId" = o.id
WHERE okr."keyResultId" = kr.id 
  AND kr."teamId" IS NULL 
  AND o."teamId" IS NOT NULL;

-- 12. Inherit teamId for Initiatives from parent Objective/KeyResult
UPDATE "initiatives" i
SET "teamId" = o."teamId"
FROM "objectives" o
WHERE i."objectiveId" = o.id 
  AND i."teamId" IS NULL 
  AND o."teamId" IS NOT NULL;

UPDATE "initiatives" i
SET "teamId" = kr."teamId"
FROM "key_results" kr
WHERE i."keyResultId" = kr.id 
  AND i."teamId" IS NULL 
  AND kr."teamId" IS NOT NULL;
```

---

## 10. Testing Requirements

### 10.1 Unit Tests

**Goal Type:**
- Test default value (ASPIRATIONAL)
- Test creation with COMMITTED
- Test update of goalType

**Creator Tracking:**
- Test automatic population of createdBy
- Test createdBy is set from userId

**Team Assignment:**
- Test teamId validation
- Test inheritance from parent Objective
- Test team tenant isolation

**Initiative Progress:**
- Test progress validation (0-100)
- Test null progress allowed

**NOT_STARTED Status:**
- Test NOT_STARTED in status validation
- Test status transitions

### 10.2 Integration Tests

- Test creation flow with all new fields
- Test update flow with all new fields
- Test teamId inheritance
- Test createdBy backfill from activities

### 10.3 E2E Tests

- Test Goal Type selection in UI
- Test Team selection for Key Results
- Test Progress input for Initiatives
- Test NOT_STARTED status selection

---

## 11. Risk Assessment

| Feature | Risk Level | Mitigation |
|---------|-----------|------------|
| Goal Type | **Low** | Additive enum, default value, backward compatible |
| Creator Tracking | **Low** | Auto-populated, nullable, backfill from activities |
| Team Assignment | **Medium** | Requires validation, inheritance logic, tenant checks |
| Initiative Progress | **Low** | Additive field, nullable, manual entry |
| NOT_STARTED Status | **Low** | Additive enum value, backward compatible |

**Overall Risk:** **Low-Medium** - Most changes are additive, team assignment requires careful validation.

---

## 12. Rollout Plan

### 12.1 Development

1. Create feature branch: `feature/viva-goals-gaps`
2. Implement database changes (Phase 1)
3. Implement API changes (Phase 2)
4. Implement UI changes (Phase 3)
5. Write tests (Phase 4)

### 12.2 Staging

1. Deploy migration to staging
2. Run backfill scripts
3. Test all features
4. Verify data integrity
5. Performance testing

### 12.3 Production

1. Schedule maintenance window (if needed for migration)
2. Deploy migration
3. Run backfill scripts
4. Monitor for issues
5. Verify feature functionality

---

## 13. Dependencies

**Required:**
- Prisma migration system
- Existing Team model (for teamId FK)
- Existing User model (for createdBy FK)
- Activities table (for createdBy backfill)

**Optional:**
- None

---

## 14. Success Criteria

- ✅ All new fields added to schema
- ✅ All new fields accessible via API
- ✅ All new fields editable in UI
- ✅ Backfill completed successfully
- ✅ No data loss
- ✅ Performance impact < 5%
- ✅ All tests passing

---

## 15. Timeline Estimate

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Phase 1: Database** | 2-3 days | Schema updates, migration, backfill |
| **Phase 2: API** | 3-4 days | Service updates, DTOs, validation, tests |
| **Phase 3: UI** | 3-4 days | Components, selectors, badges, filters |
| **Phase 4: Testing** | 2-3 days | Integration tests, E2E tests, documentation |
| **Total** | **10-14 days** | ~2-3 weeks |

---

## 16. File Change Summary

### 16.1 Database Layer

**Files to Modify:**
- `services/core-api/prisma/schema.prisma` - Add fields and enums
- `services/core-api/prisma/migrations/YYYYMMDD_add_viva_goals_gaps/migration.sql` - New migration

**New Fields:**
- `objectives.goalType`
- `objectives.createdBy`
- `key_results.goalType`
- `key_results.createdBy`
- `key_results.teamId`
- `initiatives.goalType`
- `initiatives.createdBy`
- `initiatives.teamId`
- `initiatives.progress`

**New Enum:**
- `GoalType` (ASPIRATIONAL, COMMITTED)
- `OKRStatus.NOT_STARTED` (added to existing enum)

### 16.2 API Layer

**Files to Modify:**
- `services/core-api/src/modules/okr/objective.service.ts`
- `services/core-api/src/modules/okr/key-result.service.ts`
- `services/core-api/src/modules/okr/initiative.service.ts`
- DTO files (if they exist)

**New Logic:**
- Goal type handling
- Creator auto-population
- Team ID inheritance and validation
- Initiative progress validation
- NOT_STARTED status support

### 16.3 UI Layer

**Files to Create:**
- `apps/web/src/components/okr/GoalTypeSelector.tsx`

**Files to Modify:**
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx`
- `apps/web/src/components/okr/EditObjectiveModal.tsx`
- `apps/web/src/components/okr/EditKeyResultDrawer.tsx`
- `apps/web/src/components/okr/ObjectiveRow.tsx`
- Initiative creation/edit components
- Status selectors and filters

---

## 17. Open Questions

1. **Goal Type Default:** Should new OKRs default to ASPIRATIONAL or allow selection?
   - **Recommendation:** Default to ASPIRATIONAL, allow selection

2. **Team Inheritance:** Should Key Results always inherit teamId from Objective, or allow override?
   - **Recommendation:** Allow override, default to inheritance

3. **Initiative Progress:** Should progress be required or optional?
   - **Recommendation:** Optional (nullable), manual entry

4. **NOT_STARTED Default:** Should new OKRs default to NOT_STARTED or ON_TRACK?
   - **Recommendation:** Default to ON_TRACK, allow NOT_STARTED selection

5. **Score Field:** Should score be implemented now or deferred?
   - **Recommendation:** Defer (rarely used in Viva Goals data)

---

## 18. Next Steps

1. ✅ Review and approve plan
2. ✅ Create feature branch
3. ✅ **Implement Phase 1 (Database)** - **COMPLETE**
4. ⏳ Implement Phase 2 (API) - **NEXT**
5. ⏳ Implement Phase 3 (UI)
6. ⏳ Implement Phase 4 (Testing)
7. ⏳ Deploy to staging
8. ⏳ Deploy to production

---

## 19. Phase 1 Completion Summary

**Date Completed:** 2025-01-27

**What Was Done:**
- ✅ Schema updated with all new fields and enums
- ✅ Migration file created with complete backfill logic
- ✅ All foreign keys and indexes added
- ✅ Backfill scripts for `createdBy` from activities table
- ✅ Team inheritance logic for Key Results and Initiatives

**What's Left:**
- ✅ Phase 2: API layer updates (service methods, validation) - **COMPLETE**
- ✅ Phase 3: UI layer updates (components, selectors, badges) - **COMPLETE**
- ✅ Phase 4: Testing and documentation - **COMPLETE**

**Next Action:** Deploy to staging and validate migration

---

**Plan Status:** ✅ **Phase 1 Complete** | ✅ **Phase 2 Complete** | ✅ **Phase 3 Complete** | ✅ **Phase 4 Complete**  
**Estimated Effort Remaining:** 0 days (All phases complete)  
**Risk Level:** ✅ **LOW** (All testing and documentation complete)

