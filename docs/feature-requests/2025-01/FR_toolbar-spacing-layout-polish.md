---
title: Toolbar spacing & layout polish (OKR header)

id: FR-002

status: Parked

area: OKR

author: PD/PM/TL Trio

created: 2025-11-05

updated: 2025-11-05

labels: [okr, ux, layout, accessibility]

---

## Problem

Header density; "New Objective" & "Needs Attention" placement affects hierarchy. Current toolbar has inconsistent spacing and alignment, making it difficult to scan and prioritise actions. Multiple action buttons compete for attention without clear visual hierarchy.

**Concrete examples:**
- "Attention" button and "Add" dropdown feel cramped
- Inconsistent spacing between scope toggle and action buttons
- Layout shifts slightly on first paint causing visual instability

## Desired outcomes (measurable)

- Improved scan-ability with clear visual hierarchy
- Consistent spacing tokens applied throughout toolbar
- No layout shift (CLS) on first paint > 0.05
- Accessible keyboard navigation flow

## Users & roles

- Persona(s): Contributor, Manager, Tenant Admin/Owner, Superuser
- RBAC implications: Hidden elements (e.g., SUPERUSER destructive CTAs) must not cause layout shifts

## Scope

- In scope:
  - Reflow actions to a single, right-aligned cluster
  - Apply consistent spacing tokens (4px, 8px, 12px, 16px)
  - Preserve RBAC hiding logic
  - Maintain responsive behaviour

- Out of scope:
  - Changes to action functionality
  - New toolbar features
  - Changes to scope toggle component

## UX notes

- Right-aligned action cluster: Attention → Manage Cycles → Add dropdown
- Consistent gap spacing between elements (use Tailwind gap utilities)
- Visual hierarchy: Primary actions (Add) more prominent than secondary (Attention)
- British English copy: "Attention", "Manage Cycles", "Add"
- Accessibility: Logical tab order, visible focus indicators

## Technical notes

- Frontend touchpoints:
  - `apps/web/src/app/dashboard/okrs/components/OKRToolbar.tsx`
  - `apps/web/src/app/dashboard/okrs/page.tsx` (layout container)

- Backend touchpoints / endpoints:
  - None (pure UI change)

- Data/visibility constraints:
  - RBAC checks determine button visibility
  - No layout shift when buttons hidden/shown

## Acceptance criteria (Gherkin)

- Given SUPERUSER, destructive CTAs are hidden; header remains aligned
- Given a Tenant Admin, when the toolbar renders, then spacing is consistent (measured via layout test)
- Given a user with no attention items, when the toolbar renders, then no layout shift occurs
- Given keyboard navigation, when tabbing through toolbar, then focus order is logical (Attention → Cycles → Add)

## Telemetry

- Events:
  - None (pure UI polish; no new interactions)

- Success signals:
  - CLS score < 0.05 (measured via Lighthouse)
  - Visual regression tests pass
  - No accessibility violations

## Quality & non-functional

- Performance: No layout shift on first paint (CLS < 0.05)
- Error handling: N/A (static layout)
- Logging: No console statements
- i18n: British English copy
- a11y: WCAG 2.1 AA compliance; logical tab order; visible focus indicators
- No-console rules: ESLint passes

## Test plan (high level)

- Unit:
  - Spacing calculations
  - RBAC hiding logic

- Component:
  - Visual regression tests (before/after screenshots)
  - Layout shift measurements
  - Keyboard navigation tests

- Integration/E2E:
  - CLS measurement via Lighthouse
  - Cross-browser layout consistency
  - Responsive breakpoint testing

## Dependencies & risks

- Dependencies:
  - Design system spacing tokens
  - Visual regression testing framework

- Risks:
  - Layout shift regression → Mitigation: CLS monitoring, visual regression tests
  - Accessibility regression → Mitigation: Keyboard nav tests, screen reader testing

## Rollout & rollback

- No feature flag required (low-risk UI polish)
- Rollback: Revert component changes
- Clean revert: No database changes; pure frontend change



