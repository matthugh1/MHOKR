# Security Review

**Date**: 2025-01-20  
**Auditor**: Automated Audit  
**Status**: Complete  
**Last Updated**: 2025-01-20 (Phase 1 Implementation)

---

## Remediation Status

### ✅ Resolved Findings

- **Finding #1 (Default Secret Fallback)**: ✅ **RESOLVED**
  - Removed all `'default-secret'` fallbacks from production code
  - Added startup validation to ensure `JWT_SECRET` is set and not equal to `'default-secret'`
  - Created shared environment validation utilities
  - Files updated:
    - `services/api-gateway/src/middleware/auth.middleware.ts`
    - `services/core-api/src/modules/auth/strategies/jwt.strategy.ts`
    - `services/core-api/src/modules/auth/auth.module.ts`
    - `services/core-api/src/modules/auth/utils/jwks-verifier.ts`
    - `services/core-api/src/modules/superuser/superuser.module.ts`
    - `services/core-api/src/main.ts` (startup validation)
    - `services/api-gateway/src/index.ts` (startup validation)

- **Finding #2 (Sensitive Data in Logs)**: ✅ **RESOLVED**
  - Removed email addresses from log messages
  - Removed user IDs from log messages where not necessary
  - Removed JWT secret length logging
  - Files updated:
    - `services/core-api/src/modules/auth/auth.service.ts`
    - `services/core-api/src/modules/auth/strategies/jwt.strategy.ts`

- **Finding #3 (Missing Authorization Guards)**: ✅ **VERIFIED**
  - Migration controller already has `@UseGuards(JwtAuthGuard, RBACGuard)` and `@RequireAction('impersonate_user')`
  - Superuser controller already has `@UseGuards(JwtAuthGuard, RBACGuard)` and `@RequireAction('impersonate_user')`
  - No changes needed - guards are properly implemented

- **Finding #4 (Hardcoded Passwords)**: ✅ **RESOLVED**
  - Replaced hardcoded passwords with environment variables
  - Added validation to ensure passwords are provided via environment variables
  - Files updated:
    - `services/core-api/prisma/factories/users.ts`
    - `services/core-api/scripts/reset-user-password.ts`
    - `services/core-api/prisma/bootstrapOrg.ts`
    - `services/core-api/src/modules/okr/okr-import.service.ts`

### 🔄 Additional Improvements

- **Startup Validation**: ✅ **IMPLEMENTED**
  - Added environment variable validation at application startup
  - Created shared validation utilities for both Core API and API Gateway
  - Application fails fast with clear error messages if required variables are missing

- **CI Security Gates**: ✅ **IMPLEMENTED**
  - Added `npm audit` to lint script with `--audit-level=high`
  - CI will now fail on high/critical vulnerabilities

### ⚠️ Open Findings

- **Finding #5 (Raw SQL Queries)**: 🟡 **REVIEWED** - Queries use Prisma's parameterised syntax (safe)
- **Finding #6 (Missing CSRF Protection)**: 🟡 **ASSESSED** - Using JWT tokens in headers (lower CSRF risk)
- **Finding #7 (API Gateway Default Secret)**: ✅ **RESOLVED** - Same as Finding #1
- **Finding #8 (Missing Input Sanitisation)**: 🟡 **VERIFIED** - React escapes by default, no `dangerouslySetInnerHTML` found

---

## Overview

This security review examines authentication, authorisation, tenant isolation, data protection, and common security vulnerabilities in the OKR Framework codebase. The application implements multi-layer tenant isolation and RBAC, but several security improvements are recommended.

---

## Strengths

### ✅ Multi-Layer Tenant Isolation

The application implements **defense-in-depth** for tenant isolation:

1. **Application Layer**: Service methods validate tenant context
2. **Prisma Middleware**: Automatic query filtering by tenant
3. **PostgreSQL RLS**: Database-level Row-Level Security policies

**Files**:
- `services/core-api/src/common/prisma/tenant-isolation.middleware.ts`
- `services/core-api/src/common/prisma/prisma.service.ts`
- `services/core-api/src/common/tenant/tenant-mutation.guard.ts`

### ✅ Comprehensive RBAC System

- **RBACGuard**: Enforces role-based access control on endpoints
- **Action-based permissions**: Fine-grained actions (`view_okr`, `edit_okr`, `delete_okr`, etc.)
- **Resource context**: Permission checks consider resource ownership and scope
- **Superuser handling**: Proper isolation of superuser capabilities

**Files**:
- `services/core-api/src/modules/rbac/rbac.guard.ts`
- `services/core-api/src/modules/rbac/rbac.ts`

### ✅ JWT Authentication

- JWT tokens used for authentication
- Token verification in API Gateway and Core API
- Password hashing via bcrypt

### ✅ Input Validation

- **class-validator** used for DTO validation
- Global validation pipe in NestJS
- Frontend validation for user inputs

### ✅ Rate Limiting

- Rate limiting implemented on sensitive endpoints
- Configurable via environment variables

---

## Findings

### 🔴 High Priority

#### 1. Default Secret Fallback

**Issue**: JWT secret falls back to `'default-secret'` if environment variable is not set.

**Files**:
- `services/api-gateway/src/middleware/auth.middleware.ts:16`
- `services/core-api/src/modules/auth/strategies/jwt.strategy.ts:32`
- `services/core-api/src/modules/auth/auth.module.ts:20`
- `services/core-api/src/modules/auth/utils/jwks-verifier.ts:43`

**Code**:
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
```

**Risk**: If `JWT_SECRET` is not set, the application uses a predictable secret, making tokens vulnerable to forgery.

**Recommendation**:
- **Fail fast**: Throw an error if `JWT_SECRET` is not set in production
- **Validation**: Add startup validation to ensure required secrets are present
- **Example fix**:
  ```typescript
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET || JWT_SECRET === 'default-secret') {
    throw new Error('JWT_SECRET must be set in environment variables');
  }
  ```

#### 2. Sensitive Data in Logs

**Issue**: Console logging includes sensitive information (emails, user IDs, JWT secret length).

**Files**:
- `services/core-api/src/modules/auth/auth.service.ts:141,146,154,172`
- `services/core-api/src/modules/auth/strategies/jwt.strategy.ts:36,57,67,74,77,80,94`

**Examples**:
```typescript
console.warn(`[AUTH] Login failed: User not found for email: ${normalizedEmail}`);
console.log('[JWT STRATEGY] validate called with payload:', { sub: payload?.sub, email: payload?.email });
```

**Risk**: Sensitive data in logs may be exposed if logs are leaked or accessed by unauthorised parties.

**Recommendation**:
- **Remove sensitive data**: Log user IDs instead of emails
- **Use structured logging**: Use a logging library (e.g., Winston, Pino) with log levels
- **Sanitise logs**: Remove or redact sensitive fields before logging
- **Example fix**:
  ```typescript
  this.logger.warn(`[AUTH] Login failed: User not found for email: ${hashEmail(normalizedEmail)}`);
  ```

#### 3. Missing Authorization Guards

**Issue**: Some endpoints lack proper authorization guards.

**Files**:
- `services/core-api/src/modules/rbac/migration.controller.ts:17` - Missing RBACGuard
- `services/core-api/src/modules/superuser/superuser.controller.ts:19` - Missing RBACGuard (service-layer checks present)

**Risk**: Endpoints may be accessible without proper authorization checks.

**Recommendation**:
- **Add RBACGuard** to migration controller with superuser-only check
- **Add RBACGuard** to superuser controller for consistency (even though service-layer checks exist)
- **Example fix**:
  ```typescript
  @UseGuards(JwtAuthGuard, RBACGuard)
  @RequireAction('impersonate_user') // or superuser check
  ```

#### 4. Hardcoded Passwords in Scripts

**Issue**: Test/seed scripts contain hardcoded passwords.

**Files**:
- `services/core-api/prisma/factories/users.ts:22` - `DEFAULT_PASSWORD = 'changeme'`
- `services/core-api/scripts/reset-user-password.ts:8` - `const password = 'test123'`
- `services/core-api/prisma/bootstrapOrg.ts:249` - `const defaultPassword = 'test123'`
- `services/core-api/src/modules/okr/okr-import.service.ts:1013` - `const defaultPassword = 'changeme'`

**Risk**: Hardcoded passwords in source code may be committed to version control.

**Recommendation**:
- **Use environment variables**: Read passwords from environment or prompt for input
- **Document**: Clearly mark these as development/test-only
- **Example fix**:
  ```typescript
  const defaultPassword = process.env.DEFAULT_PASSWORD || prompt('Enter default password:');
  ```

---

### 🟡 Medium Priority

#### 5. Raw SQL Queries

**Issue**: Some raw SQL queries use Prisma's `$queryRaw`, which is parameterised but should be reviewed.

**Files**:
- `services/core-api/src/modules/rbac/migration.service.ts:74,80,117,123,161,168,238,259,281,342,347,352`
- `services/core-api/src/common/prisma/prisma.service.ts:52,55` - RLS session variables

**Code**:
```typescript
orgMembers = await this.prisma.$queryRaw`
  SELECT id, "userId", "tenantId", role::text
  FROM organization_members
`;
```

**Risk**: While Prisma's `$queryRaw` uses parameterised queries (safe), raw SQL should be carefully reviewed for injection risks.

**Recommendation**:
- **Review all raw SQL**: Ensure all queries use Prisma's parameterised syntax
- **Avoid string concatenation**: Never build SQL queries with string concatenation
- **Current status**: ✅ Queries appear to use Prisma's template literals (safe)

#### 6. Missing CSRF Protection

**Issue**: No explicit CSRF protection for state-changing operations.

**Risk**: Cross-Site Request Forgery attacks may be possible if cookies are used for authentication.

**Recommendation**:
- **Assess need**: If using JWT tokens in Authorization header (not cookies), CSRF risk is lower
- **Add CSRF tokens**: If cookies are used, implement CSRF token validation
- **Current status**: ✅ Using JWT tokens in headers (lower CSRF risk)

#### 7. API Gateway Default Secret

**Issue**: API Gateway uses same default secret fallback as Core API.

**File**: `services/api-gateway/src/middleware/auth.middleware.ts:16`

**Risk**: Same as finding #1.

**Recommendation**: Same as finding #1.

#### 8. Missing Input Sanitisation for HTML

**Issue**: No explicit HTML sanitisation found (though React escapes by default).

**Risk**: If user-generated content is rendered as HTML, XSS vulnerabilities may exist.

**Recommendation**:
- **Verify React escaping**: React escapes content by default, but verify custom HTML rendering
- **Use sanitisation library**: If rendering HTML, use a library like DOMPurify
- **Current status**: ✅ No `dangerouslySetInnerHTML` found in frontend code

---

### 🟢 Low Priority

#### 9. Inconsistent Guard Usage

**Issue**: Some endpoints use service-layer checks instead of guard-level checks.

**Files**:
- `services/core-api/src/modules/superuser/superuser.controller.ts` - Service-layer superuser checks

**Risk**: Lower consistency, but functional.

**Recommendation**: Add RBACGuard for consistency (already recommended in finding #3).

#### 10. Logging of JWT Secret Length

**Issue**: JWT secret length is logged (though not the secret itself).

**File**: `services/core-api/src/modules/auth/strategies/jwt.strategy.ts:36`

**Code**:
```typescript
console.log('[JWT STRATEGY] Constructor called, JWT_SECRET length:', (configService.get<string>('JWT_SECRET') || 'default-secret').length);
```

**Risk**: Low - length alone is not sensitive, but unnecessary logging.

**Recommendation**: Remove or use debug-level logging.

#### 11. Test Credentials in Code

**Issue**: Test credentials may be hardcoded in test files.

**Files**: Various test files (needs verification)

**Risk**: Low - test files typically not deployed.

**Recommendation**: Verify test files don't contain production credentials.

---

## Recommended Security Hardening Checklist

### Immediate Actions (P0)

- [ ] **Remove default secret fallback**: Fail fast if `JWT_SECRET` is not set
- [ ] **Sanitise logs**: Remove emails and sensitive data from logs
- [ ] **Add authorization guards**: Add RBACGuard to migration and superuser controllers
- [ ] **Remove hardcoded passwords**: Use environment variables or prompts

### Short-Term Improvements (P1)

- [ ] **Implement structured logging**: Use a logging library with log levels
- [ ] **Add startup validation**: Validate all required environment variables on startup
- [ ] **Review raw SQL queries**: Audit all `$queryRaw` usage for injection risks
- [ ] **Add security headers**: Verify Helmet is properly configured (already present in API Gateway)

### Medium-Term Enhancements (P2)

- [ ] **Implement CSRF protection**: If cookies are used, add CSRF tokens
- [ ] **Add rate limiting**: Verify rate limiting is applied to all sensitive endpoints (already present)
- [ ] **Security testing**: Add automated security tests (OWASP ZAP, etc.)
- [ ] **Dependency scanning**: Add automated dependency vulnerability scanning (see Step 7)

### Long-Term Improvements (P3)

- [ ] **Security audit logging**: Implement comprehensive audit logging for security events
- [ ] **Penetration testing**: Conduct periodic penetration testing
- [ ] **Security training**: Ensure developers are aware of security best practices
- [ ] **Incident response plan**: Document security incident response procedures

---

## Authentication Flow

### Current Implementation

1. **User Login**: `POST /auth/login` → Returns JWT token
2. **Token Storage**: Frontend stores token in `localStorage`
3. **Token Usage**: Token sent in `Authorization: Bearer <token>` header
4. **Token Verification**: 
   - API Gateway verifies token (`auth.middleware.ts`)
   - Core API verifies token (`jwt.strategy.ts`)
5. **User Context**: Token payload includes `sub` (user ID), `email`, `name`
6. **Tenant Context**: Tenant ID extracted from user's role assignments

### Security Considerations

- ✅ **JWT tokens**: Stateless authentication
- ✅ **Password hashing**: bcrypt with salt
- ⚠️ **Token storage**: localStorage (vulnerable to XSS, but common practice)
- ⚠️ **No token refresh**: No refresh token mechanism found

**Recommendation**: Consider implementing refresh tokens for better security.

---

## Authorization Flow

### Current Implementation

1. **JWT Guard**: Verifies token and sets `req.user`
2. **Tenant Context Guard**: Sets `req.tenantId` from user's tenant
3. **RBAC Guard**: Checks if user has required action permission
4. **Service Layer**: Additional tenant isolation checks

### Security Considerations

- ✅ **Multi-layer checks**: Guards + service layer
- ✅ **Action-based permissions**: Fine-grained control
- ✅ **Resource context**: Permissions consider resource ownership
- ⚠️ **Superuser handling**: Superuser checks are consistent but could be more explicit

---

## Tenant Isolation

### Current Implementation

1. **Application Layer**: Service methods validate tenant context
2. **Prisma Middleware**: Automatically filters queries by tenant
3. **PostgreSQL RLS**: Database-level policies enforce tenant boundaries

### Security Considerations

- ✅ **Defense-in-depth**: Multiple layers of protection
- ✅ **RLS policies**: Database-level enforcement
- ✅ **Middleware filtering**: Automatic query filtering
- ⚠️ **Write operations**: Write operations skip middleware filtering (explicit validation required)

**Recommendation**: Ensure all write operations explicitly validate tenant context (appears to be the case).

---

## Data Protection

### Current Implementation

- ✅ **Password hashing**: bcrypt
- ✅ **Input validation**: class-validator
- ✅ **SQL injection protection**: Prisma ORM (parameterised queries)
- ⚠️ **Logging**: Sensitive data in logs (see finding #2)

---

## Summary

### Overall Security Posture

**Rating**: **Good** with room for improvement

The application implements strong security foundations:
- Multi-layer tenant isolation
- Comprehensive RBAC system
- JWT authentication
- Input validation

However, several issues need attention:
- Default secret fallback (critical)
- Sensitive data in logs (high)
- Missing authorization guards (high)
- Hardcoded passwords (high)

### Priority Actions

1. **Remove default secret fallback** (P0)
2. **Sanitise logs** (P0)
3. **Add missing authorization guards** (P0)
4. **Remove hardcoded passwords** (P0)
5. **Implement structured logging** (P1)
6. **Add startup validation** (P1)

---

**End of Security Review**

