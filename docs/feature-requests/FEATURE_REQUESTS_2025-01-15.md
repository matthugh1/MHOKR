---
title: Feature Requests - 2025-01-15
source: audit / epic / TODO scan
generatedBy: Cursor
date: 2025-01-15
---

# Feature Requests - 2025-01-15

**Generated:** 2025-01-15  
**Source:** Comprehensive audit scan of TODO comments, audit reports, epic summaries, and planning documents  
**Total Requests:** 47

---

## Product Areas

- **OKR Core:** 18 requests
- **RBAC & Security:** 8 requests
- **Analytics & Reporting:** 5 requests
- **Integrations:** 4 requests
- **Performance & Scalability:** 6 requests
- **UX & Polish:** 6 requests

---

## OKR Core

### OKR-CORE-FR001: Multi-Organization User Support

**Title:** Support users belonging to multiple organizations

**Problem Statement:** JWT strategy currently only uses first org membership, preventing users from accessing multiple organizations they belong to.

**Proposed Solution:** Update JWT strategy to support multiple organization memberships, allow users to switch between organizations, and maintain separate RBAC contexts per organization.

**Expected Outcome / KPI:**
- Users can access all organizations they belong to
- Organization switching UI available
- RBAC context correctly scoped per organization
- Zero cross-tenant data leakage

**Priority:** High

**Effort Estimate:** L (Large)

**Dependencies:** JWT strategy refactor, RBAC context builder updates

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/src/modules/auth/strategies/jwt.strategy.ts:107` - TODO comment

---

### OKR-CORE-FR002: Propose Change Workflow for Locked OKRs

**Title:** Allow "propose change" workflow instead of hard blocking edits on locked OKRs

**Problem Statement:** Currently, users cannot edit published/locked OKRs at all. A workflow to propose changes would improve collaboration while maintaining governance.

**Proposed Solution:** Implement a change proposal system where users can submit change requests for locked OKRs, which owners/admins can approve or reject.

**Expected Outcome / KPI:**
- Users can propose changes to locked OKRs
- Change proposals tracked in audit log
- Approval workflow for proposals
- Reduced friction in OKR updates

**Priority:** Medium

**Effort Estimate:** XL (Extra Large)

**Dependencies:** Governance service updates, audit logging, UI components

**Status:** Idea

**Linked Epics:** None

**Evidence:** Multiple TODO comments in `okr-governance.service.ts`, `objective.service.ts`, `key-result.service.ts`

---

### OKR-CORE-FR003: Key Result Weighting Support

**Title:** Add weighting support for Key Results in progress calculation

**Problem Statement:** Currently all Key Results contribute equally to Objective progress. Some KRs may be more important than others.

**Proposed Solution:** Add `weight` field to `ObjectiveKeyResult` junction table, allow users to assign weights (e.g., KR1 = 40%, KR2 = 60%), and update progress calculation to use weighted average.

**Expected Outcome / KPI:**
- Objectives can have weighted Key Results
- Progress calculation reflects importance
- UI shows weights in KR list
- Backward compatible (default weight = equal)

**Priority:** Medium

**Effort Estimate:** M (Medium)

**Dependencies:** Schema migration, progress service updates

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/src/modules/okr/okr-progress.service.ts:10` - TODO comment

---

### OKR-CORE-FR004: Admin Endpoint for Cycle Status Updates

**Title:** Create admin endpoint to update cycle status (DRAFT → ACTIVE → LOCKED → ARCHIVED)

**Problem Statement:** Cycle status transitions are not exposed via API, requiring manual database updates.

**Proposed Solution:** Create admin-only endpoint `PATCH /cycles/:id/status` with RBAC guard requiring `manage_tenant_settings`, validate state transitions, and record audit logs.

**Expected Outcome / KPI:**
- Admins can update cycle status via API
- State transitions validated
- Audit trail for status changes
- UI can trigger status updates

**Priority:** High

**Effort Estimate:** S (Small)

**Dependencies:** Cycle service updates, RBAC guards

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/prisma/schema.prisma:202` - TODO comment

---

### OKR-CORE-FR005: Deep Links for Objectives

**Title:** Add `objectiveId` query param to highlight specific objective in list/tree view

**Problem Statement:** Users cannot share links to specific objectives, limiting collaboration.

**Proposed Solution:** Support `?objectiveId=xxx` in URL, automatically expand/highlight objective when present, and respect visibility rules (don't expose PRIVATE OKRs).

**Expected Outcome / KPI:**
- Users can share links to specific objectives
- Deep links work in List and Tree views
- Visibility rules enforced
- Improved collaboration

**Priority:** Low

**Effort Estimate:** S (Small)

**Dependencies:** URL param handling, visibility checks

**Status:** Idea

**Linked Epics:** [OKR Trio Audit Backlog](../../audit/OKR_TRIO_AUDIT_BACKLOG.md) - Story 11

---

### OKR-CORE-FR006: Scope Toggle URL Persistence

**Title:** Persist scope selection in URL params and send explicit scope param to backend

**Problem Statement:** Scope toggle doesn't persist across page reloads, and backend relies on implicit visibility filtering instead of explicit scope param.

**Proposed Solution:** Add `scope` query param to URL (`?scope=my|team-workspace|tenant`), send explicit scope param to `/okr/overview` endpoint, and update backend to filter by scope explicitly.

**Expected Outcome / KPI:**
- Scope selection persists across reloads
- Backend explicitly filters by scope
- Improved testability
- Better performance (backend can optimize queries)

**Priority:** Critical

**Effort Estimate:** M (Medium)

**Dependencies:** Frontend URL handling, backend query param support

**Status:** Planned

**Linked Epics:** [OKR Trio Audit Backlog](../../audit/OKR_TRIO_AUDIT_BACKLOG.md) - Story 1

---

### OKR-CORE-FR007: Role-Aware Empty States

**Title:** Show role-appropriate empty states with action buttons

**Problem Statement:** Empty states are generic and don't guide users based on their permissions.

**Proposed Solution:** TENANT_ADMIN sees "Create your first objective" with button, CONTRIBUTOR sees message without button if `canCreateObjective === false`, and SUPERUSER sees read-only message.

**Expected Outcome / KPI:**
- Users understand if they can create OKRs
- Reduced confusion about empty states
- Improved onboarding experience
- Aligned with RBAC permissions

**Priority:** Critical

**Effort Estimate:** S (Small)

**Dependencies:** Permission checks, UI components

**Status:** Planned

**Linked Epics:** [OKR Trio Audit Backlog](../../audit/OKR_TRIO_AUDIT_BACKLOG.md) - Story 2

---

### OKR-CORE-FR008: Client-Side Filters Migration to Backend

**Title:** Move workspace, team, owner, search filters to backend query params

**Problem Statement:** Client-side filtering reduces performance and scalability. All filtering should be server-side for consistency.

**Proposed Solution:** Add `workspaceId`, `teamId`, `ownerId`, `search` query params to `/okr/overview`, filter server-side before visibility checks, and remove client-side filtering logic.

**Expected Outcome / KPI:**
- Consistent server-side filtering
- Better performance (reduced client computation)
- Improved scalability
- Backend can optimize queries

**Priority:** Medium

**Effort Estimate:** L (Large)

**Dependencies:** Backend query param support, frontend API updates

**Status:** Idea

**Linked Epics:** [OKR Trio Audit Backlog](../../audit/OKR_TRIO_AUDIT_BACKLOG.md) - Story 8

---

### OKR-CORE-FR009: Enhanced Lock Warning Messages

**Title:** Show specific lock reason in warning message (publish lock vs cycle lock)

**Problem Statement:** Generic lock messages don't explain why OKRs are locked, causing user confusion.

**Proposed Solution:** Lock message specifies reason ("This objective is published and locked" vs "This cycle is locked"), add tooltip explaining governance rules, and include actionable guidance.

**Expected Outcome / KPI:**
- Users understand why OKRs are locked
- Reduced support requests
- Better UX for governance features
- Clear actionable guidance

**Priority:** High

**Effort Estimate:** S (Small)

**Dependencies:** Lock info service updates, UI components

**Status:** Planned

**Linked Epics:** [OKR Trio Audit Backlog](../../audit/OKR_TRIO_AUDIT_BACKLOG.md) - Story 4

---

### OKR-CORE-FR010: Activity Timeline in Objective Detail View

**Title:** Expose activity timeline endpoints on Objective detail view

**Problem Statement:** Activity endpoints exist but not exposed in UI, limiting visibility into OKR history.

**Proposed Solution:** Add activity timeline component to Objective detail view, show check-ins, status changes, and edits, and support pagination for long histories.

**Expected Outcome / KPI:**
- Users can see OKR history
- Improved transparency
- Better audit trail visibility
- Enhanced collaboration

**Priority:** Medium

**Effort Estimate:** M (Medium)

**Dependencies:** Activity service endpoints, UI components

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/src/modules/activity/activity.controller.ts:36` - TODO comment

---

### OKR-CORE-FR011: Activity Timeline in Key Result Detail View

**Title:** Expose activity timeline endpoints on Key Result detail view

**Problem Statement:** Key Result activity not visible in UI, limiting visibility into KR history.

**Proposed Solution:** Add activity timeline component to Key Result detail view, show check-ins and updates, and support pagination.

**Expected Outcome / KPI:**
- Users can see KR history
- Improved transparency
- Better tracking of KR progress

**Priority:** Medium

**Effort Estimate:** M (Medium)

**Dependencies:** Activity service endpoints, UI components

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/src/modules/activity/activity.controller.ts:72` - TODO comment

---

### OKR-CORE-FR012: Cross-User Activity Feed

**Title:** Show all activity across user's OKRs/KRs in unified feed

**Problem Statement:** Users cannot see a unified view of all activity across their OKRs.

**Proposed Solution:** Create `/activity/user/:userId` endpoint showing all activity for user's OKRs/KRs, support filtering by date range, and add UI component for activity feed.

**Expected Outcome / KPI:**
- Users see unified activity feed
- Better visibility into OKR updates
- Improved collaboration awareness

**Priority:** Low

**Effort Estimate:** M (Medium)

**Dependencies:** Activity service updates, UI components

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/src/modules/activity/activity.controller.ts:107` - TODO comment

---

### OKR-CORE-FR013: Warning Modal for Editing Published OKRs

**Title:** Show warning modal when attempting to edit published OKR

**Problem Statement:** Users can attempt to edit published OKRs without understanding governance implications.

**Proposed Solution:** Show warning modal explaining publish lock, allow user to proceed or cancel, and record audit log of edit attempts.

**Expected Outcome / KPI:**
- Users understand governance implications
- Reduced accidental edits
- Better compliance with governance rules

**Priority:** Medium

**Effort Estimate:** S (Small)

**Dependencies:** UI modal component, governance checks

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/src/modules/okr/objective.controller.ts:82` - TODO comment

---

### OKR-CORE-FR014: Warning Modal for Deleting Published OKRs

**Title:** Show warning modal when attempting to delete published OKR

**Problem Statement:** Users can attempt to delete published OKRs without understanding governance implications.

**Proposed Solution:** Show warning modal explaining publish lock, require confirmation, and record audit log of delete attempts.

**Expected Outcome / KPI:**
- Users understand governance implications
- Reduced accidental deletions
- Better compliance with governance rules

**Priority:** Medium

**Effort Estimate:** S (Small)

**Dependencies:** UI modal component, governance checks

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/src/modules/okr/objective.controller.ts:98` - TODO comment

---

### OKR-CORE-FR015: Dedicated "My Dashboard" View

**Title:** Expose `/me` endpoint data in dedicated dashboard view

**Problem Statement:** `/me` endpoint provides useful data but not exposed in UI.

**Proposed Solution:** Create "My Dashboard" view showing user's OKRs, overdue check-ins, and key metrics, use `/me` endpoint data, and provide personalized insights.

**Expected Outcome / KPI:**
- Users have personalized dashboard
- Better visibility into personal OKRs
- Improved user engagement

**Priority:** Low

**Effort Estimate:** M (Medium)

**Dependencies:** `/me` endpoint, UI components

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/src/modules/okr/me.controller.ts:22` - TODO comment

---

### OKR-CORE-FR016: Strategic Bet Filter Dropdown

**Title:** Use strategic bet endpoint to populate filter dropdown in analytics and OKR list

**Problem Statement:** Strategic bets exist but cannot be used for filtering in UI.

**Proposed Solution:** Add strategic bet filter to analytics dashboard and OKR list, populate from `/reports/strategic-bets` endpoint, and filter OKRs by strategic bet.

**Expected Outcome / KPI:**
- Users can filter by strategic bet
- Better alignment visibility
- Improved strategic planning

**Priority:** Low

**Effort Estimate:** M (Medium)

**Dependencies:** Strategic bet endpoint, UI components

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/src/modules/okr/okr-reporting.controller.ts:122` - TODO comment

---

### OKR-CORE-FR017: All Cycles Endpoint

**Title:** Replace placeholder with `/objectives/cycles/all` endpoint to show all cycles, not just active

**Problem Statement:** Currently only active cycles shown, limiting historical view.

**Proposed Solution:** Create `/objectives/cycles/all` endpoint returning all cycles (active, draft, locked, archived), update frontend to use endpoint, and add cycle status filtering.

**Expected Outcome / KPI:**
- Users can view all cycles
- Better historical context
- Improved cycle management

**Priority:** Medium

**Effort Estimate:** S (Small)

**Dependencies:** Backend endpoint, frontend updates

**Status:** Idea

**Linked Epics:** None

**Evidence:** `apps/web/src/app/dashboard/okrs/page.tsx:195` - TODO comment

---

### OKR-CORE-FR018: Remove Synthetic Cycle Fallback

**Title:** Remove hardcoded synthetic cycle fallback and show empty state instead

**Problem Statement:** Synthetic fallback cycle masks backend issues and creates confusion.

**Proposed Solution:** Remove synthetic cycle fallback, show empty state if no cycles from backend, and improve error handling for cycle loading failures.

**Expected Outcome / KPI:**
- No synthetic data in production
- Better error visibility
- Clearer user experience

**Priority:** Medium

**Effort Estimate:** S (Small)

**Dependencies:** Frontend updates, error handling

**Status:** Idea

**Linked Epics:** [OKR Trio Audit Product](../../audit/OKR_TRIO_AUDIT_PRODUCT.md) - B.2

---

## RBAC & Security

### RBAC-FR001: RBAC Audit Logging Implementation

**Title:** Implement actual audit logging for RBAC changes

**Problem Statement:** RBAC role assignments and revocations are not logged, creating compliance gaps.

**Proposed Solution:** Implement audit logging service integration, log all role assignments/revocations with actor, target, action, and timestamp, and expose audit log via admin endpoint.

**Expected Outcome / KPI:**
- Complete audit trail for RBAC changes
- Compliance requirements met
- Security incident investigation capability
- Audit log queryable via API

**Priority:** Critical

**Effort Estimate:** M (Medium)

**Dependencies:** Audit log service, RBAC service updates

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/src/modules/rbac/rbac.service.ts:323, 351` - TODO comments

---

### RBAC-FR002: Check-in Request Manager Validation

**Title:** Add RBAC checks for manager permissions on check-in requests

**Problem Statement:** Check-in request service lacks RBAC validation for manager permissions.

**Proposed Solution:** Add RBAC checks to verify manager permissions before creating check-in requests, validate user can request check-ins for target user, and record audit logs.

**Expected Outcome / KPI:**
- Proper RBAC enforcement for check-ins
- Security compliance
- Reduced unauthorized check-in requests

**Priority:** Critical

**Effort Estimate:** S (Small)

**Dependencies:** RBAC service, check-in request service updates

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/src/modules/okr/checkin-request.service.ts:49` - TODO comment

---

### RBAC-FR003: Frontend Visibility Alignment with Backend

**Title:** Align frontend visibility checks with backend visibility rules

**Problem Statement:** Frontend visibility checks may not match backend rules, causing inconsistencies.

**Proposed Solution:** Update frontend hooks to mirror backend visibility logic, add defensive checks to prevent PRIVATE OKR leakage, and ensure consistency across all visibility checks.

**Expected Outcome / KPI:**
- Frontend and backend visibility aligned
- No PRIVATE OKR leakage
- Consistent user experience
- Better security posture

**Priority:** High

**Effort Estimate:** M (Medium)

**Dependencies:** Frontend hooks updates, backend visibility service

**Status:** Idea

**Linked Epics:** None

**Evidence:** `apps/web/src/hooks/useTenantPermissions.ts:106-124` - TODO comments

---

### RBAC-FR004: Key Result RBAC Implementation

**Title:** Implement formal RBAC for Key Results (currently placeholder)

**Problem Statement:** Key Result RBAC is currently a placeholder, not enforcing proper permissions.

**Proposed Solution:** Implement full RBAC for Key Results, define actions (view, edit, delete, create), enforce permissions based on parent Objective and user role, and update service methods.

**Expected Outcome / KPI:**
- Proper RBAC for Key Results
- Security compliance
- Consistent permission model
- Better access control

**Priority:** High

**Effort Estimate:** M (Medium)

**Dependencies:** RBAC service updates, Key Result service updates

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/src/modules/okr/key-result.service.ts:125, 195` - TODO comments

---

### RBAC-FR005: TENANT_ADMIN Workspace Management Scope Clarification

**Title:** Clarify if TENANT_ADMIN can create/edit workspaces (cannot delete)

**Problem Statement:** Unclear if TENANT_ADMIN can create/edit workspaces, causing inconsistent permissions.

**Proposed Solution:** Document TENANT_ADMIN workspace permissions, update RBAC matrix, and ensure consistent enforcement across codebase.

**Expected Outcome / KPI:**
- Clear TENANT_ADMIN permissions
- Consistent enforcement
- Better documentation
- Reduced confusion

**Priority:** Medium

**Effort Estimate:** S (Small)

**Dependencies:** RBAC matrix updates, documentation

**Status:** Idea

**Linked Epics:** None

**Evidence:** [RBAC Matrix](../../audit/RBAC_MATRIX.md) - Section 5

---

### RBAC-FR006: Legacy Membership Tables Cleanup

**Title:** Remove legacy membership tables and TenantIsolationGuard after all controllers migrated

**Problem Statement:** Legacy membership tables and guard still exist after migration to new RBAC system.

**Proposed Solution:** Audit all controllers for legacy guard usage, migrate remaining controllers, remove legacy tables and guard, and update documentation.

**Expected Outcome / KPI:**
- Cleaner codebase
- Reduced technical debt
- Single source of truth for permissions
- Better maintainability

**Priority:** Low

**Effort Estimate:** M (Medium)

**Dependencies:** Controller migration completion, schema cleanup

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/src/modules/permissions/tenant-isolation.guard.ts:15` - TODO comment

---

### RBAC-FR007: Client-Side Defensive Visibility Check

**Title:** Add client-side defensive check to prevent PRIVATE OKR leakage

**Problem Statement:** If backend bug occurs, PRIVATE OKRs could leak to frontend.

**Proposed Solution:** Add defensive visibility check in frontend before rendering OKRs, filter out PRIVATE OKRs user cannot see, and log warnings if leakage detected.

**Expected Outcome / KPI:**
- Defense in depth for visibility
- Reduced security risk
- Better error detection
- Improved security posture

**Priority:** Medium

**Effort Estimate:** S (Small)

**Dependencies:** Frontend visibility hooks, logging

**Status:** Idea

**Linked Epics:** [OKR Trio Audit Product](../../audit/OKR_TRIO_AUDIT_PRODUCT.md) - A.5

---

### RBAC-FR008: Visibility Badge for TENANT_ADMIN Users

**Title:** Show visibility badge (PRIVATE vs PUBLIC_TENANT) for TENANT_ADMIN users

**Problem Statement:** Users cannot tell if OKR is PRIVATE or PUBLIC_TENANT in UI.

**Proposed Solution:** Add visibility badge to Objective rows for TENANT_ADMIN users, show "Private" or "Public" badge, and help admins understand visibility levels.

**Expected Outcome / KPI:**
- Admins can see visibility levels
- Better visibility management
- Improved admin UX
- Clearer OKR classification

**Priority:** Low

**Effort Estimate:** S (Small)

**Dependencies:** UI components, permission checks

**Status:** Idea

**Linked Epics:** [OKR Trio Audit Product](../../audit/OKR_TRIO_AUDIT_PRODUCT.md) - A.5

---

## Analytics & Reporting

### ANALYTICS-FR001: Analytics Feed Integration

**Title:** Add analytics feed to analytics dashboard

**Problem Statement:** Analytics feed endpoint exists but not integrated into UI.

**Proposed Solution:** Integrate `/reports/analytics/feed` endpoint into analytics dashboard, show feed of OKR updates and changes, and support filtering and pagination.

**Expected Outcome / KPI:**
- Users see analytics feed in dashboard
- Better visibility into OKR changes
- Improved analytics experience

**Priority:** Medium

**Effort Estimate:** M (Medium)

**Dependencies:** Analytics endpoint, UI components

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/src/modules/okr/okr-reporting.controller.ts:50` - TODO comment

---

### ANALYTICS-FR002: Export CSV Button in Analytics Dashboard

**Title:** Add Export CSV button in analytics dashboard for TENANT_OWNER / TENANT_ADMIN

**Problem Statement:** CSV export endpoint exists but not accessible from UI.

**Proposed Solution:** Add Export CSV button to analytics dashboard, gate by `export_data` permission, trigger CSV download, and show success/error feedback.

**Expected Outcome / KPI:**
- Admins can export analytics data
- Better data portability
- Improved reporting capabilities

**Priority:** Medium

**Effort Estimate:** S (Small)

**Dependencies:** Export endpoint, UI components, permission checks

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/src/modules/okr/okr-reporting.controller.ts:67` - TODO comment

---

### ANALYTICS-FR003: Live Data Integration for AI Dashboard

**Title:** Replace placeholder data with live data from `/reports/*` endpoints

**Problem Statement:** AI dashboard shows placeholder data instead of live analytics.

**Proposed Solution:** Integrate `/reports/*` endpoints into AI dashboard, show live analytics data, and remove placeholder components.

**Expected Outcome / KPI:**
- AI dashboard shows live data
- Better analytics visibility
- Improved dashboard utility

**Priority:** Medium

**Effort Estimate:** M (Medium)

**Dependencies:** Analytics endpoints, UI components

**Status:** Idea

**Linked Epics:** None

**Evidence:** `apps/web/src/app/dashboard/ai/page.tsx:13, 102` - TODO comments

---

### ANALYTICS-FR004: Dynamic Export Permissions

**Title:** Align export permissions dynamically per-tenant, not just role check

**Problem Statement:** Export permissions are hardcoded role checks, not dynamic per tenant.

**Proposed Solution:** Use RBAC service to check `export_data` permission dynamically, respect tenant-specific permissions, and update UI to reflect actual permissions.

**Expected Outcome / KPI:**
- Dynamic export permissions
- Better permission flexibility
- Consistent with RBAC model

**Priority:** Medium

**Effort Estimate:** S (Small)

**Dependencies:** RBAC service, UI updates

**Status:** Idea

**Linked Epics:** None

**Evidence:** `apps/web/src/app/dashboard/analytics/page.tsx:166` - TODO comment

---

### ANALYTICS-FR005: Export Data Permission Alignment

**Title:** Keep `canExportData()` aligned with backend RBACService.canExportData()

**Problem Statement:** Frontend export permission check may drift from backend.

**Proposed Solution:** Ensure frontend `canExportData()` mirrors backend logic, add tests to verify alignment, and document permission requirements.

**Expected Outcome / KPI:**
- Frontend and backend permissions aligned
- Consistent export behavior
- Better security posture

**Priority:** Medium

**Effort Estimate:** S (Small)

**Dependencies:** Frontend hooks, backend RBAC service

**Status:** Idea

**Linked Epics:** None

**Evidence:** `apps/web/src/app/dashboard/analytics/page.tsx:243` - TODO comment

---

## Integrations

### INTEGRATIONS-FR001: GitHub API Integration

**Title:** Implement GitHub API call for integration with GitHub repositories

**Problem Statement:** GitHub integration service exists but not implemented.

**Proposed Solution:** Implement GitHub API client, support repository linking, sync issues/PRs to OKRs, and add webhook support for real-time updates.

**Expected Outcome / KPI:**
- GitHub repositories linked to OKRs
- Issue/PR sync working
- Real-time updates via webhooks
- Better development-OKR alignment

**Priority:** Low

**Effort Estimate:** XL (Extra Large)

**Dependencies:** GitHub API, webhook service, OAuth setup

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/integration-service/src/connectors/github/github.service.ts:13` - TODO comment

---

### INTEGRATIONS-FR002: Jira Issue Sync

**Title:** Implement Jira issue sync for integration with Jira

**Problem Statement:** Jira integration service exists but not implemented.

**Proposed Solution:** Implement Jira API client, support issue linking to OKRs, sync issue status to KR progress, and add webhook support for real-time updates.

**Expected Outcome / KPI:**
- Jira issues linked to OKRs
- Issue status sync working
- Real-time updates via webhooks
- Better project-OKR alignment

**Priority:** Low

**Effort Estimate:** XL (Extra Large)

**Dependencies:** Jira API, webhook service, OAuth setup

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/integration-service/src/connectors/jira/jira.service.ts:13, 19` - TODO comments

---

### INTEGRATIONS-FR003: Slack API Integration

**Title:** Implement Slack API call for integration with Slack

**Problem Statement:** Slack integration service exists but not implemented.

**Proposed Solution:** Implement Slack API client, support channel notifications for OKR updates, send check-in reminders, and add slash commands for OKR queries.

**Expected Outcome / KPI:**
- Slack notifications for OKR updates
- Check-in reminders via Slack
- Slash commands for OKR queries
- Better team communication

**Priority:** Low

**Effort Estimate:** L (Large)

**Dependencies:** Slack API, webhook service, OAuth setup

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/integration-service/src/connectors/slack/slack.service.ts:15` - TODO comment

---

### INTEGRATIONS-FR004: Webhook Processing for Integrations

**Title:** Implement webhook processing for Jira and GitHub integrations

**Problem Statement:** Webhook service exists but processing not implemented.

**Proposed Solution:** Implement webhook handlers for Jira and GitHub events, process webhook payloads, update linked OKRs/KRs, and handle webhook authentication.

**Expected Outcome / KPI:**
- Real-time updates from integrations
- Webhook processing working
- Better integration reliability
- Reduced polling overhead

**Priority:** Low

**Effort Estimate:** M (Medium)

**Dependencies:** Webhook service, integration services

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/integration-service/src/webhooks/webhook.service.ts:7, 13` - TODO comments

---

## Performance & Scalability

### PERF-FR001: Batch Progress Recalculation

**Title:** Add performance optimization with batch recalculation for progress updates

**Problem Statement:** Progress recalculation happens individually, causing performance issues with large datasets.

**Proposed Solution:** Implement batch progress recalculation, process multiple OKRs in single transaction, and optimize database queries.

**Expected Outcome / KPI:**
- Faster progress updates
- Better performance with large datasets
- Reduced database load
- Improved scalability

**Priority:** Medium

**Effort Estimate:** M (Medium)

**Dependencies:** Progress service updates, database optimization

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/src/modules/okr/okr-progress.service.ts:11` - TODO comment

---

### PERF-FR002: Transaction Support for Progress Updates

**Title:** Add transaction support for atomic progress updates

**Problem Statement:** Progress updates may be inconsistent if partial updates fail.

**Proposed Solution:** Wrap progress updates in database transactions, ensure atomicity, and handle rollback on errors.

**Expected Outcome / KPI:**
- Atomic progress updates
- Data consistency guaranteed
- Better error handling
- Improved reliability

**Priority:** Medium

**Effort Estimate:** S (Small)

**Dependencies:** Database transaction support, progress service updates

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/src/modules/okr/okr-progress.service.ts:12` - TODO comment

---

### PERF-FR003: Query Optimization for Large Datasets

**Title:** Optimize queries for large datasets in reporting service

**Problem Statement:** Reporting queries may be slow with large datasets, fetching all data then filtering in JS.

**Proposed Solution:** Optimize database queries, add proper indexes, use database-level filtering, and implement pagination.

**Expected Outcome / KPI:**
- Faster reporting queries
- Better performance with large datasets
- Reduced memory usage
- Improved scalability

**Priority:** Medium

**Effort Estimate:** M (Medium)

**Dependencies:** Database optimization, query refactoring

**Status:** Idea

**Linked Epics:** None

**Evidence:** `services/core-api/src/modules/okr/okr-reporting.service.ts:31, 103, 694, 725` - TODO comments

---

### PERF-FR004: Tree View Lazy Loading

**Title:** Implement lazy loading for Tree view (only render expanded branches)

**Problem Statement:** Tree view performance degrades with large datasets (>100 objectives) by loading all objectives upfront.

**Proposed Solution:** Implement lazy loading, only render expanded branches, lazy-load children when branch expanded, and show performance warning if >100 objectives.

**Expected Outcome / KPI:**
- Faster Tree view initial load
- Better performance with large datasets
- Maintains 60 FPS during navigation
- Improved scalability

**Priority:** Medium

**Effort Estimate:** L (Large)

**Dependencies:** Tree view refactoring, lazy loading implementation

**Status:** Idea

**Linked Epics:** [OKR Trio Audit Backlog](../../audit/OKR_TRIO_AUDIT_BACKLOG.md) - Story 12

---

### PERF-FR005: Pagination Cursor Support

**Title:** Pass pagination cursor + load handler once backend supports it

**Problem Statement:** Current pagination uses page numbers, not efficient cursors.

**Proposed Solution:** Implement cursor-based pagination, update frontend to use cursors, and improve pagination performance.

**Expected Outcome / KPI:**
- More efficient pagination
- Better performance with large datasets
- Improved user experience
- Reduced server load

**Priority:** Low

**Effort Estimate:** M (Medium)

**Dependencies:** Backend cursor support, frontend updates

**Status:** Idea

**Linked Epics:** None

**Evidence:** `apps/web/src/app/dashboard/okrs/page.tsx:851` - TODO comment

---

### PERF-FR006: Activity Timeline Pagination

**Title:** Wire activity timeline to `/activity/*` with pagination params (limit, cursor)

**Problem Statement:** Activity timeline may load all items, causing performance issues.

**Proposed Solution:** Add pagination to activity timeline, use cursor-based pagination, and implement load more functionality.

**Expected Outcome / KPI:**
- Faster activity timeline loading
- Better performance with long histories
- Improved user experience

**Priority:** Low

**Effort Estimate:** S (Small)

**Dependencies:** Activity service pagination, UI components

**Status:** Idea

**Linked Epics:** None

**Evidence:** `apps/web/src/components/ui/ActivityDrawer.tsx:112` - TODO comment

---

## UX & Polish

### UX-FR001: Telemetry for Scope Toggle and Filters

**Title:** Track scope toggle, filter changes, and cycle changes

**Problem Statement:** Cannot measure user behavior without telemetry for key actions.

**Proposed Solution:** Add `scope_toggle`, `filter_applied`, and `cycle_changed` events, include metadata (scope, previousScope, timestamp), and send to analytics service.

**Expected Outcome / KPI:**
- User behavior data available
- Better product decisions
- Improved analytics
- Measurable UX improvements

**Priority:** Critical

**Effort Estimate:** S (Small)

**Dependencies:** Analytics service, event tracking

**Status:** Planned

**Linked Epics:** [OKR Trio Audit Backlog](../../audit/OKR_TRIO_AUDIT_BACKLOG.md) - Story 3

---

### UX-FR002: Remove Console.log Statements

**Title:** Remove all console.log statements and replace telemetry with analytics service

**Problem Statement:** Production code contains console.log statements causing noise, performance overhead, and security risk.

**Proposed Solution:** Remove all console.log statements (except errors), replace with analytics service calls, add ESLint rule `no-console` (allow console.error only), and remove backend debug logging.

**Expected Outcome / KPI:**
- Cleaner production code
- Better performance
- Improved security
- Proper telemetry

**Priority:** High

**Effort Estimate:** M (Medium)

**Dependencies:** Analytics service, ESLint config

**Status:** Planned

**Linked Epics:** [OKR Trio Audit Backlog](../../audit/OKR_TRIO_AUDIT_BACKLOG.md) - Story 5

---

### UX-FR003: Split Large page.tsx File

**Title:** Extract modals, handlers, and state management from page.tsx into separate files/hooks

**Problem Statement:** File is too large (1487 lines), hard to maintain and test.

**Proposed Solution:** Extract modals to `hooks/useOKRModals.ts`, extract state management to `hooks/useOKRPageState.ts`, extract handlers to `hooks/useOKRHandlers.ts`, and reduce page.tsx to <500 lines.

**Expected Outcome / KPI:**
- Better code organization
- Easier maintenance
- Improved testability
- Reduced complexity

**Priority:** High

**Effort Estimate:** M (Medium)

**Dependencies:** Refactoring, hook extraction

**Status:** Planned

**Linked Epics:** [OKR Trio Audit Backlog](../../audit/OKR_TRIO_AUDIT_BACKLOG.md) - Story 6

---

### UX-FR004: Consolidate mapObjectiveData Function

**Title:** Extract duplicate `mapObjectiveData` functions into shared utility

**Problem Statement:** Code duplication between OKRPageContainer and OKRTreeContainer.

**Proposed Solution:** Create single `mapObjectiveData` function in `utils/mapObjectiveData.ts`, use in both containers, and maintain backward compatibility.

**Expected Outcome / KPI:**
- Reduced code duplication
- Easier maintenance
- Consistent mapping logic
- Better code reuse

**Priority:** Low

**Effort Estimate:** S (Small)

**Dependencies:** Utility extraction, refactoring

**Status:** Idea

**Linked Epics:** [OKR Trio Audit Backlog](../../audit/OKR_TRIO_AUDIT_BACKLOG.md) - Story 7

---

### UX-FR005: Keyboard Navigation for List View

**Title:** Add Arrow key navigation and Enter to expand for List view rows

**Problem Statement:** Keyboard users cannot navigate list, accessibility issue.

**Proposed Solution:** Add Arrow key navigation (Up/Down), Enter key expands/collapses row, Tab focuses interactive elements, and ensure focus visible (WCAG AA contrast).

**Expected Outcome / KPI:**
- Better accessibility
- Keyboard navigation working
- WCAG AA compliance
- Improved UX for keyboard users

**Priority:** Low

**Effort Estimate:** M (Medium)

**Dependencies:** Keyboard handlers, accessibility testing

**Status:** Idea

**Linked Epics:** [OKR Trio Audit Backlog](../../audit/OKR_TRIO_AUDIT_BACKLOG.md) - Story 9

---

### UX-FR006: Performance Monitoring

**Title:** Track scroll FPS, render time, and API response times

**Problem Statement:** Cannot measure performance without telemetry.

**Proposed Solution:** Track scroll FPS during virtualised list scroll (target: 60 FPS), track render time for OKR list (target: <150ms for 20 items), track API response times (target: <200ms), and send to analytics service.

**Expected Outcome / KPI:**
- Performance data available
- Better optimization decisions
- Measurable performance improvements
- Improved user experience

**Priority:** Low

**Effort Estimate:** M (Medium)

**Dependencies:** Performance monitoring, analytics service

**Status:** Idea

**Linked Epics:** [OKR Trio Audit Backlog](../../audit/OKR_TRIO_AUDIT_BACKLOG.md) - Story 10

---

## Summary Table

### By Priority

| Priority | Count |
|----------|-------|
| Critical | 4 |
| High | 8 |
| Medium | 22 |
| Low | 13 |

### By Product Area

| Area | Count |
|------|-------|
| OKR Core | 18 |
| RBAC & Security | 8 |
| Analytics & Reporting | 5 |
| Integrations | 4 |
| Performance & Scalability | 6 |
| UX & Polish | 6 |

### By Effort Estimate

| Effort | Count |
|--------|-------|
| S (Small) | 15 |
| M (Medium) | 20 |
| L (Large) | 7 |
| XL (Extra Large) | 5 |

### By Status

| Status | Count |
|--------|-------|
| Idea | 40 |
| Planned | 7 |

---

## Notes

- All feature requests are based on explicit evidence from audit documents, TODO comments, or planning documents
- Priority levels: Critical (blocks core functionality), High (important UX/security), Medium (valuable improvements), Low (nice-to-have)
- Effort estimates: S (1-2 days), M (3-5 days), L (1-2 weeks), XL (2+ weeks)
- Status: Idea (proposed), Planned (scheduled), In-Progress (active), Released (complete)
- Linked Epics reference audit documents or planning documents where applicable

---

**End of Feature Requests Document**


