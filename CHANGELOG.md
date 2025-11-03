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
