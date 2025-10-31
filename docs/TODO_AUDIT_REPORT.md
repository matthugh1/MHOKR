# TODO / FIXME / NOTE Audit

- Timestamp: 2025-10-31T11:38:08.533Z
- Git SHA: 7023a95

## Summary

- Total matches: 150
- Allowed phase-tag TODOs: 103
- Notes: 38
- Unapproved TODOs / FIXMEs / HACKs: 9

## Unapproved TODOs (BLOCKERS)

```text
.github/workflows/premerge-check.yml:36  - name: Run TODO compliance audit
scripts/todo-audit.js:111  // If it's a NOTE without TODO/FIXME/HACK, classify as note (these are allowed)
scripts/todo-audit.js:123  // Otherwise it's unapproved (TODO/FIXME/HACK without allowed tag)
scripts/todo-audit.js:150  // Also skip workflow files that mention "TODO compliance audit" as step names
scripts/todo-audit.js:152  (filePath.includes('.github/workflows/') && line.includes('TODO compliance audit'))) {
scripts/todo-audit.js:183  line.includes('includes(\'TODO\')') || line.includes('includes(\'FIXME\')') ||
scripts/todo-audit.js:184  line.includes('includes(\'HACK\')')) {
services/core-api/src/modules/okr/okr-reporting.controller.ts:22  * TODO Phase 2: Move the following endpoints from ObjectiveController:
services/core-api/src/modules/okr/okr-reporting.controller.ts:30  * TODO Phase 2: Move the following endpoints from KeyResultController:
```

## All Allowed Phase TODOs

```text
apps/web/src/app/dashboard/ai/page.tsx:13  // TODO [phase7-hardening]: Replace with live data from /reports/* endpoints once backend integration is ready
apps/web/src/app/dashboard/ai/page.tsx:102  {/* TODO [phase7-hardening]: Replace placeholder StatCards with live data from /reports/* endpoints */}
apps/web/src/app/dashboard/ai/page.tsx:126  {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
apps/web/src/app/dashboard/analytics/__tests__/analytics.smoke.test.tsx:10  * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
apps/web/src/app/dashboard/analytics/page.tsx:78  // TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle'
apps/web/src/app/dashboard/analytics/page.tsx:133  // TODO [phase7-performance]: lift this into a shared util if we reuse it
apps/web/src/app/dashboard/analytics/page.tsx:166  // TODO [phase7-hardening]: align this with backend export permissions dynamically per-tenant, not just role check.
apps/web/src/app/dashboard/analytics/page.tsx:197  // TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle'
apps/web/src/app/dashboard/analytics/page.tsx:243  {/* TODO [phase7-hardening]: canExportData() must stay aligned with backend RBACService.canExportData() */}
apps/web/src/app/dashboard/analytics/page.tsx:259  {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
apps/web/src/app/dashboard/analytics/page.tsx:306  {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
apps/web/src/app/dashboard/analytics/page.tsx:348  {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
apps/web/src/app/dashboard/analytics/page.tsx:393  {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
apps/web/src/app/dashboard/okrs/components/PublishLockWarningModal.tsx:56  {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
apps/web/src/app/dashboard/okrs/page.tsx:195  // TODO [phase7-hardening]: Replace with /objectives/cycles/all endpoint when available to show all cycles, not just active
apps/web/src/app/dashboard/okrs/page.tsx:371  // TODO [phase7-hardening]: align with backend once cycle status is fully exposed in API responses
apps/web/src/app/dashboard/okrs/page.tsx:402  // TODO [phase7-hardening]: align with backend once cycle status is fully exposed in API responses
apps/web/src/app/dashboard/okrs/page.tsx:595  {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
apps/web/src/app/dashboard/okrs/page.tsx:728  {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
apps/web/src/app/dashboard/okrs/page.tsx:746  {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
apps/web/src/app/dashboard/okrs/page.tsx:756  // TODO [phase7-hardening]: align with backend once cycle status is fully exposed in API responses
apps/web/src/app/dashboard/okrs/page.tsx:805  // TODO [phase7-hardening]: align with backend once cycle status is fully exposed in API responses
apps/web/src/app/dashboard/okrs/page.tsx:851  {/* TODO [phase7-performance]: pass pagination cursor + load handler once backend supports it. */}
apps/web/src/app/dashboard/okrs/page.tsx:877  // TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle'
apps/web/src/components/dashboard-layout.tsx:146  {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
apps/web/src/components/ui/ActivityDrawer.tsx:75  {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
apps/web/src/components/ui/ActivityDrawer.tsx:93  {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
apps/web/src/components/ui/ActivityDrawer.tsx:112  {/* TODO [phase7-performance]: Wire this to /activity/* with pagination params (limit, cursor) */}
apps/web/src/components/ui/ActivityItemCard.test.tsx:10  * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
apps/web/src/components/ui/BuildStamp.test.tsx:2  // TODO [phase7-hardening]: migrate to proper Jest/RTL config once test runner is wired
apps/web/src/components/ui/BuildStamp.tsx:48  // TODO [phase7-hardening]: theme this with tokens if design system evolves
apps/web/src/components/ui/CycleSelector.test.tsx:10  * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
apps/web/src/components/ui/CycleSelector.tsx:142  {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
apps/web/src/components/ui/CycleSelector.tsx:155  {/* TODO [phase7-hardening]: drive statuses from backend cycle.status */}
apps/web/src/components/ui/CycleSelector.tsx:167  {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
apps/web/src/components/ui/CycleSelector.tsx:175  {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
apps/web/src/components/ui/CycleSelector.tsx:188  {/* TODO [phase7-hardening]: drive statuses from backend cycle.status */}
apps/web/src/components/ui/CycleSelector.tsx:201  {/* TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle' */}
apps/web/src/components/ui/CycleSelector.tsx:226  {/* TODO [phase6-polish]: visual grouping headers in popover */}
apps/web/src/components/ui/ObjectiveCard.test.tsx:10  * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
apps/web/src/components/ui/SectionHeader.test.tsx:10  * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
apps/web/src/components/ui/StatCard.test.tsx:10  * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
apps/web/src/components/ui/StatusBadge.test.tsx:10  * TODO [phase7-hardening]: expand visual regression tests once Storybook is live
apps/web/src/hooks/useTenantPermissions.ts:106  // TODO [phase7-hardening]: align with backend visibility rules once fully exposed
apps/web/src/hooks/useTenantPermissions.ts:114  // TODO [phase7-hardening]: Backend already enforces visibility via RBAC + tenant isolation.
apps/web/src/hooks/useTenantPermissions.ts:124  // TODO [phase7-hardening]: Mirror canSeeObjective() once KR-level visibility is modelled distinctly.
apps/web/src/hooks/useTenantPermissions.ts:207  // TODO [phase7-hardening]: parent objective should always be available
apps/web/src/hooks/useTenantPermissions.ts:232  // TODO [phase7-hardening]: align with backend logic - check-ins may be slightly looser
apps/web/src/hooks/useTenantPermissions.ts:249  // TODO [phase7-hardening]: Keep this in sync with OkrGovernanceService logic.
apps/web/src/hooks/useTenantPermissions.ts:287  // TODO [phase7-hardening]: Keep this in sync with OkrGovernanceService logic.
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
services/core-api/src/modules/okr/okr-reporting.controller.ts:60  * TODO [phase7-hardening]: Frontend - add this feed to analytics dashboard.
services/core-api/src/modules/okr/okr-reporting.controller.ts:77  * TODO [phase7-hardening]: Frontend - add Export CSV button in analytics dashboard for TENANT_OWNER / TENANT_ADMIN.
services/core-api/src/modules/okr/okr-reporting.controller.ts:118  * TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle'
services/core-api/src/modules/okr/okr-reporting.controller.ts:132  * TODO [phase7-hardening]: Frontend - use this to populate a 'filter by strategic bet' dropdown in analytics and OKR list.
services/core-api/src/modules/okr/okr-reporting.controller.ts:147  * TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle'
services/core-api/src/modules/okr/okr-reporting.controller.ts:161  * TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle'
services/core-api/src/modules/okr/okr-reporting.service.ts:31  * TODO [phase7-performance]: May need optimization for large datasets.
services/core-api/src/modules/okr/okr-reporting.service.ts:103  * TODO [phase7-performance]: May need optimization for memory usage with large datasets.
services/core-api/src/modules/okr/okr-reporting.service.ts:379  * TODO [phase7-hardening]: Frontend will use to populate 'filter by strategic bet' dropdown.
services/core-api/src/modules/okr/okr-reporting.service.ts:450  * TODO [phase7-hardening]: Later we should handle multiple active cycles, but for now assume at most one active cycle per org.
services/core-api/src/modules/okr/okr-reporting.service.ts:509  * TODO [phase7-hardening]: Later we should handle multiple active cycles, but for now assume at most one active cycle per org.
services/core-api/src/modules/okr/okr-reporting.service.ts:510  * TODO [phase6-polish]: tracked in GH issue 'Phase 6 polish bundle'
services/core-api/src/modules/okr/okr-reporting.service.ts:694  * TODO [phase7-performance]: Optimize this query - currently fetches all KRs and their latest check-ins, then filters in JS.
services/core-api/src/modules/okr/okr-reporting.service.ts:725  // TODO [phase7-performance]: Optimize this query - currently fetches all KRs and their latest check-ins, then filters in JS.
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
apps/web/src/app/dashboard/ai/page.tsx:14  // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
apps/web/src/app/dashboard/ai/page.tsx:103  {/* NOTE: This surface is internal-tenant-only and is not exposed to external design partners. */}
apps/web/src/app/dashboard/analytics/__tests__/analytics.smoke.test.tsx:1  // NOTE: phase14-hardening
apps/web/src/app/dashboard/analytics/page.tsx:167  // NOTE: This surface is admin-only and is not exposed to external design partners.
apps/web/src/app/dashboard/analytics/page.tsx:244  {/* NOTE: This surface is admin-only and is not exposed to external design partners. */}
apps/web/src/app/dashboard/okrs/page.tsx:196  // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
apps/web/src/app/dashboard/okrs/page.tsx:372  // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
apps/web/src/app/dashboard/okrs/page.tsx:403  // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
apps/web/src/app/dashboard/okrs/page.tsx:757  // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
apps/web/src/app/dashboard/okrs/page.tsx:806  // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
apps/web/src/components/ui/BuildStamp.tsx:49  // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
apps/web/src/components/ui/CycleSelector.tsx:156  {/* NOTE: This surface is internal-tenant-only and is not exposed to external design partners. */}
apps/web/src/components/ui/CycleSelector.tsx:189  {/* NOTE: This surface is internal-tenant-only and is not exposed to external design partners. */}
apps/web/src/hooks/useTenantPermissions.ts:107  // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
apps/web/src/hooks/useTenantPermissions.ts:115  // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
apps/web/src/hooks/useTenantPermissions.ts:125  // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
apps/web/src/hooks/useTenantPermissions.ts:208  // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
apps/web/src/hooks/useTenantPermissions.ts:233  // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
apps/web/src/hooks/useTenantPermissions.ts:250  // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
apps/web/src/hooks/useTenantPermissions.ts:288  // NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
services/core-api/prisma/schema.prisma:203  // NOTE: This surface is admin-only and is not exposed to external design partners.
services/core-api/src/modules/activity/activity.controller.ts:19  * NOTE: Activity timeline endpoints were moved from ObjectiveController and KeyResultController under /activity/* in Phase 4.
services/core-api/src/modules/okr/key-result.controller.ts:24  // NOTE: Reporting/analytics endpoints were moved to OkrReportingController under /reports/* in Phase 4.
services/core-api/src/modules/okr/key-result.controller.ts:108  // NOTE: Activity timeline endpoints moved to ActivityController under /activity/* in Phase 4.
services/core-api/src/modules/okr/key-result.service.ts:14  * NOTE: Reporting / analytics / check-in feed logic was moved to OkrReportingService in Phase 4.
services/core-api/src/modules/okr/key-result.service.ts:689  // NOTE: Reporting / analytics / check-in feed methods moved to OkrReportingService in Phase 4
services/core-api/src/modules/okr/objective.controller.ts:32  // NOTE: Reporting/analytics endpoints were moved to OkrReportingController under /reports/* in Phase 4.
services/core-api/src/modules/okr/objective.controller.ts:102  // NOTE: Activity timeline endpoints moved to ActivityController under /activity/* in Phase 4.
services/core-api/src/modules/okr/objective.service.ts:13  * NOTE: Reporting / analytics / export logic was moved to OkrReportingService in Phase 4.
services/core-api/src/modules/okr/objective.service.ts:562  // NOTE: Reporting / analytics / export methods moved to OkrReportingService in Phase 4
services/core-api/src/modules/okr/okr-reporting.controller.ts:61  * NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
services/core-api/src/modules/okr/okr-reporting.controller.ts:78  * NOTE: This surface is admin-only and is not exposed to external design partners.
services/core-api/src/modules/okr/okr-reporting.controller.ts:133  * NOTE: This surface is internal-tenant-only and is not exposed to external design partners.
services/core-api/src/modules/okr/okr-reporting.service.ts:18  * NOTE: Reporting / analytics / export logic was moved from ObjectiveService and KeyResultService in Phase 4.
services/core-api/src/modules/rbac/rbac.ts:301  // NOTE: organizationId is the canonical tenant identifier.
services/core-api/src/modules/rbac/rbac.ts:369  // NOTE: organizationId is the canonical tenant identifier.
services/core-api/src/modules/rbac/rbac.ts:475  // NOTE: organizationId is the canonical tenant identifier.
```

