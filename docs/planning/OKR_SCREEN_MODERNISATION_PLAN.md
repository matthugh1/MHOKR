# OKR Screen Modernisation Plan

**Generated:** 2025-01-XX  
**Owners:** Principal Product + Engineering  
**Timeline:** W4.M1 → W5.M3 (4 phases, ~8 weeks)

**Based on:** OKR_SCREEN_FINDINGS_AND_RECOMMENDATIONS.md, OKR_TAXONOMY_DECISIONS.md, OKR_SCREEN_CHANGE_BACKLOG.md, OKR_CREATION_DRAWER_PLAN.md

---

## 1. Vision

**What "best-in-market" means for our OKR screen:**

- **Single canonical taxonomy** — Cycle (operational period), Status (progress state), Publish State (governance), and Visibility (access control) are clearly distinguished and consistently applied across all UI surfaces (source: OKR_TAXONOMY_DECISIONS.md §Cycle, §Status, §Publish State, §Visibility).

- **Frictionless creation & alignment** — Guided drawer wizard integrates seamlessly with the OKR list page, ensuring complete metadata collection (owner, cycle, visibility, alignment) before publish, with contextual help text and validation (source: OKR_CREATION_DRAWER_PLAN.md §2).

- **Intelligent summaries and drill-downs** — Inline analytics, cycle health indicators, overdue check-in highlights, and role-aware empty states provide immediate context without navigation (source: OKR_SCREEN_CHANGE_BACKLOG.md OKR-UI-007).

- **Clear governance & permission feedback** — Lock states (publish lock, cycle lock) are visually distinct from progress states; permission-gated actions are hidden (not disabled); lock warnings explain why actions are unavailable (source: OKR_SCREEN_FINDINGS_AND_RECOMMENDATIONS.md §C.2).

- **Modern interaction patterns** — Virtualised lists maintain performance with 200+ objectives; side-panel drawers for creation/editing keep context; inline metrics update without page refresh; expandable rows reveal KRs and initiatives on demand (source: OKR_SCREEN_CURRENT_STATE.md §6.2).

- **Instant performance** — Lazy data fetch with server-side pagination; visibility filtering happens before pagination; permission flags computed server-side; client-side virtualisation renders only visible rows (source: OKR_API_CONTRACTS.md §1.3.2-1.3.3).

- **Audit-safe, AI-ready foundation** — Every action is RBAC-enforced; SUPERUSER is read-only; visibility is server-side enforced; governance locks are immutable once set; all mutations are audited (source: OKR_API_CONTRACTS.md §6.3, §7.1).

---

## 2. Architectural Overview

### 2.1 Stable Components (No Changes Required)

**React Components:**
- `OKRListVirtualised` — Virtualised list rendering (source: `apps/web/src/app/dashboard/okrs/OKRListVirtualised.tsx`)
- `ObjectiveRow` — Individual objective row with expand/collapse (source: `apps/web/src/components/okr/ObjectiveRow.tsx`)
- `OkrBadge` — Badge component for status/publish/cycle indicators (source: `apps/web/src/components/okr/OkrBadge.tsx`)

**Hooks:**
- `useTenantPermissions` — Permission checks mirroring backend logic (source: `apps/web/src/hooks/useTenantPermissions.ts`)
- `usePermissions` — RBAC role checks (source: `apps/web/src/hooks/usePermissions.ts`)

**API Endpoints:**
- `GET /okr/overview` — Unified OKR list with pagination, visibility filtering, permission flags (source: `services/core-api/src/modules/okr/okr-overview.controller.ts`)
- `GET /reports/cycles/active` — Active cycles for selector (source: `services/core-api/src/modules/okr/okr-reporting.controller.ts:122-128`)
- `GET /reports/check-ins/overdue` — Overdue check-ins for badges (source: `services/core-api/src/modules/okr/okr-reporting.controller.ts:166-173`)

**Services:**
- `OkrVisibilityService` — Server-side visibility enforcement (source: `services/core-api/src/modules/okr/okr-visibility.service.ts`)
- `OkrGovernanceService` — Publish lock and cycle lock checks (source: `services/core-api/src/modules/okr/okr-governance.service.ts`)
- `RBACService` — Permission checks (`canPerformAction`, `buildUserContext`) (source: `services/core-api/src/modules/rbac/rbac.service.ts`)

---

### 2.2 Components Requiring Refactoring

**Frontend:**
- `OKRPageContainer` — Consolidate client-side filtering; remove legacy periods logic; integrate creation drawer (source: `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx`)
- `page.tsx` — Remove hardcoded `legacyPeriods` array; clarify badge labels; integrate creation drawer (source: `apps/web/src/app/dashboard/okrs/page.tsx:313-318`)
- `CycleSelector` — Remove legacy periods support; use only cycles from API (source: `apps/web/src/components/ui/CycleSelector.tsx`)

**Backend:**
- `okr-overview.controller.ts` — Already stable; may need to add `canCreateKeyResult` flag in future (source: `services/core-api/src/modules/okr/okr-overview.controller.ts`)
- Schema migrations — Remove deprecated visibility levels, KR visibility field (if vestigial), period field (if unused) (source: OKR_SCREEN_CHANGE_BACKLOG.md OKR-SCHEMA-002, OKR-SCHEMA-003, OKR-SCHEMA-001)

---

### 2.3 Final Component Hierarchy

```
OKRsPage (page.tsx)
├── PageHeader (title, badges, "New Objective" button)
├── ActiveCycleBanner (cycle status, lock warnings)
├── FilterBar (status chips, cycle dropdown, workspace/team/owner filters, search)
├── OKRPageContainer
│   ├── EmptyState (role-aware: admin vs contributor)
│   └── OKRListVirtualised
│       └── ObjectiveRow (per objective)
│           ├── CollapsedHeader (title, badges, progress, actions)
│           └── ExpandedBody (KRs, initiatives, actions)
├── OKRCreationDrawer (side panel, 4-step wizard)
├── EditObjectiveModal (existing, kept)
├── NewKeyResultModal (existing, kept)
├── NewInitiativeModal (existing, kept)
├── NewCheckInModal (existing, kept)
├── PublishLockWarningModal (existing, kept)
└── ActivityDrawer (existing, kept)
```

**Shared Hooks:**
- `useTenantPermissions` — Permission checks (RBAC + governance locks)
- `usePermissions` — RBAC role checks
- `useWorkspace` — Workspace/team context
- `useAuth` — User context

---

### 2.4 RBAC, Visibility, and Governance Enforcement Layers

**API Layer (Backend):**
- **RBAC:** `@RequireAction('view_okr'|'create_okr'|'edit_okr'|'delete_okr')` guards on all endpoints (source: OKR_API_CONTRACTS.md §5).
- **Visibility:** `OkrVisibilityService.canUserSeeObjective()` filters objectives before pagination (source: OKR_API_CONTRACTS.md §7.1).
- **Governance:** `OkrGovernanceService.checkPublishLockForObjective()` and `checkCycleLockForObjective()` deny edits if locked (source: OKR_API_CONTRACTS.md §6.1-6.2).
- **Permission Flags:** `canEdit`, `canDelete`, `canCheckIn`, `canCreateObjective` computed server-side and returned in response (source: OKR_API_CONTRACTS.md §1.3.4).

**Hook Layer (Frontend):**
- **RBAC:** `usePermissions.canEditOKR()`, `canDeleteOKR()`, `isTenantAdminOrOwner()` (source: OKR_SCREEN_CURRENT_STATE.md §4.2).
- **Visibility:** `useTenantPermissions.canViewObjective()`, `canSeeKeyResult()` (mirrors backend logic for UX) (source: OKR_SCREEN_CURRENT_STATE.md §4.2).
- **Governance:** `useTenantPermissions.canEditObjective()`, `canDeleteObjective()`, `getLockInfoForObjective()` (checks publish lock + cycle lock) (source: OKR_SCREEN_CURRENT_STATE.md §4.2).

**Component Layer (Frontend):**
- **RBAC:** Buttons/menu items conditionally rendered based on `canEdit`, `canDelete`, `canCheckIn` flags (source: OKR_SCREEN_CURRENT_STATE.md §1.5, lines 77, 79).
- **Visibility:** Objectives/KRs filtered server-side; UI never receives invisible items (source: OKR_API_CONTRACTS.md §1.3.2).
- **Governance:** Lock warnings shown via `PublishLockWarningModal`; edit/delete buttons hidden if locked (source: OKR_SCREEN_CURRENT_STATE.md §5.1).

**Consistency Rule:** Backend is source of truth for enforcement. Frontend mirrors logic for UX only (hiding buttons). All mutations are validated server-side.

---

## 3. Modernisation Roadmap

| Phase | Title | Key Deliverables | Backend | Frontend | Dependencies | Measurable Outcome |
|-------|--------|------------------|----------|-----------|---------------|--------------------|
| **W4.M1** | **Taxonomy and Data Model Alignment** | Unify Cycle vs Period, clean enums, migrate or deprecate pillars, update API schema | Run SQL probes (OKR-BACKEND-001). Remove deprecated visibility levels if unused (OKR-SCHEMA-002). Remove KR visibility field if vestigial (OKR-SCHEMA-003). Document or deprecate period field (OKR-SCHEMA-001). Remove pillar support if unused (OKR-UI-009). | Remove `plannedCycleId` references (OKR-UI-003). Remove legacy periods array (OKR-UI-001). Clarify Status vs Published badge labels (OKR-UI-002). Update copy to distinguish Status vs Published (OKR-UI-008). | None (foundation phase) | Single canonical taxonomy (Cycle, Status, Publish, Visibility). No deprecated enum values in use. No vestigial fields in schema. All copy uses correct terminology. |
| **W4.M2** | **UI Structural Redesign** | Header, filter bar, unified chips, empty state revamp | Verify `canCreateObjective` flag works correctly. Ensure `/okr/overview` response includes all required fields. | Consolidate filter bar (status chips + cycle dropdown + workspace/team/owner + search). Redesign header with clear badges (cycle, lock status). Implement role-aware empty states (OKR-UI-007). Verify permission-gated buttons hide correctly (OKR-UI-004, OKR-UI-005). Ensure KR visibility inheritance works (OKR-UI-006). | W4.M1 (taxonomy decisions) | Consistent badge styling. Clear separation of Status vs Published. Role-appropriate empty states. All actions permission-gated. |
| **W5.M1** | **In-Context Creation Flow Integration** | Permission-gated drawer from OKR page, backend create endpoints | Verify `canCreateObjective` flag computation. Ensure cycle lock checks work for creation. Verify RBAC `create_okr` action enforcement. | Implement `OKRCreationDrawer` component (4-step wizard). Integrate drawer trigger from "New Objective" button. Wire up drawer to `/okr/creation-context` endpoint. Implement step-by-step validation (title, owner, cycle, visibility, KRs). Add "Save Draft" and "Publish" actions. | W4.M2 (UI structure) | Users can create OKRs via guided drawer. All required metadata collected. Draft vs Published workflow works. Permission gating enforced. |
| **W5.M2** | **Intelligent Summary and Contextual Insights** | Inline analytics, cycle status indicators, upcoming check-ins, overdue KRs | Add summary endpoints for cycle health, overdue check-ins, upcoming deadlines. Ensure visibility filtering applies to analytics. | Add inline metrics to header (cycle health, overdue count). Show upcoming check-ins in KR section. Add predictive indicators (cycle ending soon, low confidence KRs). Implement drill-down views for analytics. | W5.M1 (creation flow) | Users see cycle health at a glance. Overdue check-ins highlighted. Predictive insights visible. Analytics respect visibility rules. |
| **W5.M3** | **Final UX Polish and AI-Assist Integration Prep** | Performance tuning, copy polish, telemetry | Add telemetry endpoints for usage tracking. Optimise `/okr/overview` query performance. Add caching for cycle/owner/user lists. | Performance audit (virtualisation, pagination, lazy loading). Copy review (all tooltips, error messages, empty states). Add telemetry hooks for user actions. Prepare hooks for AI-assist integration (context extraction, suggestion endpoints). | W5.M2 (analytics) | Page load < 1s for 100 objectives. All copy reviewed and consistent. Telemetry tracking user actions. Foundation ready for AI features. |

---

### 3.1 Phase W4.M1: Taxonomy and Data Model Alignment

**Duration:** 2 weeks

**Backend Tasks:**

1. **Run SQL Probes** (OKR-BACKEND-001)
   - Execute OKR_SQL_PROBES.sql §2: Period vs Cycle distribution
   - Execute OKR_SQL_PROBES.sql §3: Visibility level distribution (deprecated values)
   - Execute OKR_SQL_PROBES.sql §5: Pillar usage
   - Execute OKR_SQL_PROBES.sql §8: KR visibility vs parent objective
   - Document results and make decisions

2. **Remove Deprecated Visibility Levels** (OKR-SCHEMA-002, if probe confirms unused)
   - Create migration to change existing `WORKSPACE_ONLY`, `TEAM_ONLY`, `MANAGER_CHAIN`, `EXEC_ONLY` values to `PUBLIC_TENANT`
   - Remove deprecated values from `VisibilityLevel` enum
   - Update TypeScript types
   - Update visibility service to handle migration

3. **Remove KR Visibility Field** (OKR-SCHEMA-003, if probe confirms vestigial)
   - Create migration to drop `key_results.visibilityLevel` column
   - Update visibility service to always use parent objective visibility
   - Update API responses to remove KR visibility field

4. **Document or Deprecate Period Field** (OKR-SCHEMA-001)
   - If period unused: Create migration to deprecate `objectives.period` field (keep for validation only)
   - If period used: Document relationship (period = validation rule, cycle = operational period)
   - Update objective service validation to use cycle dates instead of period if deprecated

5. **Remove Pillar Support** (OKR-UI-009, if probe confirms unused)
   - Create migration to drop `strategic_pillars` table and `objectives.pillarId` FK
   - Remove `/reports/pillars` endpoint
   - Update API responses to remove pillar references

**Frontend Tasks:**

1. **Remove Planned Cycle ID References** (OKR-UI-003)
   - Remove `plannedCycleId` references from `mapObjectiveToViewModel()` in `OKRPageContainer.tsx`
   - Clean up any other references to `plannedCycleId`

2. **Remove Legacy Periods Array** (OKR-UI-001)
   - Remove `legacyPeriods` hardcoded array from `page.tsx:313-318`
   - Update `CycleSelector` to use only cycles from `/reports/cycles/active`
   - Ensure graceful handling of empty cycles array

3. **Clarify Status vs Published Badge Labels** (OKR-UI-002)
   - Review `ObjectiveRow.tsx` badge rendering
   - Ensure Status badge uses progress labels (On track / At risk / Blocked / Completed / Cancelled)
   - Ensure Published badge uses governance labels (Published / Draft)
   - Apply distinct visual styles (colours, borders) to differentiate badges

4. **Update Copy** (OKR-UI-008)
   - Review all tooltips, error messages, empty states
   - Ensure Status and Published are never conflated
   - Update badge tooltips to explain difference

**Acceptance Criteria:**
- SQL probe results documented
- No deprecated visibility levels in use (or migrated)
- No KR visibility field in schema (or documented as vestigial)
- Period vs Cycle relationship documented (or period deprecated)
- No pillar support (or implemented in UI)
- No `plannedCycleId` references in codebase
- No `legacyPeriods` array in codebase
- Status and Published badges visually distinct

---

### 3.2 Phase W4.M2: UI Structural Redesign

**Duration:** 2 weeks

**Backend Tasks:**

1. **Verify Permission Flags**
   - Ensure `canCreateObjective` flag works correctly in `/okr/overview` response
   - Verify cycle lock checks work for creation permission
   - Test SUPERUSER read-only behaviour

2. **Verify API Response Fields**
   - Ensure `/okr/overview` includes all required fields (`canEdit`, `canDelete`, `canCheckIn`, `canCreateObjective`)
   - Verify visibility filtering happens before pagination
   - Test pagination with large datasets (100+ objectives)

**Frontend Tasks:**

1. **Consolidate Filter Bar**
   - Redesign filter section to group related filters
   - Status chips (sticky header) — ON_TRACK, AT_RISK, BLOCKED, COMPLETED, CANCELLED
   - Cycle dropdown — All cycles / specific cycle
   - Workspace/Team/Owner dropdowns — All / specific selection
   - Search input — Full-text search across title/description/owner
   - Clear filters button — Only visible when filters active

2. **Redesign Header**
   - Page title: "Objectives & Key Results"
   - Subtitle: "Aligned execution. Live progress. Governance state at a glance."
   - Badges: Cycle badge (e.g., "Viewing: Q4 2025"), Active cycle badge, Lock warning badge
   - Actions: "New Objective" button (permission-gated), "Visual Builder" link

3. **Active Cycle Banner**
   - Show cycle name, status badge (DRAFT/ACTIVE/LOCKED/ARCHIVED), date range
   - Lock warning message if cycle is LOCKED and user is not admin
   - Visual distinction from other UI elements

4. **Implement Role-Aware Empty States** (OKR-UI-007)
   - Tenant Admin: "No OKRs found. Create your first objective to get started." with "New Objective" button
   - Contributor: "No OKRs found." (no create button if `canCreateObjective === false`)
   - SUPERUSER: "No OKRs found." (no create button, read-only)

5. **Verify Permission Gating** (OKR-UI-004, OKR-UI-005)
   - Verify "New Objective" button only shows if `canCreateObjective === true`
   - Verify Edit/Delete buttons hidden if `canEdit`/`canDelete === false`
   - Verify menu items hidden (not disabled) when user lacks permission

6. **Verify KR Visibility Inheritance** (OKR-UI-006)
   - Verify KRs not visible if parent Objective is not visible
   - Verify visibility filtering happens server-side
   - Verify no KRs visible to users who cannot see parent Objective

**Acceptance Criteria:**
- Filter bar consolidated and intuitive
- Header badges clearly show cycle and lock status
- Empty states role-appropriate
- All actions permission-gated (hidden, not disabled)
- KR visibility inheritance verified

---

### 3.3 Phase W5.M1: In-Context Creation Flow Integration

**Duration:** 2 weeks

**Backend Tasks:**

1. **Verify Creation Endpoints**
   - Verify `POST /objectives` endpoint validates all required fields
   - Verify cycle lock checks work for creation
   - Verify RBAC `create_okr` action enforcement
   - Verify SUPERUSER read-only enforcement

2. **Verify Creation Context Endpoint**
   - Ensure `/okr/creation-context` returns correct data:
     - `allowedVisibilityLevels` (filtered by RBAC)
     - `allowedOwners` (users in same tenant)
     - `canAssignOthers` (based on RBAC)
     - `availableCycles` (DRAFT/ACTIVE cycles, or LOCKED if admin)

**Frontend Tasks:**

1. **Implement OKRCreationDrawer Component**
   - Create drawer component using `Sheet` from `@/components/ui/sheet.tsx`
   - Implement 4-step wizard:
     - Step A: Objective Basics (title, description, owner, cycle, alignment)
     - Step B: Visibility & Access (visibility level, whitelist if PRIVATE/EXEC_ONLY)
     - Step C: Key Results (repeatable KR blocks with title, target, owner, cadence)
     - Step D: Review & Publish (summary, draft/publish actions)
   - Add step navigation (Next/Previous buttons)
   - Add validation at each step

2. **Integrate Drawer Trigger**
   - Wire up "New Objective" button to open drawer
   - Ensure button only shows if `canCreateObjective === true`
   - Handle drawer close (cancel, backdrop click, Escape key)

3. **Wire Up Creation Context**
   - Fetch `/okr/creation-context` when drawer opens
   - Populate owner dropdown with `allowedOwners`
   - Populate cycle dropdown with `availableCycles`
   - Filter visibility options based on `allowedVisibilityLevels`

4. **Implement Validation**
   - Title required, non-empty
   - Owner required, must be in `allowedOwners`
   - Cycle required, must be in `availableCycles`
   - Visibility required, must be in `allowedVisibilityLevels`
   - At least one KR required before publish
   - Cycle lock check: Show warning if cycle is LOCKED and user is not admin

5. **Implement Save Draft / Publish Actions**
   - Save Draft: `POST /objectives` with `isPublished: false`
   - Publish: `POST /objectives` with `isPublished: true`
   - Create KRs via `POST /key-results` for each KR in wizard
   - Handle errors gracefully (show inline errors, rollback on failure)
   - Refresh OKR list after successful creation

**Acceptance Criteria:**
- Drawer opens from "New Objective" button
- 4-step wizard collects all required metadata
- Validation prevents invalid submissions
- Save Draft creates draft OKR
- Publish creates published OKR with all KRs
- Permission gating enforced throughout

---

### 3.4 Phase W5.M2: Intelligent Summary and Contextual Insights

**Duration:** 2 weeks

**Backend Tasks:**

1. **Add Summary Endpoints**
   - `GET /reports/cycle-health/:cycleId` — Returns cycle health metrics (on-track %, at-risk %, overdue check-ins count)
   - `GET /reports/upcoming-check-ins` — Returns KRs with check-ins due soon (next 7 days)
   - Ensure visibility filtering applies to all analytics endpoints

2. **Optimise Analytics Queries**
   - Add indexes for common query patterns
   - Cache cycle health calculations
   - Ensure pagination works for large datasets

**Frontend Tasks:**

1. **Add Inline Metrics to Header**
   - Cycle health indicator (on-track %, at-risk %, overdue count)
   - Visual indicator (colour-coded badge)
   - Click to drill down to filtered view

2. **Show Upcoming Check-Ins**
   - Add section in expanded KR view showing "Check-ins due in next 7 days"
   - Show KR title, due date, owner
   - Link to check-in modal

3. **Add Predictive Indicators**
   - Cycle ending soon (within 7 days) — show warning badge
   - Low confidence KRs (confidence < 3/5) — show warning in KR section
   - Overdue check-ins — already implemented, verify visibility

4. **Implement Drill-Down Views**
   - Click cycle health badge → filter by cycle
   - Click overdue count → filter by overdue status
   - Click at-risk % → filter by AT_RISK status

**Acceptance Criteria:**
- Cycle health metrics visible in header
- Upcoming check-ins shown in KR section
- Predictive indicators visible
- Drill-down views work correctly
- Analytics respect visibility rules

---

### 3.5 Phase W5.M3: Final UX Polish and AI-Assist Integration Prep

**Duration:** 2 weeks

**Backend Tasks:**

1. **Add Telemetry Endpoints**
   - `POST /telemetry/okr-action` — Track user actions (create, edit, delete, check-in, view)
   - Store action type, entity type, user ID, timestamp, metadata

2. **Optimise Performance**
   - Add query caching for cycle/owner/user lists
   - Optimise `/okr/overview` query (reduce N+1 queries)
   - Add database indexes for common filters

3. **Prepare AI-Assist Hooks**
   - Add endpoints for context extraction (extract OKR from text, suggest KRs)
   - Add endpoints for suggestions (suggest cycle, suggest owner, suggest visibility)

**Frontend Tasks:**

1. **Performance Audit**
   - Measure page load time (target: < 1s for 100 objectives)
   - Measure virtualisation performance (scroll FPS)
   - Measure API response times
   - Optimise re-renders (use React.memo, useMemo, useCallback)

2. **Copy Review**
   - Review all tooltips, error messages, empty states
   - Ensure consistent terminology (Status vs Published, Cycle vs Period)
   - Update any remaining copy inconsistencies

3. **Add Telemetry Hooks**
   - Track drawer opens, wizard step completions, publish actions
   - Track filter usage, search usage, view duration
   - Send telemetry to backend endpoint

4. **Prepare AI-Assist Integration Points**
   - Add hooks for AI suggestions (suggest title, suggest KRs, suggest cycle)
   - Add UI placeholders for AI suggestions (can be wired up later)
   - Ensure context extraction endpoints are ready

**Acceptance Criteria:**
- Page load < 1s for 100 objectives
- All copy reviewed and consistent
- Telemetry tracking user actions
- Foundation ready for AI features

---

## 4. Competitive Edge Layer

**Differentiators we'll embed into the new OKR screen:**

1. **Live Governance Feedback** — Unlike Perdoo and WorkBoard, we show cycle lock and publish lock states in real-time. Users see exactly why they can't edit (cycle locked, published, or insufficient permissions) with contextual lock warnings, not just disabled buttons (source: OKR_SCREEN_FINDINGS_AND_RECOMMENDATIONS.md §C.2).

2. **Role-Aware Creation Guidance** — Unlike Ally.io and Lattice, our creation drawer adapts to user role. Contributors see simplified flows (PUBLIC_TENANT only); admins see full options (PRIVATE, EXEC_ONLY, whitelist management). The wizard guides users through required metadata collection, preventing incomplete OKRs (source: OKR_CREATION_DRAWER_PLAN.md §3.2).

3. **Predictive Cycle Health** — Unlike standard OKR tools that show static metrics, we provide predictive indicators: cycle ending soon warnings, low confidence KR alerts, overdue check-in highlights. Users see cycle health at a glance in the header, not buried in analytics (source: W5.M2 deliverables).

4. **Server-Side Visibility Enforcement** — Unlike tools that filter client-side (security risk), we enforce visibility server-side before pagination. Users never receive data they can't see; PRIVATE OKRs are invisible to unauthorised users. This provides audit-safe, enterprise-grade security (source: OKR_API_CONTRACTS.md §7.1).

5. **Instant Performance with Scale** — Unlike tools that slow down with 100+ objectives, our virtualised list maintains sub-second performance. Server-side pagination + client-side virtualisation + lazy loading ensure smooth UX even with 500+ objectives (source: OKR_SCREEN_CURRENT_STATE.md §6.1-6.2).

---

## 5. Quality Gates

### 5.1 Mandatory Smoke Tests Before Merging Each Phase

**W4.M1 (Taxonomy Alignment):**
- SQL probe results documented and decisions made
- No deprecated enum values in use (or migrated)
- No vestigial fields in schema (or documented)
- Status and Published badges visually distinct
- Copy review completed

**W4.M2 (UI Redesign):**
- Filter bar works correctly (status, cycle, workspace/team/owner, search)
- Empty states role-appropriate (admin vs contributor vs SUPERUSER)
- Permission gating verified (buttons hidden, not disabled)
- KR visibility inheritance verified (server-side filtering)

**W5.M1 (Creation Flow):**
- Drawer opens from "New Objective" button
- 4-step wizard collects all required metadata
- Validation prevents invalid submissions
- Save Draft creates draft OKR
- Publish creates published OKR with all KRs
- Permission gating enforced (button hidden if `canCreateObjective === false`)

**W5.M2 (Analytics):**
- Cycle health metrics visible in header
- Upcoming check-ins shown in KR section
- Predictive indicators visible
- Drill-down views work correctly
- Analytics respect visibility rules

**W5.M3 (Polish):**
- Page load < 1s for 100 objectives
- All copy reviewed and consistent
- Telemetry tracking user actions
- Performance metrics within targets

---

### 5.2 Frontend Acceptance Criteria

**Visibility:**
- PRIVATE objectives not visible to unauthorised users (server-side filtered)
- KRs inherit visibility from parent Objective
- Visibility not displayed as badge (enforced by filtering)

**Cycle Locks:**
- LOCKED/ARCHIVED cycles show lock warning in Active Cycle Banner
- Edit/Delete buttons hidden for non-admins in locked cycles
- Cycle lock check happens server-side (via `canEdit`/`canDelete` flags)

**Publish State:**
- Published OKRs show "Published" badge (tone: neutral)
- Draft OKRs show "Draft" badge (tone: warn)
- Edit/Delete buttons hidden for non-admins on published OKRs
- Publish lock check happens server-side (via `canEdit`/`canDelete` flags)

**Status:**
- Status badge shows progress state (On track / At risk / Blocked / Completed / Cancelled)
- Status badge visually distinct from Published badge
- Status filter chips work correctly (filter by progress state)

**SUPERUSER:**
- SUPERUSER sees all OKRs (read-only)
- SUPERUSER cannot create/edit/delete OKRs (buttons hidden)
- SUPERUSER sees lock warnings but cannot bypass

---

### 5.3 Post-Implementation Telemetry

**Usage Metrics:**
- Drawer open rate (how often users click "New Objective")
- Wizard completion rate (how many users complete all 4 steps)
- Draft vs Published ratio (how many OKRs saved as draft vs published)
- Filter usage (which filters are most used: status, cycle, workspace, team, owner)
- Search usage (how often users search, what terms)

**Governance Friction Metrics:**
- Lock warning display rate (how often users see lock warnings)
- Failed edit attempts (users trying to edit locked OKRs)
- Permission denial rate (users trying to perform actions they can't)

**Performance Metrics:**
- Page load time (target: < 1s for 100 objectives)
- API response time (target: < 200ms for `/okr/overview`)
- Virtualisation performance (scroll FPS, target: 60 FPS)

**Telemetry Endpoints:**
- `POST /telemetry/okr-action` — Track user actions
- Frontend sends: action type, entity type, user ID, timestamp, metadata

---

## Evidence File References

- Findings: `docs/audit/OKR_SCREEN_FINDINGS_AND_RECOMMENDATIONS.md`
- Taxonomy: `docs/planning/OKR_TAXONOMY_DECISIONS.md`
- Backlog: `docs/planning/OKR_SCREEN_CHANGE_BACKLOG.md`
- Creation Plan: `docs/planning/OKR_CREATION_DRAWER_PLAN.md`
- Current State: `docs/audit/OKR_SCREEN_CURRENT_STATE.md`
- API Contracts: `docs/audit/OKR_API_CONTRACTS.md`

