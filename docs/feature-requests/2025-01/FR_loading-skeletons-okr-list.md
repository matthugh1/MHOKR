---
title: Loading skeletons for OKR list & inline insights

id: FR-006

status: Parked

area: OKR

author: PD/PM/TL Trio

created: 2025-11-05

updated: 2025-11-05

labels: [okr, ux, performance, loading-states]

---

## Problem

Content flash / perceived lag on slower networks. When OKR list loads, there's no loading state, causing content flash and making the page feel slow. Inline insights also lack loading states.

**Concrete examples:**
- Blank screen → sudden content flash
- No feedback during data fetch
- Perceived lag on slower connections

## Desired outcomes (measurable)

- Skeletons render within 50ms while data fetches
- No layout shift (CLS) when skeletons → content transition
- Improved perceived performance

## Users & roles

- Persona(s): All users (loading states affect all)
- RBAC implications: None (visual only)

## Scope

- In scope:
  - Skeleton components for OKR list rows
  - Skeleton components for inline insights
  - Show skeletons during data fetch
  - Hide skeletons when data resolves

- Out of scope:
  - Changes to data fetching performance
  - Changes to skeleton design (use existing components)
  - Changes to other loading states

## UX notes

- Skeleton design: Use existing `OkrRowSkeleton` component
- Stable heights: No layout shift on skeleton → content transition
- British English: N/A (visual only)
- Accessibility: Skeletons announced to screen readers as "Loading"

## Technical notes

- Frontend touchpoints:
  - `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx` (list container)
  - `apps/web/src/components/okr/ObjectiveRow.tsx` (inline insights)
  - `apps/web/src/components/ui/skeletons.tsx` (existing skeleton components)

- Backend touchpoints / endpoints:
  - None (pure UI change)

- Data/visibility constraints:
  - Show skeletons when `loading` state is true
  - Hide skeletons when data resolves

## Acceptance criteria (Gherkin)

- Given OKR list is loading, when skeletons render, then they appear within 50ms
- Given skeletons are visible, when data resolves, then skeletons disappear and content appears
- Given skeleton → content transition, when layout shift measured, then CLS < 0.05
- Given skeletons render, then test-id "okr-list-skeleton" is present

## Telemetry

- Events:
  - `okr_list_skeleton_shown` { duration_ms, count }
  - `okr_list_loaded` (existing; enhanced with skeleton duration)

- Success signals:
  - Perceived performance improves (user feedback)
  - CLS score improves (measured via Lighthouse)
  - Skeleton duration tracked (target < 500ms)

## Quality & non-functional

- Performance: Skeleton render < 50ms; no performance degradation
- Error handling: Skeletons hide on error (show error state)
- Logging: No console statements
- i18n: British English (screen reader announcements)
- a11y: Skeletons announced to screen readers; keyboard navigation preserved
- No-console rules: ESLint passes

## Test plan (high level)

- Unit:
  - Skeleton component rendering
  - Loading state management

- Component:
  - Skeleton → content transition
  - Layout shift measurements
  - Screen reader announcements

- Integration/E2E:
  - CLS measurement via Lighthouse
  - Slow network simulation
  - Cross-browser testing

## Dependencies & risks

- Dependencies:
  - Existing skeleton components (`OkrRowSkeleton`, `InlineInsightSkeleton`)
  - Loading state management

- Risks:
  - Layout shift regression → Mitigation: Stable skeleton heights, CLS monitoring
  - Performance impact → Mitigation: Lightweight skeletons, lazy rendering

## Rollout & rollback

- No feature flag required (low-risk UX improvement)
- Rollback: Remove skeleton rendering logic
- Clean revert: No database changes; pure frontend change



