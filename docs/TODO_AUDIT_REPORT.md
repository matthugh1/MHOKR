# TODO / FIXME / NOTE Audit

- Timestamp: 2025-10-31T10:58:14.071Z
- Git SHA: 3c9e6c0

## Summary

- Total matches: 118
- Allowed phase-tag TODOs: 104
- Notes: 14
- Unapproved TODOs / FIXMEs / HACKs: 0

## Unapproved TODOs (BLOCKERS)

*None found. ✅*

## All Allowed Phase TODOs

```text
apps/web/src/app/dashboard/ai/page.tsx:13  // TODO [phase7-hardening]: Replace with live data from /reports/* endpoints once backend integration is ready
apps/web/src/app/dashboard/ai/page.tsx:101  {/* TODO [phase7-hardening]: Replace placeholder StatCards with live data from /reports/* endpoints */}
apps/web/src/app/dashboard/ai/page.tsx:124  {/* TODO [phase6-polish]: Enhance executive summary with actual metrics and recommendations
apps/web/src/app/dashboard/analytics/__tests__/analytics.smoke.test.tsx:10  * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
apps/web/src/app/dashboard/analytics/page.tsx:78  // TODO [phase6-polish]: replace with proper skeleton loaders
apps/web/src/app/dashboard/analytics/page.tsx:133  // TODO [phase7-performance]: lift this into a shared util if we reuse it
apps/web/src/app/dashboard/analytics/page.tsx:166  // TODO [phase7-hardening]: align this with backend export permissions dynamically per-tenant, not just role check.
apps/web/src/app/dashboard/analytics/page.tsx:196  // TODO [phase6-polish]: turn this into toast
apps/web/src/app/dashboard/analytics/page.tsx:242  {/* TODO [phase7-hardening]: canExportData() must stay aligned with backend RBACService.canExportData() */}
apps/web/src/app/dashboard/analytics/page.tsx:257  {/* TODO [phase6-polish]: turn into toast */}
apps/web/src/app/dashboard/analytics/page.tsx:304  {/* TODO [phase6-polish]: add subtle icon/illustration */}
apps/web/src/app/dashboard/analytics/page.tsx:346  {/* TODO [phase6-polish]: add subtle icon/illustration */}
apps/web/src/app/dashboard/analytics/page.tsx:391  {/* TODO [phase6-polish]: add subtle icon/illustration */}
apps/web/src/app/dashboard/okrs/components/PublishLockWarningModal.tsx:56  {/* TODO [phase6-polish]: add small lock icon */}
apps/web/src/app/dashboard/okrs/page.tsx:195  // TODO [phase7-hardening]: Replace with /objectives/cycles/all endpoint when available to show all cycles, not just active
apps/web/src/app/dashboard/okrs/page.tsx:370  // TODO [phase7-hardening]: align with backend once cycle status is fully exposed in API responses
apps/web/src/app/dashboard/okrs/page.tsx:400  // TODO [phase7-hardening]: align with backend once cycle status is fully exposed in API responses
apps/web/src/app/dashboard/okrs/page.tsx:592  {/* TODO [phase6-polish]: Later we'll surface a CTA for admins to open next cycle / lock current cycle. */}
apps/web/src/app/dashboard/okrs/page.tsx:725  {/* TODO [phase6-polish]: add illustration + CTA when we allow creation */}
apps/web/src/app/dashboard/okrs/page.tsx:743  {/* TODO [phase6-polish]: add CTA "Create first objective in this cycle" for admins */}
apps/web/src/app/dashboard/okrs/page.tsx:753  // TODO [phase7-hardening]: align with backend once cycle status is fully exposed in API responses
apps/web/src/app/dashboard/okrs/page.tsx:801  // TODO [phase7-hardening]: align with backend once cycle status is fully exposed in API responses
apps/web/src/app/dashboard/okrs/page.tsx:846  {/* TODO [phase7-performance]: pass pagination cursor + load handler once backend supports it. */}
apps/web/src/app/dashboard/okrs/page.tsx:872  // TODO [phase6-polish]: improve copy for lock reasons
apps/web/src/components/dashboard-layout.tsx:146  {/* TODO[phase6-polish]: unify BuildStamp footer placement across all dashboard layouts */}
apps/web/src/components/ui/ActivityDrawer.tsx:75  {/* TODO [phase6-polish]: include avatar / icon for objective vs key result */}
apps/web/src/components/ui/ActivityDrawer.tsx:93  {/* TODO [phase6-polish]: add subtle illustration */}
apps/web/src/components/ui/ActivityDrawer.tsx:112  {/* TODO [phase7-performance]: Wire this to /activity/* with pagination params (limit, cursor) */}
apps/web/src/components/ui/ActivityItemCard.test.tsx:10  * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
apps/web/src/components/ui/BuildStamp.test.tsx:2  // TODO [phase7-hardening]: migrate to proper Jest/RTL config once test runner is wired
apps/web/src/components/ui/BuildStamp.tsx:40  // TODO [phase7-hardening]: theme this with tokens if design system evolves
apps/web/src/components/ui/CycleSelector.test.tsx:10  * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
apps/web/src/components/ui/CycleSelector.tsx:142  {/* TODO [phase6-polish]: visual grouping headers in popover */}
apps/web/src/components/ui/CycleSelector.tsx:155  {/* TODO [phase7-hardening]: drive statuses from backend cycle.status */}
apps/web/src/components/ui/CycleSelector.tsx:166  {/* TODO [phase6-polish]: CTA to create first cycle */}
apps/web/src/components/ui/CycleSelector.tsx:174  {/* TODO [phase6-polish]: visual grouping headers in popover */}
apps/web/src/components/ui/CycleSelector.tsx:187  {/* TODO [phase7-hardening]: drive statuses from backend cycle.status */}
apps/web/src/components/ui/CycleSelector.tsx:199  {/* TODO [phase6-polish]: visual grouping headers in popover */}
apps/web/src/components/ui/CycleSelector.tsx:224  {/* TODO [phase6-polish]: visual grouping headers in popover */}
apps/web/src/components/ui/ObjectiveCard.test.tsx:10  * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
apps/web/src/components/ui/SectionHeader.test.tsx:10  * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
apps/web/src/components/ui/StatCard.test.tsx:10  * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
apps/web/src/components/ui/StatusBadge.test.tsx:10  * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
apps/web/src/hooks/useTenantPermissions.ts:106  // TODO [phase7-hardening]: align with backend visibility rules once fully exposed
apps/web/src/hooks/useTenantPermissions.ts:113  // TODO [phase7-hardening]: Backend already enforces visibility via RBAC + tenant isolation.
apps/web/src/hooks/useTenantPermissions.ts:122  // TODO [phase7-hardening]: Mirror canSeeObjective() once KR-level visibility is modelled distinctly.
apps/web/src/hooks/useTenantPermissions.ts:204  // TODO [phase7-hardening]: parent objective should always be available
apps/web/src/hooks/useTenantPermissions.ts:228  // TODO [phase7-hardening]: align with backend logic - check-ins may be slightly looser
apps/web/src/hooks/useTenantPermissions.ts:244  // TODO [phase7-hardening]: Keep this in sync with OkrGovernanceService logic.
apps/web/src/hooks/useTenantPermissions.ts:281  // TODO [phase7-hardening]: Keep this in sync with OkrGovernanceService logic.
services/ai-service/src/personas/persona.controller.ts:37  // TODO [phase7-performance]: Implement SSE streaming for real-time persona responses
services/core-api/prisma/schema.prisma:202  // TODO [phase7-hardening]: Admin endpoint to update cycle.status (DRAFT -> ACTIVE -> LOCKED -> ARCHIVED)
services/core-api/src/modules/activity/activity.controller.ts:36  * TODO [phase7-hardening]: Frontend - expose this on the Objective detail view timeline.
services/core-api/src/modules/activity/activity.controller.ts:72  * TODO [phase7-hardening]: Frontend - expose this on the Key Result detail view timeline.
services/core-api/src/modules/activity/activity.controller.ts:107  * TODO [phase7-hardening]: Future enhancement - show all activity across user's OKRs/KRs
services/core-api/src/modules/activity/activity.controller.ts:119  // TODO [phase7-hardening]: Future implementation
services/core-api/src/modules/auth/strategies/jwt.strategy.ts:107  // TODO [phase7-hardening]: Support multi-org users (current logic only uses first org membership)
services/core-api/src/modules/okr/key-result.service.ts:125  * TODO [phase7-hardening]: This is a placeholder until formal KR RBAC is implemented.
services/core-api/src/modules/okr/key-result.service.ts:195  * TODO [phase7-hardening]: This is a placeholder until formal KR RBAC is implemented.
services/core-api/src/modules/okr/key-result.service.ts:422  // TODO [phase7-hardening]: Governance logic moved to OkrGovernanceService
services/core-api/src/modules/okr/key-result.service.ts:423  // TODO [phase7-hardening]: Future version will allow "propose change" workflow instead of hard blocking
services/core-api/src/modules/okr/key-result.service.ts:527  // TODO [phase7-hardening]: Governance logic moved to OkrGovernanceService
services/core-api/src/modules/okr/key-result.service.ts:528  // TODO [phase7-hardening]: Future version will allow "propose change" workflow instead of hard blocking
services/core-api/src/modules/okr/key-result.service.ts:631  // TODO [phase7-hardening]: Governance logic moved to OkrGovernanceService
services/core-api/src/modules/okr/key-result.service.ts:632  // TODO [phase7-hardening]: Future version will allow "propose change" workflow instead of hard blocking
services/core-api/src/modules/okr/me.controller.ts:22  // TODO [phase7-hardening]: Expose this data in a dedicated 'My dashboard' view in frontend
services/core-api/src/modules/okr/objective.controller.ts:82  // TODO [phase7-hardening]: Frontend - show warning modal when attempting to edit published OKR
services/core-api/src/modules/okr/objective.controller.ts:98  // TODO [phase7-hardening]: Frontend - show warning modal when attempting to delete published OKR
services/core-api/src/modules/okr/objective.service.ts:401  // TODO [phase7-hardening]: Governance logic moved to OkrGovernanceService
services/core-api/src/modules/okr/objective.service.ts:402  // TODO [phase7-hardening]: Future version will allow "propose change" workflow instead of hard blocking
services/core-api/src/modules/okr/objective.service.ts:519  // TODO [phase7-hardening]: Governance logic moved to OkrGovernanceService
services/core-api/src/modules/okr/objective.service.ts:520  // TODO [phase7-hardening]: Future version will allow "propose change" workflow instead of hard blocking
services/core-api/src/modules/okr/okr-governance.service.ts:65  // TODO [phase7-hardening]: Future version will allow "propose change" workflow instead of hard blocking
services/core-api/src/modules/okr/okr-governance.service.ts:109  // TODO [phase7-hardening]: Future version will allow "propose change" workflow instead of hard blocking
services/core-api/src/modules/okr/okr-governance.service.ts:307  * TODO [phase7-hardening]: Implement "propose change" workflow instead of hard blocking
services/core-api/src/modules/okr/okr-governance.service.ts:313  // TODO [phase7-hardening]: Future implementation
services/core-api/src/modules/okr/okr-progress.service.ts:10  * TODO [phase7-hardening]: Add weighting support on ObjectiveKeyResult junction table (e.g., KR1 = 40%, KR2 = 60%)
services/core-api/src/modules/okr/okr-progress.service.ts:11  * TODO [phase7-performance]: Add performance optimization with batch recalculation
services/core-api/src/modules/okr/okr-progress.service.ts:12  * TODO [phase7-hardening]: Add transaction support for atomic updates
services/core-api/src/modules/okr/okr-reporting.controller.ts:49  * TODO [phase7-hardening]: Frontend - add this feed to analytics dashboard.
services/core-api/src/modules/okr/okr-reporting.controller.ts:65  * TODO [phase7-hardening]: Frontend - add Export CSV button in analytics dashboard for TENANT_OWNER / TENANT_ADMIN.
services/core-api/src/modules/okr/okr-reporting.controller.ts:105  * TODO [phase6-polish]: Frontend - show active cycle name at the top of the OKR dashboard and mark locked cycles.
services/core-api/src/modules/okr/okr-reporting.controller.ts:119  * TODO [phase7-hardening]: Frontend - use this to populate a 'filter by strategic bet' dropdown in analytics and OKR list.
services/core-api/src/modules/okr/okr-reporting.controller.ts:133  * TODO [phase6-polish]: Frontend - highlight strategic gaps (pillars with zero objectives).
services/core-api/src/modules/okr/okr-reporting.controller.ts:147  * TODO [phase6-polish]: Frontend - show 'Check-ins overdue' widget in analytics.
services/core-api/src/modules/okr/okr-reporting.service.ts:31  * TODO [phase7-performance]: May need optimization for large datasets.
services/core-api/src/modules/okr/okr-reporting.service.ts:103  * TODO [phase7-performance]: May need optimization for memory usage with large datasets.
services/core-api/src/modules/okr/okr-reporting.service.ts:379  * TODO [phase7-hardening]: Frontend will use to populate 'filter by strategic bet' dropdown.
services/core-api/src/modules/okr/okr-reporting.service.ts:450  * TODO [phase7-hardening]: Later we should handle multiple active cycles, but for now assume at most one active cycle per org.
services/core-api/src/modules/okr/okr-reporting.service.ts:509  * TODO [phase7-hardening]: Later we should handle multiple active cycles, but for now assume at most one active cycle per org.
services/core-api/src/modules/okr/okr-reporting.service.ts:510  * TODO [phase6-polish]: Frontend - highlight strategic gaps (pillars with zero objectives).
services/core-api/src/modules/okr/okr-reporting.service.ts:694  * TODO [phase7-performance]: Optimize this query - currently fetches all KRs and their latest check-ins, then filters in JS.
services/core-api/src/modules/okr/okr-reporting.service.ts:725  // TODO [phase7-performance]: Optimize this query - currently fetches all KRs and their latest check-ins, then filters in JS.
services/core-api/src/modules/okr/tenant-guard.ts:16  * TODO [phase7-hardening]: Extract tenant isolation logic from:
services/core-api/src/modules/permissions/tenant-isolation.guard.ts:15  * TODO [phase7-hardening]: Cleanup/removal of legacy membership tables and TenantIsolationGuard after all controllers migrated
services/core-api/src/modules/rbac/audit.ts:59  // TODO [phase7-hardening]: Implement actual audit logging for RBAC changes for audit/compliance visibility
services/core-api/src/modules/rbac/rbac.service.ts:323  // TODO [phase7-hardening]: Record audit log for RBAC changes for audit/compliance visibility
services/core-api/src/modules/rbac/rbac.service.ts:351  // TODO [phase7-hardening]: Record audit log for RBAC changes for audit/compliance visibility
services/integration-service/src/connectors/github/github.service.ts:13  // TODO [phase7-hardening]: Implement GitHub API call for integration with GitHub repositories
services/integration-service/src/connectors/jira/jira.service.ts:13  // TODO [phase7-hardening]: Implement Jira issue sync for integration with Jira
services/integration-service/src/connectors/jira/jira.service.ts:19  // TODO [phase7-hardening]: Implement Jira API call for integration with Jira
services/integration-service/src/connectors/slack/slack.service.ts:15  // TODO [phase7-hardening]: Implement Slack API call for integration with Slack
services/integration-service/src/webhooks/webhook.service.ts:7  // TODO [phase7-hardening]: Implement webhook processing for Jira integration
services/integration-service/src/webhooks/webhook.service.ts:13  // TODO [phase7-hardening]: Implement webhook processing for GitHub integration
```

## All Notes

```text
apps/web/next-env.d.ts:4  // NOTE: This file should not be edited
services/core-api/src/modules/activity/activity.controller.ts:19  * NOTE: Activity timeline endpoints were moved from ObjectiveController and KeyResultController under /activity/* in Phase 4.
services/core-api/src/modules/okr/key-result.controller.ts:24  // NOTE: Reporting/analytics endpoints were moved to OkrReportingController under /reports/* in Phase 4.
services/core-api/src/modules/okr/key-result.controller.ts:108  // NOTE: Activity timeline endpoints moved to ActivityController under /activity/* in Phase 4.
services/core-api/src/modules/okr/key-result.service.ts:14  * NOTE: Reporting / analytics / check-in feed logic was moved to OkrReportingService in Phase 4.
services/core-api/src/modules/okr/key-result.service.ts:689  // NOTE: Reporting / analytics / check-in feed methods moved to OkrReportingService in Phase 4
services/core-api/src/modules/okr/objective.controller.ts:32  // NOTE: Reporting/analytics endpoints were moved to OkrReportingController under /reports/* in Phase 4.
services/core-api/src/modules/okr/objective.controller.ts:102  // NOTE: Activity timeline endpoints moved to ActivityController under /activity/* in Phase 4.
services/core-api/src/modules/okr/objective.service.ts:13  * NOTE: Reporting / analytics / export logic was moved to OkrReportingService in Phase 4.
services/core-api/src/modules/okr/objective.service.ts:562  // NOTE: Reporting / analytics / export methods moved to OkrReportingService in Phase 4
services/core-api/src/modules/okr/okr-reporting.service.ts:18  * NOTE: Reporting / analytics / export logic was moved from ObjectiveService and KeyResultService in Phase 4.
services/core-api/src/modules/rbac/rbac.ts:301  // NOTE: organizationId is the canonical tenant identifier.
services/core-api/src/modules/rbac/rbac.ts:369  // NOTE: organizationId is the canonical tenant identifier.
services/core-api/src/modules/rbac/rbac.ts:475  // NOTE: organizationId is the canonical tenant identifier.
```

