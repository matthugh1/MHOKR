# Merge Plan

This document outlines the sequential merge strategy for bringing all refactor phases back into `main` while preserving behavior and establishing a stable baseline for demo, design partners, and first paying customers.

## Merge Order

The following branches must be merged in this exact order:

### 1. refactor/phase1-scaffolding

**What changed structurally:**
- Created scaffolding for tenant guard (`OkrTenantGuard`), governance service (`OkrGovernanceService`), reporting service (`OkrReportingService`), and reporting controller (`OkrReportingController`)
- Created frontend hook scaffolding (`useTenantPermissions`)
- Added module wiring with circular dependency handling

**Runtime behaviour changed:** No

**TODOs that MUST NOT ship into main:** None (scaffolding only)

---

### 2. refactor/phase2-tenant-guard

**What changed structurally:**
- Extracted tenant isolation logic into `OkrTenantGuard.buildOrgWhereClause()`
- Extracted write permission enforcement into `OkrTenantGuard.assertCanMutateResource()`
- Updated all service methods to use tenant guard

**Runtime behaviour changed:** No (logic preserved, only centralized)

**TODOs that MUST NOT ship into main:** None

---

### 3. refactor/phase3-governance-service

**What changed structurally:**
- Extracted publish lock and cycle lock enforcement into `OkrGovernanceService`
- Centralized lifecycle governance rules (publish lock, cycle lock, propose-change workflow hook)

**Runtime behaviour changed:** No (lock enforcement preserved, only centralized)

**TODOs that MUST NOT ship into main:** None

---

### 4. refactor/phase4-reporting-and-activity

**What changed structurally:**
- Migrated analytics/reporting methods from `ObjectiveService` and `KeyResultService` to `OkrReportingService`
- Migrated activity timeline endpoints to `ActivityController`
- Created `/reports/*` API surface

**Runtime behaviour changed:** No (endpoints preserved, only moved to dedicated controllers)

**TODOs that MUST NOT ship into main:** None

---

### 5. refactor/phase5-frontend-permissions

**What changed structurally:**
- Implemented `useTenantPermissions` hook as single source of truth for permission checks
- Centralized publish lock and cycle lock UX rules in frontend
- Updated components to use permission hook instead of inline checks

**Runtime behaviour changed:** No (permission checks preserved, only centralized)

**TODOs that MUST NOT ship into main:** None

---

### 6. refactor/phase6-wire-reporting-and-activity

**What changed structurally:**
- Updated frontend API calls to use `/reports/*` endpoints
- Updated frontend to use `/activity/*` endpoints
- Removed old endpoint implementations from objective/key-result controllers

**Runtime behaviour changed:** No (API contract preserved, only endpoint paths changed)

**TODOs that MUST NOT ship into main:** None

---

### 7. refactor/phase7-hardening

**What changed structurally:**
- Removed duplicate analytics logic from `ObjectiveService` and `KeyResultService`
- Cleaned up inline tenant isolation, publish lock, and cycle lock logic
- Added RBAC export_data check to CSV export endpoint

**Runtime behaviour changed:** No (functionality preserved, code deduplicated)

**TODOs that MUST NOT ship into main:** None

---

### 8. refactor/phase8-demo-readiness

**What changed structurally:**
- Enhanced analytics dashboard with KPI cards and sections
- Added activity drawer with timeline
- Added publish lock modal and warning system

**Runtime behaviour changed:** Yes — New UI features added (analytics enhancements, activity drawer, publish lock modal). No breaking changes to existing functionality.

**TODOs that MUST NOT ship into main:** None

---

### 9. refactor/phase9-polish

**What changed structurally:**
- Visual polish and styling improvements across UI
- Consistent card styling, spacing, and typography
- Empty state improvements

**Runtime behaviour changed:** No (visual changes only)

**TODOs that MUST NOT ship into main:** None

---

### 10. refactor/phase10-design-system

**What changed structurally:**
- Extracted object-oriented design system components (`StatCard`, `SectionHeader`, `StatusBadge`, `ActivityItemCard`, `ObjectiveCard`)
- Centralized design tokens and component patterns
- Created component documentation and Storybook stubs

**Runtime behaviour changed:** No (components refactored, visual output preserved)

**TODOs that MUST NOT ship into main:** None

---

### 11. refactor/phase11-release-readiness

**What changed structurally:**
- Added architecture documentation (`BACKEND_OVERVIEW.md`, `FRONTEND_OVERVIEW.md`, `DESIGN_SYSTEM.md`)
- Added test scaffolding and test plans
- Created `RELEASE_CHECKLIST.md`

**Runtime behaviour changed:** No (documentation and test scaffolding only)

**TODOs that MUST NOT ship into main:** None

---

## What to Regression Test Before Merge to Main

Before merging any branch to `main`, verify the following:

- [ ] **Analytics dashboard loads with real data** — KPIs display correctly, sections render, no errors
- [ ] **CSV export works and is RBAC-gated** — Export button only visible to users with `export_data` permission, download succeeds
- [ ] **OKR list renders with no data, partial data, and fully populated data** — Empty states, partial loads, and full loads all render correctly
- [ ] **Activity drawer opens and shows timeline** — Clicking history/activity icon opens drawer, timeline displays chronologically
- [ ] **Publish lock modal triggers when editing locked OKRs** — Attempting to edit published OKRs shows warning modal
- [ ] **Overdue check-ins widget renders on analytics page** — Widget displays when overdue check-ins exist, handles empty state
- [ ] **App loads with a non-admin user (permissions enforced)** — Non-admin users see correct UI based on permissions, cannot access restricted actions
- [ ] **App loads with an admin user (export visible etc.)** — Admin users see export button, full feature access

---

## Merge Checklist

For each phase merge:

- [ ] Branch compiles (`tsc --noEmit` passes)
- [ ] Linting passes (`npm run lint`)
- [ ] Regression tests pass (checklist above)
- [ ] PR description matches phase summary
- [ ] No TODO tags blocking merge (only allowed: `[phase6-polish]`, `[phase7-hardening]`, `[phase7-performance]`)
- [ ] Code review completed
- [ ] CI checks pass

---

## Post-Merge Verification

After merging to `main`:

- [ ] Run full regression test suite
- [ ] Verify build succeeds in CI
- [ ] Smoke test in staging environment
- [ ] Update release notes if applicable

