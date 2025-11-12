# OKR Taxonomy Decisions

**Generated:** 2025-01-XX  
**Purpose:** Canonical definitions for OKR concepts based on audit evidence

**Based on:** OKR_SCREEN_CURRENT_STATE.md, OKR_DATA_MODEL_TRUTH.md, OKR_API_CONTRACTS.md

---

## Cycle (Canonical)

**Definition:** Operational planning period representing OKR execution windows (e.g., "Q1 2025", "Q2 2025").

**Source:** `objectives.cycleId` FK → `cycles.id` (source: OKR_DATA_MODEL_TRUTH.md §1.1, line 22).

**Schema:** `cycles` table with `id`, `organizationId`, `name`, `status`, `startDate`, `endDate` (source: OKR_DATA_MODEL_TRUTH.md §1.5).

**Status Values:** `DRAFT | ACTIVE | LOCKED | ARCHIVED` (source: OKR_DATA_MODEL_TRUTH.md §3.3).

**UI Display:** Cycle badge in objective row (e.g., "Q4 2025"), cycle selector dropdown, Active Cycle Banner (source: OKR_SCREEN_CURRENT_STATE.md §1.2, §1.3, §1.5).

**Governance:** When cycle status is `LOCKED` or `ARCHIVED`, only TENANT_ADMIN/TENANT_OWNER can edit/delete objectives in that cycle (source: OKR_API_CONTRACTS.md §6.2).

**If/Then Rules:**
- If cycle status is `LOCKED` or `ARCHIVED`: Show lock warning in Active Cycle Banner; hide edit/delete buttons for non-admins (source: OKR_SCREEN_CURRENT_STATE.md §5.2).
- If cycle status is `ACTIVE`: Show "Active" chip next to cycle badge (source: OKR_SCREEN_CURRENT_STATE.md §1.5, line 68).
- If cycle status is `DRAFT`: Show cycle name with "(draft)" suffix (source: OKR_SCREEN_CURRENT_STATE.md §3.3).

**Copy Guidelines:** Use cycle name as-is (e.g., "Q4 2025"); do not call it a "Period" or "Quarter" unless cycle name explicitly contains those terms.

---

## Period (PENDING — needs confirmation)

**Status:** PENDING — requires SQL probe to confirm usage.

**Probe Required:** OKR_SQL_PROBES.sql §2 — check period vs cycle distribution.

**Expected Confirming Output:** Query showing objectives with both period and cycle, or confirming period is unused.

**Current Evidence:**
- `objectives.period` exists as enum: `MONTHLY | QUARTERLY | ANNUAL | CUSTOM` (source: OKR_DATA_MODEL_TRUTH.md §3.4).
- Period is NOT displayed in OKR list UI (source: OKR_SCREEN_CURRENT_STATE.md §3.4).
- Period is used for date range validation in objective creation/update (source: OKR_GAPS_AND_DECISIONS.md §1.1).

**Tentative Definition:** Validation rule for date range constraints (e.g., quarterly should be ~90 days). Not a UI concept.

**Decision:** After probe, either:
- **Keep:** Document as validation-only concept, not displayed in UI.
- **Remove:** Deprecate period field if unused.

---

## Status (Progress State)

**Definition:** Progress state of an Objective or Key Result.

**Source:** `objectives.status` column, enum `OKRStatus` (source: OKR_DATA_MODEL_TRUTH.md §3.1).

**Enum Values:** `ON_TRACK | AT_RISK | OFF_TRACK | COMPLETED | CANCELLED` (source: OKR_DATA_MODEL_TRUTH.md §3.1).

**Default:** `ON_TRACK` (source: OKR_DATA_MODEL_TRUTH.md §3.1).

**UI Display:** Status badge chips (filter header) and objective row status badge (source: OKR_SCREEN_CURRENT_STATE.md §1.3, §1.5).

**Badge Labels:**
- `ON_TRACK` → "On track" (tone: good)
- `AT_RISK` → "At risk" (tone: warn)
- `BLOCKED` → "Blocked" (tone: bad)
- `COMPLETED` → "Completed" (tone: neutral)
- `CANCELLED` → "Cancelled" (tone: neutral)

**Source:** `apps/web/src/components/okr/ObjectiveRow.tsx:68-83` (source: OKR_SCREEN_CURRENT_STATE.md §1.5).

**Copy Guidelines:** Always refer to status as "Status" or "Progress Status". Never call it "Published" or "Draft" (those are separate concepts).

---

## Publish State (Governance State)

**Definition:** Governance state indicating whether an OKR is published (locked for editing) or draft (freely editable).

**Source:** `objectives.isPublished` column, Boolean (default: `false`) (source: OKR_DATA_MODEL_TRUTH.md §3.8).

**Values:** `true` (Published) or `false` (Draft) (source: OKR_DATA_MODEL_TRUTH.md §3.8).

**UI Display:** "Published" / "Draft" badge in objective row (source: OKR_SCREEN_CURRENT_STATE.md §1.5, line 66).

**Governance:** When `isPublished === true`, only TENANT_ADMIN/TENANT_OWNER can edit/delete (source: OKR_SCREEN_CURRENT_STATE.md §5.1).

**Copy Guidelines:** Use "Published" or "Draft" labels. Never call it "Status" (status is separate). Use "Published" badge (tone: neutral) and "Draft" badge (tone: warn) (source: `apps/web/src/components/okr/ObjectiveRow.tsx:287-289`).

**If/Then Rules:**
- If `isPublished === true` and user is not admin: Show `PublishLockWarningModal` when user tries to edit; hide edit/delete buttons (source: OKR_SCREEN_CURRENT_STATE.md §5.1).
- If `isPublished === false`: Allow normal editing (subject to RBAC and cycle lock).

---

## Visibility (Access Control)

**Definition:** Access control level determining who can view an Objective or Key Result.

**Source:** `objectives.visibilityLevel` column, enum `VisibilityLevel` (source: OKR_DATA_MODEL_TRUTH.md §3.2).

**Active Enum Values:**
- `PUBLIC_TENANT` (default) — Visible to everyone in tenant (source: OKR_DATA_MODEL_TRUTH.md §3.2).
- `PRIVATE` — Only owner + explicit whitelist (source: OKR_DATA_MODEL_TRUTH.md §3.2).

**Deprecated Enum Values:** `WORKSPACE_ONLY`, `TEAM_ONLY`, `MANAGER_CHAIN`, `EXEC_ONLY` — treated as `PUBLIC_TENANT` (source: OKR_DATA_MODEL_TRUTH.md §3.2).

**Status:** PENDING — requires SQL probe to confirm deprecated values usage (OKR_SQL_PROBES.sql §3).

**Whitelist Mechanism:**
- `organizations.execOnlyWhitelist` (JSONB) — Array of user IDs (source: OKR_DATA_MODEL_TRUTH.md §1.8).
- `organizations.metadata` (JSONB) — May contain whitelist data (source: OKR_DATA_MODEL_TRUTH.md §1.8).

**Inheritance:** Key Results inherit visibility from parent Objective (source: OKR_API_CONTRACTS.md §7.2).

**Enforcement:** Server-side filtering via `OkrVisibilityService.canUserSeeObjective()` (source: OKR_API_CONTRACTS.md §7.1).

**UI Display:** NOT displayed as badge; enforced by filtering (visible objectives are filtered out before reaching UI) (source: OKR_SCREEN_CURRENT_STATE.md §3.5).

**Copy Guidelines:** Do not display visibility level as badge in UI. Visibility is enforced server-side; users see only what they're allowed to see.

**If/Then Rules:**
- If visibility is `PRIVATE` and user is not owner/admin/whitelisted: Objective is filtered out server-side (source: OKR_API_CONTRACTS.md §7.1).
- If visibility is `PUBLIC_TENANT` or deprecated values: Objective is visible to all users in tenant (source: OKR_API_CONTRACTS.md §7.1).

---

## Alignment (Strategic Pillar)

**Status:** PENDING — requires SQL probe to confirm pillar usage.

**Probe Required:** OKR_SQL_PROBES.sql §5 — check pillar usage.

**Expected Confirming Output:** Count of objectives with/without pillars, and list of pillars in use.

**Current Evidence:**
- `strategic_pillars` table EXISTS (source: OKR_DATA_MODEL_TRUTH.md §1.6).
- `objectives.pillarId` FK exists → `strategic_pillars.id` (source: OKR_DATA_MODEL_TRUTH.md §1.1, line 21).
- Frontend shows `availablePillars={[]}` (empty array) in modals (source: OKR_SCREEN_CURRENT_STATE.md §7.2).
- No pillar filter or display in OKR list UI (source: OKR_SCREEN_CURRENT_STATE.md §7.2).

**Alternative: Parent Objective**

**Definition:** Hierarchical alignment via `objectives.parentId` FK → `objectives.id` (self-referential) (source: OKR_DATA_MODEL_TRUTH.md §2.1).

**Purpose:** Cascading objectives (parent-child relationships) (source: OKR_DATA_MODEL_TRUTH.md §2.1).

**UI Display:** NOT currently displayed in OKR list UI (source: OKR_SCREEN_CURRENT_STATE.md — not mentioned in UI inventory).

**Decision:** After probe, either:
- **If pillars used:** Implement pillar badge and filter in UI.
- **If pillars unused:** Remove pillar support; use Parent Objective for alignment (if needed).

---

## Initiatives Anchoring

**Definition:** Initiatives can anchor to either an Objective OR a Key Result (or both).

**Source:** `initiatives.objectiveId` (nullable) and `initiatives.keyResultId` (nullable) (source: OKR_DATA_MODEL_TRUTH.md §1.4, lines 141-142).

**Schema:** Both can be set simultaneously (source: OKR_DATA_MODEL_TRUTH.md §4.4).

**UI Behaviour:** `NewInitiativeModal` accepts either `objectiveId` OR `keyResultId` (source: OKR_DATA_MODEL_TRUTH.md §4.4).

**UI Display:** Initiatives shown under both Objective (direct) and Key Result (nested) sections (source: OKR_SCREEN_CURRENT_STATE.md §1.6).

**Copy Guidelines:** When displaying initiative, show "supports: [KR title]" indicator if `keyResultId` is set (source: OKR_SCREEN_CURRENT_STATE.md §1.6, line 105).

**If/Then Rules:**
- If initiative has `keyResultId`: Show under KR section with "supports: [KR title]" indicator.
- If initiative has `objectiveId` only: Show under Objective section directly.
- If initiative has both: Show under both sections (current behaviour).

**Decision:** Current implementation is correct. Database allows both for flexibility; UI enforces single parent at creation time.

---

## Copy Guidelines Summary

**Status Badge:**
- Use: "On track", "At risk", "Blocked", "Completed", "Cancelled"
- Do not use: "Status: On track" (redundant), "Published" (wrong concept)

**Published Badge:**
- Use: "Published" or "Draft"
- Do not use: "Status: Published" (wrong concept), "On track" (wrong concept)

**Cycle Badge:**
- Use: Cycle name as-is (e.g., "Q4 2025")
- Do not use: "Period: Q4 2025" (period is separate concept), "Quarter 4" (use cycle name)

**Visibility:**
- Do not display as badge (enforced server-side)
- Do not mention in UI (users see only what they're allowed to see)

**Initiative:**
- Use: "supports: [KR title]" when linked to KR
- Do not use: "belongs to" (initiatives can belong to both Objective and KR)

---

## Evidence File References

- Schema: `services/core-api/prisma/schema.prisma`
- Frontend Objective Row: `apps/web/src/components/okr/ObjectiveRow.tsx`
- Frontend OKR Page: `apps/web/src/app/dashboard/okrs/page.tsx`
- Backend Visibility Service: `services/core-api/src/modules/okr/okr-visibility.service.ts`
- Backend Governance Service: `services/core-api/src/modules/okr/okr-governance.service.ts`

