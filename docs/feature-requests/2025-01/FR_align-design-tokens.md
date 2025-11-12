---
title: Align design tokens (typography/spacing) for OKR page

id: FR-003

status: Parked

area: OKR

author: PD/PM/TL Trio

created: 2025-11-05

updated: 2025-11-05

labels: [okr, design-system, typography, spacing]

---

## Problem

Mixed sizes/spacing; visual inconsistency. OKR page uses inconsistent typography scales and spacing values, making the interface feel unpolished. Multiple components use different spacing conventions.

**Concrete examples:**
- Page title uses `text-2xl` while card titles use `text-xl`
- Inconsistent gap spacing (some use `gap-2`, others `gap-3`, `gap-4`)
- Mixed padding values (`p-4`, `p-6`, `py-6`)

## Desired outcomes (measurable)

- Standardised tokens applied consistently across OKR page
- Design system audit passes (lints/design-tokens script)
- Visual consistency improves (measured via design review)

## Users & roles

- Persona(s): All users (visual consistency affects all)
- RBAC implications: None (pure visual change)

## Scope

- In scope:
  - Apply existing design tokens only (no net-new tokens)
  - Typography scale: Use standard headings (h1-h6) and body text sizes
  - Spacing scale: Use 4px base unit (gap-1 through gap-8)
  - Padding scale: Consistent padding values

- Out of scope:
  - Creating new design tokens
  - Changes to design system itself
  - Changes to other pages beyond OKR

## UX notes

- Typography: Consistent heading hierarchy (PageHeader → Card titles → Body text)
- Spacing: 4px base unit (gap-1 = 4px, gap-2 = 8px, gap-3 = 12px, gap-4 = 16px)
- Padding: Consistent container padding (p-6 for cards, p-8 for page)
- British English copy throughout
- Accessibility: Maintain readable font sizes (minimum 14px body text)

## Technical notes

- Frontend touchpoints:
  - `apps/web/src/app/dashboard/okrs/page.tsx`
  - `apps/web/src/app/dashboard/okrs/components/*.tsx` (all OKR components)
  - `apps/web/src/components/okr/*.tsx` (OKR-specific components)

- Backend touchpoints / endpoints:
  - None (pure UI change)

- Data/visibility constraints:
  - None

## Acceptance criteria (Gherkin)

- Given the lints/design-tokens script runs, then no violations are reported
- Given components render, then typography sizes match design system tokens
- Given components render, then spacing values match design system tokens
- Given component snapshots are compared, then no unexpected changes beyond OKR page

## Telemetry

- Events:
  - None (pure visual change)

- Success signals:
  - Design system audit passes
  - Visual regression tests show consistent improvements
  - No accessibility violations

## Quality & non-functional

- Performance: No performance impact (pure CSS changes)
- Error handling: N/A
- Logging: No console statements
- i18n: British English copy
- a11y: Maintain WCAG 2.1 AA compliance; readable font sizes
- No-console rules: ESLint passes

## Test plan (high level)

- Unit:
  - Design token validation (script-based)

- Component:
  - Visual regression tests
  - Typography scale validation
  - Spacing scale validation

- Integration/E2E:
  - Design system audit passes
  - Cross-browser visual consistency
  - Accessibility audit (font sizes, contrast)

## Dependencies & risks

- Dependencies:
  - Design system token definitions
  - Linting script for design tokens

- Risks:
  - Unexpected visual changes → Mitigation: Visual regression tests, component snapshots
  - Accessibility regression → Mitigation: Font size checks, contrast validation

## Rollout & rollback

- No feature flag required (low-risk visual polish)
- Rollback: Revert component changes
- Clean revert: No database changes; pure CSS changes



