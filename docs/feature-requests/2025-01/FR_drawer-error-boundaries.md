---
title: Drawer error boundaries (creation/edit/insights)

id: FR-004

status: Parked

area: OKR

author: PD/PM/TL Trio

created: 2025-11-05

updated: 2025-11-05

labels: [okr, stability, error-handling, drawers]

---

## Problem

Unhandled runtime errors can blank drawers. When JavaScript errors occur in drawer components (OKRCreationDrawer, EditObjectiveModal, AttentionDrawer, CycleManagementDrawer), the entire drawer becomes blank and unusable, leaving users without feedback or recovery options.

**Concrete examples:**
- React error in drawer → blank white screen
- Network error during data fetch → drawer stuck in loading state
- User sees no error message or retry option

## Desired outcomes (measurable)

- Shared ErrorBoundary wraps all drawers
- Friendly error message displayed with retry option
- No app crash; drawer closes gracefully
- Telemetry error recorded for debugging

## Users & roles

- Persona(s): All users (errors affect all)
- RBAC implications: Error messages respect RBAC (don't expose sensitive data)

## Scope

- In scope:
  - Create shared ErrorBoundary component for drawers
  - Wrap OKRCreationDrawer, EditObjectiveModal, AttentionDrawer, CycleManagementDrawer
  - Display user-friendly error message
  - Provide retry/close options
  - Log errors to telemetry

- Out of scope:
  - Changes to error handling outside drawers
  - Changes to backend error responses
  - Changes to modal error handling (separate story)

## UX notes

- Error message: "Something went wrong. Please try again or close and start over."
- Retry button: Attempts to reload drawer content
- Close button: Closes drawer gracefully
- British English copy: "Something went wrong", "Try again", "Close"
- Accessibility: Error message announced to screen readers, keyboard navigation

## Technical notes

- Frontend touchpoints:
  - `apps/web/src/components/ui/ErrorBoundary.tsx` (new component)
  - `apps/web/src/app/dashboard/okrs/components/OKRCreationDrawer.tsx`
  - `apps/web/src/components/okr/EditObjectiveModal.tsx`
  - `apps/web/src/components/okr/AttentionDrawer.tsx`
  - `apps/web/src/app/dashboard/okrs/components/CycleManagementDrawer.tsx`

- Backend touchpoints / endpoints:
  - None (error handling only)

- Data/visibility constraints:
  - Error messages must not expose sensitive data (user IDs, internal errors)
  - RBAC-aware error messages (don't reveal permission details)

## Acceptance criteria (Gherkin)

- Given a forced error in OKRCreationDrawer, when the error occurs, then ErrorBoundary catches it and shows friendly message
- Given an error boundary shows, when user clicks "Try again", then drawer attempts to reload
- Given an error boundary shows, when user clicks "Close", then drawer closes gracefully
- Given an error occurs, when telemetry fires, then error event includes component name and error type

## Telemetry

- Events:
  - `drawer_error_boundary_triggered` { component, error_type, error_message_hash }
  - `drawer_error_retry_clicked` { component }
  - `drawer_error_closed` { component }

- Success signals:
  - Error boundary catch rate decreases (errors fixed proactively)
  - Retry success rate > 50% (errors are recoverable)
  - User satisfaction improves (fewer support tickets)

## Quality & non-functional

- Performance: Error boundary overhead < 1ms
- Error handling: Graceful degradation; no app crashes
- Logging: Error details logged to console.error (sanitised)
- i18n: British English copy
- a11y: Error messages announced to screen readers; keyboard navigation works
- No-console rules: Only console.error allowed (sanitised)

## Test plan (high level)

- Unit:
  - ErrorBoundary component tests
  - Error catching logic
  - Retry mechanism

- Component:
  - Force error in drawer → boundary catches
  - Retry button → reloads content
  - Close button → closes drawer

- Integration/E2E:
  - Simulate network errors
  - Simulate React errors
  - Verify telemetry fires correctly

## Dependencies & risks

- Dependencies:
  - React ErrorBoundary API
  - Telemetry infrastructure

- Risks:
  - Error boundary itself fails → Mitigation: Fallback UI, extensive testing
  - Performance impact → Mitigation: Lazy error boundary, minimal overhead
  - Error message leaks sensitive data → Mitigation: Sanitise error messages

## Rollout & rollback

- No feature flag required (stability improvement)
- Rollback: Remove ErrorBoundary wrappers
- Clean revert: No database changes; pure frontend change

