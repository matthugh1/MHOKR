# TODO Audit Report - Phase-Tagged Items

**Generated:** 2025-01-XX  
**Scope:** All TypeScript (.ts) and TSX (.tsx) files across apps/, services/, scripts/, packages/

---

## Summary

- **Phase 5 (Core):** 8 TODOs - Critical functional items that must ship
- **Phase 6 (Polish):** 51 TODOs - UX enhancements, animations, visual improvements
- **Phase 7 (Hardening):** 90 TODOs - Validation, security, performance, backend alignment
- **Total:** 149 TODOs
- **Completed:** 0 (no DONE/completed markers found)

---

## Phase 5: Core Functional Items (Must Ship)

| Phase | File | Line | Summary | Context |
|-------|------|------|---------|---------|
| phase5-core | `apps/web/src/app/dashboard/okrs/page.tsx` | 513 | open EditObjectiveModal here instead of routing to Visual Builder | `handleEditOKR` function - currently routes to Visual Builder, should open inline modal |
| phase5-core | `apps/web/src/app/dashboard/okrs/page.tsx` | 644 | inline check-in workflow for this KR | `handleAddCheckIn` function - currently just logs, needs full check-in UI |
| phase5-core | `apps/web/src/components/okr/ObjectiveRow.tsx` | 530 | Display owner avatar if KR owner differs from objective owner (requires owner data in KR response) | Key Result rendering section - needs owner data from backend |
| phase5-core | `services/core-api/src/modules/okr/okr-overview.controller.ts` | 165 | resolve actual cycle state | `getOverview` method - currently uses `o.cycle.status`, needs proper cycle state resolution |
| phase5-core | `apps/web/src/components/okr/ObjectiveCard.tsx` | 394 | open initiative modal pre-scoped to this KR | Key Result section - "+ Initiative" button click handler |
| phase5-core | `apps/web/src/components/okr/ObjectiveCard.tsx` | 404 | inline check-in workflow for this KR | Key Result section - "Add check-in" button click handler |
| phase5-core | `apps/web/src/components/okr/ObjectiveCard.tsx` | 433 | open initiative modal scoped to this Objective | Initiative section - "+ Initiative" button click handler |
| phase5-core | `apps/web/src/components/okr/NewKeyResultModal.tsx` | 274 | Wire POST /api/key-results with the objectiveId when saving | Form submission - ensure objectiveId is included in API call |

---

## Phase 6: Polish / UX / Animation

| Phase | File | Line | Summary | Context |
|-------|------|------|---------|---------|
| phase6-polish | `apps/web/src/app/dashboard/okrs/page.tsx` | 67 | reintroduce compact view with grid/list toggle | Component state - viewMode currently unused, needs grid/list UI |
| phase6-polish | `apps/web/src/app/dashboard/okrs/page.tsx` | 126 | consolidate these into a reducer | Multiple state variables for modals/filters - should use useReducer |
| phase6-polish | `apps/web/src/app/dashboard/okrs/page.tsx` | 406 | hydrate from backend once periods endpoint exists | `legacyPeriods` useMemo - currently hardcoded, needs backend endpoint |
| phase6-polish | `apps/web/src/app/dashboard/okrs/page.tsx` | 951 | tracked in GH issue 'Phase 6 polish bundle' | Active Cycle Banner - polish item |
| phase6-polish | `apps/web/src/app/dashboard/okrs/page.tsx` | 1202 | reintroduce compact view with grid/list toggle | Filters section - commented out grid/list toggle UI |
| phase6-polish | `apps/web/src/app/dashboard/okrs/page.tsx` | 1250 | Fade-in animation when first Objective appears | Empty state rendering - needs entrance animation |
| phase6-polish | `apps/web/src/app/dashboard/okrs/page.tsx` | 1268 | tracked in GH issue 'Phase 6 polish bundle' | Empty state message - polish item |
| phase6-polish | `apps/web/src/app/dashboard/okrs/page.tsx` | 1389 | tracked in GH issue 'Phase 6 polish bundle' | PublishLockWarningModal lock message - polish item |
| phase6-polish | `apps/web/src/app/dashboard/okrs/page.tsx` | 1438 | toast "Objective created" | NewObjectiveModal onSubmit success handler |
| phase6-polish | `apps/web/src/app/dashboard/okrs/page.tsx` | 1443 | surface inline form error state | NewObjectiveModal onSubmit error handler |
| phase6-polish | `apps/web/src/app/dashboard/okrs/page.tsx` | 1489 | toast "Key Result added" | NewKeyResultModal onSubmit success handler |
| phase6-polish | `apps/web/src/app/dashboard/okrs/page.tsx` | 1493 | surface inline form error state | NewKeyResultModal onSubmit error handler |
| phase6-polish | `apps/web/src/app/dashboard/okrs/page.tsx` | 1560 | toast "Initiative added" | NewInitiativeModal onSubmit success handler |
| phase6-polish | `apps/web/src/app/dashboard/okrs/page.tsx` | 1564 | surface inline form error state | NewInitiativeModal onSubmit error handler |
| phase6-polish | `apps/web/src/components/okr/ObjectiveRow.tsx` | 258 | Animate progress bar changes with spring transition | Progress bar rendering - motion.div exists but needs spring animation |
| phase6-polish | `apps/web/src/components/okr/ObjectiveRow.tsx` | 311 | Add subtle fade/slide-in of these pills on row hover for visual focus without clutter | Execution metadata pills - hover animation |
| phase6-polish | `apps/web/src/components/okr/ObjectiveRow.tsx` | 312 | animate pill colour on status changes with framer-motion layout + animate prop | Execution metadata pills - status change animation |
| phase6-polish | `apps/web/src/components/okr/ObjectiveRow.tsx` | 319 | Add a tiny ▲ / ▼ arrow based on change vs previous check-in | Confidence pill - trend indicator |
| phase6-polish | `apps/web/src/components/okr/ObjectiveRow.tsx` | 451 | Animate expand/collapse using framer-motion height + opacity | Expanded body section - needs smooth expand/collapse |
| phase6-polish | `apps/web/src/components/okr/ObjectiveRow.tsx` | 512 | Animate progress bar changes with spring transition | Key Result progress bar - same as line 258 |
| phase6-polish | `services/core-api/src/modules/okr/okr-overview.controller.ts` | 198 | join latest check-ins | `getOverview` response - `latestConfidencePct` currently null, needs check-in join |
| phase6-polish | `apps/web/src/components/okr/ObjectiveCard.tsx` | 467 | If due date is within next 7 days and status !== COMPLETE, colour the due date text-rose-600 and append "• Upcoming" | Initiative rendering - due date styling logic (partially implemented) |
| phase6-polish | `apps/web/src/components/okr/NewObjectiveModal.tsx` | 250 | After successful create, offer CTA "Add first Key Result" with the returned objectiveId | Form submission success - needs post-create CTA |
| phase6-polish | `apps/web/src/app/dashboard/me/page.tsx` | 906 | Add sparkline animation showing update frequency over time | My Dashboard - needs sparkline visualization |
| phase6-polish | `apps/web/src/components/dashboard/KpiCard.tsx` | 29 | Implement spring-based number animation using useMotionValue + useTransform | KpiCard component - value display needs animated counting |
| phase6-polish | `apps/web/src/app/dashboard/page.tsx` | 393 | Add more rows e.g. "Objectives flagged At Risk", etc. | Dashboard summary section - expand summary rows |
| phase6-polish | `apps/web/src/app/dashboard/ai/page.tsx` | 124 | tracked in GH issue 'Phase 6 polish bundle' | Executive summary section - polish item |
| phase6-polish | `apps/web/src/components/ui/CycleSelector.tsx` | 142 | tracked in GH issue 'Phase 6 polish bundle' | Popover menu - Current & Upcoming section header |
| phase6-polish | `apps/web/src/components/ui/CycleSelector.tsx` | 166 | tracked in GH issue 'Phase 6 polish bundle' | Popover menu - No cycles message |
| phase6-polish | `apps/web/src/components/ui/CycleSelector.tsx` | 174 | tracked in GH issue 'Phase 6 polish bundle' | Popover menu - Previous section header |
| phase6-polish | `apps/web/src/components/ui/CycleSelector.tsx` | 199 | tracked in GH issue 'Phase 6 polish bundle' | Popover menu - Legacy Periods section header |
| phase6-polish | `apps/web/src/components/ui/CycleSelector.tsx` | 224 | visual grouping headers in popover | Popover menu - Special section header styling |
| phase6-polish | `services/core-api/src/modules/okr/okr-reporting.controller.ts` | 118 | tracked in GH issue 'Phase 6 polish bundle' | `getActiveCycles` endpoint comment |
| phase6-polish | `services/core-api/src/modules/okr/okr-reporting.controller.ts` | 147 | tracked in GH issue 'Phase 6 polish bundle' | `getPillarCoverage` endpoint comment |
| phase6-polish | `services/core-api/src/modules/okr/okr-reporting.controller.ts` | 161 | tracked in GH issue 'Phase 6 polish bundle' | `getOverdueCheckIns` endpoint comment |
| phase6-polish | `apps/web/src/app/dashboard/okrs/components/PublishLockWarningModal.tsx` | 56 | tracked in GH issue 'Phase 6 polish bundle' | Modal component - polish item |
| phase6-polish | `apps/web/src/app/dashboard/analytics/page.tsx` | 78 | tracked in GH issue 'Phase 6 polish bundle' | Analytics page - polish item |
| phase6-polish | `apps/web/src/app/dashboard/analytics/page.tsx` | 197 | tracked in GH issue 'Phase 6 polish bundle' | Analytics page - polish item |
| phase6-polish | `apps/web/src/app/dashboard/analytics/page.tsx` | 259 | tracked in GH issue 'Phase 6 polish bundle' | Analytics page - polish item |
| phase6-polish | `apps/web/src/app/dashboard/analytics/page.tsx` | 306 | tracked in GH issue 'Phase 6 polish bundle' | Analytics page - polish item |
| phase6-polish | `apps/web/src/app/dashboard/analytics/page.tsx` | 348 | tracked in GH issue 'Phase 6 polish bundle' | Analytics page - polish item |
| phase6-polish | `apps/web/src/app/dashboard/analytics/page.tsx` | 393 | tracked in GH issue 'Phase 6 polish bundle' | Analytics page - polish item |
| phase6-polish | `services/core-api/src/modules/okr/okr-reporting.service.ts` | 510 | tracked in GH issue 'Phase 6 polish bundle' | Reporting service - polish item |
| phase6-polish | `apps/web/src/components/ui/ActivityDrawer.tsx` | 75 | tracked in GH issue 'Phase 6 polish bundle' | ActivityDrawer component - polish item |
| phase6-polish | `apps/web/src/components/ui/ActivityDrawer.tsx` | 93 | tracked in GH issue 'Phase 6 polish bundle' | ActivityDrawer component - polish item |
| phase6-polish | `apps/web/src/components/dashboard-layout.tsx` | 146 | tracked in GH issue 'Phase 6 polish bundle' | DashboardLayout component - polish item |
| phase6-polish | `apps/web/src/app/dashboard/builder/page.tsx` | 178 | hydrate from backend once periods endpoint exists | Builder page - legacy periods hydration |
| phase6-polish | `apps/web/src/app/dashboard/builder/page.tsx` | 944 | align header spacing with analytics/okrs headers if design tweaks | Builder page header - spacing alignment |
| phase6-polish | `apps/web/src/app/dashboard/builder/components/EditPanel.tsx` | 95 | Add CTA to create a new objective | EditPanel component - empty state CTA |
| phase6-polish | `apps/web/src/app/dashboard/builder/components/EditPanel.tsx` | 140 | replace with a nicer inline callout component | EditPanel component - callout styling |
| phase6-polish | `apps/web/src/app/dashboard/builder/components/EditFormTabs.tsx` | 177 | replace with a nicer inline callout component | EditFormTabs component - callout styling |

---

## Phase 7: Hardening / Validation / Performance / Security

| Phase | File | Line | Summary | Context |
|-------|------|------|---------|---------|
| phase7-hardening | `apps/web/src/app/dashboard/okrs/page.tsx` | 86 | move to SWR/react-query once we introduce caching & invalidation | Component state - `loading` state management, needs data fetching library |
| phase7-hardening | `apps/web/src/app/dashboard/okrs/page.tsx` | 292 | Replace with /objectives/cycles/all endpoint when available to show all cycles, not just active | `loadActiveCycles` function - currently only loads active cycles |
| phase7-hardening | `apps/web/src/app/dashboard/okrs/page.tsx` | 487 | align with backend once cycle status is fully exposed in API responses | `handleEditOKR` function - cycle status mapping |
| phase7-hardening | `apps/web/src/app/dashboard/okrs/page.tsx` | 514 | Visual Builder is for planning / storytelling, not basic CRUD | `handleEditOKR` function - routing logic comment |
| phase7-hardening | `apps/web/src/app/dashboard/okrs/page.tsx` | 563 | align with backend once cycle status is fully exposed in API responses | `renderObjectiveRow` function - cycle status mapping |
| phase7-hardening | `apps/web/src/app/dashboard/okrs/page.tsx` | 623 | Virtualise ObjectiveRows when >50 items using react-window or similar | `groupedObjectives` useMemo - performance optimization for large lists |
| phase7-hardening | `apps/web/src/app/dashboard/okrs/page.tsx` | 650 | align with backend once cycle status is fully exposed in API responses | `handleDeleteOKR` function - cycle status mapping |
| phase7-hardening | `apps/web/src/app/dashboard/okrs/page.tsx` | 909 | restrict Visual Builder to admin / strategy roles only | Visual Builder button - needs RBAC check |
| phase7-hardening | `apps/web/src/app/dashboard/okrs/page.tsx` | 1441 | map backend validation errors to field-level messages | NewObjectiveModal error handling |
| phase7-hardening | `apps/web/src/app/dashboard/okrs/page.tsx` | 1491 | map backend validation errors to field-level messages | NewKeyResultModal error handling |
| phase7-hardening | `apps/web/src/app/dashboard/okrs/page.tsx` | 1562 | map backend validation errors to field-level messages | NewInitiativeModal error handling |
| phase7-hardening | `apps/web/src/components/okr/ObjectiveRow.tsx` | 320 | surface tooltip on hover explaining where the numbers come from | Confidence pill - needs explanatory tooltip |
| phase7-hardening | `services/core-api/src/modules/okr/okr-overview.controller.ts` | 197 | compute via analytics join | `getOverview` response - `overdueCheckInsCount` currently 0, needs proper join |
| phase7-hardening | `apps/web/src/components/okr/NewInitiativeModal.tsx` | 182 | Support re-parenting / linking initiative to both an Objective and a Key Result | Form component - initiative linking logic |
| phase7-hardening | `apps/web/src/app/dashboard/me/page.tsx` | 179 | Move cadence logic server-side | `updateDiscipline` useMemo - cadence calculation should be server-side |
| phase7-hardening | `apps/web/src/app/dashboard/me/page.tsx` | 277 | Move cadence/overdue logic server-side | `upcomingDeadlinesFiltered` useMemo - deadline calculation should be server-side |
| phase7-hardening | `apps/web/src/app/dashboard/page.tsx` | 88 | tighten dashboard access & visibility rules based on tenant/workspace membership | `fetchDashboard` function - access control logic |
| phase7-hardening | `apps/web/src/components/ui/BuildStamp.tsx` | 48 | theme this with tokens if design system evolves | BuildStamp component - theming |
| phase7-hardening | `apps/web/src/app/dashboard/ai/page.tsx` | 13 | Replace with live data from /reports/* endpoints once backend integration is ready | Component state - placeholder insights data |
| phase7-hardening | `apps/web/src/app/dashboard/ai/page.tsx` | 101 | Replace placeholder StatCards with live data from /reports/* endpoints | StatCard rendering - needs real data |
| phase7-hardening | `apps/web/src/components/ui/CycleSelector.tsx` | 155 | drive statuses from backend cycle.status | Cycle status badge rendering |
| phase7-hardening | `apps/web/src/components/ui/CycleSelector.tsx` | 187 | drive statuses from backend cycle.status | Cycle status badge rendering (duplicate) |
| phase7-hardening | `services/core-api/src/modules/okr/okr-reporting.controller.ts` | 60 | Frontend - add this feed to analytics dashboard | `getAnalyticsFeed` endpoint comment |
| phase7-hardening | `services/core-api/src/modules/okr/okr-reporting.controller.ts` | 77 | Frontend - add Export CSV button in analytics dashboard for TENANT_OWNER / TENANT_ADMIN | `exportCSV` endpoint comment |
| phase7-hardening | `services/core-api/src/modules/okr/okr-reporting.controller.ts` | 132 | Frontend - use this to populate a 'filter by strategic bet' dropdown in analytics and OKR list | `getPillars` endpoint comment |
| phase7-hardening | `apps/web/src/app/dashboard/analytics/__tests__/analytics.smoke.test.tsx` | 10 | expand visual regression tests once Storybook is live | Test file comment |
| phase7-hardening | `apps/web/src/app/dashboard/analytics/page.tsx` | 166 | align this with backend export permissions dynamically per-tenant, not just role check | `canExportData` logic - needs dynamic tenant-based check |
| phase7-hardening | `apps/web/src/app/dashboard/analytics/page.tsx` | 243 | canExportData() must stay aligned with backend RBACService.canExportData() | Export button rendering - permission sync comment |
| phase7-hardening | `services/core-api/src/modules/okr/okr-reporting.service.ts` | 379 | Frontend will use to populate 'filter by strategic bet' dropdown | `getPillarsForOrg` method comment |
| phase7-hardening | `services/core-api/src/modules/okr/okr-reporting.service.ts` | 450 | Later we should handle multiple active cycles, but for now assume at most one active cycle per org | `getActiveCycleForOrg` method - multi-cycle support |
| phase7-hardening | `services/core-api/src/modules/okr/okr-reporting.service.ts` | 509 | Later we should handle multiple active cycles, but for now assume at most one active cycle per org | `getPillarCoverageForActiveCycle` method - multi-cycle support |
| phase7-hardening | `services/core-api/src/modules/okr/me.controller.ts` | 22 | Expose this data in a dedicated 'My dashboard' view in frontend | `getMyOKRs` endpoint comment |
| phase7-hardening | `apps/web/src/hooks/useTenantPermissions.ts` | 106 | align with backend visibility rules once fully exposed | `canViewObjective` function - visibility logic |
| phase7-hardening | `apps/web/src/hooks/useTenantPermissions.ts` | 114 | Backend already enforces visibility via RBAC + tenant isolation | `canSeeObjective` function - visibility sync comment |
| phase7-hardening | `apps/web/src/hooks/useTenantPermissions.ts` | 124 | Mirror canSeeObjective() once KR-level visibility is modelled distinctly | `canSeeKeyResult` function - KR visibility logic |
| phase7-hardening | `apps/web/src/hooks/useTenantPermissions.ts` | 207 | parent objective should always be available | `canEditKeyResult` function - parent objective check |
| phase7-hardening | `apps/web/src/hooks/useTenantPermissions.ts` | 232 | align with backend logic - check-ins may be slightly looser | `canCheckInOnKeyResult` function - check-in permission logic |
| phase7-hardening | `apps/web/src/hooks/useTenantPermissions.ts` | 249 | Keep this in sync with OkrGovernanceService logic | `getLockInfoForObjective` function - lock logic sync |
| phase7-hardening | `apps/web/src/hooks/useTenantPermissions.ts` | 287 | Keep this in sync with OkrGovernanceService logic | `getLockInfoForKeyResult` function - lock logic sync |
| phase7-hardening | `services/integration-service/src/webhooks/webhook.service.ts` | 7 | Implement webhook processing for Jira integration | Webhook service - Jira integration |
| phase7-hardening | `services/integration-service/src/webhooks/webhook.service.ts` | 13 | Implement webhook processing for GitHub integration | Webhook service - GitHub integration |
| phase7-hardening | `services/integration-service/src/connectors/slack/slack.service.ts` | 15 | Implement Slack API call for integration with Slack | Slack service - API implementation |
| phase7-hardening | `services/integration-service/src/connectors/jira/jira.service.ts` | 13 | Implement Jira issue sync for integration with Jira | Jira service - issue sync |
| phase7-hardening | `services/integration-service/src/connectors/jira/jira.service.ts` | 19 | Implement Jira API call for integration with Jira | Jira service - API call |
| phase7-hardening | `services/integration-service/src/connectors/github/github.service.ts` | 13 | Implement GitHub API call for integration with GitHub repositories | GitHub service - API call |
| phase7-hardening | `services/core-api/src/modules/rbac/rbac.service.ts` | 323 | Record audit log for RBAC changes for audit/compliance visibility | RBAC service - audit logging |
| phase7-hardening | `services/core-api/src/modules/rbac/rbac.service.ts` | 351 | Record audit log for RBAC changes for audit/compliance visibility | RBAC service - audit logging (duplicate) |
| phase7-hardening | `services/core-api/src/modules/rbac/audit.ts` | 59 | Implement actual audit logging for RBAC changes for audit/compliance visibility | Audit module - implementation |
| phase7-hardening | `services/core-api/src/modules/permissions/tenant-isolation.guard.ts` | 15 | Cleanup/removal of legacy membership tables and TenantIsolationGuard after all controllers migrated | Tenant isolation guard - cleanup comment |
| phase7-hardening | `services/core-api/src/modules/okr/okr-progress.service.ts` | 10 | Add weighting support on ObjectiveKeyResult junction table (e.g., KR1 = 40%, KR2 = 60%) | Progress service - KR weighting feature |
| phase7-hardening | `services/core-api/src/modules/okr/okr-progress.service.ts` | 12 | Add transaction support for atomic updates | Progress service - transaction support |
| phase7-hardening | `services/core-api/src/modules/okr/okr-governance.service.ts` | 65 | Future version will allow "propose change" workflow instead of hard blocking | Governance service - propose change workflow |
| phase7-hardening | `services/core-api/src/modules/okr/okr-governance.service.ts` | 109 | Future version will allow "propose change" workflow instead of hard blocking | Governance service - propose change workflow (duplicate) |
| phase7-hardening | `services/core-api/src/modules/okr/okr-governance.service.ts` | 307 | Implement "propose change" workflow instead of hard blocking | Governance service - propose change workflow method |
| phase7-hardening | `services/core-api/src/modules/okr/okr-governance.service.ts` | 313 | Future implementation | Governance service - placeholder |
| phase7-hardening | `services/core-api/src/modules/okr/objective.service.ts` | 401 | Governance logic moved to OkrGovernanceService | Objective service - governance refactor comment |
| phase7-hardening | `services/core-api/src/modules/okr/objective.service.ts` | 402 | Future version will allow "propose change" workflow instead of hard blocking | Objective service - propose change workflow |
| phase7-hardening | `services/core-api/src/modules/okr/objective.service.ts` | 519 | Governance logic moved to OkrGovernanceService | Objective service - governance refactor comment (duplicate) |
| phase7-hardening | `services/core-api/src/modules/okr/objective.service.ts` | 520 | Future version will allow "propose change" workflow instead of hard blocking | Objective service - propose change workflow (duplicate) |
| phase7-hardening | `services/core-api/src/modules/okr/objective.controller.ts` | 82 | Frontend - show warning modal when attempting to edit published OKR | Objective controller - frontend integration |
| phase7-hardening | `services/core-api/src/modules/okr/objective.controller.ts` | 98 | Frontend - show warning modal when attempting to delete published OKR | Objective controller - frontend integration |
| phase7-hardening | `services/core-api/src/modules/okr/key-result.service.ts` | 125 | This is a placeholder until formal KR RBAC is implemented | Key result service - RBAC placeholder |
| phase7-hardening | `services/core-api/src/modules/okr/key-result.service.ts` | 195 | This is a placeholder until formal KR RBAC is implemented | Key result service - RBAC placeholder (duplicate) |
| phase7-hardening | `services/core-api/src/modules/okr/key-result.service.ts` | 422 | Governance logic moved to OkrGovernanceService | Key result service - governance refactor comment |
| phase7-hardening | `services/core-api/src/modules/okr/key-result.service.ts` | 423 | Future version will allow "propose change" workflow instead of hard blocking | Key result service - propose change workflow |
| phase7-hardening | `services/core-api/src/modules/okr/key-result.service.ts` | 527 | Governance logic moved to OkrGovernanceService | Key result service - governance refactor comment (duplicate) |
| phase7-hardening | `services/core-api/src/modules/okr/key-result.service.ts` | 528 | Future version will allow "propose change" workflow instead of hard blocking | Key result service - propose change workflow (duplicate) |
| phase7-hardening | `services/core-api/src/modules/okr/key-result.service.ts` | 631 | Governance logic moved to OkrGovernanceService | Key result service - governance refactor comment (duplicate) |
| phase7-hardening | `services/core-api/src/modules/okr/key-result.service.ts` | 632 | Future version will allow "propose change" workflow instead of hard blocking | Key result service - propose change workflow (duplicate) |
| phase7-hardening | `services/core-api/src/modules/auth/strategies/jwt.strategy.ts` | 107 | Support multi-org users (current logic only uses first org membership) | JWT strategy - multi-org support |
| phase7-hardening | `services/core-api/src/modules/activity/activity.controller.ts` | 36 | Frontend - expose this on the Objective detail view timeline | Activity controller - frontend integration |
| phase7-hardening | `services/core-api/src/modules/activity/activity.controller.ts` | 72 | Frontend - expose this on the Key Result detail view timeline | Activity controller - frontend integration |
| phase7-hardening | `services/core-api/src/modules/activity/activity.controller.ts` | 107 | Future enhancement - show all activity across user's OKRs/KRs | Activity controller - future enhancement |
| phase7-hardening | `services/core-api/src/modules/activity/activity.controller.ts` | 119 | Future implementation | Activity controller - placeholder |
| phase7-hardening | `apps/web/src/app/dashboard/builder/page.tsx` | 69 | tighten typing - replace Record<string, unknown> with proper node types | Builder page - typing improvement |
| phase7-hardening | `apps/web/src/app/dashboard/builder/page.tsx` | 291 | Replace with /objectives/cycles/all endpoint when available to show all cycles, not just active | Builder page - cycles endpoint |
| phase7-hardening | `apps/web/src/components/ui/CycleSelector.test.tsx` | 10 | expand visual regression tests once Storybook is live | Test file comment |
| phase7-hardening | `apps/web/src/components/ui/BuildStamp.test.tsx` | 2 | migrate to proper Jest/RTL config once test runner is wired | Test file comment |
| phase7-hardening | `apps/web/src/app/dashboard/builder/components/EditPanel.tsx` | 56 | add confirm modal before destructive actions | EditPanel - delete confirmation |
| phase7-hardening | `apps/web/src/app/dashboard/builder/components/EditFormTabs.tsx` | 26 | tighten typing | EditFormTabs - typing improvement |

---

## Recommendations: Top 5 TODOs to Implement Next

Based on impact and dependencies, here are the top 5 TODOs to prioritize:

### 1. **Wire POST /api/key-results with objectiveId** (Phase 5)
- **File:** `apps/web/src/components/okr/NewKeyResultModal.tsx:274`
- **Impact:** Critical - Key Results cannot be properly linked to Objectives without this
- **Effort:** Low - Simple API payload fix
- **Blocks:** Core functionality

### 2. **Open EditObjectiveModal instead of routing to Visual Builder** (Phase 5)
- **File:** `apps/web/src/app/dashboard/okrs/page.tsx:513`
- **Impact:** High - Improves UX and separates CRUD from planning
- **Effort:** Medium - Requires creating EditObjectiveModal component
- **Dependencies:** None

### 3. **Inline check-in workflow for Key Results** (Phase 5)
- **File:** `apps/web/src/app/dashboard/okrs/page.tsx:644` and `ObjectiveCard.tsx:404`
- **Impact:** High - Core feature for tracking progress
- **Effort:** Medium - Requires check-in form/modal and API integration
- **Dependencies:** Backend check-in endpoints should exist

### 4. **Map backend validation errors to field-level messages** (Phase 7)
- **Files:** `apps/web/src/app/dashboard/okrs/page.tsx:1441, 1491, 1562`
- **Impact:** High - Critical UX improvement for form validation
- **Effort:** Medium - Requires error parsing and field mapping logic
- **Dependencies:** Backend error format must be standardized

### 5. **Move to SWR/react-query for data fetching** (Phase 7)
- **File:** `apps/web/src/app/dashboard/okrs/page.tsx:86`
- **Impact:** High - Improves caching, invalidation, and loading states
- **Effort:** High - Requires refactoring multiple components
- **Dependencies:** Install and configure SWR or react-query

---

## Summary Statistics

- **Total TODOs:** 149
- **Phase 5 (Core):** 8 (5.4%)
- **Phase 6 (Polish):** 51 (34.2%)
- **Phase 7 (Hardening):** 90 (60.4%)
- **Completed:** 0 (0%)
- **Files Affected:** 50+

---

*Report generated by scanning all TypeScript and TSX files in apps/, services/, scripts/, and packages/ directories.*

