# RBAC Guardrails

**Date:** 2025-01-27  
**Purpose:** Lightweight guardrails to prevent RBAC bypasses and gaps

---

## Overview

This document describes the guardrails added to prevent RBAC enforcement gaps, tenant isolation violations, and visibility rule bypasses. These are **non-breaking changes** that add linting, CI checks, and telemetry without modifying application behaviour.

---

## 1. AuthorisationService (Single Decision Centre)

**Location:** `services/core-api/src/policy/authorisation.service.ts`  
**Module:** `services/core-api/src/policy/policy.module.ts`

### Purpose

Centralises all permission decisions in a single service. RBACGuard delegates to AuthorisationService for all authorisation checks.

### How It Works

AuthorisationService combines:
- **RBAC role checks** (via `rbac.ts`)
- **Tenant boundary checks** (for mutations, via `tenant-boundary.ts`)
- **Publish/cycle lock checks** (for OKR mutations, via `OkrGovernanceService`)
- **Visibility checks** (for reads, via `visibilityPolicy.ts`)

### Configuration

Control via environment variable:

```bash
# Default: enabled
RBAC_AUTHZ_CENTRE=on

# Disable (fallback to legacy path)
RBAC_AUTHZ_CENTRE=off
```

### Integration

RBACGuard automatically uses AuthorisationService when `RBAC_AUTHZ_CENTRE=on` (default).

---

## 2. ESLint Rule: No Unguarded Mutations

**Location:** `scripts/rbac/eslint-no-unguarded-mutation.js`  
**Configuration:** `services/core-api/.eslintrc.custom-rules.js`

### Purpose

Ensures all controller mutation methods (POST, PATCH, PUT, DELETE) have:
- `@RequireAction(...)` decorator
- `RBACGuard` in `@UseGuards(...)`

### How It Works

The rule scans controller methods and flags:
- Mutation HTTP methods without `@RequireAction`
- Mutation methods without `RBACGuard` at class or method level

### Usage

```bash
# Run linting
cd services/core-api
npm run lint

# Or from root
npm run lint
```

### Configuration

The rule is enabled by default in `services/core-api/.eslintrc.custom-rules.js`:

```javascript
rules: {
  'local-rbac/no-unguarded-mutation': 'error',
}
```

To disable (not recommended):

```javascript
rules: {
  'local-rbac/no-unguarded-mutation': 'off',
}
```

### Testing the Rule

Create a test file with an unguarded mutation:

```typescript
@Post()
async createWithoutGuard(@Body() data: any) {
  // This should fail linting
}
```

Expected error:
```
Missing @RequireAction decorator
Missing RBACGuard
```

---

## 3. CI Enforcement Check

**Location:** `scripts/rbac/ci-enforcement-check.ts`

### Purpose

Runs RBAC audit scan and fails CI if CRITICAL or HIGH issues are found.

### Usage

```bash
# Run manually
ts-node scripts/rbac/ci-enforcement-check.ts

# In CI pipeline
npm run rbac:audit:ci
```

### Configuration

Control strictness via environment variable:

```bash
# Default: strict (fail on CRITICAL/HIGH)
RBAC_AUDIT_STRICT=true ts-node scripts/rbac/ci-enforcement-check.ts

# Non-strict (warn only)
RBAC_AUDIT_STRICT=false ts-node scripts/rbac/ci-enforcement-check.ts
```

### Exit Codes

- `0` - No CRITICAL/HIGH issues (or strict mode disabled)
- `1` - CRITICAL or HIGH issues found (strict mode)

### Integration

Add to CI pipeline (e.g., `.github/workflows/ci.yml`):

```yaml
- name: RBAC Audit
  run: ts-node scripts/rbac/ci-enforcement-check.ts
  env:
    RBAC_AUDIT_STRICT: true
```

---

## 4. RBAC Deny Telemetry

**Location:** `services/core-api/src/modules/rbac/rbac.telemetry.ts`  
**Integration:** `services/core-api/src/modules/rbac/rbac.guard.ts`

### Purpose

Records deny events for monitoring and debugging without modifying application behaviour.

### How It Works

When `RBACGuard` denies access, it calls `recordDeny()` with:
- Action attempted
- User role
- Route
- Reason code (from AuthorisationService)
- User ID and tenant ID (for debugging)

### Configuration

Control telemetry via environment variable:

```bash
# Default: enabled (for development)
RBAC_TELEMETRY=on

# Disable telemetry
RBAC_TELEMETRY=off
```

### Logging

Telemetry logs to NestJS logger with `WARN` level:

```
[RBAC Deny] {
  action: 'edit_okr',
  role: 'TEAM_CONTRIBUTOR',
  route: '/objectives/123',
  reasonCode: 'PUBLISH_LOCK',
  userId: 'user-123',
  tenantId: 'org-1',
  timestamp: '2025-01-27T10:00:00Z'
}
```

### Future Integration

The telemetry hook is designed to integrate with external logging services (DataDog, CloudWatch, etc.):

```typescript
// In rbac.telemetry.ts
private async sendToExternalService(event: DenyEvent): Promise<void> {
  // Send to DataDog, CloudWatch, etc.
}
```

### No Behaviour Changes

- Telemetry is **read-only** (no database writes)
- No-op if disabled
- Does not affect authorization logic
- Only logs after deny decision is made

---

## 5. Tenant Boundary Helper

**Location:** `services/core-api/src/policy/tenant-boundary.ts`

### Purpose

Centralised tenant isolation checks for mutations. Used by AuthorisationService ONLY.

### How It Works

Checks:
- Superuser read-only (superuser cannot mutate)
- User has organisation
- Resource has organisation
- Same tenant (user org matches resource org)

---

## Summary

| Component | Purpose | Impact | Configurable |
|-----------|---------|--------|--------------|
| AuthorisationService | Single decision centre | All routes | `RBAC_AUTHZ_CENTRE` |
| ESLint Rule | Prevent unguarded mutations | Development-time | Yes |
| CI Check | Fail on CRITICAL/HIGH gaps | CI/CD | `RBAC_AUDIT_STRICT` |
| Telemetry | Monitor deny events | Runtime logging | `RBAC_TELEMETRY` |
| Tenant Boundary | Centralised tenant checks | Mutations only | N/A |

---

## Next Steps

1. ✅ AuthorisationService created
2. ✅ ESLint rule created
3. ✅ CI check script created
4. ✅ Telemetry hook added
5. ⏭️ Wire CI check into GitHub Actions/GitLab CI
6. ⏭️ Configure external logging service integration (optional)

---

## Notes

- All guardrails are **optional** and can be disabled via environment variables
- No application behaviour changes (except telemetry logging)
- Telemetry is **no-op** if disabled
- ESLint rule requires custom plugin setup (see `.eslintrc.custom-rules.js`)
- AuthorisationService is the **source of truth** for all permission decisions
- Rollback available via `RBAC_AUTHZ_CENTRE=off` (see `RBAC_ROLLBACK_NOTES.md`)


**Location:** `scripts/rbac/eslint-no-unguarded-mutation.js`  
**Configuration:** `services/core-api/.eslintrc.custom-rules.js`

### Purpose

Ensures all controller mutation methods (POST, PATCH, PUT, DELETE) have:
- `@RequireAction(...)` decorator
- `RBACGuard` in `@UseGuards(...)`

### How It Works

The rule scans controller methods and flags:
- Mutation HTTP methods without `@RequireAction`
- Mutation methods without `RBACGuard` at class or method level

### Usage

```bash
# Run linting
cd services/core-api
npm run lint

# Or from root
npm run lint
```

### Configuration

The rule is enabled by default in `services/core-api/.eslintrc.custom-rules.js`:

```javascript
rules: {
  'local-rbac/no-unguarded-mutation': 'error',
}
```

To disable (not recommended):

```javascript
rules: {
  'local-rbac/no-unguarded-mutation': 'off',
}
```

### Testing the Rule

Create a test file with an unguarded mutation:

```typescript
@Post()
async createWithoutGuard(@Body() data: any) {
  // This should fail linting
}
```

Expected error:
```
Missing @RequireAction decorator
Missing RBACGuard
```

---

## 2. CI Enforcement Check

**Location:** `scripts/rbac/ci-enforcement-check.ts`

### Purpose

Runs RBAC audit scan and fails CI if CRITICAL or HIGH issues are found.

### Usage

```bash
# Run manually
ts-node scripts/rbac/ci-enforcement-check.ts

# In CI pipeline
npm run rbac:audit:ci
```

### Configuration

Control strictness via environment variable:

```bash
# Default: strict (fail on CRITICAL/HIGH)
RBAC_AUDIT_STRICT=true ts-node scripts/rbac/ci-enforcement-check.ts

# Non-strict (warn only)
RBAC_AUDIT_STRICT=false ts-node scripts/rbac/ci-enforcement-check.ts
```

### Exit Codes

- `0` - No CRITICAL/HIGH issues (or strict mode disabled)
- `1` - CRITICAL or HIGH issues found (strict mode)

### Integration

Add to CI pipeline (e.g., `.github/workflows/ci.yml`):

```yaml
- name: RBAC Audit
  run: ts-node scripts/rbac/ci-enforcement-check.ts
  env:
    RBAC_AUDIT_STRICT: true
```

---

## 3. RBAC Deny Telemetry

**Location:** `services/core-api/src/modules/rbac/rbac.telemetry.ts`  
**Integration:** `services/core-api/src/modules/rbac/rbac.guard.ts`

### Purpose

Records deny events for monitoring and debugging without modifying application behaviour.

### How It Works

When `RBACGuard` denies access, it calls `recordDeny()` with:
- Action attempted
- User role
- Route
- Reason code
- User ID and tenant ID (for debugging)

### Configuration

Control telemetry via environment variable:

```bash
# Default: enabled (for development)
RBAC_TELEMETRY=on

# Disable telemetry
RBAC_TELEMETRY=off
```

### Logging

Telemetry logs to NestJS logger with `WARN` level:

```
[RBAC Deny] {
  action: 'edit_okr',
  role: 'TEAM_CONTRIBUTOR',
  route: '/objectives/123',
  reasonCode: 'PERMISSION_DENIED',
  userId: 'user-123',
  tenantId: 'org-1',
  timestamp: '2025-01-27T10:00:00Z'
}
```

### Future Integration

The telemetry hook is designed to integrate with external logging services (DataDog, CloudWatch, etc.):

```typescript
// In rbac.telemetry.ts
private async sendToExternalService(event: DenyEvent): Promise<void> {
  // Send to DataDog, CloudWatch, etc.
}
```

### No Behaviour Changes

- Telemetry is **read-only** (no database writes)
- No-op if disabled
- Does not affect authorization logic
- Only logs after deny decision is made

---

## 4. Test Seeds

**Location:** `scripts/rbac/__tests__/`

### Purpose

Minimal test fixtures for RBAC trace scripts (if needed).

### Usage

Test fixtures can be created using existing seed users:
- `founder@puzzelcx.local` - TENANT_OWNER
- `admin1@puzzelcx.local` - TENANT_ADMIN
- `workspace-lead-sales-1@puzzelcx.local` - WORKSPACE_LEAD
- `team-lead-enterprise-sales@puzzelcx.local` - TEAM_LEAD
- `member-enterprise-sales-1@puzzelcx.local` - TEAM_CONTRIBUTOR
- `platform@puzzelcx.local` - SUPERUSER

See `docs/audit/SEED_LOGIN_CREDENTIALS.md` for full list.

---

## Summary

| Component | Purpose | Impact | Configurable |
|-----------|---------|--------|--------------|
| ESLint Rule | Prevent unguarded mutations | Development-time | Yes |
| CI Check | Fail on CRITICAL/HIGH gaps | CI/CD | `RBAC_AUDIT_STRICT` |
| Telemetry | Monitor deny events | Runtime logging | `RBAC_TELEMETRY` |

---

## Next Steps

1. ✅ ESLint rule created
2. ✅ CI check script created
3. ✅ Telemetry hook added
4. ⏭️ Wire CI check into GitHub Actions/GitLab CI
5. ⏭️ Configure external logging service integration (optional)

---

## Notes

- All guardrails are **optional** and can be disabled via environment variables
- No application behaviour changes (except telemetry logging)
- Telemetry is **no-op** if disabled
- ESLint rule requires custom plugin setup (see `.eslintrc.custom-rules.js`)

