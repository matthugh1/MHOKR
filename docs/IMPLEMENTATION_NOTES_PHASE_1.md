# Phase 1 Implementation Notes: Security & Safety

**Date**: 2025-01-20  
**Status**: In Progress  
**Phase**: Phase 1 - Security & Safety

---

## Overview

This document tracks the implementation of Phase 1 security fixes based on the audit findings. All changes are incremental and focused on eliminating critical security vulnerabilities.

---

## Work Items

### SEC-001: Remove Default Secret Fallback from JWT Configuration

**Priority**: P0  
**Effort**: S (Small)  
**Source**: 02_SECURITY_REVIEW – High #1

**Problem Description**:
JWT secret falls back to `'default-secret'` if the environment variable is not set, making tokens vulnerable to forgery. This is a critical security vulnerability that must be fixed immediately.

**Files Affected**:
- `services/api-gateway/src/middleware/auth.middleware.ts:16`
- `services/core-api/src/modules/auth/strategies/jwt.strategy.ts:32`
- `services/core-api/src/modules/auth/auth.module.ts:20`
- `services/core-api/src/modules/auth/utils/jwks-verifier.ts:43`

**Proposed Change Approach**:
1. Remove all `|| 'default-secret'` fallbacks
2. Add validation to throw an error if `JWT_SECRET` is not set or equals `'default-secret'`
3. Create a shared validation utility for environment variables
4. Add startup validation in main.ts to fail fast before the application starts

**Risks / Rollback Considerations**:
- **High Risk**: Application will fail to start if `JWT_SECRET` is not set
- **Mitigation**: Ensure all environments (dev, staging, production) have `JWT_SECRET` configured
- **Rollback**: Revert changes if environment variables are not properly configured
- **Testing**: Verify application fails gracefully with clear error messages

**Test Strategy**:
1. Unit tests: Verify validation throws error when `JWT_SECRET` is missing
2. Integration tests: Verify application fails to start without `JWT_SECRET`
3. Manual testing: Verify error message is clear and actionable

---

### SEC-002: Sanitise Logs to Remove Sensitive Data

**Priority**: P0  
**Effort**: M (Medium)  
**Source**: 02_SECURITY_REVIEW – High #2

**Problem Description**:
Console logging includes sensitive information such as emails, user IDs, and JWT secret length. This data may be exposed if logs are leaked or accessed by unauthorised parties.

**Files Affected**:
- `services/core-api/src/modules/auth/auth.service.ts:141,146,154,172`
- `services/core-api/src/modules/auth/strategies/jwt.strategy.ts:36,57,67,74,77,80,94`

**Proposed Change Approach**:
1. Remove email addresses from log messages (use user ID or hash instead)
2. Remove user IDs from log messages where not necessary
3. Remove JWT secret length logging
4. Replace `console.log`/`console.warn`/`console.error` with a logger that can be configured
5. For now, use a simple logger that redacts sensitive data (full structured logging is Phase 3)

**Risks / Rollback Considerations**:
- **Low Risk**: Changes are additive and improve security
- **Consideration**: May reduce debugging capability temporarily, but improves security posture
- **Rollback**: Simple revert if issues arise

**Test Strategy**:
1. Verify no email addresses appear in logs
2. Verify no user IDs appear in logs (except where necessary for debugging)
3. Verify application still functions correctly
4. Check log output to ensure sensitive data is redacted

---

### SEC-003: Add RBACGuard to Migration Controller

**Priority**: P0  
**Effort**: S (Small)  
**Source**: 02_SECURITY_REVIEW – High #3

**Problem Description**:
The migration controller may be accessible without proper authorisation checks, allowing unauthorised users to run migrations.

**Files Affected**:
- `services/core-api/src/modules/rbac/migration.controller.ts:17`

**Proposed Change Approach**:
1. Verify current guard implementation
2. Ensure `@UseGuards(JwtAuthGuard, RBACGuard)` is present
3. Ensure `@RequireAction('impersonate_user')` is present on all mutation endpoints
4. Add superuser-only check if needed

**Risks / Rollback Considerations**:
- **Medium Risk**: Adding guards may break existing functionality if tests rely on unauthenticated access
- **Mitigation**: Review existing tests and update as needed
- **Rollback**: Simple revert if issues arise

**Test Strategy**:
1. Verify endpoints require authentication
2. Verify endpoints require appropriate permissions
3. Verify superuser-only endpoints are properly protected
4. Run existing integration tests to ensure no regressions

**Status**: ✅ **Already Implemented** - Controller already has `@UseGuards(JwtAuthGuard, RBACGuard)` and `@RequireAction('impersonate_user')` on mutation endpoints.

---

### SEC-004: Add RBACGuard to Superuser Controller

**Priority**: P0  
**Effort**: S (Small)  
**Source**: 02_SECURITY_REVIEW – High #3

**Problem Description**:
The superuser controller may be accessible without proper authorisation checks, though service-layer checks exist.

**Files Affected**:
- `services/core-api/src/modules/superuser/superuser.controller.ts:19`

**Proposed Change Approach**:
1. Verify current guard implementation
2. Ensure `@UseGuards(JwtAuthGuard, RBACGuard)` is present
3. Ensure `@RequireAction('impersonate_user')` is present on mutation endpoints
4. Add superuser-only checks at guard level for consistency

**Risks / Rollback Considerations**:
- **Low Risk**: Controller already has guards, but may need refinement
- **Mitigation**: Ensure consistency between guard-level and service-level checks
- **Rollback**: Simple revert if issues arise

**Test Strategy**:
1. Verify endpoints require authentication
2. Verify endpoints require appropriate permissions
3. Verify superuser-only endpoints are properly protected
4. Run existing integration tests to ensure no regressions

**Status**: ✅ **Already Implemented** - Controller already has `@UseGuards(JwtAuthGuard, RBACGuard)` and `@RequireAction('impersonate_user')` on mutation endpoints. Service-layer checks provide additional defence-in-depth.

---

### SEC-005: Remove Hardcoded Passwords from Scripts and Factories

**Priority**: P0  
**Effort**: S (Small)  
**Source**: 02_SECURITY_REVIEW – High #4

**Problem Description**:
Test/seed scripts contain hardcoded passwords that may be committed to version control, creating a security risk.

**Files Affected**:
- `services/core-api/prisma/factories/users.ts:22` - `DEFAULT_PASSWORD = 'changeme'`
- `services/core-api/scripts/reset-user-password.ts:8` - `const password = 'test123'`
- `services/core-api/prisma/bootstrapOrg.ts:249` - `const defaultPassword = 'test123'`
- `services/core-api/src/modules/okr/okr-import.service.ts:1013` - `const defaultPassword = 'changeme'`

**Proposed Change Approach**:
1. Replace hardcoded passwords with environment variables
2. Use `process.env.DEFAULT_PASSWORD` with fallback to prompt or error
3. For seed scripts, use environment variable with clear documentation
4. For import service, use environment variable or prompt
5. Document that these are development/test-only passwords

**Risks / Rollback Considerations**:
- **Low Risk**: Changes improve security without breaking functionality
- **Consideration**: May require environment variable setup in development
- **Mitigation**: Provide clear documentation and `.env.example` file
- **Rollback**: Simple revert if issues arise

**Test Strategy**:
1. Verify scripts work with environment variables
2. Verify scripts fail gracefully if password is not provided
3. Verify seed scripts still function correctly
4. Check that no hardcoded passwords remain in codebase

---

### SEC-006: Add Startup Validation for Required Environment Variables

**Priority**: P0  
**Effort**: S (Small)  
**Source**: 02_SECURITY_REVIEW – Recommended Actions

**Problem Description**:
The application should validate that all required environment variables are set at startup, failing fast if they are missing.

**Files Affected**:
- `services/core-api/src/main.ts` (new validation)
- `services/api-gateway/src/index.ts` (new validation)
- Create shared validation utility

**Proposed Change Approach**:
1. Create a shared environment validation utility
2. Define required environment variables for each service
3. Add startup validation in `main.ts`/`index.ts` files
4. Fail fast with clear error messages if required variables are missing
5. Validate that `JWT_SECRET` is set and not equal to `'default-secret'`

**Risks / Rollback Considerations**:
- **Medium Risk**: Application will fail to start if environment variables are not set
- **Mitigation**: Ensure all environments have required variables configured
- **Rollback**: Simple revert if issues arise
- **Testing**: Verify application fails gracefully with clear error messages

**Test Strategy**:
1. Verify application fails to start without required variables
2. Verify error messages are clear and actionable
3. Verify application starts successfully with all required variables
4. Test in different environments (dev, staging, production)

---

### SEC-007: Add CI Gate for Security Checks

**Priority**: P0  
**Effort**: M (Medium)  
**Source**: 00_SUMMARY_AND_ACTION_PLAN – P0 #5

**Problem Description**:
CI/CD pipeline should include security checks such as secret scanning and dependency auditing to prevent security issues from being merged.

**Files Affected**:
- `package.json` (add npm audit to lint script)
- CI/CD configuration (GitHub Actions, etc.)

**Proposed Change Approach**:
1. Add `npm audit` to the lint script
2. Configure `npm audit` to fail on high/critical vulnerabilities
3. Add secret scanning (if available)
4. Document CI security gates

**Risks / Rollback Considerations**:
- **Low Risk**: Adding checks improves security posture
- **Consideration**: May cause CI to fail if vulnerabilities exist
- **Mitigation**: Fix existing vulnerabilities first, then enable checks
- **Rollback**: Simple revert if issues arise

**Test Strategy**:
1. Verify `npm audit` runs in CI
2. Verify CI fails on high/critical vulnerabilities
3. Verify CI passes when no vulnerabilities exist
4. Test locally to ensure checks work correctly

---

## Implementation Order

1. **SEC-001** (Remove default secret fallback) - Critical, must be done first
2. **SEC-006** (Startup validation) - Depends on SEC-001
3. **SEC-002** (Sanitise logs) - Can be done in parallel
4. **SEC-005** (Remove hardcoded passwords) - Can be done in parallel
5. **SEC-003** and **SEC-004** (Verify guards) - Already implemented, verify only
6. **SEC-007** (CI gates) - Can be done last

---

## Deferred Items

None at this time. All P0 items are being addressed.

---

## Implementation Status

### ✅ Completed Items

- **SEC-001**: ✅ **COMPLETE** - Removed all default secret fallbacks, added startup validation
- **SEC-002**: ✅ **COMPLETE** - Sanitised logs, removed sensitive data
- **SEC-003**: ✅ **VERIFIED** - Guards already present, no changes needed
- **SEC-004**: ✅ **VERIFIED** - Guards already present, no changes needed
- **SEC-005**: ✅ **COMPLETE** - Removed hardcoded passwords, added environment variable validation
- **SEC-006**: ✅ **COMPLETE** - Added startup validation for required environment variables
- **SEC-007**: ✅ **COMPLETE** - Added `npm audit` to CI lint script

### 📝 Notes

- **Test Files**: Test files (`services/core-api/test/*.e2e.spec.ts`) still use `'default-secret'` fallback for test token generation. This is acceptable for test environments but should be reviewed in future to use test-specific secrets.

## Testing Checklist

- [x] Application fails to start without `JWT_SECRET` ✅
- [x] Application fails to start if `JWT_SECRET` equals `'default-secret'` ✅
- [x] No sensitive data in logs (emails, user IDs) ✅
- [x] All endpoints require proper authorisation ✅
- [x] No hardcoded passwords in production code ✅
- [x] CI security gates pass ✅
- [ ] All existing tests pass (pending verification)
- [ ] Manual testing confirms security improvements (pending verification)

---

**End of Implementation Notes**

