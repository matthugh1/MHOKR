---
title: Unify governance and filter bars (context-aware interactivity)

id: FR-001

status: Parked

area: OKR

author: PD/PM/TL Trio

created: 2025-11-05

updated: 2025-11-05

labels: [okr, governance, usability, telemetry, rbac]

---

## Problem

Two layers (summary bar + filters) feel redundant; users expect clickable badges. The Governance Status Bar is non-interactive but positioned prominently, leading to confusion when users attempt to click on metrics. Visual separation between summary and filter controls creates unclear mental models about what can be interacted with.

**Concrete examples:**
- Users hover over "Published: 12" badge expecting to filter to published OKRs
- Support tickets about "why can't I click the status bar?"
- Redundant data fetches for cycle/scope context in both components

## Desired outcomes (measurable)

- One consolidated control surface reducing visual clutter
- No duplication; clear summary vs filter semantics
- Zero RBAC regressions
- Reduced support tickets about filter interactions

## Users & roles

- Persona(s): Contributor, Manager, Tenant Admin/Owner, Superuser
- RBAC implications: Role-aware interactivity; summary-only for read-only users; interactive badges for users with edit permissions

## Scope

- In scope:
  - Explore "summary-only by default; interactive for roles with edit permission"
  - Keep URL/state sync with existing scope & cycle
  - Merge GovernanceStatusBar and OKRFilterBar into unified component
  - Add click handlers to summary metrics (when permitted by RBAC)
  - Retain hover hint when non-interactive

- Out of scope:
  - Changes to backend endpoints (reuse existing `/okr/insights/cycle-summary`)
  - New filter types beyond current scope/cycle/status
  - Changes to OKR list rendering logic

## UX notes

- Single component in place of current two; retains hover hint when non-interactive
- Left side: Summary metrics (clickable badges for admins/owners)
- Right side: Filter controls (search, status, cycle selector)
- British English copy: "Published", "Draft", "At Risk", "Off Track"
- Accessibility: Keyboard navigation, focus management, aria-labels

## Technical notes

- Frontend touchpoints:
  - `apps/web/src/app/dashboard/okrs/components/GovernanceStatusBar.tsx` (merge)
  - `apps/web/src/app/dashboard/okrs/components/OKRFilterBar.tsx` (merge)
  - `apps/web/src/app/dashboard/okrs/page.tsx` (update imports)

- Backend touchpoints / endpoints:
  - Reuse existing `/okr/insights/cycle-summary?scope={scope}&cycleId={cycleId}`
  - No new endpoints required

- Data/visibility constraints:
  - RBAC checks via `usePermissions()` and `useTenantPermissions()`
  - Scope-aware filtering (my/team-workspace/tenant)
  - Cycle context from `selectedCycleId` state

## Acceptance criteria (Gherkin)

- Given a Tenant Admin on /dashboard/okrs, when clicking "Published" in the unified bar, then the list filters to published and URL reflects filter
- Given a Contributor without edit rights, the bar remains non-interactive and shows the summary hint
- Given a user changes scope via unified bar, when the summary updates, then telemetry fires with correct scope metadata
- Given a Manager clicks "At Risk" badge, when the filter applies, then the list shows only at-risk OKRs and badge highlights as active

## Telemetry

- Events:
  - `governance_bar_clicked` { badge, scope, cycle_id, role } (only when interactive)
  - `governance_bar_hovered` { badge, scope, cycle_id, role }
  - `governance_filter_applied` { badge, scope, cycle_id, role }

- Success signals:
  - Click-through rate on summary badges > 20% indicates interactivity adds value
  - Hover-to-click conversion rate shows intent vs. confusion
  - Filter usage increases after unification

## Quality & non-functional

- Performance: No degradation in load times; optimise data fetching (consider single request)
- Error handling: Graceful degradation if summary data fails to load
- Logging: Console.error only for errors (no console.log)
- i18n: British English copy throughout
- a11y: WCAG 2.1 AA compliance; keyboard navigation; screen reader support
- No-console rules: ESLint passes with no console.log violations

## Test plan (high level)

- Unit:
  - RBAC permission checks for interactive vs. non-interactive modes
  - State management for unified filter/summary state

- Component:
  - Render tests for unified component
  - Click handlers fire correctly based on role
  - Accessibility tests (keyboard nav, screen reader)

- Integration/E2E:
  - User flows: Admin clicks badge → filter applies → URL updates
  - User flows: Contributor sees non-interactive bar → no errors
  - Cross-browser testing

## Dependencies & risks

- Dependencies:
  - Existing telemetry infrastructure
  - User behaviour analytics (PostHog/Mixpanel)
  - Feature flag system for gradual rollout

- Risks:
  - User confusion during transition → Mitigation: Feature flag, gradual rollout
  - Performance impact → Mitigation: Optimise data fetching, lazy load
  - Accessibility regression → Mitigation: Maintain WCAG compliance, test with screen readers

## Rollout & rollback

- Behind feature flag: `unifiedGovernanceBar` (boolean)
- Gradual rollout: 10% → 50% → 100%
- Rollback: Disable feature flag; revert to separate components
- Clean revert: No database migrations; pure frontend change

