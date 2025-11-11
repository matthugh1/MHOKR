---
title: Manager "My OKRs" usage study (discovery)

id: FR-011

status: Parked

area: OKR

author: PD/PM/TL Trio

created: 2025-11-05

updated: 2025-11-05

labels: [okr, research, discovery, user-study, managers]

---

## Problem

Do managers want their personal OKRs alongside team OKRs? Currently unclear whether managers need separate "My OKRs" view or prefer unified team + personal view.

**Concrete examples:**
- Managers have both personal and team OKRs
- Current scope toggle separates these
- Unclear if separation is desired or confusing

## Desired outcomes (measurable)

- Decision recorded on manager preferences
- If "yes", subsequent PRD/change request created
- Study plan document produced
- 3 interviews conducted
- Synthesis attached to this story

## Users & roles

- Persona(s): Manager, WORKSPACE_LEAD, TEAM_LEAD (primary focus)
- RBAC implications: Understand how managers use scopes differently from contributors

## Scope

- In scope:
  - Create study plan document
  - Conduct 3 manager interviews
  - Synthesise findings
  - Document decision and recommendations
  - Create follow-up PRD if "yes"

- Out of scope:
  - Changes to scope functionality
  - Changes to OKR list rendering
  - Large-scale user research

## UX notes

- Study format: 1:1 interviews (30 minutes each)
- Questions: Focus on OKR management workflow, scope usage, personal vs team
- British English: Interview guide, synthesis document
- Accessibility: N/A (research only)

## Technical notes

- Frontend touchpoints:
  - None (user research only)

- Backend touchpoints / endpoints:
  - None (user research only)

- Data/visibility constraints:
  - Interview recordings/notes (anonymised)
  - Synthesis document (no PII)

## Acceptance criteria (Gherkin)

- Given study plan created, when reviewed, then plan includes interview questions and methodology
- Given 3 interviews conducted, when completed, then findings synthesised
- Given synthesis complete, when decision recorded, then recommendation clear (yes/no)
- Given recommendation is "yes", when PRD created, then follow-up story documented

## Telemetry

- Events:
  - None (user research only)

- Success signals:
  - Clear decision on manager preferences
  - Actionable recommendations
  - Follow-up stories created if needed

## Quality & non-functional

- Performance: N/A (research only)
- Error handling: N/A
- Logging: N/A
- i18n: British English (interview guide, synthesis)
- a11y: N/A (research only)
- No-console rules: N/A

## Test plan (high level)

- Unit:
  - Study plan quality
  - Interview guide completeness

- Component:
  - Interview execution
  - Note-taking accuracy

- Integration/E2E:
  - Synthesis quality
  - Decision clarity
  - Follow-up story creation

## Dependencies & risks

- Dependencies:
  - Access to managers for interviews
  - Research methodology
  - Analysis tools

- Risks:
  - Low participation → Mitigation: Clear value proposition, flexible scheduling
  - Bias in interviews → Mitigation: Structured questions, multiple interviewers
  - Inconclusive findings → Mitigation: Expand sample size if needed

## Rollout & rollback

- No feature flag required (research only)
- Rollback: N/A (research doesn't affect users)
- Clean revert: N/A (no code changes)



