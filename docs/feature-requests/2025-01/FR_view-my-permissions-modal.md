---
title: "View my permissions" modal (read-only)

id: FR-007

status: Parked

area: OKR

author: PD/PM/TL Trio

created: 2025-11-05

updated: 2025-11-05

labels: [okr, governance, rbac, self-service]

---

## Problem

Users can't self-serve why actions are blocked. When users see blocked actions (edit, delete, etc.), they have no way to understand why without contacting support or using the RBAC Inspector (which requires admin enablement).

**Concrete examples:**
- User sees disabled "Edit" button → no explanation why
- Support tickets: "Why can't I edit this OKR?"
- Users don't understand their role limitations

## Desired outcomes (measurable)

- Modal shows effective actions per scope
- Read-only interface (no permission changes)
- Surfaces existing `/rbac/assignments/effective` endpoint data
- Optional enable via user flag (similar to RBAC Inspector)

## Users & roles

- Persona(s): Contributor, Manager, Tenant Admin/Owner, Superuser
- RBAC implications: Modal shows user's effective permissions; read-only; SUPERUSER shows read-only banner

## Scope

- In scope:
  - Create "View My Permissions" modal component
  - Display effective permissions per scope (tenant, workspace, team)
  - Show available actions for each scope
  - Optional enable via user feature flag
  - Link from "Why?" tooltips or user settings

- Out of scope:
  - Changes to RBAC system itself
  - Permission editing (read-only only)
  - Changes to backend RBAC endpoints

## UX notes

- Modal title: "My Permissions"
- Content: Table/list showing scope → available actions
- SUPERUSER banner: "Platform administrator (read-only)"
- British English copy: "My Permissions", "Available Actions", "Scope"
- Accessibility: Modal accessible via keyboard, screen reader support

## Technical notes

- Frontend touchpoints:
  - `apps/web/src/components/rbac/ViewPermissionsModal.tsx` (new component)
  - `apps/web/src/app/dashboard/settings/user/page.tsx` (settings link)
  - `apps/web/src/components/okr/WhyCantIInspector.tsx` (optional link)

- Backend touchpoints / endpoints:
  - `GET /rbac/assignments/effective` (existing endpoint)

- Data/visibility constraints:
  - Feature flag: `viewPermissions` (user-level flag)
  - RBAC data filtered by current user context
  - No sensitive data exposed (role names only)

## Acceptance criteria (Gherkin)

- Given a user, opening modal shows actions + scopes
- Given SUPERUSER, opening modal shows read-only banner
- Given feature flag disabled, when modal link clicked, then modal doesn't open
- Given feature flag enabled, when modal opens, then effective permissions displayed correctly

## Telemetry

- Events:
  - `permissions_modal_opened` { user_id, role, timestamp }
  - `permissions_modal_closed` { user_id, duration_ms }

- Success signals:
  - Modal usage rate (how many users view permissions)
  - Support ticket reduction (fewer "why can't I" questions)
  - User satisfaction (feedback on clarity)

## Quality & non-functional

- Performance: Modal load < 200ms
- Error handling: Graceful degradation if endpoint fails
- Logging: No console statements
- i18n: British English copy
- a11y: WCAG 2.1 AA compliance; keyboard navigation; screen reader support
- No-console rules: ESLint passes

## Test plan (high level)

- Unit:
  - Modal component rendering
  - Permission data formatting
  - Feature flag logic

- Component:
  - Modal opens/closes correctly
  - Permission data displays correctly
  - SUPERUSER banner shows

- Integration/E2E:
  - Feature flag enable/disable
  - Endpoint integration
  - Cross-role testing

## Dependencies & risks

- Dependencies:
  - Existing `/rbac/assignments/effective` endpoint
  - Feature flag system (user-level flags)
  - Modal component library

- Risks:
  - Permission data leaks → Mitigation: Filter by user context, sanitise output
  - Performance impact → Mitigation: Lazy load modal, cache permission data
  - User confusion → Mitigation: Clear copy, examples

## Rollout & rollback

- Behind feature flag: `viewPermissions` (user-level)
- Gradual rollout: Opt-in via user settings
- Rollback: Disable feature flag
- Clean revert: No database changes; pure frontend change

