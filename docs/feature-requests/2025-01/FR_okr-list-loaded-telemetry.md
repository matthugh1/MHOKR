---
title: OKR list loaded telemetry

id: FR-005

status: Parked

area: OKR

author: PD/PM/TL Trio

created: 2025-11-05

updated: 2025-11-05

labels: [okr, telemetry, performance, analytics]

---

## Problem

No load baseline (duration, count, role). Currently missing telemetry for OKR list loading, making it impossible to measure performance, understand user behaviour, or identify performance regressions.

**Concrete examples:**
- Cannot measure page load performance
- Cannot correlate slow loads with user complaints
- Cannot track usage patterns by role/scope

## Desired outcomes (measurable)

- Event `okr_list_loaded` fires once per mount
- Event includes duration_ms, count, scope, cycle_id, role
- Telemetry visible in console listener during validation
- Performance baseline established for future comparisons

## Users & roles

- Persona(s): All users (telemetry affects all)
- RBAC implications: Role included in telemetry for analysis

## Scope

- In scope:
  - Fire `okr_list_loaded` event on OKR list mount
  - Include performance metrics (duration_ms)
  - Include context (count, scope, cycle_id, role)
  - Pass linting (no console.log violations)

- Out of scope:
  - Changes to load performance itself
  - Additional telemetry events beyond this one
  - Changes to OKR list rendering

## UX notes

- No user-facing changes (pure telemetry)
- British English: N/A (internal only)

## Technical notes

- Frontend touchpoints:
  - `apps/web/src/app/dashboard/okrs/page.tsx` (main page)
  - `apps/web/src/app/dashboard/okrs/OKRPageContainer.tsx` (list container)
  - `apps/web/src/lib/analytics.ts` (telemetry helper)

- Backend touchpoints / endpoints:
  - None (frontend telemetry only)

- Data/visibility constraints:
  - Role detection via `usePermissions()` hook
  - Scope from `selectedScope` state
  - Cycle ID from `selectedCycleId` state

## Acceptance criteria (Gherkin)

- Given the OKR page loads, when the list renders, then `okr_list_loaded` event fires once
- Given telemetry listener is active, when event fires, then payload includes duration_ms, count, scope, cycle_id, role
- Given ESLint runs, then no console.log violations are reported
- Given validation runs, then telemetry visible in console listener

## Telemetry

- Events:
  - `okr_list_loaded` { duration_ms, count, scope, cycle_id, role, timestamp }

- Success signals:
  - Event fires consistently (100% of loads)
  - Performance baseline established (median duration_ms tracked)
  - Role distribution visible (who uses which scopes)

## Quality & non-functional

- Performance: Telemetry overhead < 1ms
- Error handling: Telemetry failures don't break page load
- Logging: No console.log; use track() helper only
- i18n: N/A (internal only)
- a11y: N/A (telemetry only)
- No-console rules: ESLint passes with no console.log violations

## Test plan (high level)

- Unit:
  - Telemetry helper function
  - Event payload structure

- Component:
  - Event fires on mount
  - Payload includes all required fields
  - Event fires only once per mount

- Integration/E2E:
  - Telemetry visible in console listener
  - Performance measurement accuracy
  - Role detection correctness

## Dependencies & risks

- Dependencies:
  - Existing telemetry infrastructure (`track()` helper)
  - `usePermissions()` hook for role detection

- Risks:
  - Performance impact → Mitigation: Minimal overhead, async fire
  - Telemetry spam → Mitigation: Fire once per mount only
  - Privacy concerns → Mitigation: No PII in telemetry; role only

## Rollout & rollback

- No feature flag required (low-risk telemetry)
- Rollback: Remove telemetry call
- Clean revert: No database changes; pure frontend change

