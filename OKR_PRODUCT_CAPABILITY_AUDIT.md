# OKR Product Capability Audit

**Date:** 2025-01-23  
**Auditor:** Senior Product + Engineering Auditor  
**Scope:** Application-level product capability assessment for commercial OKR platform (2025 standard)

---

## 1. Objective / Key Result Model

### What exists today

**Objective Model:**
- Fields: `id`, `title`, `description`, `organizationId`, `workspaceId`, `teamId`, `ownerId`, `parentId`, `children`, `period`, `startDate`, `endDate`, `status`, `progress`, `visibilityLevel`, `isPublished`, `positionX`, `positionY`, `createdAt`, `updatedAt`
- Schema: `services/core-api/prisma/schema.prisma:178-215`
- Hierarchy support: `parentId` and `children` relations exist (`schema.prisma:190-192`)
- Owner included in queries: `services/core-api/src/modules/okr/objective.service.ts:46-52` includes `owner: { id, name, email }`
- Parent/children included: `services/core-api/src/modules/okr/objective.service.ts:53-59` includes `parent` and `children`

**Key Result Model:**
- Fields: `id`, `title`, `description`, `ownerId`, `metricType`, `startValue`, `targetValue`, `currentValue`, `unit`, `status`, `progress`, `visibilityLevel`, `isPublished`, `period`, `startDate`, `endDate`, `positionX`, `positionY`
- Schema: `services/core-api/prisma/schema.prisma:217-246`
- Many-to-many link to Objectives: `ObjectiveKeyResult` junction table (`schema.prisma:249-261`)
- KR types via `MetricType` enum: `INCREASE`, `DECREASE`, `REACH`, `MAINTAIN` (`schema.prisma:302-307`)
- Baseline/target stored: `startValue`, `targetValue`, `currentValue` (`schema.prisma:223-225`)

**Progress Calculation:**
- KR progress calculated from values: `packages/utils/src/index.ts:8-34` `calculateProgress()` function
- KR progress updated on check-in: `services/core-api/src/modules/okr/key-result.service.ts:497-510` updates `currentValue` and `progress` when check-in created
- Progress recalculation on KR update: `services/core-api/src/modules/okr/key-result.service.ts:367-378` recalculates if `currentValue` changes

### Gaps / risks

**Critical Gap: No Objective Progress Roll-up**
- Objective `progress` field exists (`schema.prisma:199`) but **never calculated from child KRs**
- No code found that aggregates KR progress → Objective progress
- No code found that aggregates child Objective progress → parent Objective progress
- **Impact:** Objective progress values are manually set or default to 0, not derived from actual KR performance

**KR Type Limitations:**
- `MetricType` supports increase/decrease/reach/maintain, but no distinction between:
  - Metric-based KRs (quantitative: "Increase revenue to $1M")
  - Milestone-based KRs (qualitative: "Launch beta by March")
  - Activity-based KRs (task completion: "Complete 5 customer interviews")
- **Impact:** All KRs treated as metrics, even if they're milestones or activities

**Weighting Missing:**
- No field on `ObjectiveKeyResult` junction table for weighting (e.g., KR1 = 40%, KR2 = 60%)
- No field on Objective hierarchy for weighting child Objectives
- **Impact:** Roll-up (if implemented) would default to simple average, not weighted contribution

**Cascading Alignment Validation:**
- Parent-child relationships exist but no validation that:
  - Child period matches parent period
  - Child dates fall within parent dates
  - Cascading makes logical sense
- **Impact:** Can create misaligned hierarchies (child OKR ends before parent starts)

### Severity buckets

- **Blocker for MVP?** YES — Cannot show accurate Objective progress without roll-up from KRs
- **Blocker for exec demo / design partner?** YES — Execs expect parent OKRs to reflect child progress
- **Blocker for commercial sale?** YES — Enterprise buyers will reject a platform where top-level OKRs don't roll up

---

## 2. Check-ins / Operating Rhythm

### What exists today

**Check-in Model:**
- Schema: `services/core-api/prisma/schema.prisma:420-434`
- Fields: `id`, `keyResultId`, `userId`, `value`, `confidence`, `note`, `blockers`, `createdAt`
- Linked to KeyResult via `keyResultId` with cascade delete

**Check-in Creation:**
- Endpoint: `POST /key-results/:id/check-in` (`services/core-api/src/modules/okr/key-result.controller.ts:89-102`)
- Service method: `services/core-api/src/modules/okr/key-result.service.ts:447-514` `createCheckIn()`
- Updates KR `currentValue` and `progress` on check-in creation (`key-result.service.ts:496-510`)

**Historical Storage:**
- Check-ins are **not overwritten** — each check-in creates a new record (`schema.prisma:420-434`)
- Check-ins included in KR detail queries: `services/core-api/src/modules/okr/key-result.service.ts:53-55` includes `checkIns` ordered by `createdAt: 'desc'`
- Latest 5 check-ins included in Objective detail: `services/core-api/src/modules/okr/objective.service.ts:72-75` includes `checkIns: { orderBy: { createdAt: 'desc' }, take: 5 }`

### Gaps / risks

**No Dedicated Check-in History Endpoint:**
- No `GET /key-results/:id/check-ins` endpoint
- Check-ins only accessible via `GET /key-results/:id` (which includes limited check-ins)
- **Impact:** Cannot paginate check-in history, cannot filter by date range, cannot export check-in timeline

**No Cadence/Reminder System:**
- No model for check-in cadence (weekly/bi-weekly/monthly)
- No scheduled reminders or notifications
- No "check-in due" indicators
- **Impact:** Teams must manually remember to check in; no automation or prompts

**No Check-in Trend Analysis:**
- Check-ins stored but no endpoints or components that:
  - Graph value over time
  - Show confidence trends
  - Highlight blockers that persist across multiple check-ins
- Analytics page (`apps/web/src/app/dashboard/analytics/page.tsx`) shows **hardcoded mock data**, not real check-in trends
- **Impact:** Cannot surface patterns like "confidence dropping for 3 weeks" or "same blocker mentioned 4 times"

**No "AT_RISK this week" Status:**
- `status` field exists on KR (`schema.prisma:227`) but not dynamically calculated from recent check-ins
- No logic that says "KR is AT_RISK this week because blocker X exists"
- `determineOKRStatus()` utility exists (`packages/utils/src/index.ts:39-58`) but **not called anywhere** in services
- **Impact:** Status must be manually set, not auto-calculated from check-in data

### Severity buckets

- **Blocker for MVP?** NO — Teams can manually check in and see basic history
- **Blocker for exec demo / design partner?** YES — Expect to see trends, cadence enforcement, and auto-risk detection
- **Blocker for commercial sale?** YES — Enterprise buyers expect automated cadence, reminders, and trend analysis

---

## 3. Strategic Alignment / Pillars / Bets

### What exists today

**Initiative Model:**
- Schema: `services/core-api/prisma/schema.prisma:263-285`
- Can link to Objective (`objectiveId`) or KeyResult (`keyResultId`)
- Fields: `title`, `description`, `ownerId`, `status`, `period`, `startDate`, `endDate`, `dueDate`
- **No link to strategic pillars, themes, bets, or strategic initiatives**

**No Strategic Pillar/Themes Model:**
- Searched codebase for: `pillarId`, `themeId`, `strategicThemeId`, `betId`, `initiativeId` (strategic context)
- **Result:** None found
- No service or component that groups OKRs by strategic pillar

### Gaps / risks

**Cannot Link OKRs to Strategic Context:**
- No way to tag an Objective as "drives Agentic Co-Pilot strategy"
- No way to group OKRs by strategic theme (e.g., "Product-Led Growth", "Customer Success")
- No way to link OKRs to executive bets or strategic initiatives
- **Impact:** Cannot answer "which OKRs drive our top 3 strategic pillars?" Cannot report to execs on strategic alignment

**Initiative Confusion:**
- `Initiative` model exists but is **tactical** (linked to OKRs), not **strategic** (OKRs link to Initiatives)
- No model for strategic Initiatives that OKRs cascade from
- **Impact:** Naming confusion; Initiatives are work items, not strategic themes

### Severity buckets

- **Blocker for MVP?** NO — Can operate without strategic tagging
- **Blocker for exec demo / design partner?** YES — Execs expect to see OKRs grouped by strategic pillar
- **Blocker for commercial sale?** YES — Enterprise buyers need strategic alignment reporting

---

## 4. Ownership & Accountability

### What exists today

**Ownership Fields:**
- Objective: `ownerId` (required) (`schema.prisma:188`)
- KeyResult: `ownerId` (required) (`schema.prisma:221`)
- Owner included in queries: `services/core-api/src/modules/okr/objective.service.ts:46-52` includes `owner: { id, name, email }`

**Ownership Enforcement:**
- Owner can always edit: `services/core-api/src/modules/rbac/rbac.ts:303-306` — "Owner can always edit their own OKRs"
- Owner can always delete: `services/core-api/src/modules/rbac/rbac.ts:351-354` — "Owner can delete their own OKRs"
- Owner can always view: `services/core-api/src/modules/rbac/visibilityPolicy.ts:39-42` — "Owner can always view their own OKRs (regardless of visibility level)"

**Team/Workspace/Org Context:**
- Objectives can be scoped to `organizationId`, `workspaceId`, or `teamId` (`schema.prisma:182-187`)
- All three context fields are optional (can have org-level OKRs, workspace-level, team-level, or personal)
- Context included in queries: `services/core-api/src/modules/okr/objective.service.ts:43-45` includes `team`, `organization`, `workspace`

**Ownership Display:**
- Frontend shows owner: `apps/web/src/app/dashboard/okrs/page.tsx:459` displays "Owner: {owner.name}"

### Gaps / risks

**No Exec Sponsor vs Delivery Owner:**
- Only one `ownerId` field per OKR
- No distinction between:
  - **Exec Sponsor** (accountable for outcome, reviews progress)
  - **Delivery Owner** (does the work, updates check-ins)
- **Impact:** Cannot model "VP Product sponsors, but Engineering Lead owns delivery"

**No Team-Level Ownership View:**
- Can query "all OKRs owned by User X" but no easy endpoint for "all OKRs owned by Team X"
- Must filter in frontend after fetching all OKRs
- **Impact:** Team leads cannot easily see "my team's OKRs" without manual filtering

**UI Ownership Visibility:**
- Owner name shown in OKR list (`apps/web/src/app/dashboard/okrs/page.tsx:459`)
- **But:** No prominent badge or avatar on OKR cards indicating ownership
- **But:** No "My OKRs" filter or tab in UI
- **Impact:** Ownership exists but not prominently surfaced in UI

### Severity buckets

- **Blocker for MVP?** NO — Single owner works for basic use
- **Blocker for exec demo / design partner?** MAYBE — May need sponsor vs owner distinction
- **Blocker for commercial sale?** YES — Enterprise buyers expect sponsor + owner model

---

## 5. Time / Cadence / Cycles

### What exists today

**Period Model:**
- Enum: `MONTHLY`, `QUARTERLY`, `ANNUAL`, `CUSTOM` (`schema.prisma:287-292`)
- Objective: `period` (required), `startDate`, `endDate` (required) (`schema.prisma:195-197`)
- KeyResult: `period` (optional), `startDate`, `endDate` (optional) (`schema.prisma:231-233`)

**Period Validation:**
- Period-specific date range validation: `services/core-api/src/modules/okr/objective.service.ts:242-264`
  - MONTHLY: 25-35 days
  - QUARTERLY: 85-95 days
  - ANNUAL: 360-370 days
  - CUSTOM: no constraints

**Period Display:**
- Frontend shows period badges: `apps/web/src/app/dashboard/okrs/page.tsx:447-452` displays period badge with calendar icon
- Period filtering in Builder: `apps/web/src/app/dashboard/builder/page.tsx:131-140` filters nodes by period

**Time Utilities:**
- `getQuarter()`, `getQuarterDateRange()` utilities exist (`packages/utils/src/index.ts:111-123`)

### Gaps / risks

**No Active Cycle Concept:**
- No field like `isActiveCycle` or `cycleStatus` (DRAFT, ACTIVE, ARCHIVED)
- No endpoint to get "current active quarter"
- No automatic cycle transition (Q1 → Q2)
- **Impact:** Cannot answer "what's the current OKR cycle?" Cannot prevent editing past cycles

**No Progress vs Time Calculation:**
- `determineOKRStatus()` utility exists (`packages/utils/src/index.ts:39-58`) that compares progress vs elapsed time
- **But:** This function is **never called** in any service
- No automatic status updates based on "progress is 30% but we're 60% through the period"
- **Impact:** Status must be manually set, not auto-calculated from time/progress ratio

**No Cycle Comparison:**
- Cannot compare "Q1 2024 vs Q1 2025"
- No endpoints that aggregate OKRs by period for comparison
- **Impact:** Cannot answer "how did we do this quarter vs last quarter?"

**Hard-coded Period Types:**
- Period enum is fixed: MONTHLY, QUARTERLY, ANNUAL, CUSTOM
- No configuration for "6-week sprints" or "bi-annual cycles"
- CUSTOM exists but no validation or UI support for custom periods
- **Impact:** Organizations with non-standard cadences cannot model their cycles

### Severity buckets

- **Blocker for MVP?** NO — Can manually set periods and dates
- **Blocker for exec demo / design partner?** YES — Expect active cycle concept and time-based status
- **Blocker for commercial sale?** YES — Enterprise buyers need cycle management and comparison

---

## 6. Visibility / Privacy / Exec Control

### What exists today

**Visibility Levels:**
- Enum: `PUBLIC_TENANT`, `PRIVATE`, plus deprecated levels (`schema.prisma:320-327`)
- Default: `PUBLIC_TENANT` (`schema.prisma:200, 229`)
- Deprecated levels (`WORKSPACE_ONLY`, `TEAM_ONLY`, `MANAGER_CHAIN`, `EXEC_ONLY`) are **treated as PUBLIC_TENANT** for backward compatibility (`visibilityPolicy.ts:44-53`)

**PRIVATE Visibility Enforcement:**
- Only PRIVATE restricts read access: `services/core-api/src/modules/rbac/visibilityPolicy.ts:44-48`
- PRIVATE whitelist check: `services/core-api/src/modules/rbac/visibilityPolicy.ts:62-107` `canViewPrivate()`
- Supports `privateWhitelist` and `execOnlyWhitelist` (backward compatibility) in Organization metadata

**Tenant Isolation:**
- `organizationId` as canonical tenant identifier (`schema.prisma:182`)
- Superuser read-only: `services/core-api/src/modules/auth/strategies/jwt.strategy.ts:28-34` sets `organizationId: null` for superusers
- Tenant scoping in queries: `services/core-api/src/modules/okr/objective.service.ts:21-28` filters by `organizationId`
- Cross-tenant prevention: `services/core-api/src/modules/okr/objective.service.ts:144-146` blocks edit if `okrOrganizationId !== userOrganizationId`

**Exec Control:**
- `allowTenantAdminExecVisibility` flag on Organization (`schema.prisma:21`)
- `execOnlyWhitelist` JSON field on Organization (`schema.prisma:22`)
- RBAC checks EXEC_ONLY access: `services/core-api/src/modules/rbac/rbac.ts:314-318` blocks TENANT_ADMIN from EXEC_ONLY unless `allowTenantAdminExecVisibility` is true

**UI Visibility Indicators:**
- PRIVATE badge shown: `apps/web/src/app/dashboard/okrs/page.tsx:444-446` displays "🔒 Private" badge

### Gaps / risks

**Deprecated Visibility Levels Still in Enum:**
- `WORKSPACE_ONLY`, `TEAM_ONLY`, `MANAGER_CHAIN`, `EXEC_ONLY` are deprecated but still in schema
- All treated as PUBLIC_TENANT (globally visible)
- **Impact:** Confusing for users who set EXEC_ONLY expecting it to restrict access

**No Individual User Whitelist for PRIVATE:**
- PRIVATE supports whitelist via Organization `privateWhitelist` or `execOnlyWhitelist`
- **But:** No UI or endpoint to easily add/remove users from whitelist
- Whitelist service exists (`services/core-api/src/modules/rbac/exec-whitelist.service.ts`) but **only for EXEC_ONLY**, not PRIVATE
- **Impact:** Admins must manually edit Organization JSON to whitelist users

**No Visibility Level Filtering in UI:**
- UI shows PRIVATE badge but no filter for "show only PRIVATE OKRs" or "hide PRIVATE OKRs"
- **Impact:** Users cannot easily filter by visibility level

### Severity buckets

- **Blocker for MVP?** NO — Basic visibility works
- **Blocker for exec demo / design partner?** MAYBE — Deprecated levels may confuse users
- **Blocker for commercial sale?** YES — Need proper UI for whitelist management and visibility filtering

---

## 7. Reporting / Aggregation / Health Views

### What exists today

**Status Fields:**
- Objective: `status` (`ON_TRACK`, `AT_RISK`, `OFF_TRACK`, `COMPLETED`, `CANCELLED`) (`schema.prisma:198`)
- KeyResult: `status` (same enum) (`schema.prisma:227`)
- Progress fields: `progress` (Float 0-100) on both Objective and KeyResult

**Check-in Data Available:**
- Check-ins include `value`, `confidence`, `note`, `blockers` (`schema.prisma:425-428`)
- Historical check-ins queryable via `keyResult.checkIns` relation

**Analytics Page (Frontend):**
- Page exists: `apps/web/src/app/dashboard/analytics/page.tsx`
- **But:** Shows **hardcoded mock data** (`analytics/page.tsx:102-107` mock team stats, `analytics/page.tsx:175-197` mock activity feed)
- No API calls to fetch real OKR data
- **Impact:** Analytics page is a placeholder, not functional

### Gaps / risks

**No Reporting Endpoints:**
- No `GET /reports/company-progress` endpoint
- No `GET /reports/at-risk` endpoint
- No `GET /reports/health-summary` endpoint
- No aggregation endpoints that count OKRs by status, team, or period
- **Impact:** Cannot build leadership dashboards without exporting to Excel and doing manual aggregation

**No Status Aggregation:**
- Cannot get "count of AT_RISK OKRs across organization"
- Cannot get "count of OFF_TRACK KRs by team"
- Must fetch all OKRs and aggregate in frontend
- **Impact:** Performance issues with large datasets; cannot efficiently answer "where are we off track?"

**No Trend Data Endpoints:**
- Check-ins stored but no endpoints that:
  - Graph progress over time
  - Show confidence trends
  - Aggregate blockers across all KRs
- **Impact:** Cannot surface insights like "confidence dropping for 5 KRs this week"

**No Roll-up Progress Views:**
- No endpoint for "organization-level progress" (aggregate of all OKRs)
- No endpoint for "workspace-level progress" (aggregate of workspace OKRs)
- No endpoint for "team-level progress" (aggregate of team OKRs)
- **Impact:** Cannot show "we're 68% complete as an organization" without manual calculation

**Analytics Page Non-Functional:**
- Frontend analytics page exists but shows mock data
- No real-time data integration
- **Impact:** Analytics page is misleading — looks functional but isn't

### Severity buckets

- **Blocker for MVP?** NO — Can manually review OKRs one by one
- **Blocker for exec demo / design partner?** YES — Execs expect consolidated health views
- **Blocker for commercial sale?** YES — Enterprise buyers require reporting and aggregation endpoints

---

## 8. Governance / Workflow / Auditability

### What exists today

**Draft vs Published:**
- `isPublished` boolean on Objective (`schema.prisma:201`) and KeyResult (`schema.prisma:230`)
- Default: `false` (draft) (`schema.prisma:201, 230`)

**Publish Permission:**
- `canPublishOKRAction()` exists: `services/core-api/src/modules/rbac/rbac.ts:426-461`
- TENANT_OWNER, TENANT_ADMIN, WORKSPACE_LEAD, TEAM_LEAD can publish
- Example publish flow: `services/core-api/src/modules/rbac/integration-example.ts:240-265` shows `publish()` method

**Audit Log Model:**
- `AuditLog` model exists: `services/core-api/prisma/schema.prisma:381-404`
- Tracks: `action`, `targetType`, `targetId`, `actorUserId`, `timestamp`, `metadata`
- Used for role changes and impersonation: `services/core-api/src/modules/rbac/audit.ts` has audit helpers

**Activity Model:**
- `Activity` model exists: `services/core-api/prisma/schema.prisma:436-448`
- Tracks: `entityType`, `entityId`, `userId`, `action`, `metadata`, `createdAt`
- **But:** No evidence it's populated on OKR changes (searched codebase, no writes to Activity table found)

### Gaps / risks

**No State Machine:**
- `isPublished` is a boolean, not a state enum (DRAFT → PUBLISHED → LOCKED)
- No workflow that prevents editing after publish
- No "lock cycle" concept that prevents edits after quarter ends
- **Impact:** Can silently edit targets mid-quarter; no governance control

**No Edit Restriction After Publish:**
- `isPublished` exists but **no enforcement** that published OKRs cannot be edited
- `canEdit()` checks RBAC but not publish status
- **Impact:** Anyone with edit permission can change published OKR targets/values

**No Change History:**
- `Activity` model exists but **not populated** on OKR edits
- No audit trail of:
  - Who changed Objective title/description
  - Who changed KR target value
  - Who changed progress
  - When changes occurred
- `AuditLog` exists but only used for role changes, not OKR changes
- **Impact:** Cannot audit "who changed the target from 100 to 50?" Cannot see change history

**No Review/Approval Flow:**
- No "submit for review" state
- No "pending approval" status
- No approval workflow before publish
- **Impact:** Cannot require manager/exec approval before OKRs go live

**No Target Change Tracking:**
- Can change `targetValue` on KR but no record of previous target
- No "target changed from X to Y on date Z" history
- **Impact:** Cannot detect if someone changed targets mid-quarter to make progress look better

### Severity buckets

- **Blocker for MVP?** NO — Can operate with draft/published boolean
- **Blocker for exec demo / design partner?** YES — Expect edit restrictions and change history
- **Blocker for commercial sale?** YES — Enterprise buyers require audit trails and governance controls

---

## 9. Enterprise Readiness / Multi-Org / Compliance

### What exists today

**Tenant Isolation:**
- `organizationId` as canonical tenant identifier (`schema.prisma:182`)
- Superuser read-only: `services/core-api/src/modules/auth/strategies/jwt.strategy.ts:28-34` sets `organizationId: null` for superusers; superusers cannot edit (`objective.service.ts:126-128`, `key-result.service.ts:118-120`)
- Cross-tenant read prevention: `services/core-api/src/modules/okr/objective.service.ts:21-28` filters by `organizationId`
- Cross-tenant write prevention: `services/core-api/src/modules/okr/objective.service.ts:144-146` blocks edit if org mismatch
- KR tenant isolation: `services/core-api/src/modules/okr/key-result.service.ts:115-175` enforces tenant isolation on KR edits

**RBAC Model:**
- `RoleAssignment` table: `services/core-api/prisma/schema.prisma:333-348`
- Roles: SUPERUSER, TENANT_OWNER, TENANT_ADMIN, TENANT_VIEWER, WORKSPACE_LEAD, WORKSPACE_ADMIN, WORKSPACE_MEMBER, TEAM_LEAD, TEAM_CONTRIBUTOR, TEAM_VIEWER (`schema.prisma:350-368`)
- `rbacService.canPerformAction()`: `services/core-api/src/modules/rbac/rbac.service.ts` centralizes permission checks
- Action-based permissions: `services/core-api/src/modules/rbac/rbac.ts:102-144` checks actions like `view_okr`, `edit_okr`, `delete_okr`, `publish_okr`

**Superuser Read-Only Audit Role:**
- Superuser can view all orgs but cannot edit: `services/core-api/src/modules/rbac/rbac.ts:158-199` `canSuperuser()` function
- Superuser can export data: `services/core-api/src/modules/rbac/rbac.ts:173-176`
- Superuser can impersonate: `services/core-api/src/modules/rbac/rbac.ts:168-171`

**Organization Model:**
- `Organization` model with `allowTenantAdminExecVisibility` and `execOnlyWhitelist` (`schema.prisma:17-31`)
- Multi-workspace support: `Organization.workspaces` relation (`schema.prisma:24`)

### Gaps / risks

**Frontend Still Using Legacy Roles:**
- Frontend may still reference old role system (checked `apps/web/src/hooks/usePermissions.ts` — uses RBAC but may have legacy checks)
- Need to verify all frontend permission checks align with backend RBAC
- **Impact:** UI may show/hide features incorrectly if frontend uses outdated role checks

**No Export Endpoints:**
- `export_data` action exists in RBAC (`services/core-api/src/modules/rbac/rbac.ts:139-140`)
- Permission check exists: `services/core-api/src/modules/rbac/rbac.ts:639-662` `canExportData()`
- **But:** No actual export endpoints (`GET /export/csv`, `GET /export/pdf`, etc.)
- **Impact:** Cannot export OKR data for board meetings or QBRs; must manually copy/paste

**Audit Trail Surface:**
- `AuditLog` model exists and is populated for role changes
- **But:** No UI or endpoint to view audit logs
- **But:** `Activity` model exists but **not populated** for OKR changes
- **Impact:** Audit data exists but not accessible to admins; no compliance reporting

**No SCIM/SSO Integration:**
- No SCIM endpoints for user provisioning/deprovisioning
- No SSO integration hooks (SAML, OIDC)
- No user lifecycle automation
- **Impact:** Cannot integrate with enterprise identity providers; manual user management required

**No Multi-Org User Support:**
- JWT strategy gets "first org membership" only: `services/core-api/src/modules/auth/strategies/jwt.strategy.ts:38-42` uses `findFirst()` with `orderBy: { createdAt: 'asc' }`
- TODO comment: "Support multi-org users (currently using first org membership only)" (`jwt.strategy.ts:37`)
- **Impact:** Users who belong to multiple organizations can only access first org

### Severity buckets

- **Blocker for MVP?** NO — Single-org users work fine
- **Blocker for exec demo / design partner?** YES — Need export capabilities and audit trail access
- **Blocker for commercial sale?** YES — Enterprise buyers require SSO, SCIM, export, and multi-org support

---

## 10. AI / Assist Layer / Execution Intelligence

### What exists today

**AI Service Architecture:**
- AI service exists: `services/ai-service/` directory
- Three personas: `OKR_COACH`, `CASCADE_ASSISTANT`, `PROGRESS_ANALYST` (`schema.prisma:499-503`)

**OKR Coach Persona:**
- Validates OKRs: `services/ai-service/src/personas/okr-coach.persona.ts:61-98` `validateOKR()` method
- Suggests Key Results: `services/ai-service/src/personas/okr-coach.persona.ts:100-121` `suggestKeyResults()` method

**Progress Analyst Persona:**
- Analyzes progress: `services/ai-service/src/personas/progress-analyst.persona.ts:57-80` `analyzeProgress()` method
- Generates reports: `services/ai-service/src/personas/progress-analyst.persona.ts:82-97` `generateReport()` method
- System prompt mentions: "Generate executive summaries", "Identify at-risk OKRs", "Analyze trends across check-ins" (`progress-analyst.persona.ts:7-16`)

**Cascade Assistant Persona:**
- File exists: `services/ai-service/src/personas/cascade-assistant.persona.ts`
- Purpose: Recommends alignments and detects conflicts (`README.md:11`)

**AI Conversation Model:**
- `AIConversation` and `AIMessage` models exist (`schema.prisma:470-497`)
- Linked to workspace: `AIConversation.workspaceId` (`schema.prisma:473`)

### Gaps / risks

**No In-Product AI Integration:**
- AI personas exist but **no evidence they're called from OKR services**
- No endpoints that auto-summarize status
- No automatic "top 5 risks this week" generation
- No integration with check-in data to surface blockers automatically
- **Impact:** AI capabilities exist but not accessible to users; must be manually invoked (if at all)

**No Weekly Exec Summary Generation:**
- `ProgressAnalyst.generateReport()` exists but **not called automatically**
- No scheduled job that generates weekly summaries from check-ins
- No endpoint that produces "exec summary for week of X"
- **Impact:** Exec summaries must be manually created

**No Risk Surfacing Automation:**
- No code that automatically identifies "top 5 risks this week"
- No code that surfaces "confidence dropping for 3 weeks"
- No code that highlights "blocker mentioned in 4 consecutive check-ins"
- **Impact:** Risk detection is manual, not automated

**No In-App AI Assistant:**
- AI conversation models exist but **no UI component** that allows users to chat with AI personas
- No "ask AI: which OKR is most at risk?" interface
- **Impact:** AI capabilities are not accessible to end users

**No Auto-Status Updates:**
- `determineOKRStatus()` utility exists but **not called** to auto-update status
- No code that says "KR is AT_RISK because progress is 30% but we're 60% through period"
- **Impact:** Status updates are manual, not AI-driven

### Severity buckets

- **Blocker for MVP?** NO — Can operate without AI assistance
- **Blocker for exec demo / design partner?** MAYBE — AI features are differentiator but not required
- **Blocker for commercial sale?** NO — AI is a "nice to have" but not blocking for enterprise sales

---

## Summary

### Critical Gaps (Block Commercial Sale)

1. **No Objective Progress Roll-up** — Top-level OKRs don't reflect child progress
2. **No Reporting/Aggregation Endpoints** — Cannot build leadership dashboards
3. **No Export Capabilities** — Cannot export for board meetings/QBRs
4. **No Change History/Audit Trail** — Cannot track who changed what
5. **No Strategic Alignment** — Cannot link OKRs to strategic pillars
6. **No Cycle Management** — No active cycle concept or cycle comparison
7. **No Check-in Cadence** — No reminders or automation
8. **No SSO/SCIM** — Cannot integrate with enterprise identity providers

### Moderate Gaps (Block Exec Demo / Design Partner)

1. **No Check-in History Endpoint** — Cannot paginate/filter check-ins
2. **No Trend Analysis** — Cannot graph progress/confidence over time
3. **No Auto-Status Calculation** — Status must be manually set
4. **No Edit Restrictions After Publish** — Can change targets mid-quarter
5. **Analytics Page Non-Functional** — Shows mock data, not real data

### Minor Gaps (Acceptable for MVP)

1. **No AI Integration** — AI exists but not accessible
2. **No Multi-Org User Support** — Single org per user works for MVP
3. **No Sponsor vs Owner** — Single owner works for MVP

---

**Overall Assessment:** Platform has solid foundation (data model, RBAC, tenant isolation) but lacks critical enterprise features (reporting, export, audit trail, strategic alignment). **Not commercially credible** for enterprise sales without addressing critical gaps. **Acceptable for MVP/internal use** with manual workarounds.







