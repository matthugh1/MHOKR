---
title: Tenant isolation integration test (no cross-tenant OKR leakage)

id: FR-008

status: Parked

area: OKR

author: PD/PM/TL Trio

created: 2025-11-05

updated: 2025-11-05

labels: [okr, security, testing, tenant-isolation]

---

## Problem

Need automated guard for regressions. Tenant isolation is critical for security but currently lacks comprehensive automated testing, risking cross-tenant data leakage if regressions occur.

**Concrete examples:**
- Manual testing only; no automated validation
- Risk of cross-tenant OKR visibility if code changes
- No guardrails for accidental data exposure

## Desired outcomes (measurable)

- E2E test ensures tenants are isolated in list & analytics endpoints
- Test fails if any cross-tenant leakage detected
- Test runs in CI/CD pipeline
- Test coverage: List endpoints, analytics endpoints, detail endpoints

## Users & roles

- Persona(s): All users (security affects all)
- RBAC implications: Tests verify RBAC respects tenant boundaries

## Scope

- In scope:
  - E2E test for OKR list endpoint (`GET /objectives`)
  - E2E test for analytics endpoints (`GET /okr/insights/*`)
  - E2E test for detail endpoints (`GET /objectives/:id`)
  - Test multiple tenant scenarios
  - Test SUPERUSER read-only access

- Out of scope:
  - Unit tests (covered separately)
  - Backend changes (test existing behaviour)
  - Changes to tenant isolation logic itself

## UX notes

- No user-facing changes (automated testing only)
- British English: N/A (internal only)

## Technical notes

- Frontend touchpoints:
  - None (backend E2E tests)

- Backend touchpoints / endpoints:
  - `GET /objectives` (list endpoint)
  - `GET /okr/insights/cycle-summary` (analytics endpoint)
  - `GET /okr/insights/attention` (analytics endpoint)
  - `GET /objectives/:id` (detail endpoint)

- Data/visibility constraints:
  - Test data: Create OKRs in multiple tenants
  - Test users: Create users in different tenants
  - Verify: User from Tenant A cannot see Tenant B OKRs

## Acceptance criteria (Gherkin)

- Given cross-tenant user, when requesting OKR list, then only own tenant OKRs returned
- Given cross-tenant user, when requesting analytics, then only own tenant data returned
- Given cross-tenant user, when requesting OKR detail, then 403 Forbidden if not own tenant
- Given SUPERUSER, when requesting OKR list, then all tenants visible (read-only)

## Telemetry

- Events:
  - None (automated testing only)

- Success signals:
  - Test passes consistently (100% pass rate)
  - No cross-tenant leakage detected
  - Test runs in CI/CD pipeline

## Quality & non-functional

- Performance: Test execution < 30 seconds
- Error handling: Test failures clearly indicate leakage
- Logging: Test output includes tenant IDs and leakage details
- i18n: N/A (internal only)
- a11y: N/A (automated testing)
- No-console rules: Test output uses test framework logging

## Test plan (high level)

- Unit:
  - Test data setup (multiple tenants)
  - Test user creation (different tenants)

- Component:
  - N/A (backend E2E tests)

- Integration/E2E:
  - List endpoint isolation
  - Analytics endpoint isolation
  - Detail endpoint isolation
  - SUPERUSER read-only access

## Dependencies & risks

- Dependencies:
  - E2E testing framework (Jest, Playwright, etc.)
  - Test database with multiple tenants
  - Test user creation mechanism

- Risks:
  - Test flakiness → Mitigation: Isolated test data, deterministic tests
  - Performance impact → Mitigation: Parallel test execution, efficient test data
  - False positives → Mitigation: Clear test assertions, detailed logging

## Rollout & rollback

- No feature flag required (automated testing)
- Rollback: Remove test file
- Clean revert: No database changes; test-only change

