# OKR Platform Delivery Plan

**Date:** 2025-01-23  
**Source:** OKR Product Capability Audit  
**Purpose:** Define what we must build to be demo-ready and commercially viable

---

## A. Demo Readiness (Design Partner Readiness)

**Definition:** What we MUST have working (end to end, visibly in product, not just "the code kind of supports it") in order to sit in front of an exec sponsor at a design partner and not get laughed out of the room.

### 1. Objective Progress Roll-up

**What "good enough" means:** When an exec opens an Objective, they see progress that automatically reflects the average progress of its child Key Results; parent Objectives roll up from child Objectives.

**Code areas:**
- `services/core-api/src/modules/okr/objective.service.ts` — Add `updateObjectiveProgress()` method that aggregates from `keyResults` relation
- `services/core-api/src/modules/okr/key-result.service.ts` — Call progress roll-up after `createCheckIn()` and `update()` when progress changes
- `services/core-api/src/modules/okr/objective.service.ts` — Recursive roll-up for parent Objectives when child progress changes
- `apps/web/src/app/dashboard/okrs/page.tsx` — Verify progress bars reflect rolled-up values

### 2. Analytics Page with Real Data

**What "good enough" means:** Analytics page shows actual OKR counts, progress percentages, and at-risk counts from the database, not hardcoded numbers.

**Code areas:**
- `apps/web/src/app/dashboard/analytics/page.tsx` — Replace hardcoded arrays (`lines 102-107`, `175-197`) with API calls
- `services/core-api/src/modules/okr/objective.controller.ts` — Add aggregation endpoints (or extend `findAll()` to accept aggregation params)
- `services/core-api/src/modules/okr/objective.service.ts` — Add `getAggregatedStats()` method that counts by status, team, period

### 3. Check-in History Endpoint

**What "good enough" means:** Users can view paginated check-in history for a Key Result, see who checked in when, and view trends over time.

**Code areas:**
- `services/core-api/src/modules/okr/key-result.controller.ts` — Add `GET /key-results/:id/check-ins` endpoint with pagination
- `services/core-api/src/modules/okr/key-result.service.ts` — Add `getCheckInHistory()` method
- `apps/web/src/app/dashboard/okrs/page.tsx` or new component — Display check-in timeline/history

### 4. Auto-Status Calculation from Progress vs Time

**What "good enough" means:** When execs view OKRs, status (ON_TRACK/AT_RISK/OFF_TRACK) is automatically calculated from progress percentage vs elapsed time, not manually set.

**Code areas:**
- `packages/utils/src/index.ts` — `determineOKRStatus()` already exists (lines 39-58) but is never called
- `services/core-api/src/modules/okr/objective.service.ts` — Call `determineOKRStatus()` in `update()` and `findById()` to recalculate status
- `services/core-api/src/modules/okr/key-result.service.ts` — Call `determineOKRStatus()` after progress updates
- `apps/web/src/app/dashboard/okrs/page.tsx` — Status badges should reflect auto-calculated values

### 5. Edit Restrictions After Publish

**What "good enough" means:** Once an OKR is published (`isPublished: true`), editing requires elevated permissions or shows a warning; prevents silent mid-quarter target changes.

**Code areas:**
- `services/core-api/src/modules/rbac/rbac.ts` — Update `canEditOKRAction()` to check `isPublished` flag
- `services/core-api/src/modules/okr/objective.service.ts` — Block or warn on `update()` if `isPublished: true` and user lacks elevated role
- `services/core-api/src/modules/okr/key-result.service.ts` — Same check in `update()` method
- `apps/web/src/app/dashboard/okrs/page.tsx` — Disable edit buttons or show warning modal for published OKRs

### 6. Trend Analysis Visualization

**What "good enough" means:** Analytics page shows a simple chart of progress over time (line graph) and confidence trends from check-ins.

**Code areas:**
- `services/core-api/src/modules/okr/key-result.service.ts` — Add `getTrendData()` method that aggregates check-ins by date
- `services/core-api/src/modules/okr/key-result.controller.ts` — Add `GET /key-results/:id/trends` endpoint
- `apps/web/src/app/dashboard/analytics/page.tsx` — Add chart component (use existing chart library or simple SVG) that displays trend data

### 7. Check-in Cadence Reminders

**What "good enough" means:** Users see "check-in due" indicators on Key Results that haven't been updated in the configured cadence period (weekly/bi-weekly).

**Code areas:**
- `services/core-api/prisma/schema.prisma` — Add `checkInCadence` field to `KeyResult` model (enum: WEEKLY, BIWEEKLY, MONTHLY)
- `services/core-api/src/modules/okr/key-result.service.ts` — Add `getOverdueCheckIns()` method that compares `lastCheckIn.createdAt` vs cadence
- `apps/web/src/app/dashboard/okrs/page.tsx` — Show badge/indicator on KR cards for overdue check-ins

---

## B. First Sellable Version (Commercial Viability for first paying customers)

**Definition:** What we MUST have in order to credibly charge money in an enterprise / mid-market context without the buyer saying "come back in six months".

### Reporting & Exec View

#### Reporting/Aggregation Endpoints

**Expectation:** Execs can get consolidated dashboards showing org-level progress, at-risk OKR counts, and team-level roll-ups via API; frontend consumes these for exec dashboards.

**Personas:** CFO (budget/outcome tracking), COO (operational health), VP Product (product portfolio health)

**Risk if deferred:** HIGH — Cannot answer "how are we doing as an organization?" without manual Excel exports

**Code areas:**
- `services/core-api/src/modules/okr/objective.controller.ts` — Add `GET /reports/company-progress`, `GET /reports/at-risk`, `GET /reports/health-summary`
- `services/core-api/src/modules/okr/objective.service.ts` — Add reporting service methods that aggregate by organization, workspace, team, period
- `apps/web/src/app/dashboard/analytics/page.tsx` — Replace mock data with calls to reporting endpoints

#### Export Capabilities (CSV/PDF)

**Expectation:** TENANT_OWNER and TENANT_ADMIN can export OKR data to CSV for board meetings and QBRs; PDF export for presentation-ready reports.

**Personas:** CFO (board reporting), COO (QBR prep), VP Product (stakeholder updates)

**Risk if deferred:** HIGH — Buyers will say "we need Excel exports for our board" and walk if missing

**Code areas:**
- `services/core-api/src/modules/okr/objective.controller.ts` — Add `GET /export/csv` and `GET /export/pdf` endpoints
- `services/core-api/src/modules/okr/objective.service.ts` — Add `exportToCSV()` and `exportToPDF()` methods
- `services/core-api/src/modules/rbac/rbac.ts` — `canExportData()` permission check already exists (line 639-662), wire it to endpoints

### Governance & Auditability

#### Change History / Audit Trail

**Expectation:** Admins can view who changed what OKR fields and when; change history shows previous values (e.g., "target changed from 100 to 50 on Jan 15 by User X").

**Personas:** CISO (compliance), CFO (audit requirements), VP Product (governance)

**Risk if deferred:** HIGH — Enterprise buyers require audit trails for compliance; will reject without it

**Code areas:**
- `services/core-api/src/modules/activity/activity.service.ts` — `createActivity()` exists (line 23-36) but not called
- `services/core-api/src/modules/okr/objective.service.ts` — Call `activityService.createActivity()` in `create()`, `update()`, `delete()` methods
- `services/core-api/src/modules/okr/key-result.service.ts` — Same in `create()`, `update()`, `delete()`, `createCheckIn()`
- `services/core-api/src/modules/activity/activity.controller.ts` — Add `GET /activities` endpoint with filters
- `apps/web/src/app/dashboard/settings/` — Add audit log viewer page

#### Strategic Alignment / Pillars

**Expectation:** OKRs can be tagged with strategic pillars/themes; execs can filter/report by pillar to answer "which OKRs drive our Product-Led Growth strategy?"

**Personas:** VP Product (strategic alignment), COO (portfolio management), CEO (strategic execution)

**Risk if deferred:** MEDIUM — Can demo without it, but enterprise buyers will ask "how do we link OKRs to our strategic themes?"

**Code areas:**
- `services/core-api/prisma/schema.prisma` — Add `StrategicPillar` model and `pillarId` field to `Objective` model
- `services/core-api/src/modules/okr/objective.service.ts` — Include pillar in queries and allow filtering by `pillarId`
- `apps/web/src/app/dashboard/okrs/page.tsx` — Add pillar filter dropdown and pillar badges on OKR cards

### Enterprise / Compliance

#### SSO/SCIM Integration

**Expectation:** Enterprise buyers can integrate with their identity provider (SAML/OIDC) and provision/deprovision users via SCIM.

**Personas:** CISO (security/compliance), IT Admin (user management), CFO (reducing manual admin)

**Risk if deferred:** HIGH — Enterprise buyers will not sign without SSO; "we can't use a product that requires manual user management"

**Code areas:**
- `services/core-api/src/modules/auth/` — Add SAML/OIDC strategy (new files)
- `services/core-api/src/modules/auth/auth.controller.ts` — Add SSO callback endpoints
- `services/core-api/src/modules/user/` — Add SCIM controller with `GET /scim/Users`, `POST /scim/Users`, `PATCH /scim/Users/:id`, `DELETE /scim/Users/:id`
- `services/core-api/src/modules/user/user.service.ts` — Add SCIM-compliant user provisioning methods

#### Cycle Management

**Expectation:** Admins can mark cycles as ACTIVE/LOCKED/ARCHIVED; prevent edits to LOCKED cycles; show "current active quarter" in UI.

**Personas:** COO (cycle governance), VP Product (quarterly planning), CFO (cycle-based reporting)

**Risk if deferred:** MEDIUM — Can operate with manual period management, but enterprise buyers expect cycle lock controls

**Code areas:**
- `services/core-api/prisma/schema.prisma` — Add `Cycle` model with `status` enum (DRAFT, ACTIVE, LOCKED, ARCHIVED) and link to `Objective` via `cycleId`
- `services/core-api/src/modules/okr/objective.service.ts` — Block edits if `cycle.status === 'LOCKED'`
- `services/core-api/src/modules/okr/objective.controller.ts` — Add `GET /cycles/active` endpoint
- `apps/web/src/app/dashboard/okrs/page.tsx` — Show active cycle badge and disable edits for locked cycles

---

## C. Safe to Defer

**Definition:** Capabilities that are not required for demo or first deals, but are still valuable. These are allowed to slip.

### AI Integration into Workflow

**Why defer:** AI personas exist but aren't integrated. Can demo the AI chat page (`apps/web/src/app/dashboard/ai/page.tsx`) as a "coming soon" feature. Not blocking for enterprise sales.

**Who will shout:** Head of Product (competitive differentiation), but not blocking deals

### Multi-Org User Support

**Why defer:** Single org per user works for MVP and first customers. Most enterprises start with one org per user anyway.

**Who will shout:** Enterprise Sales (multi-division customers), but can be added post-sale

### Exec Sponsor vs Delivery Owner

**Why defer:** Single owner works for demo and first deals. Can add sponsor field later without breaking existing data.

**Who will shout:** VP Product (complex org structures), but not blocking initial sales

### Check-in Trend Analysis (Advanced)

**Why defer:** Basic check-in history (Section A.3) is enough for demo. Advanced trend analysis (confidence trends, blocker persistence) can come later.

**Who will shout:** Data Analyst personas, but not exec decision-makers

### Cycle Comparison (Q1 2024 vs Q1 2025)

**Why defer:** Current cycle reporting is enough. Historical comparison is nice-to-have for mature customers.

**Who will shout:** VP Product (historical analysis), but not blocking initial sales

---

## D. Structural Debt We Must Track

**Definition:** Things that will hurt us if we scale with them in place. If we ignore them, we will regret it by the time we have 5+ tenants.

### Multi-Org User Limitation

**Problem:** JWT strategy only loads first org membership (`services/core-api/src/modules/auth/strategies/jwt.strategy.ts:38-42` uses `findFirst()`). Users who belong to multiple orgs can only access their first org.

**Proof:** `services/core-api/src/modules/auth/strategies/jwt.strategy.ts:37` TODO comment: "Support multi-org users (currently using first org membership only)"

**Impact:** When we get customers with consultants/contractors who need access to multiple orgs, they'll hit this limit immediately.

### Frontend Permission Checks May Be Inconsistent

**Problem:** Audit notes frontend "may still reference old role system" but verification shows RBAC is used. However, need to audit all frontend permission checks to ensure they match backend RBAC.

**Proof:** `apps/web/src/hooks/usePermissions.ts` uses RBAC, but need to verify all components check permissions consistently

**Impact:** Users may see features they can't use, or be blocked from features they should access. Confusion at scale.

### Activity Model Not Populated

**Problem:** `Activity` model exists (`services/core-api/prisma/schema.prisma:436-448`) and `ActivityService.createActivity()` exists (`services/core-api/src/modules/activity/activity.service.ts:23-36`), but no OKR services call it.

**Proof:** Grep shows no `ActivityService` imports or calls in `services/core-api/src/modules/okr/`

**Impact:** When we need to audit "who changed what and when" for compliance, we'll have no historical data. Must fix before enterprise customers ask for audit logs.

### Deprecated Visibility Levels Still in Schema

**Problem:** `WORKSPACE_ONLY`, `TEAM_ONLY`, `MANAGER_CHAIN`, `EXEC_ONLY` are deprecated but still in enum (`services/core-api/prisma/schema.prisma:320-327`). All treated as PUBLIC_TENANT but users may set them expecting restriction.

**Proof:** `services/core-api/src/modules/rbac/visibilityPolicy.ts:44-53` treats all deprecated levels as globally visible

**Impact:** User confusion when they set EXEC_ONLY expecting restriction but it's visible to everyone. Data migration needed before we can remove these enum values.

### No Weighting on Objective-KeyResult Junction

**Problem:** `ObjectiveKeyResult` junction table (`services/core-api/prisma/schema.prisma:249-261`) has no `weight` field. When we implement roll-up (Section A.1), it will default to simple average, not weighted contribution.

**Proof:** Schema shows no `weight` field on `ObjectiveKeyResult` model

**Impact:** When customers say "KR1 is 40% of the Objective, KR2 is 60%", we can't model that. Will need migration to add weight field and update roll-up logic.

### Analytics Page Shows Mock Data

**Problem:** Analytics page (`apps/web/src/app/dashboard/analytics/page.tsx`) exists but shows hardcoded data. Looks functional but isn't.

**Proof:** `apps/web/src/app/dashboard/analytics/page.tsx:102-107` and `175-197` show hardcoded arrays

**Impact:** Trust issue — if execs discover this during demo, they'll question what else is fake. Must fix before any demo (covered in Section A.2).

### No Team-Level Ownership Endpoint

**Problem:** Can query "all OKRs owned by User X" but no endpoint for "all OKRs owned by Team X". Must filter in frontend after fetching all OKRs.

**Proof:** `services/core-api/src/modules/okr/objective.service.ts:findAll()` filters by `organizationId` and `workspaceId` but not by team membership

**Impact:** Performance degradation as orgs grow. Team leads fetching all OKRs then filtering client-side will be slow at scale.







