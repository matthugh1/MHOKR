# OKR Screen Change Backlog

**Generated:** 2025-01-XX  
**Priority:** High → Medium → Low (based on user-facing impact and effort)

**Based on:** OKR_SCREEN_FINDINGS_AND_RECOMMENDATIONS.md, OKR_TAXONOMY_DECISIONS.md

---

## OKR-UI-001: Remove Legacy Periods Array

**Title:** Remove hardcoded legacy periods array and consolidate on cycles

**Type:** UI

**Evidence:** `apps/web/src/app/dashboard/okrs/page.tsx:313-318` — hardcoded `legacyPeriods` array with comment "[phase6-polish]: hydrate from backend once periods endpoint exists" (source: OKR_SCREEN_CURRENT_STATE.md §7.5).

**Acceptance Criteria:**
- Cycle selector uses only cycles from `/reports/cycles/active` endpoint
- No references to `legacyPeriods` in codebase
- UI gracefully handles empty cycles array
- Cycle selector works correctly with cycles from API

**Effort:** S (Small) — Remove array, update `CycleSelector` component

**Dependencies:** None

---

## OKR-UI-002: Clarify Status vs Published Badge Labels

**Title:** Ensure Status and Published badges use distinct labels and visual styles

**Type:** UI/Copy

**Evidence:** Two separate concepts (`status` enum and `isPublished` boolean) both shown as badges; users may conflate them (source: OKR_SCREEN_CURRENT_STATE.md §3.1-3.2).

**Acceptance Criteria:**
- Status badge shows progress state (On track / At risk / Blocked / Completed / Cancelled)
- Published badge shows governance state (Published / Draft)
- Badges are visually distinct (different colours/styles)
- Badge labels do not conflate concepts (e.g., "Status: Published" is incorrect)

**Effort:** S (Small) — Review badge component styling and labels

**Dependencies:** None

---

## OKR-UI-003: Remove Planned Cycle ID References

**Title:** Remove `plannedCycleId` references from frontend code

**Type:** UI

**Evidence:** Frontend code references `plannedCycleId` but schema doesn't have this field (source: OKR_SCREEN_CURRENT_STATE.md §7.3, line 63).

**Acceptance Criteria:**
- No references to `plannedCycleId` in codebase
- `mapObjectiveToViewModel()` function works without `plannedCycleId`
- No runtime errors from accessing non-existent field

**Effort:** S (Small) — Remove references, clean up mapping function

**Dependencies:** None

---

## OKR-UI-004: Permission-Gated "New Objective" Button

**Title:** Ensure "New Objective" button uses `canCreateObjective` flag from server

**Type:** UI

**Evidence:** Backend provides `canCreateObjective` flag in `/okr/overview` response envelope (source: OKR_API_CONTRACTS.md §1.2, line 44). Frontend conditionally shows button based on this flag (source: OKR_SCREEN_CURRENT_STATE.md §1.1, line 18).

**Acceptance Criteria:**
- "New Objective" button only shows if `canCreateObjective === true` from backend
- Button hidden for users without `create_okr` permission
- Button hidden for SUPERUSER (read-only)
- Button hidden if cycle is LOCKED/ARCHIVED and user is not admin

**Effort:** S (Small) — Verify current implementation matches acceptance criteria

**Dependencies:** None (already implemented)

---

## OKR-UI-005: Row Actions Menu — Hide Items Instead of Disable

**Title:** Confirm row actions menu hides items instead of disabling them

**Type:** UI

**Evidence:** Edit and Delete buttons are conditional on `canEdit` and `canDelete` flags (source: OKR_SCREEN_CURRENT_STATE.md §1.5, lines 77, 79).

**Acceptance Criteria:**
- Edit button hidden if `canEdit === false`
- Delete button hidden if `canDelete === false`
- Menu dropdown only shows available actions
- No disabled buttons visible to users

**Effort:** S (Small) — Verify current implementation

**Dependencies:** None (already implemented)

---

## OKR-UI-006: Inline KR Preview — Ensure Inherited Visibility Enforced

**Title:** Verify Key Results inherit visibility from parent Objective

**Type:** UI/Backend

**Evidence:** Key Results inherit visibility from parent Objective (source: OKR_API_CONTRACTS.md §7.2). Backend filters KRs by visibility using `OkrVisibilityService.canUserSeeKeyResult()` (source: OKR_API_CONTRACTS.md §1.3.5).

**Acceptance Criteria:**
- KRs not visible if parent Objective is not visible
- Visibility filtering happens server-side (KRs filtered out before reaching UI)
- No KRs visible to users who cannot see parent Objective
- KR visibility field in schema is ignored (always inherits from parent)

**Effort:** S (Small) — Verify current implementation matches acceptance criteria

**Dependencies:** None (already implemented)

---

## OKR-UI-007: Empty State Variants by Role

**Title:** Show role-appropriate empty states (Tenant Admin vs Contributor)

**Type:** UI

**Evidence:** Not currently implemented; empty state shows generic message (source: OKR_SCREEN_CURRENT_STATE.md §1.7).

**Acceptance Criteria:**
- Tenant Admin sees: "No OKRs found. Create your first objective to get started." with "New Objective" button
- Contributor sees: "No OKRs found." (no create button if `canCreateObjective === false`)
- SUPERUSER sees: "No OKRs found." (no create button, read-only)

**Effort:** M (Medium) — Add role-based empty state logic

**Dependencies:** OKR-UI-004 (permission-gated button)

---

## OKR-UI-008: Draft vs Published Copy Updates

**Title:** Ensure copy never conflates Draft/Published with Status

**Type:** Copy

**Evidence:** Status and Published are separate concepts but both shown as badges (source: OKR_SCREEN_CURRENT_STATE.md §3.1-3.2).

**Acceptance Criteria:**
- Status badge labels never say "Published" or "Draft"
- Published badge labels never say "On track" or "At risk"
- All copy distinguishes between progress state (Status) and governance state (Published)
- Error messages and tooltips use correct terminology

**Effort:** S (Small) — Review and update copy throughout UI

**Dependencies:** OKR-UI-002 (badge labels)

---

## OKR-BACKEND-001: Run SQL Probes for Pending Decisions

**Title:** Execute SQL probes to confirm data model assumptions

**Type:** Backend/Migration

**Evidence:** Multiple gaps require SQL probes (source: OKR_GAPS_AND_DECISIONS.md §3).

**Acceptance Criteria:**
- OKR_SQL_PROBES.sql §2 executed: Period vs Cycle distribution
- OKR_SQL_PROBES.sql §3 executed: Visibility level distribution (deprecated values)
- OKR_SQL_PROBES.sql §5 executed: Pillar usage
- OKR_SQL_PROBES.sql §8 executed: KR visibility vs parent objective
- Results documented and decisions made

**Effort:** S (Small) — Run queries, document results

**Dependencies:** None

---

## OKR-SCHEMA-001: Document Period vs Cycle Relationship

**Title:** Document period vs cycle relationship or deprecate period field

**Type:** Schema/Documentation

**Evidence:** Both `objectives.period` (enum) and `objectives.cycleId` (FK) exist; relationship unclear (source: OKR_DATA_MODEL_TRUTH.md §4.1).

**Acceptance Criteria:**
- If period is unused: Deprecate period field, create migration to remove
- If period is used: Document relationship (period = validation rule, cycle = operational period)
- Documentation clarifies period vs cycle relationship
- Period used only for validation, not UI display

**Effort:** M (Medium) — Depends on SQL probe results

**Dependencies:** OKR-BACKEND-001 (SQL probe results)

---

## OKR-SCHEMA-002: Remove Deprecated Visibility Levels

**Title:** Remove deprecated visibility levels from enum or document behaviour

**Type:** Schema/Migration

**Evidence:** `WORKSPACE_ONLY`, `TEAM_ONLY`, `MANAGER_CHAIN`, `EXEC_ONLY` marked as deprecated but still in enum (source: OKR_DATA_MODEL_TRUTH.md §3.2).

**Acceptance Criteria:**
- If deprecated values unused: Remove from enum, create migration to change existing values to `PUBLIC_TENANT`
- If deprecated values used: Document that deprecated values are treated as PUBLIC_TENANT
- Schema updated accordingly
- Type definitions updated

**Effort:** M (Medium) — Depends on SQL probe results

**Dependencies:** OKR-BACKEND-001 (SQL probe results)

---

## OKR-SCHEMA-003: Remove KR Visibility Field (if Vestigial)

**Title:** Remove `key_results.visibilityLevel` field if always inherits from parent

**Type:** Schema/Migration

**Evidence:** `key_results.visibilityLevel` field exists but always inherits from parent objective (source: OKR_DATA_MODEL_TRUTH.md §4.3).

**Acceptance Criteria:**
- If KR visibility always matches parent: Remove field from schema, create migration
- If KR visibility sometimes differs: Investigate why and fix data inconsistency
- Schema updated accordingly
- Visibility service always uses parent objective visibility

**Effort:** M (Medium) — Depends on SQL probe results

**Dependencies:** OKR-BACKEND-001 (SQL probe results)

---

## OKR-UI-009: PENDING — Implement Pillar UI or Remove Schema

**Title:** Implement pillar filter and badge OR remove pillar support

**Type:** UI/Schema

**Evidence:** `strategic_pillars` table exists but UI shows `availablePillars={[]}` (source: OKR_DATA_MODEL_TRUTH.md §4.2).

**Status:** PENDING — requires SQL probe confirmation (OKR_SQL_PROBES.sql §5)

**Acceptance Criteria:**
- If pillars used: Add pillar filter to OKR list, add pillar badge to objective rows, wire up `/reports/pillars` endpoint
- If pillars unused: Remove pillar support (table, FK, endpoints)

**Effort:** L (Large) if implementing UI, M (Medium) if removing schema

**Dependencies:** OKR-BACKEND-001 (SQL probe results)

---

## OKR-UI-010: PENDING — Move "+ Initiative" Under KR Context Only

**Title:** If initiatives anchor to KR, move "+ Initiative" button under KR section only

**Type:** UI

**Evidence:** Initiatives can anchor to Objective OR Key Result (source: OKR_DATA_MODEL_TRUTH.md §4.4).

**Status:** PENDING — requires clarification on intended anchoring behaviour

**Acceptance Criteria:**
- If initiatives should only anchor to KR: Remove "+ Initiative" from objective row, show only under KR section
- If initiatives can anchor to both: Keep current implementation (both sections)

**Effort:** M (Medium) — Depends on decision

**Dependencies:** Decision on initiative anchoring model

---

## Priority Summary

**High Priority (Week 1):**
- OKR-UI-001: Remove Legacy Periods Array (S)
- OKR-UI-002: Clarify Status vs Published Badge Labels (S)
- OKR-UI-003: Remove Planned Cycle ID References (S)
- OKR-BACKEND-001: Run SQL Probes (S)

**Medium Priority (Week 2):**
- OKR-SCHEMA-001: Document Period vs Cycle Relationship (M, depends on probe)
- OKR-SCHEMA-002: Remove Deprecated Visibility Levels (M, depends on probe)
- OKR-SCHEMA-003: Remove KR Visibility Field (M, depends on probe)
- OKR-UI-007: Empty State Variants by Role (M)
- OKR-UI-008: Draft vs Published Copy Updates (S)

**Low Priority (Week 3):**
- OKR-UI-009: Implement Pillar UI or Remove Schema (L/M, depends on probe)
- OKR-UI-010: Move "+ Initiative" Under KR Context (M, depends on decision)

**Already Implemented (Verify Only):**
- OKR-UI-004: Permission-Gated "New Objective" Button (S)
- OKR-UI-005: Row Actions Menu — Hide Items (S)
- OKR-UI-006: Inline KR Preview — Inherited Visibility (S)

---

## Evidence File References

- Frontend OKR Page: `apps/web/src/app/dashboard/okrs/page.tsx`
- Frontend Container: `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx`
- Frontend Objective Row: `apps/web/src/components/okr/ObjectiveRow.tsx`
- Backend Overview Controller: `services/core-api/src/modules/okr/okr-overview.controller.ts`
- Database Schema: `services/core-api/prisma/schema.prisma`

