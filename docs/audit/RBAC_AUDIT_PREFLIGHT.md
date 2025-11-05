# RBAC Audit Preflight

**Date:** 2025-01-27  
**Branch:** feat/seed/large-org-demo  
**Last 3 Commits:**
- `271476e` feat(seed): expand OKR volumes (+demo/full presets), idempotent & validated
- `ea4b21c` fix(okr): resolve runtime errors (DrawerFormSkeleton export, api import, Select empty values)
- `cf2bf59` docs(feature-requests): add OKR backlog stories + index

---

## Stack Detection

### RBAC Core Modules
Located in `services/core-api/src/modules/rbac/`:

- **rbac.ts** - Core authorization logic (`can()`, `getEffectiveRoles()`, `getHighestPriorityRole()`)
- **rbac.service.ts** - Prisma-integrated service layer (`buildUserContext()`, `canPerformAction()`)
- **rbac.guard.ts** - NestJS guard for route protection (`RBACGuard.canActivate()`)
- **rbac.decorator.ts** - Decorators (`@RequireAction()`, `@RequireActionWithContext()`, `@Public()`)
- **visibilityPolicy.ts** - OKR visibility rules (`canViewOKR()`)
- **types.ts** - Type definitions (Roles, Actions, UserContext, ResourceContext)
- **audit.ts** - Audit logging helpers
- **rbac.module.ts** - NestJS module configuration

### Guards
Located in `services/core-api/src/**/guards/`:

- **RBACGuard** - `services/core-api/src/modules/rbac/rbac.guard.ts`
- **OkrTenantGuard** - `services/core-api/src/modules/okr/tenant-guard.ts` (static utility class)
- **RateLimitGuard** - `services/core-api/src/common/guards/rate-limit.guard.ts`
- **JwtAuthGuard** - `services/core-api/src/modules/auth/guards/jwt-auth.guard.ts`
- **PermissionGuard** - `services/core-api/src/modules/permissions/permission.guard.ts` (legacy)

### Controllers (21 total)
Located in `services/core-api/src/modules/**/*.controller.ts`:

1. `okr/objective.controller.ts`
2. `okr/key-result.controller.ts`
3. `okr/okr-cycle.controller.ts`
4. `okr/okr-overview.controller.ts`
5. `okr/okr-reporting.controller.ts`
6. `okr/okr-insights.controller.ts`
7. `okr/me.controller.ts`
8. `okr/initiative.controller.ts`
9. `okr/checkin-request.controller.ts`
10. `user/user.controller.ts`
11. `organization/organization.controller.ts`
12. `workspace/workspace.controller.ts`
13. `team/team.controller.ts`
14. `rbac/rbac-assignment.controller.ts`
15. `rbac/rbac-inspector.controller.ts`
16. `rbac/migration.controller.ts`
17. `superuser/superuser.controller.ts`
18. `layout/layout.controller.ts`
19. `auth/auth.controller.ts`
20. `activity/activity.controller.ts`
21. `system/system.controller.ts`

### Services
Key services for OKR, RBAC, Users, Workspaces/Teams:

- **OKR:** `services/core-api/src/modules/okr/objective.service.ts`, `key-result.service.ts`, `okr-reporting.service.ts`
- **RBAC:** `services/core-api/src/modules/rbac/rbac.service.ts`, `rbac-inspector.service.ts`
- **Users:** `services/core-api/src/modules/user/user.service.ts`
- **Workspaces:** `services/core-api/src/modules/workspace/workspace.service.ts`
- **Teams:** `services/core-api/src/modules/team/team.service.ts`
- **Audit:** `services/core-api/src/modules/audit/audit-log.service.ts`

---

## Test Tools

- **Jest** - Test framework configured in `services/core-api/package.json`
- **Test Scripts:**
  - `test` - Unit tests
  - `test:watch` - Watch mode
  - `test:cov` - Coverage
  - `test:e2e` - End-to-end tests
  - `test:unit` - Unit tests only
  - `smoke:test` - Smoke tests

- **Test Configuration:** `services/core-api/jest.config.js` (referenced in package.json)
- **Test Location:** `services/core-api/src/**/*.spec.ts`

---

## Linting

- **ESLint** - Configured in `.eslintrc.js` (root) and `services/core-api/.eslintrc.custom-rules.js`
- **Lint Script:** `npm run lint` in `services/core-api`
- **Plugins:** `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`

---

## CI Scripts

CI scripts location not explicitly detected in this scan. Expected locations:
- Root `.github/workflows/` (if GitHub Actions)
- Root `.gitlab-ci.yml` (if GitLab CI)
- Per-service CI configs

---

## Next Steps

1. ✅ Preflight complete
2. ⏭️ Create `scripts/rbac/audit-scan.ts` for static code analysis
3. ⏭️ Generate enforcement map and consistency report
4. ⏭️ Create dynamic trace script
5. ⏭️ Compare with spec matrix
6. ⏭️ Add hardening (lint rules, CI checks, telemetry)

