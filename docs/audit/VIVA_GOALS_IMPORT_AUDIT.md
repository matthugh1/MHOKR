# Viva Goals Import Audit Report

**Date:** 2025-01-27  
**Objective:** Understand what would need to change to support importing OKRs from Viva Goals (Excel/CSV)  
**Scope:** Database, API, and UI layers

---

## Executive Summary

This audit examines the current OKR system architecture to identify changes required for importing OKRs from Viva Goals via Excel/CSV. Key findings:

- **No import infrastructure exists** - No external_id, source, or import tracking fields
- **Manual progress updates** - Progress is calculated automatically from Key Results, but can be manually set
- **Single parent assumption** - Objectives support one parent via `parentId` (self-referential)
- **Cycle-based periods** - Uses `Cycle` model (e.g., "Q1 2025") rather than fixed quarters
- **Weighted Key Results** - Supports weighted progress roll-up via `ObjectiveKeyResult.weight`
- **Comprehensive validation** - Extensive validation for dates, alignment, ownership, and governance

---

## 1. Models, Migrations, and Schemas

### 1.1 Database Schema

**Primary Models:**
- `Objective` - `services/core-api/prisma/schema.prisma:201-254`
- `KeyResult` - `services/core-api/prisma/schema.prisma:256-296`
- `ObjectiveKeyResult` - `services/core-api/prisma/schema.prisma:298-315` (junction table)

**Key Migrations:**
- `20251102100826_baseline/migration.sql` - Baseline schema
- `20250123000000_add_weight_to_objective_key_result/migration.sql` - Added weight field
- `20250124000000_add_tags_contributors_sponsor/migration.sql` - Added tags, contributors, sponsor
- `20251103130000_add_okr_state_enums/migration.sql` - Added state enums

### 1.2 Current Schema Fields

**Objective Fields:**
- `id` (String, cuid) - Primary key
- `title` (String, NOT NULL)
- `description` (String?, nullable)
- `tenantId` (String, NOT NULL) - Organization scoping
- `workspaceId` (String?, nullable)
- `teamId` (String?, nullable)
- `pillarId` (String?, nullable) - Strategic pillar
- `cycleId` (String?, nullable) - OKR cycle/quarter
- `ownerId` (String, NOT NULL) - Owner user
- `sponsorId` (String?, nullable) - Executive sponsor
- `parentId` (String?, nullable) - Parent objective (self-referential)
- `startDate` (DateTime, NOT NULL)
- `endDate` (DateTime, NOT NULL)
- `status` (OKRStatus enum, default: ON_TRACK)
- `progress` (Float, default: 0) - Calculated from KRs
- `visibilityLevel` (VisibilityLevel enum, default: PUBLIC_TENANT)
- `isPublished` (Boolean, default: false) - DEPRECATED, use `state`
- `state` (ObjectiveState enum, default: DRAFT)
- `confidence` (Int?, nullable) - Review confidence (0-100)
- `reviewFrequency` (ReviewFrequency?, nullable)
- `lastReviewedAt` (DateTime?, nullable)

**KeyResult Fields:**
- `id` (String, cuid) - Primary key
- `title` (String, NOT NULL)
- `description` (String?, nullable)
- `ownerId` (String, NOT NULL)
- `tenantId` (String, NOT NULL)
- `metricType` (MetricType enum, NOT NULL) - INCREASE, DECREASE, REACH, MAINTAIN
- `startValue` (Float, NOT NULL)
- `targetValue` (Float, NOT NULL)
- `currentValue` (Float, NOT NULL)
- `unit` (String?, nullable)
- `status` (OKRStatus enum, default: ON_TRACK)
- `progress` (Float, default: 0) - Calculated from values
- `visibilityLevel` (VisibilityLevel enum, default: PUBLIC_TENANT)
- `isPublished` (Boolean, default: false) - DEPRECATED, use `state`
- `state` (KeyResultState enum, default: DRAFT)
- `checkInCadence` (CheckInCadence?, nullable) - WEEKLY, BIWEEKLY, MONTHLY, NONE
- `cycleId` (String?, nullable)
- `startDate` (DateTime?, nullable)
- `endDate` (DateTime?, nullable)

**ObjectiveKeyResult Junction:**
- `id` (String, cuid)
- `objectiveId` (String, NOT NULL)
- `keyResultId` (String, NOT NULL)
- `tenantId` (String, NOT NULL)
- `weight` (Float, default: 1.0) - Weight for weighted progress roll-up
- `createdAt` (DateTime)

---

## 2. Field References

### 2.1 Progress

**Database:**
- `objectives.progress` (Float, default: 0)
- `key_results.progress` (Float, default: 0)

**API:**
- `services/core-api/src/modules/okr/okr-progress.service.ts` - Progress calculation service
- `services/core-api/src/modules/okr/objective.service.ts` - Objective CRUD with progress roll-up
- `services/core-api/src/modules/okr/key-result.service.ts` - KR CRUD with progress calculation
- Progress automatically calculated from Key Results using weighted average
- Progress cascades up to parent Objectives

**UI:**
- `apps/web/src/components/okr/ObjectiveRow.tsx` - Displays progress
- `apps/web/src/components/okr/ProgressBreakdownTooltip.tsx` - Progress breakdown tooltip
- `apps/web/src/components/okr/ObjectiveProgressTrendChart.tsx` - Progress trend chart

### 2.2 Score

**Finding:** No "score" field exists in the schema. Progress (0-100) is used instead.

### 2.3 Weight

**Database:**
- `objective_key_results.weight` (Float, default: 1.0)

**API:**
- `services/core-api/src/modules/okr/objective.controller.ts:160-215` - `PATCH /objectives/:id/key-results/:keyResultId/weight`
- `services/core-api/src/modules/okr/dto/update-weight.dto.ts` - Weight update DTO
- `services/core-api/src/modules/okr/okr-progress.service.ts:68-86` - Weighted average calculation

**UI:**
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx:1249-1267` - Weight setting during KR creation

### 2.4 Alignment

**Database:**
- `objectives.parentId` (String?, nullable) - Self-referential FK

**API:**
- `services/core-api/src/modules/okr/objective.service.ts:1288-1340` - `validateAlignment()` method
- Validates: child dates within parent date range, cycle matching
- `services/core-api/src/modules/okr/objective.service.ts:344-355` - Alignment validation on create
- `services/core-api/src/modules/okr/objective.service.ts:970-979` - Alignment validation on update

**UI:**
- `apps/web/src/app/dashboard/builder/page.tsx:680-694` - Visual alignment in builder
- `apps/web/src/app/dashboard/okrs/page.tsx` - Objective hierarchy display

### 2.5 Owner

**Database:**
- `objectives.ownerId` (String, NOT NULL) - FK to `users.id`
- `key_results.ownerId` (String, NOT NULL) - FK to `users.id`

**API:**
- `services/core-api/src/modules/okr/objective.service.ts:314-321` - Owner validation on create
- `services/core-api/src/modules/okr/objective.service.ts:357-364` - Owner existence check
- `services/core-api/src/modules/okr/key-result.service.ts:303-319` - Owner validation

**UI:**
- `apps/web/src/components/okr/InlineOwnerEditor.tsx` - Inline owner editor
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx` - Owner selection in creation

### 2.6 Period

**Database:**
- `objectives.cycleId` (String?, nullable) - FK to `cycles.id`
- `key_results.cycleId` (String?, nullable) - FK to `cycles.id`
- `cycles` table with `name` (e.g., "Q1 2025"), `startDate`, `endDate`, `status`

**API:**
- `services/core-api/src/modules/okr/okr-cycle.service.ts` - Cycle management
- `services/core-api/src/modules/okr/okr-cycle.controller.ts` - Cycle endpoints
- `services/core-api/src/modules/okr/cycle-generator.service.ts` - Auto-generate cycles
- `services/core-api/src/modules/okr/objective.service.ts:443-478` - Cycle lock validation

**UI:**
- `apps/web/src/app/dashboard/okrs/components/CycleManagementDrawer.tsx` - Cycle management
- `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx` - Cycle selection

**Note:** `period` enum (MONTHLY, QUARTERLY, ANNUAL, CUSTOM) exists but is deprecated in favor of `Cycle` model.

### 2.7 Status

**Database:**
- `objectives.status` (OKRStatus enum, default: ON_TRACK)
- `key_results.status` (OKRStatus enum, default: ON_TRACK)
- `objectives.state` (ObjectiveState enum, default: DRAFT)
- `key_results.state` (KeyResultState enum, default: DRAFT)

**Enums:**
- `OKRStatus`: ON_TRACK, AT_RISK, OFF_TRACK, COMPLETED, CANCELLED
- `ObjectiveState`: DRAFT, PUBLISHED, COMPLETED, CANCELLED, ARCHIVED
- `KeyResultState`: DRAFT, PUBLISHED, COMPLETED, CANCELLED, ARCHIVED

**API:**
- `services/core-api/src/modules/okr/okr-state-transition.service.ts` - State transition logic
- `services/core-api/src/modules/okr/objective.service.ts` - Status updates trigger roll-up
- `services/core-api/src/modules/okr/key-result.service.ts` - Status updates

**UI:**
- `apps/web/src/components/okr/InlineStatusEditor.tsx` - Inline status editor
- `apps/web/src/components/okr/KeyResultStatusTrendChart.tsx` - Status trend chart

---

## 3. Import/External ID Fields

### 3.1 Current State

**Finding:** No import tracking fields exist for Objectives or Key Results.

**Existing Integration Model:**
- `KRIntegration` model exists (`services/core-api/prisma/schema.prisma:877-890`) but only for:
  - JIRA, GitHub, Salesforce, CUSTOM_WEBHOOK integrations
  - Tracks `externalId` and `source` for Key Results only
  - Not suitable for Viva Goals import tracking

**Missing Fields:**
- ❌ `objectives.externalId` - No external ID field
- ❌ `objectives.source` - No source field (e.g., "VIVA_GOALS")
- ❌ `objectives.importedAt` - No import timestamp
- ❌ `objectives.importedBy` - No import user tracking
- ❌ `key_results.externalId` - No external ID field (except via KRIntegration)
- ❌ `key_results.source` - No source field
- ❌ `key_results.importedAt` - No import timestamp

---

## 4. OKR Creation and Update Flow

### 4.1 Creation Flow

**Frontend → API → Database:**

1. **Frontend:**
   - `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx` - Creation drawer
   - `apps/web/src/components/okr/NewObjectiveModal.tsx` - Objective modal
   - `apps/web/src/components/okr/NewKeyResultModal.tsx` - KR modal

2. **API Endpoints:**
   - `POST /objectives` - `services/core-api/src/modules/okr/objective.controller.ts:40-108`
   - `POST /key-results` - `services/core-api/src/modules/okr/key-result.controller.ts:40-61`
   - `POST /okr/create-composite` - `services/core-api/src/modules/okr/okr-overview.controller.ts:808-858` - Atomic creation

3. **Service Layer:**
   - `services/core-api/src/modules/okr/objective.service.ts:309-557` - `create()` method
   - `services/core-api/src/modules/okr/key-result.service.ts:280-500` - `create()` method
   - Validates: owner, dates, alignment, cycle lock, visibility permissions
   - Creates activity log and audit entry
   - Triggers progress roll-up for parent Objective

4. **Database:**
   - Creates Objective/KeyResult record
   - Creates `objective_key_results` junction entry if linked
   - Creates activity log entry
   - Creates audit log entry

### 4.2 Update Flow

**Frontend → API → Database:**

1. **Frontend:**
   - `apps/web/src/components/okr/EditObjectiveModal.tsx` - Objective edit modal
   - `apps/web/src/components/okr/EditKeyResultDrawer.tsx` - KR edit drawer
   - `apps/web/src/components/okr/InlineTitleEditor.tsx` - Inline editors
   - `apps/web/src/components/okr/InlineStatusEditor.tsx` - Inline status editor

2. **API Endpoints:**
   - `PATCH /objectives/:id` - `services/core-api/src/modules/okr/objective.controller.ts:110-145`
   - `PATCH /key-results/:id` - `services/core-api/src/modules/okr/key-result.controller.ts:63-100`

3. **Service Layer:**
   - `services/core-api/src/modules/okr/objective.service.ts:900-1175` - `update()` method
   - `services/core-api/src/modules/okr/key-result.service.ts:600-800` - `update()` method
   - Validates: alignment, cycle lock, ownership changes
   - Updates activity log and audit entry
   - Triggers progress/status roll-up

4. **Database:**
   - Updates Objective/KeyResult record
   - Updates activity log
   - Updates audit log

---

## 5. Assumptions

### 5.1 Parent-Child Relationships

**Assumption:** One parent per Objective
- **Evidence:** `objectives.parentId` is a single FK (nullable)
- **Schema:** `services/core-api/prisma/schema.prisma:219-221`
- **Validation:** `services/core-api/src/modules/okr/objective.service.ts:1288-1340`
- **Impact:** Viva Goals import must map to single parent if hierarchical

### 5.2 Progress Updates

**Assumption:** Progress is automatically calculated from Key Results
- **Evidence:** `services/core-api/src/modules/okr/okr-progress.service.ts:30-123`
- **Calculation:** Weighted average of linked Key Results
- **Manual Override:** Progress can be manually set, but will be recalculated on KR changes
- **Impact:** Imported progress may be overwritten if KRs are linked

### 5.3 Periods/Cycles

**Assumption:** Uses Cycle model, not fixed quarters
- **Evidence:** `cycles` table with `name`, `startDate`, `endDate`, `status`
- **Migration:** `20251103_remove_periods/migration.sql` - Removed `period` enum usage
- **Impact:** Viva Goals quarters must map to Cycle records (create if missing)

### 5.4 Ownership

**Assumption:** Single owner per Objective/Key Result
- **Evidence:** `objectives.ownerId` (NOT NULL), `key_results.ownerId` (NOT NULL)
- **Contributors:** Separate `ObjectiveContributor` and `KeyResultContributor` tables exist
- **Impact:** Viva Goals owner must map to existing User or be created

### 5.5 Tenant Isolation

**Assumption:** All OKRs belong to a tenant (organization)
- **Evidence:** `objectives.tenantId` (NOT NULL), `key_results.tenantId` (NOT NULL)
- **Validation:** `services/core-api/src/modules/okr/tenant-guard.ts`
- **Impact:** Import must specify tenantId or derive from authenticated user

### 5.6 Weight

**Assumption:** Key Results have equal weight by default (1.0)
- **Evidence:** `objective_key_results.weight` (default: 1.0)
- **Impact:** Viva Goals weights must map to `weight` field if different

### 5.7 Status vs State

**Assumption:** Dual status system (status + state)
- **Evidence:** `status` (OKRStatus enum) + `state` (ObjectiveState/KeyResultState enum)
- **Logic:** `services/core-api/src/modules/okr/okr-state-transition.service.ts`
- **Impact:** Viva Goals status must map to both `status` and `state` fields

### 5.8 Many-to-Many Key Results

**Assumption:** Key Results can belong to multiple Objectives
- **Evidence:** `objective_key_results` junction table (many-to-many)
- **UI:** Typically shows 1-1 relationship
- **Impact:** Viva Goals import must handle multiple Objective links per KR

---

## 6. Required Changes by Layer

### 6.1 Database Layer

| File/Module | Purpose | Current Behaviour | Required Change for Viva Import | Risk |
|------------|---------|-------------------|--------------------------------|------|
| `prisma/schema.prisma` (Objective model) | Define Objective schema | No import tracking fields | Add `externalId String?`, `source String?`, `importedAt DateTime?`, `importedBy String?` | **Low** - Additive only |
| `prisma/schema.prisma` (KeyResult model) | Define KeyResult schema | No import tracking fields | Add `externalId String?`, `source String?`, `importedAt DateTime?`, `importedBy String?` | **Low** - Additive only |
| `prisma/migrations/` | Database migrations | No import-related migrations | Create migration to add import fields with indexes | **Low** - Additive only |
| `objectives` table | Store objectives | No external_id column | Add `external_id`, `source`, `imported_at`, `imported_by` columns | **Low** - Additive only |
| `key_results` table | Store key results | No external_id column | Add `external_id`, `source`, `imported_at`, `imported_by` columns | **Low** - Additive only |
| Indexes | Query performance | No indexes on import fields | Add indexes: `@@index([source, externalId])` for deduplication | **Low** - Additive only |

### 6.2 API Layer

| File/Module | Purpose | Current Behaviour | Required Change for Viva Import | Risk |
|------------|---------|-------------------|--------------------------------|------|
| `objective.service.ts` | Objective CRUD operations | Validates owner, dates, alignment | Add import mode validation (skip some validations), handle externalId mapping | **Medium** - May affect existing validation |
| `key-result.service.ts` | KeyResult CRUD operations | Validates owner, calculates progress | Add import mode validation, handle externalId mapping | **Medium** - May affect existing validation |
| `objective.controller.ts` | Objective HTTP endpoints | `POST /objectives`, `PATCH /objectives/:id` | Add `POST /objectives/import` endpoint for bulk import | **Low** - New endpoint |
| `key-result.controller.ts` | KeyResult HTTP endpoints | `POST /key-results`, `PATCH /key-results/:id` | Add `POST /key-results/import` endpoint for bulk import | **Low** - New endpoint |
| `okr-overview.controller.ts` | Composite OKR operations | `POST /okr/create-composite` | Add `POST /okr/import` endpoint for Viva Goals CSV/Excel | **Low** - New endpoint |
| `okr-cycle.service.ts` | Cycle management | Creates/finds cycles by name | Add `findOrCreateCycle()` for Viva Goals quarter mapping | **Low** - Additive only |
| `okr-governance.service.ts` | Governance checks | Validates cycle locks, permissions | Add import mode bypass for cycle locks (admin only) | **Medium** - Security consideration |
| `tenant-guard.ts` | Tenant isolation | Enforces tenant boundaries | Ensure import respects tenant isolation | **High** - Security critical |
| DTOs | Request validation | Validates create/update payloads | Add `ImportObjectiveDto`, `ImportKeyResultDto` with externalId fields | **Low** - New DTOs |
| CSV/Excel parser | Parse import files | No parser exists | Create parser service for Viva Goals CSV/Excel format | **Low** - New service |

### 6.3 UI Layer

| File/Module | Purpose | Current Behaviour | Required Change for Viva Import | Risk |
|------------|---------|-------------------|--------------------------------|------|
| `apps/web/src/app/dashboard/okrs/page.tsx` | Main OKR page | Displays OKRs, creation modals | Add import button/menu item, import modal/drawer | **Low** - New UI component |
| `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx` | OKR creation drawer | Manual creation form | Add import mode or separate import component | **Low** - New component |
| `apps/web/src/components/okr/ObjectiveRow.tsx` | Objective display row | Shows objective details | Display import source badge if `source` is set | **Low** - Display only |
| `apps/web/src/components/okr/KeyResultRow.tsx` | KeyResult display row | Shows KR details | Display import source badge if `source` is set | **Low** - Display only |
| File upload component | Handle file uploads | No file upload component | Create CSV/Excel file upload component with drag-drop | **Low** - New component |
| Import preview | Preview import data | No preview exists | Create import preview table showing mapped OKRs before import | **Low** - New component |
| Import mapping UI | Map CSV columns to fields | No mapping UI | Create column mapping interface (CSV headers → OKR fields) | **Medium** - Complex UI |
| Import error handling | Display import errors | No error handling | Create error display component for import failures | **Low** - New component |
| Import progress | Show import progress | No progress indicator | Add progress bar for bulk imports | **Low** - New component |

---

## 7. Key Considerations

### 7.1 Data Mapping

**Viva Goals → Current System:**
- Viva Goals Objective → Objective (title, description, owner, dates, status)
- Viva Goals Key Result → KeyResult (title, metric, start/target/current values, owner, status)
- Viva Goals Quarter → Cycle (find or create by name/date range)
- Viva Goals Owner → User (find by email or create)
- Viva Goals Parent → Objective.parentId (find by externalId if previously imported)
- Viva Goals Weight → ObjectiveKeyResult.weight (if supported)

### 7.2 Validation Challenges

**Current Validation May Block Import:**
- Cycle lock validation - Import may need admin bypass
- Owner existence - Must create users or map to existing
- Date alignment - Parent-child date validation may fail
- Tenant isolation - Must ensure correct tenant assignment
- Progress calculation - May overwrite imported progress

### 7.3 Deduplication

**Strategy:**
- Use `externalId` + `source` unique constraint
- On re-import, update existing records instead of creating duplicates
- Match by `externalId` if present, otherwise match by title + owner + dates

### 7.4 Error Handling

**Required:**
- Partial import support (some OKRs succeed, others fail)
- Detailed error reporting per row
- Rollback capability for failed imports
- Validation errors before import starts

### 7.5 Performance

**Considerations:**
- Bulk import endpoint (batch processing)
- Transaction boundaries (all-or-nothing vs. partial)
- Progress roll-up optimization (batch recalculate)
- Index on `(source, externalId)` for fast lookups

---

## 8. Recommendations

### 8.1 Phase 1: Database Schema

1. Add import tracking fields to `Objective` and `KeyResult` models
2. Create migration with indexes
3. Add unique constraint on `(source, externalId)` per tenant

### 8.2 Phase 2: API Endpoints

1. Create CSV/Excel parser service
2. Create import service with validation and mapping
3. Add `POST /okr/import` endpoint
4. Add import mode to existing services (skip certain validations)

### 8.3 Phase 3: UI Components

1. Create file upload component
2. Create import preview/mapping UI
3. Create import progress/error display
4. Add import button to OKR page

### 8.4 Phase 4: Testing

1. Unit tests for parser and mapper
2. Integration tests for import endpoint
3. E2E tests for import flow
4. Performance tests for bulk imports

---

## 9. Risk Assessment Summary

| Risk Level | Count | Areas |
|-----------|-------|-------|
| **Low** | 15 | Database schema additions, new UI components, new endpoints |
| **Medium** | 3 | Validation bypass, mapping UI complexity, governance bypass |
| **High** | 1 | Tenant isolation enforcement |

**Overall Risk:** **Medium** - Most changes are additive, but validation and security require careful handling.

---

## Appendix: Key Files Reference

### Database
- Schema: `services/core-api/prisma/schema.prisma`
- Migrations: `services/core-api/prisma/migrations/`

### API Services
- Objective: `services/core-api/src/modules/okr/objective.service.ts`
- KeyResult: `services/core-api/src/modules/okr/key-result.service.ts`
- Progress: `services/core-api/src/modules/okr/okr-progress.service.ts`
- Governance: `services/core-api/src/modules/okr/okr-governance.service.ts`
- Cycle: `services/core-api/src/modules/okr/okr-cycle.service.ts`

### API Controllers
- Objective: `services/core-api/src/modules/okr/objective.controller.ts`
- KeyResult: `services/core-api/src/modules/okr/key-result.controller.ts`
- Overview: `services/core-api/src/modules/okr/okr-overview.controller.ts`

### Frontend
- OKR Page: `apps/web/src/app/dashboard/okrs/page.tsx`
- Creation Drawer: `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx`
- Objective Row: `apps/web/src/components/okr/ObjectiveRow.tsx`
- KeyResult Row: `apps/web/src/components/okr/KeyResultRow.tsx`

