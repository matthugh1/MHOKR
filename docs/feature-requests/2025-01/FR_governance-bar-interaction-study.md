---
title: Governance Bar interaction study (discovery)

id: FR-009

status: Parked

area: OKR

author: PD/PM/TL Trio

created: 2025-11-05

updated: 2025-11-05

labels: [okr, research, discovery, telemetry, governance]

---

## Problem

Decide whether to ship interactive bar broadly. Need data-driven decision on whether to make Governance Status Bar interactive (clickable badges) based on observed user behaviour.

**Concrete examples:**
- Users hover over badges expecting interaction
- Click attempts on non-interactive elements
- Need empirical evidence before implementing FR-001

## Desired outcomes (measurable)

- Instrument hover/click attempts
- Small intercept survey for managers
- Data-driven decision on interactivity
- Telemetry events captured for analysis

## Users & roles

- Persona(s): Manager, Tenant Admin/Owner (primary focus)
- RBAC implications: Track interaction attempts by role

## Scope

- In scope:
  - Add hover telemetry to Governance Status Bar
  - Add click attempt telemetry (even when non-interactive)
  - Small user survey (3-5 managers)
  - Analysis of telemetry data

- Out of scope:
  - Making bar interactive (separate story: FR-001)
  - Changes to bar functionality
  - Large-scale user research

## UX notes

- No visual changes (telemetry only)
- Survey: Brief intercept survey (2-3 questions)
- British English: Survey copy, telemetry labels
- Accessibility: Telemetry doesn't affect accessibility

## Technical notes

- Frontend touchpoints:
  - `apps/web/src/app/dashboard/okrs/components/GovernanceStatusBar.tsx`
  - `apps/web/src/lib/analytics.ts` (telemetry helper)

- Backend touchpoints / endpoints:
  - None (frontend telemetry only)

- Data/visibility constraints:
  - Telemetry includes role and scope
  - No PII in telemetry

## Acceptance criteria (Gherkin)

- Given user hovers over governance badge, when hover detected, then `governance_bar_hovered` event fires
- Given user clicks governance badge, when click detected, then `governance_bar_click_attempted` event fires
- Given telemetry events fire, when payload includes role & scope, then data suitable for analysis
- Given survey deployed, when 3+ managers respond, then feedback collected

## Telemetry

- Events:
  - `governance_bar_hovered` { badge, scope, cycle_id, role, timestamp }
  - `governance_bar_click_attempted` { badge, scope, cycle_id, role, timestamp }

- Success signals:
  - >20% click attempts → Consider making interactive (FR-001)
  - High hover rate → Consider adding tooltips
  - Low interaction → Keep non-interactive

## Quality & non-functional

- Performance: Telemetry overhead < 1ms
- Error handling: Telemetry failures don't break bar
- Logging: No console statements
- i18n: British English (survey copy)
- a11y: No accessibility impact
- No-console rules: ESLint passes

## Test plan (high level)

- Unit:
  - Telemetry event firing
  - Payload structure

- Component:
  - Hover detection
  - Click detection
  - Event payload validation

- Integration/E2E:
  - Telemetry visible in console listener
  - Survey deployment
  - Data collection verification

## Dependencies & risks

- Dependencies:
  - Telemetry infrastructure
  - Survey tool (optional; can use in-app modal)

- Risks:
  - Low participation → Mitigation: Small targeted survey, incentives
  - Telemetry spam → Mitigation: Throttle events, debounce hover
  - Privacy concerns → Mitigation: No PII, role only

## Rollout & rollback

- No feature flag required (telemetry only)
- Rollback: Remove telemetry calls
- Clean revert: No database changes; pure frontend change



