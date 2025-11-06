# Mutation Endpoints Without Tenant Context

**Generated**: 2025-01-XX  
**Purpose**: Summary of mutation endpoints (POST/PUT/PATCH/DELETE) that do NOT reference tenant context.

**Source**: `docs/audit/RBAC_ENFORCEMENT_MAP.md`

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 12 | Missing @RequireAction AND missing tenant guard |
| HIGH | 40+ | Missing tenant guard assertion in service methods |

---

## CRITICAL Endpoints (Missing @RequireAction AND Tenant Guard)

### modules/rbac/rbac-assignment.controller.ts

| Route | Method | HTTP | Issue |
|-------|--------|------|-------|
| `rbac/assignments/assign` | POST | POST | Missing @RequireAction decorator; No tenant guard assertion found in service methods |
| `rbac/assignments/:assignmentId` | DELETE | DELETE | Missing @RequireAction decorator; No tenant guard assertion found in service methods |
| `rbac/assignments/:tenantId/add` | POST | POST | Missing @RequireAction decorator; No tenant guard assertion found in service methods |
| `rbac/assignments/:tenantId/remove` | POST | POST | Missing @RequireAction decorator; No tenant guard assertion found in service methods |
| `rbac/assignments/:tenantId/set` | POST | POST | Missing @RequireAction decorator; No tenant guard assertion found in service methods |
| `rbac/assignments/:tenantId` | DELETE | DELETE | Missing @RequireAction decorator; No tenant guard assertion found in service methods |

### modules/okr/okr-overview.controller.ts

| Route | Method | HTTP | Issue |
|-------|--------|------|-------|
| `okr/create-composite` | POST | POST | Missing @RequireAction decorator; No tenant guard assertion found in service methods |

### modules/okr/okr-cycle.controller.ts

| Route | Method | HTTP | Issue |
|-------|--------|------|-------|
| `okr/cycles` | POST | POST | Missing @RequireAction decorator; No tenant guard assertion found in service methods |
| `okr/cycles/:id` | PATCH | PATCH | Missing @RequireAction decorator; No tenant guard assertion found in service methods |
| `okr/cycles/:id/status` | PATCH | PATCH | Missing @RequireAction decorator; No tenant guard assertion found in service methods |
| `okr/cycles/:id` | DELETE | DELETE | Missing @RequireAction decorator; No tenant guard assertion found in service methods |

### modules/okr/objective.controller.ts

| Route | Method | HTTP | Issue |
|-------|--------|------|-------|
| `objectives` | POST | POST | Missing @RequireAction decorator; No tenant guard assertion found in service methods |
| `objectives/:id` | PATCH | PATCH | Missing @RequireAction decorator; No tenant guard assertion found in service methods |
| `objectives/:id` | DELETE | DELETE | Missing @RequireAction decorator; No tenant guard assertion found in service methods |

### modules/okr/key-result.controller.ts

| Route | Method | HTTP | Issue |
|-------|--------|------|-------|
| `key-results` | POST | POST | Missing @RequireAction decorator; No tenant guard assertion found in service methods |
| `key-results/:id` | PATCH | PATCH | Missing @RequireAction decorator; No tenant guard assertion found in service methods |
| `key-results/:id` | DELETE | DELETE | Missing @RequireAction decorator; No tenant guard assertion found in service methods |

### modules/okr/checkin-request.controller.ts

| Route | Method | HTTP | Issue |
|-------|--------|------|-------|
| `okr/checkin-requests` | POST | POST | Missing @RequireAction decorator; No tenant guard assertion found in service methods |

### modules/auth/auth.controller.ts

| Route | Method | HTTP | Issue |
|-------|--------|------|-------|
| `auth/register` | POST | POST | Missing @RequireAction decorator; Missing RBACGuard; No tenant guard assertion found in service methods |
| `auth/login` | POST | POST | Missing @RequireAction decorator; Missing RBACGuard; No tenant guard assertion found in service methods |
| `auth/verify` | POST | POST | Missing @RequireAction decorator; Missing RBACGuard; No tenant guard assertion found in service methods |

**Note**: Auth endpoints may be intentionally excluded from tenant guards (public endpoints).

---

## HIGH Severity Endpoints (Missing Tenant Guard Assertion)

These endpoints have `@RequireAction` and `RBACGuard` but lack explicit tenant guard assertions in service methods.

### modules/user/user.controller.ts

| Route | Method | HTTP | Issue |
|-------|--------|------|-------|
| `users` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |
| `users/:id` | PATCH | PATCH | No tenant guard assertion found in service methods; No audit log call found |
| `users/:id/reset-password` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |

### modules/workspace/workspace.controller.ts

| Route | Method | HTTP | Issue |
|-------|--------|------|-------|
| `workspaces` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |
| `workspaces/:id` | PATCH | PATCH | No tenant guard assertion found in service methods; No audit log call found |
| `workspaces/:id` | DELETE | DELETE | No tenant guard assertion found in service methods; No audit log call found |
| `workspaces/:id/members` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |
| `workspaces/:id/members/:userId` | DELETE | DELETE | No tenant guard assertion found in service methods; No audit log call found |

### modules/team/team.controller.ts

| Route | Method | HTTP | Issue |
|-------|--------|------|-------|
| `teams` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |
| `teams/:id` | PATCH | PATCH | No tenant guard assertion found in service methods; No audit log call found |
| `teams/:id` | DELETE | DELETE | No tenant guard assertion found in service methods; No audit log call found |
| `teams/:id/members` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |
| `teams/:id/members/:userId` | DELETE | DELETE | No tenant guard assertion found in service methods; No audit log call found |

### modules/organization/organization.controller.ts

| Route | Method | HTTP | Issue |
|-------|--------|------|-------|
| `organizations` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |
| `organizations/:id` | PATCH | PATCH | No tenant guard assertion found in service methods; No audit log call found |
| `organizations/:id` | DELETE | DELETE | No tenant guard assertion found in service methods; No audit log call found |
| `organizations/:id/members` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |
| `organizations/:id/members/:userId` | DELETE | DELETE | No tenant guard assertion found in service methods; No audit log call found |

### modules/superuser/superuser.controller.ts

| Route | Method | HTTP | Issue |
|-------|--------|------|-------|
| `superuser/create` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |
| `superuser/promote/:userId` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |
| `superuser/revoke/:userId` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |
| `superuser/organizations` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |
| `superuser/organizations/:organizationId/users/:userId` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |
| `superuser/organizations/:organizationId/users/:userId` | DELETE | DELETE | No tenant guard assertion found in service methods; No audit log call found |
| `superuser/impersonate/:userId` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |

**Note**: Superuser endpoints may be intentionally excluded from tenant guards (platform-level operations).

### modules/rbac/rbac-inspector.controller.ts

| Route | Method | HTTP | Issue |
|-------|--------|------|-------|
| `rbac/inspector/enable` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |

### modules/rbac/migration.controller.ts

| Route | Method | HTTP | Issue |
|-------|--------|------|-------|
| `rbac/migration/all` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |
| `rbac/migration/user/:userId` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |

**Note**: Migration endpoints may be intentionally excluded from tenant guards (platform-level operations).

### modules/okr/initiative.controller.ts

| Route | Method | HTTP | Issue |
|-------|--------|------|-------|
| `initiatives` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |
| `initiatives/:id` | PATCH | PATCH | No tenant guard assertion found in service methods; No audit log call found |
| `initiatives/:id` | DELETE | DELETE | No tenant guard assertion found in service methods; No audit log call found |

### modules/okr/key-result.controller.ts

| Route | Method | HTTP | Issue |
|-------|--------|------|-------|
| `key-results/:id/check-in` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |

### modules/okr/checkin-request.controller.ts

| Route | Method | HTTP | Issue |
|-------|--------|------|-------|
| `okr/checkin-responses` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |

### modules/layout/layout.controller.ts

| Route | Method | HTTP | Issue |
|-------|--------|------|-------|
| `layout/save` | POST | POST | No tenant guard assertion found in service methods; No audit log call found |
| `layout/:entityType/:entityId` | DELETE | DELETE | No tenant guard assertion found in service methods; No audit log call found |
| `layout/clear` | DELETE | DELETE | No tenant guard assertion found in service methods; No audit log call found |

---

## Action Plan

### Phase 1: Runtime Guardrails
- [ ] Apply `TenantMutationGuard` to all CRITICAL endpoints
- [ ] Ensure `req.tenantId` is available from middleware
- [ ] Add tenant boundary checks in service methods

### Phase 2: Static Analysis
- [ ] ESLint rule flags endpoints without tenant guards
- [ ] Update controllers to use `@UseGuards(TenantMutationGuard)`

### Phase 3: Testing
- [ ] Add tests for cross-tenant mutation rejection
- [ ] Verify tenant context is required for all mutations

---

## Notes

- **Auth endpoints**: May be intentionally excluded (public endpoints)
- **Superuser endpoints**: May be intentionally excluded (platform-level operations)
- **Migration endpoints**: May be intentionally excluded (platform-level operations)
- **Layout endpoints**: User-scoped (may not need tenant guard if user isolation is sufficient)

**Recommendation**: Apply tenant guards to all endpoints except:
1. Auth endpoints (`/auth/*`)
2. System endpoints (`/system/*`)
3. Superuser endpoints (`/superuser/*`) - if platform-level operations
4. Migration endpoints (`/rbac/migration/*`) - if platform-level operations

