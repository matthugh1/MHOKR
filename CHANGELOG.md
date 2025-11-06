## [Tenant Canonicalisation] 2025-01-06

### Overview

Eliminated "organisation/org" vs "tenant" confusion by canonicalising to **tenant** terminology. Added runtime guardrails, backfilled NULL data, and introduced static/CI guardrails.

### Canonical Term

- **Tenant** is the canonical term for multi-tenancy
- **Tenant ID** (`tenantId`) is the canonical identifier
- Database schema retains `organizationId` column name (backward compatibility)

### Runtime Guardrails

- **Tenant Context Middleware** (`services/core-api/src/common/tenant/tenant-context.middleware.ts`)
  - Resolves `tenantId` from JWT, header, subdomain, session
  - Normalises `organizationId` → `tenantId` in request body/params/query
  - Attaches `req.tenantId` to all requests
  - Registered globally in `app.module.ts`

- **Tenant Mutation Guard** (`services/core-api/src/common/tenant/tenant-mutation.guard.ts`)
  - Enforces tenant boundary checks for all mutations (POST/PUT/PATCH/DELETE)
  - Validates `req.tenantId` is present
  - Ensures payload `tenantId` matches request `tenantId`
  - Registered globally via `APP_GUARD` provider

- **Service Entry Check** (`services/core-api/src/policy/tenant-boundary.ts`)
  - `assertMutationBoundary(userCtx, resourceCtx)` function
  - Call at TOP of every mutating service method
  - Idempotent: safe to call multiple times

- **DTO Normaliser Pipe** (`services/core-api/src/common/tenant/organization-to-tenant.pipe.ts`)
  - Accepts both `organizationId` and `tenantId` in DTOs
  - Normalises `organizationId` → `tenantId` with deprecation warning

### Data Backfill

- **Migration** (`prisma/migrations/20250106_tenant_not_null_guard/migration.sql`)
  - Backfills NULL `organizationId` via parent relationships (objectives→cycles/workspaces/teams)
  - Quarantines irreconcilable rows into `TENANT_QUARANTINE`
  - Adds NOT NULL constraints to all tenant-scoped tables
  - Adds foreign keys with ON DELETE RESTRICT

- **Backfill Report** (`docs/audit/TENANT_BACKFILL_REPORT.md`)
  - Pre/post migration statistics
  - Quarantine process documentation

### Static & CI Guardrails

- **ESLint Rule**: `local-tenant/no-org-identifier`
  - Flags `organizationId`, `organisationId`, `orgId` usage
  - Exceptions: DTOs, tests, migrations, seed files

- **ESLint Rule**: `local-tenant/no-unguarded-mutations`
  - Ensures mutations have `TenantMutationGuard`
  - Works alongside `RBACGuard` and `@RequireAction`

- **Type Aliases** (`services/core-api/src/modules/rbac/types.ts`)
  - `export type OrganizationId = never` - Forces compile-time errors
  - `export type TenantId = string` - Canonical type

### Telemetry

- `rbac_missing_tenant_context_total` - Incremented on missing tenant context (400 error)
- `org_to_tenant_mapping` - Logged when `organizationId` is normalised to `tenantId`

### Tests

- `services/core-api/src/common/tenant/__tests__/tenant-context.middleware.spec.ts`
  - Tenant resolution from JWT/header/subdomain/session
  - OrganizationId → tenantId normalisation

- `services/core-api/src/common/tenant/__tests__/tenant-mutation.guard.spec.ts`
  - Tenant boundary enforcement
  - Cross-tenant mutation rejection

- `services/core-api/src/common/tenant/__tests__/tenant-backfill.spec.ts`
  - Migration validation queries

### Documentation

- `docs/audit/TENANT_AUDIT_MAP.md` - Comprehensive audit of tenant identifiers
- `docs/audit/TENANT_NAMING_DRIFT.md` - Naming drift analysis
- `docs/audit/TENANT_NULL_SURVEY.sql` - SQL queries for NULL tenant_id
- `docs/audit/MUTATION_ENDPOINTS_WITHOUT_TENANT_CONTEXT.md` - Summary of endpoints missing tenant guards
- `docs/audit/TENANT_CANONICALISATION_NOTES.md` - Implementation notes and rollback guide

### Backward Compatibility

- `organizationId` parameter still accepted (with deprecation warning)
- Database schema unchanged (`organizationId` column retained)
- No breaking changes to API contracts

### Safety

- Idempotent: Re-running creates no duplicates; guards don't double-apply
- No business rules changed: Only enforcing presence/equality of tenant
- No DB fetches in middleware/guard: Compare IDs only

---

## [Superuser Policy Decision Explorer] 2025-01-27

### Feature

- **Policy Decision Explorer**: Read-only, superuser-only tool for inspecting live permission decisions
  - Backend endpoint: `POST /policy/decide` (requires `RBAC_INSPECTOR` flag and `SUPERUSER` role)
  - Frontend page: `/superuser/policy` (feature-flagged, superuser-only)
  - Integrates with centralised `AuthorisationService` for consistent permission evaluation
  - No mutations performed; all decisions are read-only
  - Telemetry events: `policy_decide_submitted`, `policy_decide_result` (frontend); deny logging (backend)

### Components

- **Backend**: `services/core-api/src/policy/policy.controller.ts` - Policy decision endpoint
- **Frontend**: `apps/web/src/app/superuser/policy/page.tsx` - Main explorer page
  - `UserPicker.tsx` - User autocomplete component
  - `ActionPicker.tsx` - Action dropdown (all 14 actions)
  - `ResourcePicker.tsx` - Resource context inputs (tenant/workspace/team/objective/keyResult/cycle)
  - `JsonContextEditor.tsx` - Collapsible JSON context editor
  - `DecisionViewer.tsx` - Result display with colour-coded badges and details

### Feature Flag

- **Name**: `RBAC_INSPECTOR`
- **Default**: `off` (disabled)
- **Backend**: `process.env.RBAC_INSPECTOR === 'true'`
- **Frontend**: Exposed via `GET /system/status` → `flags.rbacInspector`
- **Security**: Both route and endpoint gated by flag and superuser check

### Navigation

- Added "Superuser Tools" section to dashboard sidebar (only visible when superuser and flag enabled)
- Link: "Policy Explorer" with purple-themed styling

### Tests

- **Backend**: `services/core-api/src/policy/test/policy.controller.spec.ts`
  - 403 for non-superuser
  - 404 if flag disabled
  - Happy ALLOW and DENY paths
  - Response shape validation
  - Different user evaluation
  - OKR entity loading
- **Frontend**: `apps/web/src/app/superuser/policy/__tests__/superuser.policy.page.spec.tsx`
  - Page hides if not superuser or flag false
  - Submits form and renders DecisionViewer
  - Reason badge rendering

### Documentation

- **RBAC_INSPECTOR_NOTES.md**: Purpose, route, flag, role restriction, telemetry events, example payloads, reason codes, security notes

### Technical Notes

- No application behaviour changes (read-only endpoint)
- British English throughout
- No TODO/FIXME/HACK comments
- Production-safe (disabled by default, superuser-only)

---

## [RBAC Audit & Hardening] 2025-01-27

### Audit & Documentation

- **RBAC Permissions Audit**: Complete code-true map of permission model and enforcement points
  - Static code scanner (`scripts/rbac/audit-scan.ts`) maps all controller endpoints with guards, tenant checks, audit logging
  - Dynamic trace script (`scripts/rbac/audit-trace.ts`) for runtime verification with different roles
  - Spec vs code diff (`scripts/rbac/audit-spec-diff.ts`) compares auto-generated matrix with enforcement
  - Generated reports: `RBAC_ENFORCEMENT_MAP.md/.csv`, `RBAC_GUARD_CONSISTENCY_REPORT.md`, `RBAC_SPEC_DRIFT.md`, `RBAC_CALLGRAPH_MERMAID.md`
  - All documentation in British English with file:line citations

### Hardening

- **ESLint Rule**: `local-rbac/no-unguarded-mutation` blocks mutations without `@RequireAction` and `RBACGuard`
  - Rule location: `scripts/rbac/eslint-no-unguarded-mutation.js`
  - Configuration: `services/core-api/.eslintrc.custom-rules.js`
- **CI Check**: `scripts/rbac/ci-enforcement-check.ts` fails CI on CRITICAL/HIGH gaps (configurable via `RBAC_AUDIT_STRICT`)
- **RBAC Telemetry**: Lightweight deny event logging (`services/core-api/src/modules/rbac/rbac.telemetry.ts`)
  - Integrated into `RBACGuard` catch path
  - No-op if `RBAC_TELEMETRY=off`
  - Records action, role, route, reason code for monitoring

### Tests

- **RBAC Guard Enforcement Tests**: `services/core-api/src/modules/rbac/test/rbac.guard.enforcement.spec.ts`
  - SUPERUSER read-only enforcement (deny for create/edit/delete/publish)
  - Publish lock deny for non-admin roles
  - Tenant boundary deny (cross-tenant attempts)
- **Visibility Enforcement Tests**: `services/core-api/src/modules/rbac/test/visibility.enforcement.spec.ts`
  - PRIVATE objective invisibility for non-whitelisted users
  - TENANT_OWNER access to PRIVATE OKRs
  - TENANT_ADMIN whitelist handling

### Documentation

- **RBAC_AUDIT_SUMMARY.md**: Index linking to all generated artefacts
- **RBAC_GUARDRAILS.md**: Lint rule, CI check, telemetry hook documentation
- **FR_rbac-hardening-fixes.md**: Actionable backlog with file:line references and suggested fixes

### Technical Notes

- No application behaviour changes (except optional telemetry logging)
- All scripts use British English spelling
- No TODO/FIXME/HACK comments
- Preserves SUPERUSER read-only, tenant isolation, and visibility rules

---

## Seeds

### Large-Organisation Seed Suite

- **Seed Suite**: Comprehensive seed suite for provisioning large organisations (~200 users) with realistic OKR data
  - Idempotent seed scripts with deterministic UUIDv5 ID generation
  - Size presets: `tiny` (~25 users, ~30 objectives), `demo` (~200 users, ~256 objectives), `full` (~200 users, ~392 objectives)
  - 6 workspaces, ~20 teams, realistic OKR distribution across tenant/workspace/team levels
  - 4 cycles (Q4 2025 ACTIVE, Q1 2026 ACTIVE, Q2 2026 DRAFT, Q3 2026 ARCHIVED)
  - Realistic org chart with manager chains (depth 1-4)
  - Role distribution: 1 TENANT_OWNER, 5 TENANT_ADMIN, 24 WORKSPACE_LEAD, 24 TEAM_LEAD, remainder contributors
  - Attention items: overdue check-ins (10-15%), no-progress signals (15-25%)
  - PRIVATE visibility whitelists configured
  - SUPERUSER read-only enforcement
  - Validation probes and documentation
  - Commands: `npm run seed:dry`, `npm run seed:run`, `npm run seed:run:full`, `npm run seed:run:tiny`, `npm run seed:purge`

---

## [OKR Mini Sprint 4.0] 2025-01-XX

### Features
- **Attention Drawer Polish**: Enhanced attention drawer with role-aware empty states and badge count in button title
  - Badge count displayed in button title (e.g., "Attention (4)")
  - Drawer filters by current scope and cycleId
  - Role-aware empty state messages:
    - Tenant Admin/Owner: "No items need your attention. All OKRs are on track."
    - Manager/Lead: "No team items need attention right now."
    - Contributor: "Nothing needs your attention."
  - Telemetry: `attention_drawer_opened` and `attention_empty_state_viewed` events
- **Cycle Management Drawer**: New drawer for managing OKR cycles (admin/owner only)
  - List all cycles with name, dates, and status
  - Create new cycles with inline form
  - Edit existing cycles
  - Set cycle as active
  - Archive cycles
  - Delete cycles (if no linked OKRs)
  - Accessible from toolbar button or CycleSelector footer link
  - State updates immediately without page reload
  - Telemetry: `cycle_drawer_opened`, `cycle_created`, `cycle_archived`, `cycle_set_active` events

### Technical
- **AttentionDrawer**: Added `scope` prop and role detection logic
- **OKRToolbar**: Updated attention button to show count in title
- **CycleManagementDrawer**: New component `apps/web/src/app/dashboard/okrs/components/CycleManagementDrawer.tsx`
- **CycleSelector**: Added optional footer link for cycle management
- **OKRFilterBar**: Added `onManageCycles` prop support
- All drawer titles and messages use British English
- RBAC enforced: cycle management requires TENANT_OWNER or TENANT_ADMIN role
- Backend endpoints already exist: GET/POST/PATCH/DELETE `/okr/cycles`

### Accessibility
- All buttons have `aria-label` attributes
- Drawer titles use `aria-labelledby` and `aria-describedby`
- Focus trap implemented for drawer accessibility
- Keyboard navigation support (ESC to close)

---

## [OKR Mini Sprint 3.1] 2025-11-05

### Enhancements
- **Attention Badge Count (Scope-Aware)**: Badge count now updates when scope changes (my/team-workspace/tenant)
  - Added `data-testid="attention-badge"` for testing
  - Telemetry: `attention_badge_loaded` event fired once per scope+cycle combination
- **Governance Status Bar Hover Hint**: Added tooltip explaining "Summary only — use the filters below to refine what you see."
  - Non-interactive clarification (no click handlers)
  - Added `data-testid="gov-status-hint"` and `aria-describedby` for accessibility

### Technical
- Updated `loadAttentionCount()` to include scope parameter (future-proofing)
- Updated useEffect dependency array to include `selectedScope`
- Added tooltip wrapper to GovernanceStatusBar using existing Radix UI component

---

## [OKR Mini Sprint 3] 2025-11-05

### Features
- **Governance Status Bar**: Non-interactive summary strip showing cycle health metrics (Published/Draft counts, At Risk/Off Track KRs)
  - Fetches from `/okr/insights/cycle-summary` with scope parameter
  - Positioned above filter bar, below page title
  - Telemetry: `governance_status_viewed` event fired once per mount
- **Why Can't I Inspector**: Production-safe "Why?" links for blocked actions (user-flag gated)
  - Only visible when `rbacInspector` feature flag is enabled
  - Shows on blocked edit/delete actions and blocked check-ins
  - Popover displays reason code and human-readable message
  - Data-testids: `why-link`, `why-popover`
- **Inline Health Signals**: Enhanced row-level health hints
  - Shows "2 KRs at risk", "Overdue check-ins", "No progress 14 days" hints
  - Lazy-loaded via IntersectionObserver when row visible (≥50% threshold)
  - Telemetry: `inline_insight_loaded` event with signals array
  - Respects visibility: backend endpoint filters automatically

### Technical
- **GovernanceStatusBar**: New component `apps/web/src/app/dashboard/okrs/components/GovernanceStatusBar.tsx`
- **WhyCantIInspector**: New component `apps/web/src/components/okr/WhyCantIInspector.tsx`
- **InlineInsightBar**: Enhanced with "No progress 14 days" hint and telemetry
- No new filters added - GovernanceStatusBar is summary-only
- RBAC, tenant isolation, and visibility unchanged
- SUPERUSER remains read-only

---

## [OKR Scope Mini Sprint 2] 2025-11-05

### Improvements
- **Enhanced Lock Messages**: Clarified distinction between publish lock and cycle lock with improved British English copy
  - Publish lock: "This item is published. Only Tenant Admins or Owners can change published OKRs for this cycle."
  - Cycle lock: "This cycle is locked. Changes are disabled until the cycle is reopened."
  - SUPERUSER: "Platform administrator (read-only). You can view, but not change OKR content."
- **Console Guard**: Upgraded ESLint `no-console` rule from `'warn'` to `'error'` and removed console.log statements from OKR list code paths
- **Page Decomposition**: Split large `page.tsx` (1597 lines) into smaller components:
  - `OKRFilterBar.tsx` (186 lines) - Search, status filters, cycle selector
  - `OKRToolbar.tsx` (154 lines) - Scope toggle, attention button, add dropdown
  - `page.tsx` reduced to 1316 lines (~280 lines extracted)
- **Data Test IDs**: Added `tip-publish-lock`, `tip-cycle-lock`, `tip-superuser-readonly` for automated testing

### Technical
- No behaviour changes - pure refactoring and messaging improvements
- Public API of `OKRPageContainer` unchanged
- All telemetry events still fire correctly
- RBAC/visibility logic not altered

---

## [Production-Gated RBAC Inspector] 2025-11-03

### Features
- **RBAC Inspector**: Production-safe "Why can't I...?" permission reasoning tooltips
  - **Per-User Toggle**: Enabled via User Management drawer (requires `manage_users` permission)
  - **Tooltip Component**: Shows detailed permission reasoning when actions are denied
  - **Guards Displayed**: RBAC Permission, Publish Lock, Visibility (PRIVATE), EXEC_ONLY Flag, Tenant Match
  - **Security**: Never reveals cross-tenant resources or raw IDs the caller cannot access
  - **Audit Logging**: All toggles create `toggle_rbac_inspector` audit log entries

### Backend Changes
- **Migration**: Added `users.settings` JSONB column for user preferences and debug flags
- **New Endpoint**: `POST /rbac/inspector/enable` for toggling inspector per user
  - Requires `manage_users` permission
  - Enforces tenant isolation
  - Creates audit log entries
- **Session Feature Flag**: `req.user.features.rbacInspector` exposed in JWT strategy
- **Implementation**: `services/core-api/src/modules/rbac/rbac-inspector.controller.ts` and `.service.ts`

### Frontend Changes
- **User Management**: Added Troubleshooting section with RBAC Inspector toggle
- **Feature Flag Hook**: `apps/web/src/hooks/useFeatureFlags.ts` for accessing feature flags
- **Tooltip Component**: `apps/web/src/components/rbac/RbacWhyTooltip.tsx` for permission reasoning
- **OKR Integration**: Wrapped edit/delete buttons in ObjectiveRow with tooltip component
- **Type Updates**: Extended User interface to include `features` field

### Documentation
- **docs/audit/RBAC_INSPECTOR.md**: Comprehensive guide for enabling and using the inspector

### Technical Details
- Runtime cost near-zero when inspector disabled (feature flag check only)
- Tooltip only renders when:
  1. User has `rbacInspector` feature flag enabled
  2. Action is denied (not allowed)
- No schema changes beyond adding `settings` JSONB column
- British English copy throughout
- No TODO/FIXME/HACK comments

---

## [User Management RBAC Enhancements] 2025-11-03

### Features
- **Enhanced User Management Screen**: Added RBAC insights and governance context to existing User Management screen
  - **Table Enhancements**: New columns for Roles (grouped by scope), Effective Permissions (count badge), and Governance Status (pill)
  - **Quick Filter**: "Show users with edit rights" filter to quickly find users with edit permissions
  - **Row Drawer Enhancements**: 
    - Roles & Scopes section showing role chips grouped by TENANT/WORKSPACE/TEAM scope
    - Effective Actions grouped by category (OKR, Governance, Admin)
    - Governance overlays (SUPERUSER read-only flag, publish lock info)
    - Visibility policy note explaining PRIVATE-only restrictions
  - **Role Assignment**: Assign/revoke controls shown only if caller has `manage_users` permission
  - **Backend Extension**: `GET /rbac/assignments/effective` now accepts optional `userId` query param for admin inspection
  - **Audit Logging**: Admin inspection of user permissions creates `view_user_access` audit log entry
  - **Tenant Isolation**: Cross-tenant inspection blocked; requires `manage_users` permission

### Backend Changes
- Extended `GET /rbac/assignments/effective` endpoint:
  - Added `userId` query parameter (optional) for admin inspection
  - Added tenant isolation check when inspecting other users
  - Added `manage_users` permission check for cross-user inspection
  - Added audit logging for `view_user_access` events
  - Implementation: `services/core-api/src/modules/rbac/rbac-assignment.controller.ts:113-182`

### Frontend Changes
- Enhanced User Management table (`apps/web/src/app/dashboard/settings/people/page.tsx`):
  - Added Roles column with chips grouped by scope
  - Added Effective Permissions badge showing action count
  - Added Governance Status pill (Read-only (Superuser) | Normal)
  - Added quick filter for users with edit rights
- Enhanced user drawer:
  - Added RBAC Insights section with roles by scope
  - Added Effective Actions grouped by category
  - Added Governance Status overlays
  - Added Visibility Policy note
  - Conditional role assignment controls (requires `manage_users`)
- New hook: `apps/web/src/hooks/useEffectivePermissions.ts` for fetching effective permissions

### Documentation
- **docs/audit/RBAC_EFFECTIVE_API.md**: Comprehensive API documentation for effective permissions endpoint
- **docs/audit/RBAC_SMOKE_TESTS.md**: Added admin inspection test cases with curl examples

### Technical Details
- Reuses existing endpoints: `GET /rbac/assignments/effective`, `GET /rbac/assignments/me`
- No schema changes
- No new routes
- All changes are additive
- British English copy throughout
- No TODO/FIXME/HACK comments

---

## [RBAC Audit & Snapshot Tools] 2025-11-03

### Features
- **GET /rbac/assignments/effective**: New endpoint to query effective permissions for authenticated users
  - Returns all actions (allowed/denied) at specified scopes (tenant/workspace/team)
  - Query parameters: `tenantId`, `workspaceId`, `teamId` for filtering
  - Useful for debugging permission issues and RBAC auditing
  - Implementation: `services/core-api/src/modules/rbac/rbac-assignment.controller.ts:113-133`
  - Service: `services/core-api/src/modules/rbac/rbac.service.ts:259-410`

### Documentation
- **docs/audit/RBAC_MATRIX_AUTO.md**: Auto-generated RBAC matrix with comprehensive role → action → scope mapping
  - Complete role hierarchy with priority levels (SUPERUSER=100 → TENANT_VIEWER=10)
  - Action-by-action authorization logic with file/line citations
  - All 14 actions documented with allow/deny rules
  - Special constraints: Publish Lock, EXEC_ONLY restrictions, PRIVATE visibility, tenant boundaries
  - 6 critical deny cases with references to source code
  - File reference index for all RBAC modules

- **docs/audit/RBAC_SMOKE_TESTS.md**: Curl-based smoke tests for RBAC verification
  - 6 test categories covering deny/allow cases
  - Complete setup instructions with JWT token generation
  - Test automation script template
  - Debugging tips and troubleshooting guide

### Tests
- **services/core-api/src/modules/rbac/rbac.e2e.spec.ts**: Comprehensive E2E test suite
  - **SUPERUSER Deny Cases**: Verifies SUPERUSER cannot create/edit/delete/publish OKRs (rbac.ts:182-184)
  - **Publish Lock Deny**: Validates cycle lock prevents non-admin edits of published OKRs (rbac.ts:310-323)
  - **PRIVATE Visibility Deny**: Tests PRIVATE OKR access restrictions (visibilityPolicy.ts:46-48, 62-107)
  - **Tenant Boundary Deny**: Ensures cross-tenant isolation (rbac.service.ts:270-298)
  - **Additional Cases**: TENANT_VIEWER restrictions, billing management exclusivity
  - 30+ test cases with full setup/teardown and realistic data

### Technical Details
- Endpoint uses existing `can()` function from `rbac.ts` switch logic
- Tests all 14 actions: `view_okr`, `edit_okr`, `delete_okr`, `create_okr`, `request_checkin`, `publish_okr`, `manage_users`, `manage_billing`, `manage_workspaces`, `manage_teams`, `impersonate_user`, `manage_tenant_settings`, `view_all_okrs`, `export_data`
- Results are consistent with core RBAC authorization logic
- Cache-aware: uses fresh context (`useCache: false`) for permission checks

### References
- Primary authorization logic: `services/core-api/src/modules/rbac/rbac.ts:91-756`
- Visibility policy: `services/core-api/src/modules/rbac/visibilityPolicy.ts:29-327`
- Role assignments: `services/core-api/src/modules/rbac/rbac.service.ts:26-506`

---

## [Security Hardening] W1.M1 Complete

- All tenant-scoped mutations are now protected by tenant isolation checks.
- SUPERUSER is read-only across tenant data and cannot perform write operations.
- All mutating endpoints are now wrapped in JwtAuthGuard + RBACGuard + @RequireAction().
- Role assignment, workspace/team membership changes, exec visibility whitelist changes, and other privileged actions are now logged through a central AuditLogService.
- There are no remaining TODO/FIXME/HACK placeholders in these security-sensitive services and controllers.
- A validation plan has been documented (docs/audit/W1M1_TEST_VALIDATION_PLAN.md) describing expected behaviour per role (TENANT_ADMIN, WORKSPACE_LEAD, TEAM_LEAD, CONTRIBUTOR, SUPERUSER).

## [Security Hardening] W1.M2 Complete

- Check-in request creation is now restricted to authorised roles only (direct managers, tenant admins/owners, workspace leads, and team leads).
- SUPERUSER cannot request check-ins. SUPERUSER is read-only and cannot initiate performance-style escalation.
- All check-in request creation events are now logged through AuditLogService with actor, target, org, and due date context.
- Cross-tenant escalation is blocked; you cannot request an update from someone in another organisation.
- A dedicated RBAC action ('request_checkin') and guard path have been added so this capability is explicitly permissioned.
- Manual validation steps are defined in W1.M2's validation plan (manager allowed, peer blocked, superuser blocked).

## [Governance Alignment] W2.M1 Complete

- The UI now hides edit, delete, drag, and update actions when the user is not allowed to perform them.
- Publish-locked and cycle-locked OKRs are now effectively read-only in the UI for normal users, but remain editable for tenant admins.
- The visual OKR builder is now permission-aware: contributors and workspace leads cannot drag or edit locked objectives, and destructive actions are not displayed.
- All destructive controls are now aligned with backend RBAC and governance rules. Buttons that would 403 are no longer rendered.
- This prevents accidental or misleading actions during demos and enforces trust in what the user sees.

## [Visibility Enforcement] W2.M2 Complete

- Sensitive and executive-only OKRs are now fully suppressed from the UI for unauthorised users. They do not render at all.
- PRIVATE objectives are only visible to their owner, tenant admins/owners, or explicitly whitelisted viewers.
- Key Results inherit visibility from their parent Objective and are hidden when the Objective is hidden.
- The OKR list and visual builder both pre-filter data before rendering. Contributors and workspace leads no longer see exec/board objectives unless allowed.
- Tenant admins continue to see full strategic context.
- This prevents leakage of strategic and performance-sensitive objectives to unauthorised users.

## [Performance & Scale] W3.M1 Complete

- The OKR list page has been refactored into a container (OKRPageContainer) and a virtualised list (OKRListVirtualised).
- The route file (page.tsx) is no longer a 1,700+ line monolith; rendering logic, permissions logic, and paging logic are now separated.
- Client-side pagination (20 objectives per page) has been introduced, with Next/Previous navigation and page reset on filter changes.
- Virtualised rendering now ensures that only the currently visible rows (plus buffer) mount in the DOM, keeping the UI responsive even with 200+ objectives / 600+ key results.
- All existing governance rules remain enforced in the UI:
  - Publish / cycle lock rules from W2.M1
  - Visibility rules (PRIVATE, exec-only, whitelist) from W2.M2
  - SUPERUSER remains read-only for destructive actions
- A validation plan (docs/audit/W3M1_VALIDATION_PLAN.md) defines performance, pagination, role-based visibility, and regression checks.

## [Data Minimisation & Access Control] W3.M2 Complete

- The OKR overview API now enforces per-user visibility, tenant isolation, and governance rules before returning data.
- The API returns only the objectives the caller is allowed to see, with server-side pagination (`page`, `pageSize`, `totalCount`).
- Objectives and Key Results now include `canEdit`, `canDelete`, and `canCheckIn` flags computed on the server based on publish lock, cycle lock, RBAC scope, and SUPERUSER read-only status.
- The frontend now requests paginated data from the backend (`/okr/overview?page=N&pageSize=20`) and renders only what the backend provides. No more client-side slicing or client-side hiding.
- Analytics endpoints now exclude PRIVATE / exec-only OKRs and their Key Results for unauthorised users. Tenant admins still see full rollups; contributors and workspace leads only see numbers they are allowed to see.
- A validation plan (docs/audit/W3M2_VALIDATION_PLAN.md) defines pagination, visibility, governance, SUPERUSER and analytics checks.

## [Operational Safeguards & Policy Enforcement] W3.M3 Complete

- Introduced `/system/status` endpoint for operational visibility.
- Added in-memory rate limiting guard to critical mutation endpoints (check-in requests, RBAC assignments, whitelist, OKRs).
- Implemented automated smoke test suite validating tenant isolation, visibility enforcement, pagination, and SUPERUSER read-only policy.
- Wired CI script `smoke:test` to enforce policy regressions before deployment.
- Added enforcement documentation at `docs/audit/W3M3_ENFORCEMENT_NOTES.md`.
- No TODO/FIXME/HACK comments; all changes follow existing NestJS patterns.
- This milestone ensures that all access control, governance, and visibility behaviours from W1–W3 are locked in and automatically tested.

## [W5.M1 — Tests & CI] Complete

- **Backend Unit Tests**: Added comprehensive unit tests for `ObjectiveService.createComposite()` covering validation, RBAC, governance, tenant isolation, PRIVATE visibility, KR validation, and AuditLog (20 test cases).
- **Backend Integration Tests**: Added E2E tests for `POST /okr/create-composite` endpoint covering happy path, PRIVATE visibility enforcement, rate limiting, and governance (7 test cases).
- **Frontend Component Tests**: Added component tests for `OKRCreationDrawer` publish flow covering validation gates, visibility options, SUPERUSER block, success flow, and error handling (12 test cases).
- **Test Fixtures**: Created `TestFixtures` utility class for creating test data (users, organizations, cycles) and `MockAuditLogSink` for audit log assertions.
- **CI Scripts**: Added `test:unit`, `test:e2e`, and `test:all` scripts to backend package.json. Added `test`, `test:watch`, and `test:coverage` scripts to frontend package.json.
- **E2E Config**: Created `test/jest-e2e.json` configuration for integration tests.
- **Documentation**: Test coverage matrix and notes at `docs/audit/W5M1_TESTS_NOTES.md`.

## [W5.M3 — UX Polish, Performance Budgets & Accessibility] Complete

- **Focus & Keyboard UX**: Added focus trap and return focus logic for both drawers (Creation, Attention). Esc key closes drawers. Visible focus rings on all actionable elements.
- **Skeleton Components**: Created `OkrRowSkeleton`, `InlineInsightSkeleton`, `CycleHealthSkeleton`, `DrawerFormSkeleton` with stable heights to avoid CLS.
- **Accessibility (WCAG 2.1 AA)**: Added landmarks (header/main/aside roles), `aria-labelledby` for drawers, keyboard operation (Enter/Space activate buttons), `aria-busy` on list container, live region (polite) for updates, and `aria-label` on all chips.
- **Performance Budgets**: Documented budgets (first list render ≤ 150ms, scroll frame no long tasks > 50ms, drawer open ≤ 120ms, insight fetch skeleton ≤ 50ms). Bundle budget ≤ 180 KB gz (commented).
- **Virtualisation Tuning**: Created shared `useRowVisibilityObserver` hook with rootMargin '200px' to avoid re-creating observers per row.
- **Error Mapping**: Standardised error messages (403, 429, governance) with specific guidance. Governance errors show inline alerts with actionable messages.
- **Chip Components**: Created accessible `StatusChip`, `PublishStateChip`, `VisibilityChip` components with aria-labels and keyboard support.
- **Telemetry**: Added timing marks (`performance.now()`) around objective insight loads and drawer publish clicks.
- **Documentation**: PR body at `docs/audit/W5M3_PR_BODY.md`.

## [W5.M2 — Tests & CI] Complete

- **Backend Unit Tests**: Added comprehensive unit tests for `OkrInsightsService` covering cycle summary, objective insights, attention feed, visibility filtering, status trend calculation, and overdue check-in logic (15+ test cases).
- **Backend E2E Tests**: Added integration tests for insights endpoints (`GET /okr/insights/cycle-summary`, `GET /okr/insights/objective/:id`, `GET /okr/insights/attention`) covering happy path, visibility enforcement, pagination, and performance guardrails (10+ test cases).
- **Frontend Component Tests**: Added component tests for `CycleHealthStrip`, `InlineInsightBar`, and `AttentionDrawer` covering rendering, lazy loading, pagination, permission gating, and telemetry (20+ test cases).
- **Frontend Integration Tests**: Added integration tests for OKRs page with insights features covering visibility filtering and component integration (5+ test cases).
- **CI Scripts**: Updated backend `test:all` script (already present). Updated frontend `test` script to include coverage. CI workflow ready for test job additions.
- **Documentation**: Test coverage matrix and notes at `docs/audit/W5M2_TESTS_NOTES.md`.

## [W5.M2 — Inline Insights & Cycle Health] Complete

- **Backend**: Implemented insights endpoints (`GET /okr/insights/cycle-summary`, `GET /okr/insights/objective/:id`, `GET /okr/insights/attention`) providing cycle health summaries, objective-level insights, and paginated attention feeds.
- **Frontend**: Added Cycle Health Strip (header), Inline Insight Bar (per objective row), and Attention Drawer (right-side panel) components.
- **Visibility**: All insights respect server-side visibility filtering and tenant isolation. PRIVATE/EXEC_ONLY objectives excluded for non-whitelisted users.
- **Performance**: Optimized queries with indexed filters. Lazy loading via IntersectionObserver for inline insights. Optional LRU cache hint for cycle summary (not yet implemented).
- **Telemetry**: Added events (`okr.insights.cycle.open`, `okr.insights.objective.loaded`, `okr.insights.attention.open`, `okr.insights.request_checkin.click`).
- **Documentation**: Implementation notes at `docs/audit/W5M2_IMPLEMENTATION_NOTES.md`.

## [W5.M1 — Publishable OKR Creation Flow] Complete

- **Backend**: Implemented composite create endpoint `POST /okr/create-composite` that atomically creates an Objective and its Key Results with validation, RBAC, governance, and AuditLog.
- **Frontend**: Updated OKR creation drawer to use composite endpoint (STEPs B–D wired). Permission gating and governance warnings already in place.
- **Validation**: Enforces required fields, tenant isolation, visibility permissions (PRIVATE requires admin), whitelist validation, and cycle lock governance.
- **Transaction**: Uses Prisma `$transaction()` to ensure atomicity (Objective + all Key Results created or rolled back together).
- **RBAC**: Checks `create_okr` permission before allowing creation. SUPERUSER hard-deny on write.
- **Governance**: Cycle lock enforcement (LOCKED/ARCHIVED cycles require admin override).
- **AuditLog**: Logs `objective_created` and `key_result_created` entries with actor, tenantId, objectiveId, and KR IDs.
- **Telemetry**: Added events (`okr.create.open`, `okr.create.step_viewed`, `okr.create.publish.success`, `okr.create.publish.forbidden`, `okr.create.abandon`).
- **Rate Limiting**: Composite endpoint protected by `RateLimitGuard` (30 requests per minute per user).
- **Limitations**: Draft mode not yet implemented (always publishes). EXEC_ONLY visibility excluded from creation UI per W4.M1 note.
- **Documentation**: Implementation notes at `docs/audit/W5M1_IMPLEMENTATION_NOTES.md`.

## [Taxonomy & Data Model Alignment] W4.M1 Complete

- **Cycle vs Period**: Period model completely removed (W4.M2). Cycle is canonical operational planning period.
- **Status vs Publish State**: Explicitly separated in API responses with new `publishState` field (`PUBLISHED | DRAFT`). `status` field represents progress state (`ON_TRACK | AT_RISK | OFF_TRACK | COMPLETED | CANCELLED`). `isPublished` boolean kept for backward compatibility.
- **Visibility Model**: Deprecated visibility values (`WORKSPACE_ONLY`, `TEAM_ONLY`, `MANAGER_CHAIN`, `EXEC_ONLY`) normalized to `PUBLIC_TENANT` in migration. Only canonical values (`PUBLIC_TENANT`, `PRIVATE`) exposed in API responses. `EXEC_ONLY` removed from creation context.
- **Pillars**: `pillarId` deprecated in API responses (kept in DB for backward compatibility). Pillars table remains but not exposed in main OKR API.
- **Initiatives Anchoring**: Verified correct (no changes needed). Initiatives can anchor to Objective OR Key Result (or both).
- **Migration**: Reversible migration `20251103000000_w4m1_taxonomy_alignment` normalizes deprecated visibility values.
- **Tests**: Added unit tests for visibility inheritance and enum separation. Added integration tests for `/okr/overview` contract.

## [Inline Insights & Cycle Health] W5.M2 Complete

- **Backend**: Implemented three new insights endpoints (`GET /okr/insights/cycle-summary`, `GET /okr/insights/objective/:id`, `GET /okr/insights/attention`) with visibility filtering and tenant isolation.
- **Cycle Health Summary**: Returns aggregated counts for objectives (published/draft), KRs (on track/at risk/blocked/completed), and check-ins (upcoming/overdue/recent) for a specific cycle.
- **Objective Insights**: Returns status trend, last update age, KR roll-ups, and check-in counts for a single objective.
- **Attention Feed**: Returns paginated list of attention items (overdue check-ins, no updates 14+ days, status downgrades) with visibility filtering.
- **Frontend**: Added Cycle Health Strip component in header showing cycle health metrics with clickable chips for filtering.
- **Frontend**: Added Inline Insight Bar component in objective rows showing status trend, last update age, KR roll-ups, and check-in badges (lazy-loaded via IntersectionObserver).
- **Frontend**: Added Attention Drawer component (right-side sheet) showing paginated attention items with navigation and request check-in actions.
- **Visibility**: All insights respect server-side visibility filtering. No client-side guessing. PRIVATE/EXEC_ONLY objectives excluded for non-whitelisted users.
- **Tenant Isolation**: All endpoints enforce tenant isolation using `OkrTenantGuard`. SUPERUSER sees all but read-only.
- **Performance**: Optimized queries with indexed filters. Batched fetch for objective-level insights. No heavy joins in hot path.
- **Telemetry**: Added events (`okr.insights.cycle.open`, `okr.insights.objective.loaded`, `okr.insights.attention.open`, `okr.insights.request_checkin.click`).
- **Documentation**: Implementation notes at `docs/audit/W5M2_IMPLEMENTATION_NOTES.md`.
