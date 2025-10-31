# TODO / FIXME / NOTE Audit

- Timestamp: 2025-10-31T10:53:29.585Z
- Git SHA: 9eba069

## Summary

- Total matches: 288
- Allowed phase-tag TODOs: 52
- Notes: 17
- Unapproved TODOs / FIXMEs / HACKs: 219

## Unapproved TODOs (BLOCKERS)

```text
.github/pull_request_template.md:39  ## New TODO tags added?
.github/pull_request_template.md:43  <!-- If Yes, list them. Allowed TODO tags are:
.github/pull_request_template.md:48  Any other TODO format is not allowed. -->
CODING_STANDARDS.md:144  ## TODO Tags
CODING_STANDARDS.md:146  **Only allowed TODO tags:**
CODING_STANDARDS.md:152  **No other TODO formats are allowed.** If you need to track work that doesn't fit these categories, create a GitHub issue instead.
CONTRIBUTING.md:16  ## Allowed TODO Tags
CONTRIBUTING.md:18  We enforce strict TODO tag conventions to maintain code quality and prevent technical debt from shipping.
CONTRIBUTING.md:20  **Allowed TODO tags:**
CONTRIBUTING.md:26  **No other TODO formats are allowed.** If you need to track work that doesn't fit these categories, create a GitHub issue instead.
DELIVERY_PLAN.md:219  **Proof:** `services/core-api/src/modules/auth/strategies/jwt.strategy.ts:37` TODO comment: "Support multi-org users (currently using first org membership only)"
OKR_PRODUCT_CAPABILITY_AUDIT.md:494  - TODO comment: "Support multi-org users (currently using first org membership only)" (`jwt.strategy.ts:37`)
P0_FINAL_CODE.md:434  ## 5. Remaining TODOs
P0_PR_CHANGE_PLANS.md:801  'system'  // TODO: Replace with actual assignedBy userId
P0_PR_CHANGE_PLANS.md:805  // TODO: Remove this once migration is complete
P0_PR_CHANGE_PLANS.md:968  // TODO: Navigate to edit page or open edit modal
P0_PR_CHANGE_PLANS.md:989  // TODO: Implement delete handler
P0_PR_CHANGE_PLANS.md:1079  // TODO: Navigate to edit page or open edit modal
P0_PR_CHANGE_PLANS.md:1100  // TODO: Implement delete handler
P0_SECURITY_PATCHES.md:968  ## 10. TODOs (carry forward as // TODO comments in code)
P0_SECURITY_PATCHES.md:970  All TODOs have been added to the codebase as inline comments. Summary:
PHASE5_SUMMARY.md:52  - TODO comments added for phase6-frontend-hardening to align with backend once cycle status is fully exposed in API responses
PHASE6_SUMMARY.md:12  - `apps/web/src/hooks/useTenantPermissions.ts` - Updated TODO tags to phase7-hardening
PHASE6_SUMMARY.md:28  ## TODO / tech debt state:
PHASE7_SUMMARY.md:29  - ✅ `okrs/page.tsx` passes `hasMore={false}` and leaves TODO for pagination
PHASE7_SUMMARY.md:30  - ✅ Load more button added to ActivityDrawer with TODO tag for future implementation
PHASE7_SUMMARY.md:32  ## TODO tags:
PROGRESS_ROLLUP_AND_ANALYTICS_IMPLEMENTATION.md:118  ## TODOs Added
PROGRESS_ROLLUP_AND_ANALYTICS_IMPLEMENTATION.md:121  - Line 11: TODO for weighting support on ObjectiveKeyResult junction table
PROGRESS_ROLLUP_AND_ANALYTICS_IMPLEMENTATION.md:122  - Line 12: TODO for performance optimization with batch recalculation
PROGRESS_ROLLUP_AND_ANALYTICS_IMPLEMENTATION.md:123  - Line 13: TODO for transaction support for atomic updates
PROGRESS_ROLLUP_AND_ANALYTICS_IMPLEMENTATION.md:181  **Future Optimizations (from TODOs):**
README.md:49  - **[Contributing Guide](CONTRIBUTING.md)** - Branch naming, TODO tags, backend/frontend rules
REFACTOR_PLAN_SUMMARY.md:29  4. ✅ **Skeleton Files** (with TODO comments)
REFACTOR_PLAN_SUMMARY.md:159  - **Skeleton files** - Implementation templates with TODO comments
REFACTOR_SCAFFOLDING_SUMMARY.md:16  - TODO comments reference all locations where logic will be extracted
REFACTOR_SCAFFOLDING_SUMMARY.md:27  - TODO comments with line references to existing code
REFACTOR_SCAFFOLDING_SUMMARY.md:40  - TODO comments with line references to existing code
REFACTOR_SCAFFOLDING_SUMMARY.md:46  - `GET /reports/export/csv` - CSV export endpoint (with RBAC export_data check TODO)
REFACTOR_SCAFFOLDING_SUMMARY.md:51  - TODO comments reference which methods in objective.controller.ts/key-result.controller.ts to copy from
REFACTOR_SCAFFOLDING_SUMMARY.md:58  - TODO comments reference which methods in objective.controller.ts/key-result.controller.ts to copy from
REFACTOR_SCAFFOLDING_SUMMARY.md:70  - TODO comments to call through to usePermissions() and replicate backend RBAC
REFACTOR_SCAFFOLDING_SUMMARY.md:71  - TODO comments to incorporate publish lock and cycle lock rules
REFACTOR_SCAFFOLDING_SUMMARY.md:148  - All new files contain skeleton code with TODO comments
REFACTOR_SCAFFOLDING_SUMMARY.md:190  - [x] All skeleton methods have TODO comments
REFACTOR_SCAFFOLDING_SUMMARY.md:191  - [x] TODO comments reference source file and line numbers
RELEASE_CHECKLIST.md:10  - [ ] All TODO tags are confined to:
RELEASE_CHECKLIST.md:14  - [ ] No TODOs blocking merge (all critical functionality complete)
RELEASE_VALIDATION_SCRIPT.md:200  # NOTE: Replace <TOKEN> with a valid JWT from login response
RELEASE_VALIDATION_SCRIPT.md:502  - ✓ Copy looks like plausible preview/advisory surface (not "TODO wire LLM")
RELEASE_VALIDATION_SCRIPT.md:715  - Full-sentence narrative text (not "TODO wire LLM" or lorem ipsum)
SECURITY_AUDIT_REPORT.md:267  // TODO: Support multi-org users (currently using first org membership only)
SECURITY_AUDIT_REPORT.md:432  * TODO: Apply the same tenant isolation logic to Key Results write paths (PATCH/DELETE)
SECURITY_AUDIT_REPORT.md:435  ✅ Comments match behavior. TODO is accurate (Key Results need same logic, see section 4).
SECURITY_AUDIT_REPORT.md:529  // TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.
SECURITY_AUDIT_REPORT.md:569  // TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.
SECURITY_AUDIT_REPORT.md:609  // TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.
SECURITY_AUDIT_REPORT.md:649  // TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.
SECURITY_AUDIT_REPORT.md:1065  ## 7. TODO Hygiene and Risk
SECURITY_AUDIT_REPORT.md:1067  ### 7.1 TODO Scan Results
SECURITY_AUDIT_REPORT.md:1069  **Search Pattern:** `TODO.*tenant-isolation|TODO.*P1|TODO.*KR|TODO.*superuser`
SECURITY_AUDIT_REPORT.md:1073  | File | Line(s) | TODO Content | Risk Level | Blocks Demo? |
SECURITY_AUDIT_REPORT.md:1075  | `okr/key-result.service.ts` | 201 | `TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.` | **Tech Debt** | ❌ No |
SECURITY_AUDIT_REPORT.md:1076  | `okr/key-result.service.ts` | 269 | `TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.` | **Tech Debt** | ❌ No |
SECURITY_AUDIT_REPORT.md:1077  | `okr/key-result.service.ts` | 324 | `TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.` | **Tech Debt** | ❌ No |
SECURITY_AUDIT_REPORT.md:1078  | `okr/key-result.service.ts` | 385 | `TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.` | **Tech Debt** | ❌ No |
SECURITY_AUDIT_REPORT.md:1079  | `okr/objective.service.ts` | 156 | `TODO: Apply the same tenant isolation logic to Key Results write paths (PATCH/DELETE)` | **Already Done** | ❌ No |
SECURITY_AUDIT_REPORT.md:1080  | `auth/strategies/jwt.strategy.ts` | 37 | `TODO: Support multi-org users (currently using first org membership only)` | **Scalability** | ❌ No |
SECURITY_AUDIT_REPORT.md:1083  - All TODOs are for future enhancements (multi-org support) or code organization (formal KR permission methods)
SECURITY_AUDIT_REPORT.md:1084  - No security-critical TODOs blocking demo
SECURITY_AUDIT_REPORT.md:1085  - The Key Results tenant isolation is already implemented (inline guards), the TODO is about formalizing it
SECURITY_AUDIT_REPORT.md:1087  **Verdict:** ✅ **NO BLOCKING TODOs.** All TODOs are for future work or code organization.
SECURITY_AUDIT_REPORT.md:1089  ### 7.2 TODO vs Behavior Contradictions
SECURITY_AUDIT_REPORT.md:1091  **Checked:** All TODOs against actual code behavior.
SECURITY_AUDIT_REPORT.md:1095  - ✅ TODOs accurately describe future work needed
TENANT_ISOLATION_VERIFICATION_REPORT.md:26  // TODO: Define explicit behavior for users with no organization membership (currently returns undefined, effectively blocks access)
TENANT_ISOLATION_VERIFICATION_REPORT.md:41  ## 3. TODO Classification
TENANT_ISOLATION_VERIFICATION_REPORT.md:52  1. **objective.service.ts:135** - `TODO: Define explicit behavior for OKRs that have no organizationId`
TENANT_ISOLATION_VERIFICATION_REPORT.md:56  2. **objective.service.ts:167** - `TODO: Define explicit behavior for OKRs that have no organizationId`
TENANT_ISOLATION_VERIFICATION_REPORT.md:60  3. **objective.service.ts:153** - `TODO: Apply the same tenant isolation logic to Key Results write paths (PATCH/DELETE)`
TENANT_ISOLATION_VERIFICATION_REPORT.md:70  1. **jwt.strategy.ts:37** - `TODO: Support multi-org users (currently using first org membership only)`
TENANT_ISOLATION_VERIFICATION_REPORT.md:74  2. **jwt.strategy.ts:44** - `TODO: Define explicit behavior for users with no organization membership`
TENANT_ISOLATION_VERIFICATION_REPORT.md:76  - **Action**: Update TODO after fix
TENANT_ISOLATION_VERIFICATION_REPORT.md:78  3. **permissions/tenant-isolation.guard.ts:15** - `TODO: Cleanup/removal of legacy membership tables and TenantIsolationGuard after all controllers migrated`
TENANT_ISOLATION_VERIFICATION_REPORT.md:82  4. **rbac/rbac.service.ts:295,323** - `TODO: Record audit log`
TENANT_ISOLATION_VERIFICATION_REPORT.md:86  5. **rbac/audit.ts:59** - `TODO: Implement actual audit logging`
TENANT_ISOLATION_VERIFICATION_REPORT.md:90  6. **auth/auth.service.ts:150** - `TODO: Implement actual Keycloak token verification`
TENANT_ISOLATION_VERIFICATION_REPORT.md:142  - No TODO suggests relaxing it ✓
TODO_REGISTER.json:5  "comment": "TODO [tenant-isolation-P1-KR]: This is a placeholder until formal KR RBAC is implemented.",
TODO_REGISTER.json:12  "comment": "TODO [tenant-isolation-P1-KR]: This is a placeholder until formal KR RBAC is implemented.",
TODO_REGISTER.json:19  "comment": "TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.",
TODO_REGISTER.json:26  "comment": "TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.",
TODO_REGISTER.json:33  "comment": "TODO: Future version will allow \"propose change\" workflow instead of hard blocking",
TODO_REGISTER.json:40  "comment": "TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.",
TODO_REGISTER.json:47  "comment": "TODO: Future version will allow \"propose change\" workflow instead of hard blocking",
TODO_REGISTER.json:54  "comment": "TODO [tenant-isolation-P1-KR]: replace with formal canEditKeyResult/canDeleteKeyResult.",
TODO_REGISTER.json:61  "comment": "TODO: Future version will allow \"propose change\" workflow instead of hard blocking",
TODO_REGISTER.json:68  "comment": "TODO: Optimize this query - currently fetches all KRs and their latest check-ins, then filters in JS.",
TODO_REGISTER.json:75  "comment": "TODO: Apply the same tenant isolation logic to Key Results write paths (PATCH/DELETE)",
TODO_REGISTER.json:82  "comment": "TODO: Future version will allow \"propose change\" workflow instead of hard blocking",
TODO_REGISTER.json:89  "comment": "TODO: Future version will allow \"propose change\" workflow instead of hard blocking",
TODO_REGISTER.json:96  "comment": "TODO: Later we should handle multiple active cycles, but for now assume at most one active cycle per org.",
TODO_REGISTER.json:103  "comment": "TODO: Frontend - use this to populate a 'filter by strategic bet' dropdown in analytics and OKR list",
TODO_REGISTER.json:110  "comment": "TODO: Frontend - show active cycle name at the top of the OKR dashboard and mark locked cycles",
TODO_REGISTER.json:117  "comment": "TODO: Frontend: highlight rows where objectiveCountInActiveCycle === 0 as strategic gaps.",
TODO_REGISTER.json:124  "comment": "TODO: Frontend - add Export CSV button in analytics dashboard for TENANT_OWNER / TENANT_ADMIN",
TODO_REGISTER.json:131  "comment": "TODO: Frontend - show warning modal when attempting to edit published OKR",
TODO_REGISTER.json:138  "comment": "TODO: Frontend - show warning modal when attempting to delete published OKR",
TODO_REGISTER.json:145  "comment": "TODO: Frontend - expose this on the Objective detail view timeline",
TODO_REGISTER.json:152  "comment": "TODO: Frontend: show 'Check-ins overdue' widget in analytics.",
TODO_REGISTER.json:159  "comment": "TODO: Frontend - expose this on the Key Result detail view timeline",
TODO_REGISTER.json:166  "comment": "TODO: Future enhancements:\n * - Add weighting support on ObjectiveKeyResult junction table (e.g., KR1 = 40%, KR2 = 60%)\n * - Add performance optimization with batch recalculation\n * - Add transaction support for atomic updates",
TODO_REGISTER.json:173  "comment": "TODO: Support multi-org users (currently using first org membership only)",
TODO_REGISTER.json:180  "comment": "TODO: Frontend: this powers a 'My dashboard' view; later we can add widgets for only-my-team.",
TODO_REGISTER.json:187  "comment": "TODO: Admin endpoint to update cycle.status (DRAFT -> ACTIVE -> LOCKED -> ARCHIVED)",
TODO_REGISTER.json:194  "comment": "TODO: Record audit log",
TODO_REGISTER.json:201  "comment": "TODO: Record audit log",
TODO_REGISTER.json:208  "comment": "TODO: Implement actual audit logging",
TODO_REGISTER.json:215  "comment": "TODO: Implement actual Keycloak token verification",
TODO_REGISTER.json:222  "comment": "TODO: Cleanup/removal of legacy membership tables and TenantIsolationGuard after all controllers migrated",
TODO_REGISTER.json:229  "comment": "TODO: Future: call backend activity endpoint to show audit drawer.",
TODO_REGISTER.json:236  "comment": "TODO: Later we'll surface a CTA for admins to open next cycle / lock current cycle.",
TODO_REGISTER.json:243  "comment": "TODO: Make this pretty later - replace with proper drawer/modal component",
TODO_REGISTER.json:250  "comment": "TODO: Make this pretty later - replace with proper drawer/modal component",
TODO_REGISTER.json:257  "comment": "TODO: Add loading state and better error handling",
TODO_REGISTER.json:264  "comment": "TODO: RBAC nuance - ensure canAdministerTenant() matches backend checks exactly",
TODO_REGISTER.json:271  "comment": "TODO: Backend endpoint `/me/summary` is now available and should be integrated here.",
TODO_REGISTER.json:278  "comment": "TODO: Implement SSE streaming",
TODO_REGISTER.json:285  "comment": "TODO: Implement Slack API call",
TODO_REGISTER.json:292  "comment": "TODO: Implement webhook processing",
TODO_REGISTER.json:299  "comment": "TODO: Implement webhook processing",
TODO_REGISTER.json:306  "comment": "TODO: Implement Jira issue sync",
TODO_REGISTER.json:313  "comment": "TODO: Implement Jira API call",
TODO_REGISTER.json:320  "comment": "TODO: Implement GitHub API call",
docs/MERGE_PLAN.md:18  **TODOs that MUST NOT ship into main:** None (scaffolding only)
docs/MERGE_PLAN.md:31  **TODOs that MUST NOT ship into main:** None
docs/MERGE_PLAN.md:43  **TODOs that MUST NOT ship into main:** None
docs/MERGE_PLAN.md:56  **TODOs that MUST NOT ship into main:** None
docs/MERGE_PLAN.md:69  **TODOs that MUST NOT ship into main:** None
docs/MERGE_PLAN.md:82  **TODOs that MUST NOT ship into main:** None
docs/MERGE_PLAN.md:95  **TODOs that MUST NOT ship into main:** None
docs/MERGE_PLAN.md:108  **TODOs that MUST NOT ship into main:** None
docs/MERGE_PLAN.md:121  **TODOs that MUST NOT ship into main:** None
docs/MERGE_PLAN.md:134  **TODOs that MUST NOT ship into main:** None
docs/MERGE_PLAN.md:147  **TODOs that MUST NOT ship into main:** None
docs/architecture/FRONTEND_OVERVIEW.md:149  - `canSeeObjective(objective)`: Visibility check (currently always true, TODO: align with backend)
docs/architecture/FRONTEND_OVERVIEW.md:254  ## TODO: Future Improvements
docs/tenant-isolation.md:51  - Interim guard marked with // TODO [tenant-isolation-P1-KR].
scripts/todo-audit.js:4  * TODO / FIXME / HACK / NOTE Compliance Audit Script
scripts/todo-audit.js:6  * Scans the repository for TODO-style comments and enforces allowed formats.
scripts/todo-audit.js:32  const MATCH_PATTERNS = ['TODO', 'FIXME', 'HACK', 'NOTE:'];
scripts/todo-audit.js:49  if (filePath.includes('docs/TODO_AUDIT_REPORT.md')) {
scripts/todo-audit.js:97  if (trimmed.startsWith('NOTE:') || trimmed.startsWith('// NOTE:') || trimmed.startsWith('/* NOTE:') || trimmed.startsWith('* NOTE:')) {
scripts/todo-audit.js:196  let report = `# TODO / FIXME / NOTE Audit\n\n`;
scripts/todo-audit.js:201  report += `- Allowed phase-tag TODOs: ${allowedPhaseTagCount}\n`;
scripts/todo-audit.js:203  report += `- Unapproved TODOs / FIXMEs / HACKs: ${unapprovedCount}\n\n`;
scripts/todo-audit.js:206  report += `## Unapproved TODOs (BLOCKERS)\n\n`;
scripts/todo-audit.js:218  report += `## All Allowed Phase TODOs\n\n`;
scripts/todo-audit.js:245  console.error('🔍 Scanning repository for TODO / FIXME / HACK / NOTE comments...\n');
scripts/todo-audit.js:273  const reportPath = path.join(REPO_ROOT, 'docs', 'TODO_AUDIT_REPORT.md');
scripts/todo-audit.js:286  // Exit with error code if unapproved TODOs found
scripts/todo-audit.js:288  console.error(`\n❌ Found ${summary.unapprovedCount} unapproved TODO/FIXME/HACK comment(s). These must be fixed before proceeding.`);
scripts/todo-audit.js:291  console.error(`\n✅ All TODO comments are compliant.`);
services/ai-service/src/personas/persona.controller.ts:37  // TODO: Implement SSE streaming
services/core-api/prisma/schema.prisma:202  // TODO: Admin endpoint to update cycle.status (DRAFT -> ACTIVE -> LOCKED -> ARCHIVED)
services/core-api/src/modules/activity/activity.controller.ts:36  * TODO [phase4-reporting]: Frontend - expose this on the Objective detail view timeline.
services/core-api/src/modules/activity/activity.controller.ts:72  * TODO [phase4-reporting]: Frontend - expose this on the Key Result detail view timeline.
services/core-api/src/modules/activity/activity.controller.ts:107  * TODO: Future enhancement - show all activity across user's OKRs/KRs
services/core-api/src/modules/activity/activity.controller.ts:119  // TODO: Future implementation
services/core-api/src/modules/auth/strategies/jwt.strategy.ts:107  // TODO: Support multi-org users (currently using first org membership only)
services/core-api/src/modules/okr/key-result.service.ts:125  * TODO [tenant-isolation-P1-KR]: This is a placeholder until formal KR RBAC is implemented.
services/core-api/src/modules/okr/key-result.service.ts:195  * TODO [tenant-isolation-P1-KR]: This is a placeholder until formal KR RBAC is implemented.
services/core-api/src/modules/okr/key-result.service.ts:422  // TODO [phase3-governance]: Governance logic moved to OkrGovernanceService
services/core-api/src/modules/okr/key-result.service.ts:423  // TODO [propose-change-workflow]: Future version will allow "propose change" workflow instead of hard blocking
services/core-api/src/modules/okr/key-result.service.ts:527  // TODO [phase3-governance]: Governance logic moved to OkrGovernanceService
services/core-api/src/modules/okr/key-result.service.ts:528  // TODO [propose-change-workflow]: Future version will allow "propose change" workflow instead of hard blocking
services/core-api/src/modules/okr/key-result.service.ts:631  // TODO [phase3-governance]: Governance logic moved to OkrGovernanceService
services/core-api/src/modules/okr/key-result.service.ts:632  // TODO [propose-change-workflow]: Future version will allow "propose change" workflow instead of hard blocking
services/core-api/src/modules/okr/me.controller.ts:22  // TODO: Frontend: this powers a 'My dashboard' view; later we can add widgets for only-my-team.
services/core-api/src/modules/okr/objective.controller.ts:82  // TODO: Frontend - show warning modal when attempting to edit published OKR
services/core-api/src/modules/okr/objective.controller.ts:98  // TODO: Frontend - show warning modal when attempting to delete published OKR
services/core-api/src/modules/okr/objective.service.ts:401  // TODO [phase3-governance]: Governance logic moved to OkrGovernanceService
services/core-api/src/modules/okr/objective.service.ts:402  // TODO [propose-change-workflow]: Future version will allow "propose change" workflow instead of hard blocking
services/core-api/src/modules/okr/objective.service.ts:519  // TODO [phase3-governance]: Governance logic moved to OkrGovernanceService
services/core-api/src/modules/okr/objective.service.ts:520  // TODO [propose-change-workflow]: Future version will allow "propose change" workflow instead of hard blocking
services/core-api/src/modules/okr/okr-governance.service.ts:65  // TODO [propose-change-workflow]: Future version will allow "propose change" workflow instead of hard blocking
services/core-api/src/modules/okr/okr-governance.service.ts:109  // TODO [propose-change-workflow]: Future version will allow "propose change" workflow instead of hard blocking
services/core-api/src/modules/okr/okr-governance.service.ts:307  * TODO [propose-change-workflow]: Implement "propose change" workflow instead of hard blocking
services/core-api/src/modules/okr/okr-governance.service.ts:313  // TODO [propose-change-workflow]: Future implementation
services/core-api/src/modules/okr/okr-progress.service.ts:10  * TODO: Future enhancements:
services/core-api/src/modules/okr/okr-reporting.controller.ts:22  * TODO Phase 2: Move the following endpoints from ObjectiveController:
services/core-api/src/modules/okr/okr-reporting.controller.ts:30  * TODO Phase 2: Move the following endpoints from KeyResultController:
services/core-api/src/modules/okr/okr-reporting.controller.ts:60  * TODO [phase4-reporting]: Frontend - add this feed to analytics dashboard.
services/core-api/src/modules/okr/okr-reporting.controller.ts:76  * TODO [phase4-reporting]: Frontend - add Export CSV button in analytics dashboard for TENANT_OWNER / TENANT_ADMIN.
services/core-api/src/modules/okr/okr-reporting.controller.ts:116  * TODO [phase4-reporting]: Frontend - show active cycle name at the top of the OKR dashboard and mark locked cycles.
services/core-api/src/modules/okr/okr-reporting.controller.ts:130  * TODO [phase4-reporting]: Frontend - use this to populate a 'filter by strategic bet' dropdown in analytics and OKR list.
services/core-api/src/modules/okr/okr-reporting.controller.ts:144  * TODO [phase4-reporting]: Frontend - highlight strategic gaps (pillars with zero objectives).
services/core-api/src/modules/okr/okr-reporting.controller.ts:158  * TODO [phase4-reporting]: Frontend - show 'Check-ins overdue' widget in analytics.
services/core-api/src/modules/okr/okr-reporting.service.ts:31  * TODO [phase4-reporting]: Early reporting endpoint - may need optimization for large datasets.
services/core-api/src/modules/okr/okr-reporting.service.ts:103  * TODO [phase4-reporting]: May need optimization for memory usage with large datasets.
services/core-api/src/modules/okr/okr-reporting.service.ts:288  * TODO [phase4-reporting]: Early reporting endpoint - moved to /reports/* in Phase 4.
services/core-api/src/modules/okr/okr-reporting.service.ts:381  * TODO [phase4-reporting]: Frontend will use to populate 'filter by strategic bet' dropdown.
services/core-api/src/modules/okr/okr-reporting.service.ts:452  * TODO [phase4-reporting]: Later we should handle multiple active cycles, but for now assume at most one active cycle per org.
services/core-api/src/modules/okr/okr-reporting.service.ts:511  * TODO [phase4-reporting]: Later we should handle multiple active cycles, but for now assume at most one active cycle per org.
services/core-api/src/modules/okr/okr-reporting.service.ts:512  * TODO [phase4-reporting]: Frontend - highlight strategic gaps (pillars with zero objectives).
services/core-api/src/modules/okr/okr-reporting.service.ts:696  * TODO [phase4-reporting]: Optimize this query - currently fetches all KRs and their latest check-ins, then filters in JS.
services/core-api/src/modules/okr/okr-reporting.service.ts:727  // TODO: Optimize this query - currently fetches all KRs and their latest check-ins, then filters in JS.
services/core-api/src/modules/okr/tenant-guard.ts:16  * TODO: Extract tenant isolation logic from:
services/core-api/src/modules/permissions/tenant-isolation.guard.ts:15  * TODO: Cleanup/removal of legacy membership tables and TenantIsolationGuard after all controllers migrated
services/core-api/src/modules/rbac/COMPLETED_STEPS.md:84  - TODO comments mark where API calls should be added
services/core-api/src/modules/rbac/audit.ts:59  // TODO: Implement actual audit logging
services/core-api/src/modules/rbac/rbac.service.ts:323  // TODO: Record audit log
services/core-api/src/modules/rbac/rbac.service.ts:351  // TODO: Record audit log
services/integration-service/src/connectors/github/github.service.ts:13  // TODO: Implement GitHub API call
services/integration-service/src/connectors/jira/jira.service.ts:13  // TODO: Implement Jira issue sync
services/integration-service/src/connectors/jira/jira.service.ts:19  // TODO: Implement Jira API call
services/integration-service/src/connectors/slack/slack.service.ts:15  // TODO: Implement Slack API call
services/integration-service/src/webhooks/webhook.service.ts:7  // TODO: Implement webhook processing
services/integration-service/src/webhooks/webhook.service.ts:13  // TODO: Implement webhook processing
```

## All Allowed Phase TODOs

```text
PHASE7_SUMMARY.md:33  - ✅ TODO tags standardised to `[phase6-polish]`, `[phase7-hardening]`, `[phase7-performance]`
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
docs/MERGE_PLAN.md:174  - [ ] No TODO tags blocking merge (only allowed: `[phase6-polish]`, `[phase7-hardening]`, `[phase7-performance]`)
```

## All Notes

```text
SECURITY_AUDIT_REPORT.md:935  // NOTE: organizationId is the canonical tenant identifier.
SECURITY_AUDIT_REPORT.md:945  // NOTE: organizationId is the canonical tenant identifier.
SECURITY_AUDIT_REPORT.md:955  // NOTE: organizationId is the canonical tenant identifier.
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

