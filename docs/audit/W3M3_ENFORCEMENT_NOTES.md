# W3.M3 Operational Safeguards & Policy Enforcement

## Policy Statement

**These smoke tests MUST pass before any deployment or release tag.**

If these tests fail, you are about to ship a security regression.

## Purpose

W3.M3 locks in the critical behaviors delivered in W1–W3 so they cannot quietly regress:

- **Visibility filtering** - Users cannot see PRIVATE objectives outside their scope
- **Superuser restrictions** - SUPERUSER cannot create check-in requests (read-only for escalations)
- **Pagination enforcement** - Page/pageSize logic is correctly enforced
- **Analytics visibility** - Analytics excludes private exec-only OKRs for non-admins

## Smoke Test Suite

Located in: `services/core-api/test/smoke/`

### Tests

1. **visibility.spec.ts** - Verifies WORKSPACE_LEAD cannot see PRIVATE objectives from other workspaces
2. **superuser_write.spec.ts** - Verifies SUPERUSER cannot create check-in requests (403 Forbidden)
3. **pagination.spec.ts** - Verifies pagination (page/pageSize) logic is enforced
4. **analytics_visibility.spec.ts** - Verifies analytics excludes private exec-only OKRs for non-admins

## Running Smoke Tests

```bash
cd services/core-api
npm run smoke:test
```

Or using yarn:

```bash
cd services/core-api
yarn smoke:test
```

## CI Integration

These smoke tests should be run as part of:

- Pre-commit hooks (optional but recommended)
- Pre-merge checks (mandatory)
- Pre-deployment validation (mandatory)

## Enforcement Components

### 1. System Status Endpoint

`GET /system/status` - Returns system health and enforcement capabilities:

```json
{
  "ok": true,
  "service": "core-api",
  "gitTag": "<string or null>",
  "buildTimestamp": "<ISO timestamp>",
  "enforcement": {
    "rbacGuard": true,
    "tenantIsolation": true,
    "visibilityFiltering": true,
    "auditLogging": true
  }
}
```

### 2. Rate Limiting

Per-user rate limiting for privileged mutations:
- **Limit**: 30 calls per 60 seconds per user
- **Applies to**:
  - Check-in request creation (`POST /okr/checkin-requests`)
  - RBAC role assignment (`POST /rbac/assignments/assign`, `DELETE /rbac/assignments/:id`)
  - Exec whitelist mutations (`POST /rbac/whitelist/:tenantId/add`, etc.)
  - OKR mutations (`POST /objectives`, `PATCH /objectives/:id`, `DELETE /objectives/:id`, etc.)
- **Response**: 429 Too Many Requests with message "Rate limit exceeded for privileged mutations."

## What This Protects

These safeguards prevent:

1. **Regression of visibility rules** - Future code cannot accidentally expose PRIVATE objectives
2. **Superuser privilege escalation** - SUPERUSER remains read-only for escalations
3. **Pagination bypass** - Users cannot bypass pagination limits
4. **Analytics data leakage** - Exec-only OKRs stay hidden from non-admins
5. **Rate limit abuse** - Automated abuse of mutation endpoints is throttled

## Maintenance

- Do not remove or disable these tests
- Do not modify test assertions without reviewing security implications
- If a test fails, treat it as a blocker for deployment
- Update tests when adding new enforcement mechanisms

## Related Documentation

- W3M3_BASELINE_SUMMARY.md - Baseline discovery findings
- W3M2_VALIDATION_PLAN.md - Previous milestone validation
- W3M1_VALIDATION_PLAN.md - UI scalability milestone validation



