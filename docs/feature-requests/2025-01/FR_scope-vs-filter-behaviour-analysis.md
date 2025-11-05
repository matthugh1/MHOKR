---
title: Scope vs filter behaviour analysis (discovery)

id: FR-010

status: Parked

area: OKR

author: PD/PM/TL Trio

created: 2025-11-05

updated: 2025-11-05

labels: [okr, research, discovery, telemetry, analytics]

---

## Problem

Need to compare scope changes vs filter usage to inform default behaviours. Currently unclear how users navigate between scopes vs. using filters, making it difficult to optimise default behaviours.

**Concrete examples:**
- Users switch scopes frequently vs. using filters
- Unclear which pattern is more common
- Need data to inform UX decisions

## Desired outcomes (measurable)

- Compare scope changes vs filter usage
- Weekly dashboard (internal) summarising ratios
- Document interpretation notes
- Inform default behaviours based on data

## Users & roles

- Persona(s): All users (behaviour affects all)
- RBAC implications: Track usage by role to understand role-specific patterns

## Scope

- In scope:
  - Analyse existing telemetry (`scope_toggle`, `filter_applied`)
  - Create weekly dashboard/report
  - Document findings and interpretations
  - Recommend default behaviours

- Out of scope:
  - Changes to scope/filter functionality
  - New telemetry events (use existing)
  - User-facing changes

## UX notes

- No user-facing changes (analysis only)
- Dashboard: Internal tool for product team
- British English: Report copy, documentation
- Accessibility: N/A (internal tool)

## Technical notes

- Frontend touchpoints:
  - None (analysis of existing telemetry)

- Backend touchpoints / endpoints:
  - Telemetry analytics endpoint (if available)
  - Or manual analysis of telemetry data

- Data/visibility constraints:
  - Existing telemetry events: `scope_toggle`, `filter_applied`
  - Compare frequencies, patterns, user segments

## Acceptance criteria (Gherkin)

- Given telemetry data collected, when analysed, then scope vs filter ratios calculated
- Given weekly dashboard runs, when data aggregated, then ratios summarised
- Given analysis complete, when findings documented, then interpretation notes included
- Given recommendations made, when default behaviours updated, then based on data

## Telemetry

- Events:
  - Analysis of existing events:
    - `scope_toggle` { scope, prev_scope, cycle_id, ts }
    - `filter_applied` { scope, q, status, cycle_id, ts }

- Success signals:
  - Clear patterns identified (scope-first vs filter-first)
  - Recommendations actionable
  - Default behaviours optimised

## Quality & non-functional

- Performance: Analysis runs efficiently (< 5 minutes)
- Error handling: Analysis handles missing data gracefully
- Logging: Analysis logs to console (for debugging)
- i18n: British English (report copy)
- a11y: N/A (internal tool)
- No-console rules: Analysis scripts can use console.log

## Test plan (high level)

- Unit:
  - Analysis logic
  - Ratio calculations
  - Dashboard generation

- Component:
  - N/A (analysis only)

- Integration/E2E:
  - End-to-end analysis pipeline
  - Dashboard accuracy
  - Report generation

## Dependencies & risks

- Dependencies:
  - Existing telemetry infrastructure
  - Analytics tool (PostHog/Mixpanel/internal dashboard)
  - Data analysis tools

- Risks:
  - Insufficient data → Mitigation: Collect for 4-6 weeks before analysis
  - Analysis bias → Mitigation: Clear methodology, peer review
  - Performance impact → Mitigation: Efficient queries, caching

## Rollout & rollback

- No feature flag required (analysis only)
- Rollback: N/A (analysis doesn't affect users)
- Clean revert: N/A (no code changes)

