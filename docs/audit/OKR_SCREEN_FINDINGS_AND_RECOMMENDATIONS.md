# OKR Screen Findings and Recommendations

**Generated:** 2025-01-XX  
**Based on:** OKR_SCREEN_CURRENT_STATE.md, OKR_DATA_MODEL_TRUTH.md, OKR_API_CONTRACTS.md, OKR_GAPS_AND_DECISIONS.md

---

## A. Executive Summary

**What's Working:**
- Server-side pagination and visibility enforcement prevent data leakage (source: OKR_API_CONTRACTS.md §1.3.2-1.3.3)
- Governance locks (publish lock + cycle lock) enforced server-side with permission flags (`canEdit`, `canDelete`, `canCheckIn`) (source: OKR_API_CONTRACTS.md §1.3.4)
- Client-side virtualisation maintains performance with large datasets (source: OKR_SCREEN_CURRENT_STATE.md §6.2)
- RBAC actions (`view_okr`, `create_okr`, `edit_okr`, `delete_okr`) properly enforced via guards (source: OKR_API_CONTRACTS.md §5)

**What's Confusing:**
- **Cycles vs Periods**: Both `objectives.period` (enum) and `objectives.cycleId` (FK) exist; period not displayed in UI (source: OKR_DATA_MODEL_TRUTH.md §4.1)
- **Status vs Published**: Two separate concepts (`status` enum and `isPublished` boolean) both shown as badges; users may conflate them (source: OKR_SCREEN_CURRENT_STATE.md §3.1-3.2)
- **Pillars**: Table exists but UI shows `availablePillars={[]}`; unclear if pillars are used (source: OKR_DATA_MODEL_TRUTH.md §4.2)
- **Legacy Periods**: Hardcoded array in frontend; comment suggests backend endpoint should exist (source: OKR_SCREEN_CURRENT_STATE.md §7.5)
- **KR Visibility**: Field exists but always inherits from parent objective (source: OKR_DATA_MODEL_TRUTH.md §4.3)

**Top 5 Fixes with Expected Impact:**
1. Remove legacy periods array and consolidate on cycles (low effort, high clarity)
2. Clarify Status vs Published badges with distinct labels (low effort, high UX)
3. Remove `plannedCycleId` references from frontend (low effort, removes dead code)
4. Document period vs cycle relationship or deprecate period field (medium effort, reduces confusion)
5. Verify pillar usage via SQL probe; implement UI or remove schema (medium effort, completes feature or removes technical debt)

---

## B. Taxonomy & State

### B.1 Cycle vs Period

**Evidence:**
- `objectives.period` exists as enum: `MONTHLY | QUARTERLY | ANNUAL | CUSTOM` (source: OKR_DATA_MODEL_TRUTH.md §3.4)
- `objectives.cycleId` exists as FK → `cycles.id` (source: OKR_DATA_MODEL_TRUTH.md §1.1, line 22)
- Period is NOT displayed in OKR list UI (source: OKR_SCREEN_CURRENT_STATE.md §3.4)
- Period is used for date range validation in objective creation/update (source: OKR_GAPS_AND_DECISIONS.md §1.1)
- Cycle is displayed prominently in UI (badge, selector, banner) (source: OKR_SCREEN_CURRENT_STATE.md §1.2, §1.3)

**Payload Sources:**
- Cycle: `objective.cycle` object in `/okr/overview` response (source: OKR_API_CONTRACTS.md §1.2, lines 59-63)
- Period: NOT in `/okr/overview` response (source: OKR_API_CONTRACTS.md §1.2)

**Conclusion:** Period is a validation concept (date range constraints), not a UI concept. Cycle is the operational planning period. **PENDING**: Run SQL probe from OKR_SQL_PROBES.sql §2 to confirm period/cycle distribution.

---

### B.2 Status vs Publish State

**Status:**
- Source: `objectives.status` column, enum `OKRStatus` = `ON_TRACK | AT_RISK | OFF_TRACK | COMPLETED | CANCELLED` (source: OKR_DATA_MODEL_TRUTH.md §3.1)
- Default: `ON_TRACK` (source: OKR_DATA_MODEL_TRUTH.md §3.1)
- Response field: `objective.status` in `/okr/overview` (source: OKR_API_CONTRACTS.md §1.2, line 48)
- UI display: Status badge chips (filter header) and objective row status badge (source: OKR_SCREEN_CURRENT_STATE.md §1.3, §1.5)

**Publish State:**
- Source: `objectives.isPublished` column, Boolean (default: `false`) (source: OKR_DATA_MODEL_TRUTH.md §3.8)
- Response field: `objective.isPublished` in `/okr/overview` (source: OKR_API_CONTRACTS.md §1.2, line 51)
- UI display: "Published" / "Draft" badge in objective row (source: OKR_SCREEN_CURRENT_STATE.md §1.5, line 66)
- Governance: When `isPublished === true`, only TENANT_ADMIN/TENANT_OWNER can edit/delete (source: OKR_SCREEN_CURRENT_STATE.md §5.1)

**Badge Usage:**
- Status badge: Shows progress state (On track / At risk / Blocked / Completed / Cancelled) (source: OKR_SCREEN_CURRENT_STATE.md §1.5, line 65)
- Publication badge: Shows governance state (Published / Draft) (source: OKR_SCREEN_CURRENT_STATE.md §1.5, line 66)
- Both badges appear side-by-side in objective row (source: `apps/web/src/components/okr/ObjectiveRow.tsx:280-289`)

**Conclusion:** Status = progress state; Publish State = governance state. These are separate concepts and should remain distinct in UI.

---

### B.3 Visibility Model

**Enum Values:**
- `PUBLIC_TENANT` (default), `PRIVATE`, `WORKSPACE_ONLY` (deprecated), `TEAM_ONLY` (deprecated), `MANAGER_CHAIN` (deprecated), `EXEC_ONLY` (deprecated) (source: OKR_DATA_MODEL_TRUTH.md §3.2)

**Whitelist Mechanism:**
- `organizations.execOnlyWhitelist` (JSONB) - Array of user IDs (source: OKR_DATA_MODEL_TRUTH.md §1.8)
- `organizations.metadata` (JSONB) - May contain whitelist data (source: OKR_DATA_MODEL_TRUTH.md §1.8)
- No separate `visibility_whitelists` table (source: OKR_DATA_MODEL_TRUTH.md §1.8)

**Inheritance to KRs:**
- Key Results inherit visibility from parent Objective (source: OKR_API_CONTRACTS.md §7.2)
- Backend: `OkrVisibilityService.canUserSeeKeyResult()` calls `canUserSeeObjective()` with parent objective (source: OKR_API_CONTRACTS.md §7.2)
- Frontend: `useTenantPermissions.canSeeKeyResult()` checks parent objective visibility (source: OKR_SCREEN_CURRENT_STATE.md §7.6)
- **Note:** `key_results.visibilityLevel` field exists but is ignored (source: OKR_DATA_MODEL_TRUTH.md §4.3)

**Enforcement:**
- Server-side: `OkrVisibilityService.canUserSeeObjective()` filters objectives before pagination (source: OKR_API_CONTRACTS.md §7.1)
- Applied in: `/okr/overview` endpoint at lines 128-163 (source: OKR_API_CONTRACTS.md §7.1)
- Visibility NOT displayed as badge in UI; enforced by filtering (source: OKR_SCREEN_CURRENT_STATE.md §3.5)

**Conclusion:** Visibility is server-side enforced; KRs always inherit from parent objective. Deprecated enum values need migration probe (see OKR_SQL_PROBES.sql §3).

---

### B.4 Pillars/Alignment

**Pillars Table:**
- `strategic_pillars` table EXISTS (source: OKR_DATA_MODEL_TRUTH.md §1.6)
- Columns: `id`, `organizationId`, `name`, `description`, `color` (source: OKR_DATA_MODEL_TRUTH.md §1.6)
- `objectives.pillarId` FK exists → `strategic_pillars.id` (source: OKR_DATA_MODEL_TRUTH.md §1.1, line 21)

**UI Usage:**
- Frontend shows `availablePillars={[]}` (empty array) in modals (source: OKR_SCREEN_CURRENT_STATE.md §7.2)
- No pillar filter or display in OKR list UI (source: OKR_SCREEN_CURRENT_STATE.md §7.2)
- Reporting endpoint exists: `GET /reports/pillars` (source: OKR_API_CONTRACTS.md §2, line 137-143)

**Conclusion:** Pillars table exists but not used in UI. **PENDING**: Run SQL probe from OKR_SQL_PROBES.sql §5 to check pillar usage.

---

### B.5 Initiatives Anchoring

**Schema:**
- `initiatives.objectiveId` (nullable) - FK → `objectives.id` (source: OKR_DATA_MODEL_TRUTH.md §1.4, line 142)
- `initiatives.keyResultId` (nullable) - FK → `key_results.id` (source: OKR_DATA_MODEL_TRUTH.md §1.4, line 141)
- Both can be set simultaneously (source: OKR_DATA_MODEL_TRUTH.md §4.4)

**UI Behaviour:**
- `NewInitiativeModal` accepts either `objectiveId` OR `keyResultId` (source: OKR_DATA_MODEL_TRUTH.md §4.4)
- UI shows initiatives under both Objective (direct) and Key Result (nested) sections (source: OKR_SCREEN_CURRENT_STATE.md §1.6)

**Conclusion:** Initiatives can anchor to Objective OR Key Result (or both). UI enforces single parent at creation; database allows both for flexibility.

---

## C. RBAC/Governance

### C.1 Actions Required

**Create Objective:**
- Action: `create_okr` (source: OKR_API_CONTRACTS.md §5.1)
- Enforced: `/okr/overview` endpoint computes `canCreateObjective` flag (source: OKR_API_CONTRACTS.md §1.3.4)
- Location: `services/core-api/src/modules/okr/okr-overview.controller.ts:377-467` (source: OKR_API_CONTRACTS.md §1.3.4)
- Additional checks: Cycle lock check if `cycleId` provided; SUPERUSER read-only (source: OKR_API_CONTRACTS.md §1.3.4)

**Edit Objective:**
- Action: `edit_okr` (source: OKR_API_CONTRACTS.md §5.1)
- Enforced: `/okr/overview` endpoint computes `canEdit` flag per objective (source: OKR_API_CONTRACTS.md §1.3.4)
- Location: `services/core-api/src/modules/okr/okr-overview.controller.ts:238-266` (source: OKR_API_CONTRACTS.md §1.3.4)
- Additional checks: Governance locks (publish lock + cycle lock) (source: OKR_API_CONTRACTS.md §1.3.4)

**Publish Objective:**
- **NOT IMPLEMENTED**: No separate `publish_okr` action
- Publishing is controlled by `isPublished` boolean flag (source: OKR_DATA_MODEL_TRUTH.md §3.8)
- Governance: Once published, only TENANT_ADMIN/TENANT_OWNER can edit (source: OKR_SCREEN_CURRENT_STATE.md §5.1)

**SUPERUSER Behaviour:**
- SUPERUSER (`user.organizationId === null`) is read-only (source: OKR_API_CONTRACTS.md §6.3)
- Cannot edit published OKRs (source: OKR_API_CONTRACTS.md §6.3)
- Cannot edit OKRs in locked cycles (source: OKR_API_CONTRACTS.md §6.3)
- Cannot create OKRs (source: OKR_API_CONTRACTS.md §6.3)
- Enforcement: Multiple checks for `actingUser.organizationId === null` (source: OKR_API_CONTRACTS.md §6.3)

---

### C.2 Cycle/Publish Locks

**Publish Lock:**
- Check: `OkrGovernanceService.checkPublishLockForObjective()` (source: OKR_API_CONTRACTS.md §6.1)
- Location: `services/core-api/src/modules/okr/okr-governance.service.ts:40-66` (source: OKR_API_CONTRACTS.md §6.1)
- Condition: `objective.isPublished === true` (source: OKR_API_CONTRACTS.md §6.1)
- Effect: Only TENANT_ADMIN/TENANT_OWNER can edit/delete (source: OKR_API_CONTRACTS.md §6.1)
- UI Mirror: `useTenantPermissions.canEditObjective()` checks publish lock (source: OKR_SCREEN_CURRENT_STATE.md §4.2)
- UI Display: Shows `PublishLockWarningModal` when user tries to edit locked objective (source: OKR_SCREEN_CURRENT_STATE.md §5.1)

**Cycle Lock:**
- Check: `OkrGovernanceService.checkCycleLockForObjective()` (source: OKR_API_CONTRACTS.md §6.2)
- Location: `services/core-api/src/modules/okr/okr-governance.service.ts:127-182` (source: OKR_API_CONTRACTS.md §6.2)
- Condition: `cycle.status === 'LOCKED'` or `cycle.status === 'ARCHIVED'` (source: OKR_API_CONTRACTS.md §6.2)
- Effect: Only TENANT_ADMIN/TENANT_OWNER can edit/delete (source: OKR_API_CONTRACTS.md §6.2)
- UI Mirror: `useTenantPermissions.canEditObjective()` checks cycle lock (source: OKR_SCREEN_CURRENT_STATE.md §4.2)
- UI Display: Shows cycle status badge (LOCKED) and warning message in Active Cycle Banner (source: OKR_SCREEN_CURRENT_STATE.md §5.2)

**Conclusion:** Both locks are enforced server-side and mirrored in UI for UX (hiding buttons). Backend is source of truth.

---

## D. API Contracts

### D.1 GET /okr/overview Response Fields Used by OKR Page

**Envelope-Level Fields:**
- `page`, `pageSize`, `totalCount` - Used for pagination display (source: OKR_SCREEN_CURRENT_STATE.md §1.7)
- `canCreateObjective` - Used to conditionally show "New Objective" button (source: OKR_SCREEN_CURRENT_STATE.md §1.1, line 18)

**Per-Objective Fields:**
- `objectiveId`, `title`, `status`, `progress` - Display in objective row (source: OKR_SCREEN_CURRENT_STATE.md §1.5)
- `isPublished` - Display as "Published" / "Draft" badge (source: OKR_SCREEN_CURRENT_STATE.md §1.5, line 66)
- `visibilityLevel` - NOT displayed; used for server-side filtering (source: OKR_SCREEN_CURRENT_STATE.md §3.5)
- `cycleStatus` - Used to determine cycle badge display (source: OKR_SCREEN_CURRENT_STATE.md §1.5, line 67)
- `cycle` - Object with `id`, `name`, `status`; used for cycle badge (source: OKR_API_CONTRACTS.md §1.2, lines 59-63)
- `owner` - Object with `id`, `name`, `email`; displayed as owner chip (source: OKR_SCREEN_CURRENT_STATE.md §1.5, line 69)
- `canEdit`, `canDelete` - Used to conditionally show edit/delete buttons (source: OKR_SCREEN_CURRENT_STATE.md §1.5, lines 77, 79)

**Per-Key Result Fields:**
- `keyResultId`, `title`, `status`, `progress` - Display in expanded KR section (source: OKR_SCREEN_CURRENT_STATE.md §1.6)
- `startValue`, `targetValue`, `currentValue`, `unit` - Used for progress label (source: OKR_SCREEN_CURRENT_STATE.md §1.6, line 95)
- `canCheckIn` - Used to conditionally show "Check in" button (source: OKR_SCREEN_CURRENT_STATE.md §1.6, line 96)
- `initiatives` - Array of initiatives linked to KR (source: OKR_SCREEN_CURRENT_STATE.md §1.6)

**Per-Initiative Fields:**
- `id`, `title`, `status`, `dueDate` - Display in initiatives section (source: OKR_SCREEN_CURRENT_STATE.md §1.6)
- `keyResultId` - Used to show "supports: [KR title]" indicator (source: OKR_SCREEN_CURRENT_STATE.md §1.6, line 105)

**Response Source:** `services/core-api/src/modules/okr/okr-overview.controller.ts:471-491` (source: OKR_API_CONTRACTS.md §1.2)

---

### D.2 Reporting Endpoints Used by OKR Screen

**GET /reports/cycles/active:**
- Purpose: Load active cycles for cycle selector and banner (source: OKR_SCREEN_CURRENT_STATE.md §2.2)
- Called from: `apps/web/src/app/dashboard/okrs/page.tsx:200` (source: OKR_SCREEN_CURRENT_STATE.md §2.2)
- Visibility filtering: Server-side (uses `req.user.organizationId`) (source: OKR_API_CONTRACTS.md §2.1)

**GET /reports/check-ins/overdue:**
- Purpose: Load overdue check-ins for KR overdue badges (source: OKR_SCREEN_CURRENT_STATE.md §2.2)
- Called from: `apps/web/src/app/dashboard/okrs/page.tsx:222` (source: OKR_SCREEN_CURRENT_STATE.md §2.2)
- Visibility filtering: Server-side (uses `req.user.organizationId` and `req.user.id`) (source: OKR_API_CONTRACTS.md §3.1)

**Conclusion:** Reporting endpoints use server-side visibility filtering via user context.

---

## E. Data Model Risks

### E.1 Contradictions

**Period vs Cycle:**
- Both `objectives.period` (enum) and `objectives.cycleId` (FK) exist (source: OKR_DATA_MODEL_TRUTH.md §4.1)
- Period not displayed in UI; cycle is displayed (source: OKR_DATA_MODEL_TRUTH.md §4.1)
- **Risk:** Confusion about which concept to use; period may be vestigial

**KR Visibility Inheritance:**
- `key_results.visibilityLevel` field exists but always inherits from parent objective (source: OKR_DATA_MODEL_TRUTH.md §4.3)
- **Risk:** Unused field in schema; potential for future inconsistency if KR visibility becomes independent

**Objective-KeyResult Many-to-Many:**
- Schema allows many-to-many via junction table (source: OKR_DATA_MODEL_TRUTH.md §4.5)
- UI assumes one-to-many (source: OKR_DATA_MODEL_TRUTH.md §4.5)
- **Risk:** UI may break if shared KRs are created; or schema is over-engineered

---

### E.2 Vestigial Fields

**Planned Cycle ID:**
- Frontend references `plannedCycleId` but schema doesn't have this field (source: OKR_SCREEN_CURRENT_STATE.md §7.3)
- **Risk:** Dead code; potential runtime errors if field is accessed

**KR Visibility Level:**
- Field exists but is ignored (always inherits from parent) (source: OKR_DATA_MODEL_TRUTH.md §4.3)
- **Risk:** Unused field; potential for future inconsistency

---

### E.3 Enum Overlaps or Ambiguous States

**Visibility Level Deprecation:**
- `WORKSPACE_ONLY`, `TEAM_ONLY`, `MANAGER_CHAIN`, `EXEC_ONLY` marked as deprecated (source: OKR_DATA_MODEL_TRUTH.md §3.2)
- Comment says: "treated as PUBLIC_TENANT" (source: OKR_DATA_MODEL_TRUTH.md §3.2)
- **Risk:** Confusing enum; potential inconsistencies if deprecated values are still in use

**Conclusion:** Multiple contradictions and vestigial fields identified. See recommendations section for resolution paths.

---

## F. Recommendations

### F.1 Remove Legacy Periods Array

**Problem:** Frontend has hardcoded `legacyPeriods` array instead of using cycles from API (source: OKR_SCREEN_CURRENT_STATE.md §7.5, lines 313-318).

**Option A:** Remove legacy periods array, use only cycles
- Pros: Single source of truth, cleaner code
- Cons: May break if cycles endpoint fails
- Migration: Remove `legacyPeriods` array, update `CycleSelector` to use only cycles

**Option B:** Keep as fallback
- Pros: Resilience if cycles endpoint fails
- Cons: Hardcoded data, technical debt

**Recommended Path:** Option A. Cycles are the operational concept; legacy periods are vestigial.

**Acceptance Checks:**
- Cycle selector works with cycles from API only
- No references to `legacyPeriods` in codebase
- UI gracefully handles empty cycles array

---

### F.2 Clarify Status vs Published Badges

**Problem:** Two separate concepts (`status` enum and `isPublished` boolean) both shown as badges; users may conflate them (source: OKR_SCREEN_CURRENT_STATE.md §3.1-3.2).

**Option A:** Keep separate badges with clearer labels
- Pros: Preserves information, clear distinction
- Cons: More badges in UI
- Implementation: Rename "Published" badge to "Published" (no change) and ensure status badge label is distinct (e.g., "On track" not "Status: On track")

**Option B:** Combine into single badge
- Pros: Fewer badges
- Cons: Loses information, conflates concepts

**Recommended Path:** Option A. Status and publish state are semantically different (progress vs governance).

**Acceptance Checks:**
- Status badge shows progress state (On track / At risk / Blocked / Completed / Cancelled)
- Published badge shows governance state (Published / Draft)
- Badges are visually distinct (different colours/styles)

---

### F.3 Remove Planned Cycle ID References

**Problem:** Frontend code references `plannedCycleId` but schema doesn't have this field (source: OKR_SCREEN_CURRENT_STATE.md §7.3, line 63).

**Option A:** Remove from frontend
- Pros: Removes dead code, no confusion
- Cons: Requires frontend changes
- Implementation: Remove `plannedCycleId` references from `mapObjectiveToViewModel()`

**Option B:** Add to schema
- Pros: Implements planned feature
- Cons: Requires full-stack work, may not be needed

**Recommended Path:** Option A. Field doesn't exist in schema; remove dead code.

**Acceptance Checks:**
- No references to `plannedCycleId` in codebase
- `mapObjectiveToViewModel()` function works without `plannedCycleId`

---

### F.4 Document Period vs Cycle Relationship

**Problem:** Both `objectives.period` (enum) and `objectives.cycleId` (FK) exist; relationship unclear (source: OKR_DATA_MODEL_TRUTH.md §4.1).

**Option A:** Document relationship
- Pros: No migration, preserves flexibility
- Cons: Still two concepts to understand
- Implementation: Document that period = validation rule (date range constraints), cycle = operational planning period

**Option B:** Deprecate period field
- Pros: Clearer model, removes confusion
- Cons: Requires migration, may break existing code

**Recommended Path:** Option A (pending SQL probe). Run OKR_SQL_PROBES.sql §2 to check period/cycle distribution. If period is unused, proceed to Option B.

**Acceptance Checks:**
- Documentation clarifies period vs cycle relationship
- Period used only for validation, not UI display
- Cycle used for UI filtering and display

---

### F.5 Verify Pillar Usage and Decide

**Problem:** `strategic_pillars` table exists but UI shows `availablePillars={[]}`; unclear if pillars are used (source: OKR_DATA_MODEL_TRUTH.md §4.2).

**Option A:** Implement pillar UI
- Pros: Completes feature, uses existing schema
- Cons: Requires frontend work

**Option B:** Remove pillar support
- Pros: Cleaner schema, removes confusion
- Cons: Breaking change, may lose data

**Recommended Path:** PENDING SQL probe. Run OKR_SQL_PROBES.sql §5 to check pillar usage. If pillars are unused, proceed to Option B. If used, proceed to Option A.

**Acceptance Checks:**
- SQL probe confirms pillar usage or lack thereof
- If unused: Remove pillar support (table, FK, endpoints)
- If used: Implement pillar filter and badge in UI

---

### F.6 Remove Deprecated Visibility Levels

**Problem:** `WORKSPACE_ONLY`, `TEAM_ONLY`, `MANAGER_CHAIN`, `EXEC_ONLY` marked as deprecated but still in enum (source: OKR_DATA_MODEL_TRUTH.md §3.2).

**Option A:** Remove from enum
- Pros: Cleaner schema, removes confusion
- Cons: Requires migration, may break existing code
- Implementation: Create migration to change existing values to `PUBLIC_TENANT`, remove deprecated values from enum

**Option B:** Document behaviour
- Pros: No migration, preserves backward compatibility
- Cons: Still confusing, technical debt

**Recommended Path:** PENDING SQL probe. Run OKR_SQL_PROBES.sql §3 to check deprecated visibility level usage. If unused, proceed to Option A. If used, proceed to Option B.

**Acceptance Checks:**
- SQL probe confirms deprecated visibility level usage
- If unused: Remove deprecated values from enum
- If used: Document that deprecated values are treated as PUBLIC_TENANT

---

### F.7 Remove KR Visibility Field (if Vestigial)

**Problem:** `key_results.visibilityLevel` field exists but always inherits from parent objective (source: OKR_DATA_MODEL_TRUTH.md §4.3).

**Option A:** Remove KR visibility field
- Pros: Cleaner schema, removes confusion
- Cons: Requires migration, loses flexibility
- Implementation: Drop `key_results.visibilityLevel` column, always use parent objective visibility

**Option B:** Keep field for future use
- Pros: Preserves flexibility
- Cons: Unused field, confusing schema

**Recommended Path:** PENDING SQL probe. Run OKR_SQL_PROBES.sql §8 to check if any KRs have different visibility than parent. If none, proceed to Option A. If some, investigate why.

**Acceptance Checks:**
- SQL probe confirms KR visibility matches parent objective visibility
- If matched: Remove KR visibility field from schema
- If mismatched: Investigate why and fix data inconsistency

---

## G. Delivery Outline (2–3 Weeks)

### Week 1: Low Effort Fixes

**Day 1-2:**
- Remove legacy periods array (F.1)
- Remove `plannedCycleId` references (F.3)
- Clarify Status vs Published badges (F.2)

**Day 3-4:**
- Run SQL probes (Period vs Cycle, Visibility Distribution, KR Visibility, Pillar Usage)
- Analyse probe results

**Day 5:**
- Document period vs cycle relationship (F.4) or deprecate period field (pending probe)

---

### Week 2: Medium Effort Fixes

**Day 1-2:**
- Remove deprecated visibility levels (F.6) or document behaviour (pending probe)
- Remove KR visibility field (F.7) or investigate mismatches (pending probe)

**Day 3-4:**
- Verify pillar usage and decide (F.5)
  - If unused: Remove pillar support
  - If used: Implement pillar UI (moves to Week 3)

**Day 5:**
- Code review and testing

---

### Week 3: High Effort (if needed)

**Day 1-3:**
- Implement pillar UI (if probe confirms usage)
- OR: Remove pillar support (if probe confirms unused)

**Day 4-5:**
- Final testing and validation
- Documentation updates

---

**Total Estimated Effort:** 2-3 weeks (depending on probe results and pillar decision)

