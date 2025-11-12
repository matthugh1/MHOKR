# RBAC Hardening Fixes

**Status:** Backlog  
**Priority:** Based on audit findings  
**Created:** 2025-01-27

---

## Overview

This document tracks actionable fixes identified by the RBAC audit and hardening process. Each issue includes file references, suggested fixes, and recommended owner.

---

## CRITICAL Issues

### C1: Missing @RequireAction on Mutation Endpoints

**Severity:** CRITICAL  
**Description:** Mutation endpoints (POST, PATCH, PUT, DELETE) without `@RequireAction` decorator.

**Affected Endpoints:**
- See `docs/audit/RBAC_GUARD_CONSISTENCY_REPORT.md` for full list

**Suggested Fix:**
1. Add `@RequireAction('action_name')` decorator to mutation methods
2. Ensure action matches the operation (e.g., `create_okr`, `edit_okr`, `delete_okr`)

**Owner:** Backend Team  
**Estimate:** 2-4 hours

---

### C2: Missing RBACGuard on Mutation Endpoints

**Severity:** CRITICAL  
**Description:** Mutation endpoints without `RBACGuard` in `@UseGuards(...)`.

**Affected Endpoints:**
- See `docs/audit/RBAC_GUARD_CONSISTENCY_REPORT.md` for full list

**Suggested Fix:**
1. Add `RBACGuard` to `@UseGuards(JwtAuthGuard, RBACGuard)` at class or method level
2. Ensure `JwtAuthGuard` runs before `RBACGuard`

**Owner:** Backend Team  
**Estimate:** 1-2 hours

---

### C3: Missing Tenant Guard Assertions

**Severity:** CRITICAL  
**Description:** Service methods performing mutations without tenant guard checks.

**Affected Methods:**
- See `docs/audit/RBAC_ENFORCEMENT_MAP.md` for full list

**Suggested Fix:**
1. Add `OkrTenantGuard.assertSameTenant(userOrganizationId, resourceOrganizationId)` before mutations
2. Add `OkrTenantGuard.assertCanMutateTenant(userOrganizationId)` for superuser read-only enforcement

**Owner:** Backend Team  
**Estimate:** 4-6 hours

---

## HIGH Issues

### H1: Missing Audit Log Calls

**Severity:** HIGH  
**Description:** Mutation endpoints without audit log calls after successful operations.

**Affected Endpoints:**
- See `docs/audit/RBAC_ENFORCEMENT_MAP.md` for full list

**Suggested Fix:**
1. Add `AuditLogService.record()` call after successful mutations
2. Include action, actor, target, and metadata

**Example:**
```typescript
await this.auditLogService.record({
  action: 'CREATE_OKR',
  actorUserId: userId,
  targetId: okr.id,
  targetType: AuditTargetType.OKR,
  organizationId: userOrganizationId,
});
```

**Owner:** Backend Team  
**Estimate:** 6-8 hours

---

### H2: Duplicate Enforcement Checks

**Severity:** MEDIUM  
**Description:** Same permission check enforced at multiple layers (controller, service, guard).

**Affected Areas:**
- See `docs/audit/RBAC_GUARD_CONSISTENCY_REPORT.md` for details

**Suggested Fix:**
1. Review and consolidate permission checks
2. Prefer guard-level checks over service-level checks where possible
3. Keep service-level checks only for complex business logic

**Owner:** Backend Team  
**Estimate:** 4-6 hours

---

## MEDIUM Issues

### M1: Inconsistent Error Messages

**Severity:** MEDIUM  
**Description:** RBAC deny errors have inconsistent message formats.

**Affected Areas:**
- `services/core-api/src/modules/rbac/rbac.guard.ts`

**Suggested Fix:**
1. Standardise error message format
2. Include action, role, and resource context in all deny messages

**Owner:** Backend Team  
**Estimate:** 2-3 hours

---

### M2: Missing Visibility Checks in Reporting Endpoints

**Severity:** MEDIUM  
**Description:** Reporting/analytics endpoints may not enforce visibility rules consistently.

**Affected Areas:**
- `services/core-api/src/modules/okr/okr-reporting.controller.ts`
- `services/core-api/src/modules/okr/okr-insights.controller.ts`

**Suggested Fix:**
1. Ensure `OkrVisibilityService.canViewOKR()` is called for all OKR reads
2. Filter results by visibility rules in service layer

**Owner:** Backend Team  
**Estimate:** 4-6 hours

---

## Implementation Priority

1. **Immediate:** C1, C2, C3 (CRITICAL issues)
2. **Short-term:** H1 (HIGH issues)
3. **Medium-term:** H2, M1, M2 (MEDIUM issues)

---

## Notes

- All fixes should be tested with existing test suite
- ESLint rule (`local-rbac/no-unguarded-mutation`) will catch C1 and C2 automatically
- CI check (`scripts/rbac/ci-enforcement-check.ts`) will fail on CRITICAL/HIGH issues

---

## References

- `docs/audit/RBAC_ENFORCEMENT_MAP.md` - Full endpoint mapping
- `docs/audit/RBAC_GUARD_CONSISTENCY_REPORT.md` - Detailed findings
- `docs/audit/RBAC_SPEC_DRIFT.md` - Spec vs code differences
- `docs/audit/RBAC_GUARDRAILS.md` - Guardrails documentation

