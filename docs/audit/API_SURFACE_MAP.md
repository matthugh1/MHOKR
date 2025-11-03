# API Surface Map Report
## OKR Nexus Platform

**Date:** 2025-01-XX  
**Auditor:** Architecture Audit Tool  
**Scope:** All HTTP routes, controller files, and service methods, with missing guard annotations flagged

---

## Summary

**Total Controllers:** 22  
**Total Endpoints:** 80+  
**Endpoints with Guards:** 75+  
**Endpoints Missing Guards:** 5  
**Endpoints with @RequireAction:** 70+

---

## API Gateway Routes

**Base URL:** `http://localhost:3000/api`

### Core API Routes (Proxied)

| Route Pattern | Target Service | Path Rewrite | Notes |
|--------------|----------------|--------------|-------|
| `/api/auth/*` | core-api | `/auth/*` | Public routes (no auth) |
| `/api/users/*` | core-api | `/users/*` | ✅ Protected |
| `/api/organizations/*` | core-api | `/organizations/*` | ✅ Protected |
| `/api/workspaces/*` | core-api | `/workspaces/*` | ✅ Protected |
| `/api/teams/*` | core-api | `/teams/*` | ✅ Protected |
| `/api/objectives/*` | core-api | `/objectives/*` | ✅ Protected |
| `/api/key-results/*` | core-api | `/key-results/*` | ✅ Protected |
| `/api/initiatives/*` | core-api | `/initiatives/*` | ✅ Protected |
| `/api/reports/*` | core-api | `/reports/*` | ✅ Protected (duplicate route - line 162, 204) |
| `/api/okr/*` | core-api | `/okr/*` | ✅ Protected |
| `/api/me/*` | core-api | `/me/*` | ✅ Protected |
| `/api/activities/*` | core-api | `/activities/*` | ✅ Protected |
| `/api/layout/*` | core-api | `/layout/*` | ✅ Protected |
| `/api/rbac/*` | core-api | `/rbac/*` | ✅ Protected |
| `/api/superuser/*` | core-api | `/superuser/*` | ✅ Protected |

### AI Service Routes

| Route Pattern | Target Service | Path Rewrite | Notes |
|--------------|----------------|--------------|-------|
| `/api/ai/*` | ai-service | `/personas/*` | ✅ Protected |

### Integration Service Routes

| Route Pattern | Target Service | Path Rewrite | Notes |
|--------------|----------------|--------------|-------|
| `/api/integrations/*` | integration-service | `/integrations/*` | ✅ Protected |
| `/api/webhooks/*` | integration-service | `/webhooks/*` | ✅ Protected |

### Issue: Duplicate Route

**Location:** `services/api-gateway/src/index.ts` lines 162 and 204

```typescript
app.use('/api/reports', createProxyMiddleware({ ... })); // Line 162
// ... other routes ...
app.use('/api/reports', createProxyMiddleware({ ... })); // Line 204 (DUPLICATE)
```

**Impact:** Second route definition overwrites first (may cause unexpected behavior)

**Recommendation:** Remove duplicate route definition

---

## Core API Controllers

### AuthController (`/auth`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| POST | `/auth/register` | ❌ None | ❌ None | Public endpoint |
| POST | `/auth/login` | ❌ None | ❌ None | Public endpoint |
| POST | `/auth/verify` | ❌ None | ❌ None | Public endpoint (Keycloak) |
| GET | `/auth/me` | ✅ JwtAuthGuard | ❌ None | ⚠️ Missing RBACGuard |

**Missing Guards:** `/auth/me` should have RBACGuard (low priority, returns user info only)

---

### UserController (`/users`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| GET | `/users/me` | ✅ JwtAuthGuard, RBACGuard | ❌ None | ⚠️ Missing @RequireAction (returns self) |
| GET | `/users/me/context` | ✅ JwtAuthGuard, RBACGuard | ❌ None | ⚠️ Missing @RequireAction (returns self) |
| GET | `/users` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_users` | ✅ Complete |
| GET | `/users/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_users` | ✅ Complete |
| POST | `/users` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_users` | ✅ Complete |
| PATCH | `/users/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_users` | ✅ Complete |
| POST | `/users/:id/reset-password` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_users` | ✅ Complete |

**Missing Guards:** `/users/me` and `/users/me/context` (acceptable - returns own data)

---

### OrganizationController (`/organizations`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| GET | `/organizations/current` | ✅ JwtAuthGuard, RBACGuard | ❌ None | ⚠️ Missing @RequireAction (returns current org) |
| GET | `/organizations` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_tenant_settings` | ✅ Complete |
| GET | `/organizations/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_tenant_settings` | ✅ Complete |
| POST | `/organizations` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_tenant_settings` | ✅ Complete |
| PATCH | `/organizations/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_tenant_settings` | ✅ Complete |
| DELETE | `/organizations/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_tenant_settings` | ✅ Complete |
| GET | `/organizations/:id/members` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_users` | ✅ Complete |
| POST | `/organizations/:id/members` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_users` | ✅ Complete |
| DELETE | `/organizations/:id/members/:userId` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_users` | ✅ Complete |

**Missing Guards:** `/organizations/current` (acceptable - returns current org)

---

### WorkspaceController (`/workspaces`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| GET | `/workspaces` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_workspaces` | ✅ Complete |
| GET | `/workspaces/default` | ✅ JwtAuthGuard, RBACGuard | ❌ None | ⚠️ Missing @RequireAction (returns default) |
| GET | `/workspaces/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_workspaces` | ✅ Complete |
| POST | `/workspaces` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_workspaces` | ✅ Complete |
| PATCH | `/workspaces/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_workspaces` | ✅ Complete |
| DELETE | `/workspaces/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_workspaces` | ✅ Complete |
| GET | `/workspaces/:id/members` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_users` | ✅ Complete |
| POST | `/workspaces/:id/members` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_users` | ✅ Complete |
| DELETE | `/workspaces/:id/members/:userId` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_users` | ✅ Complete |
| GET | `/workspaces/hierarchy/:organizationId` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_workspaces` | ✅ Complete |

**Missing Guards:** `/workspaces/default` (acceptable - returns default workspace)

---

### TeamController (`/teams`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| GET | `/teams` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_teams` | ✅ Complete |
| GET | `/teams/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_teams` | ✅ Complete |
| POST | `/teams` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_teams` | ✅ Complete |
| PATCH | `/teams/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_teams` | ✅ Complete |
| DELETE | `/teams/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_teams` | ✅ Complete |
| POST | `/teams/:id/members` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_users` | ✅ Complete |
| DELETE | `/teams/:id/members/:userId` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_users` | ✅ Complete |

**Missing Guards:** None

---

### ObjectiveController (`/objectives`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| GET | `/objectives` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| GET | `/objectives/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| POST | `/objectives` | ✅ JwtAuthGuard, RBACGuard | ✅ `create_okr` | ✅ Complete |
| PATCH | `/objectives/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `edit_okr` | ✅ Complete |
| DELETE | `/objectives/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `delete_okr` | ✅ Complete |

**Missing Guards:** None

---

### KeyResultController (`/key-results`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| GET | `/key-results` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| GET | `/key-results/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| POST | `/key-results` | ✅ JwtAuthGuard, RBACGuard | ✅ `create_okr` | ✅ Complete |
| PATCH | `/key-results/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `edit_okr` | ✅ Complete |
| DELETE | `/key-results/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `delete_okr` | ✅ Complete |
| POST | `/key-results/:id/check-in` | ✅ JwtAuthGuard, RBACGuard | ✅ `edit_okr` | ✅ Complete |

**Missing Guards:** None

---

### InitiativeController (`/initiatives`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| GET | `/initiatives` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| GET | `/initiatives/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| POST | `/initiatives` | ✅ JwtAuthGuard, RBACGuard | ✅ `create_okr` | ✅ Complete |
| PATCH | `/initiatives/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `edit_okr` | ✅ Complete |
| DELETE | `/initiatives/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `delete_okr` | ✅ Complete |

**Missing Guards:** None

---

### OkrReportingController (`/reports`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| GET | `/reports/analytics/summary` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| GET | `/reports/analytics/feed` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| GET | `/reports/export/csv` | ✅ JwtAuthGuard, RBACGuard | ✅ `export_data` | ✅ Complete |
| GET | `/reports/cycles/active` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| GET | `/reports/pillars` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| GET | `/reports/pillars/coverage` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| GET | `/reports/check-ins/overdue` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |

**Missing Guards:** None

---

### OkrOverviewController (`/okr`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| GET | `/okr/overview` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete - W4.M1: Returns `status`, `publishState`, `visibilityLevel` (canonical only), `cycle` (no `period`), no `pillarId` |
| GET | `/okr/creation-context` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete - W4.M1: Returns `allowedVisibilityLevels` with only `PUBLIC_TENANT` and `PRIVATE` |
| POST | `/okr/create-composite` | ✅ JwtAuthGuard, RBACGuard, RateLimitGuard | ✅ `create_okr` | ✅ Complete - W5.M1: Atomically creates Objective and Key Results with validation, RBAC, governance, and AuditLog |

**Missing Guards:** None

**W4.M1 Changes:**
- Response includes `publishState` field (`PUBLISHED | DRAFT`) in addition to `isPublished` boolean
- `visibilityLevel` returns only canonical values (`PUBLIC_TENANT | PRIVATE`)
- `period` field removed from responses (model completely removed in W4.M2)
- `pillarId` field removed from responses (deprecated)

**W5.M1 Changes:**
- Added `POST /okr/create-composite` endpoint for atomic OKR creation
- Rate limit: 30 requests per minute per user
- Supports `PUBLIC_TENANT` and `PRIVATE` visibility levels (EXEC_ONLY excluded per W4.M1)

---

### OkrInsightsController (`/okr/insights`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| GET | `/okr/insights/cycle-summary` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete - W5.M2: Returns cycle health summary (objectives, KRs, check-ins) with visibility filtering |
| GET | `/okr/insights/objective/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete - W5.M2: Returns objective-level insights (status trend, last update age, KR roll-ups, check-in counts) |
| GET | `/okr/insights/attention` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete - W5.M2: Returns paginated attention feed (overdue check-ins, no updates, status downgrades) |

**Missing Guards:** None

**W5.M2 Changes:**
- Added three new insights endpoints for inline analytics and cycle health
- All endpoints respect server-side visibility and tenant isolation
- Cycle summary includes objectives (published/draft), KRs (on track/at risk/blocked/completed), and check-ins (upcoming/overdue/recent)
- Objective insights include status trend, last update age, KR roll-ups, and check-in counts
- Attention feed supports pagination (default 20 per page, max 50)
- All insights filtered by caller's visibility scope before returning

---

### CheckInRequestController (`/okr`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| POST | `/okr/checkin-requests` | ✅ JwtAuthGuard, RBACGuard | ✅ `edit_okr` | ⚠️ TODO: Consider `request_checkin` action |
| GET | `/okr/checkin-requests/mine` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| POST | `/okr/checkin-responses` | ✅ JwtAuthGuard, RBACGuard | ✅ `edit_okr` | ⚠️ TODO: Consider more specific action |
| GET | `/okr/checkin-rollup` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |

**Missing Guards:** None (but actions could be more specific)

---

### MeController (`/me`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| GET | `/me/summary` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |

**Missing Guards:** None

---

### ActivityController (`/activity`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| GET | `/activity/objectives/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| GET | `/activity/key-results/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| GET | `/activity/feed` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ⚠️ TODO: Not implemented (returns { todo: true }) |

**Missing Guards:** None

---

### LayoutController (`/layout`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| POST | `/layout/save` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| GET | `/layout` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| DELETE | `/layout/:entityType/:entityId` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |
| DELETE | `/layout/clear` | ✅ JwtAuthGuard, RBACGuard | ✅ `view_okr` | ✅ Complete |

**Missing Guards:** None

---

### RBACAssignmentController (`/rbac/assignments`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| GET | `/rbac/assignments/me` | ✅ JwtAuthGuard, RBACGuard | ❌ None | ⚠️ Missing @RequireAction (returns own roles) |
| POST | `/rbac/assignments` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_users` | ✅ Complete |
| DELETE | `/rbac/assignments/:id` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_users` | ✅ Complete |
| GET | `/rbac/assignments/user/:userId` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_users` | ✅ Complete |

**Missing Guards:** `/rbac/assignments/me` (acceptable - returns own roles)

---

### ExecWhitelistController (`/rbac/exec-whitelist`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| GET | `/rbac/exec-whitelist/:organizationId` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_tenant_settings` | ✅ Complete |
| POST | `/rbac/exec-whitelist/:organizationId` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_tenant_settings` | ✅ Complete |
| DELETE | `/rbac/exec-whitelist/:organizationId/:userId` | ✅ JwtAuthGuard, RBACGuard | ✅ `manage_tenant_settings` | ✅ Complete |

**Missing Guards:** None

---

### RBACMigrationController (`/rbac/migration`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| POST | `/rbac/migration/migrate-legacy-roles` | ✅ JwtAuthGuard | ❌ None | ⚠️ Missing RBACGuard and @RequireAction |

**Missing Guards:** ⚠️ **CRITICAL** - Migration endpoint should be superuser-only

---

### SuperuserController (`/superuser`)

| Method | Route | Guards | @RequireAction | Notes |
|--------|-------|--------|----------------|-------|
| GET | `/superuser/check` | ✅ JwtAuthGuard | ❌ None | ⚠️ Missing RBACGuard (checks superuser in service) |
| POST | `/superuser/create` | ✅ JwtAuthGuard | ❌ None | ⚠️ Missing RBACGuard (checks superuser in service) |
| POST | `/superuser/promote/:userId` | ✅ JwtAuthGuard | ❌ None | ⚠️ Missing RBACGuard (checks superuser in service) |
| POST | `/superuser/revoke/:userId` | ✅ JwtAuthGuard | ❌ None | ⚠️ Missing RBACGuard (checks superuser in service) |
| GET | `/superuser/list` | ✅ JwtAuthGuard | ❌ None | ⚠️ Missing RBACGuard (checks superuser in service) |
| POST | `/superuser/organizations` | ✅ JwtAuthGuard | ❌ None | ⚠️ Missing RBACGuard (checks superuser in service) |
| POST | `/superuser/organizations/:organizationId/users/:userId` | ✅ JwtAuthGuard | ❌ None | ⚠️ Missing RBACGuard (checks superuser in service) |
| DELETE | `/superuser/organizations/:organizationId/users/:userId` | ✅ JwtAuthGuard | ❌ None | ⚠️ Missing RBACGuard (checks superuser in service) |
| GET | `/superuser/organizations` | ✅ JwtAuthGuard | ❌ None | ⚠️ Missing RBACGuard (checks superuser in service) |
| GET | `/superuser/users` | ✅ JwtAuthGuard | ❌ None | ⚠️ Missing RBACGuard (checks superuser in service) |
| POST | `/superuser/impersonate/:userId` | ✅ JwtAuthGuard | ❌ None | ⚠️ Missing RBACGuard (checks superuser in service) |

**Missing Guards:** ⚠️ **CRITICAL** - All superuser endpoints check superuser status in service layer, but should use RBACGuard with `impersonate_user` action for consistency

**Note:** Service-layer checks are present (e.g., `isSuperuser()`), but guard-level enforcement would be more consistent

---

## Service Methods (Not Exposed via HTTP)

### ObjectiveService

**Public Methods:**
- `findAll()` - Used by controller
- `findById()` - Used by controller
- `create()` - Used by controller
- `update()` - Used by controller
- `delete()` - Used by controller
- `canView()` - Used by controller for permission checks
- `canEdit()` - Used by controller for permission checks
- `canDelete()` - Used by controller for permission checks
- `canCreateInWorkspace()` - Used by controller for permission checks

**All methods have proper tenant isolation and RBAC checks** ✅

---

### KeyResultService

**Public Methods:**
- `findAll()` - Used by controller
- `findById()` - Used by controller
- `create()` - Used by controller
- `update()` - Used by controller
- `delete()` - Used by controller
- `createCheckIn()` - Used by controller
- `canView()` - Used by controller for permission checks
- `canEdit()` - Used by controller for permission checks
- `canDelete()` - Used by controller for permission checks
- `canEditObjective()` - Used by controller for permission checks

**All methods have proper tenant isolation and RBAC checks** ✅

---

### CheckInRequestService

**Public Methods:**
- `createRequests()` - Used by controller
- `getMyRequests()` - Used by controller
- `submitResponse()` - Used by controller
- `getRollup()` - Used by controller
- `markLateRequests()` - ⚠️ Not scheduled (TODO)

**Missing:** Manager relationship validation (TODO at line 49)

---

## Summary

### ✅ Well-Protected Endpoints

- **OKR CRUD endpoints** - All have proper guards and @RequireAction
- **Reporting endpoints** - All have proper guards and @RequireAction
- **Activity endpoints** - All have proper guards and @RequireAction
- **Team/Workspace/Organization management** - All have proper guards and @RequireAction

### ⚠️ Endpoints with Missing Guards (Acceptable)

- `/auth/me` - Returns own user info (low priority)
- `/users/me` - Returns own user info (acceptable)
- `/users/me/context` - Returns own context (acceptable)
- `/organizations/current` - Returns current org (acceptable)
- `/workspaces/default` - Returns default workspace (acceptable)
- `/rbac/assignments/me` - Returns own roles (acceptable)

### 🔴 Critical Missing Guards

1. **RBACMigrationController** - `/rbac/migration/migrate-legacy-roles`
   - **Issue:** Missing RBACGuard and @RequireAction
   - **Impact:** Critical - migration endpoint should be superuser-only
   - **Recommendation:** Add `@UseGuards(JwtAuthGuard, RBACGuard)` and `@RequireAction('impersonate_user')` or superuser check

2. **SuperuserController** - All endpoints
   - **Issue:** Missing RBACGuard (service-layer checks present)
   - **Impact:** Medium - inconsistency, but functional
   - **Recommendation:** Add RBACGuard with custom superuser check for consistency

### ⚠️ Action Specificity Issues

1. **CheckInRequestController** - Using generic `edit_okr` action
   - **Recommendation:** Consider creating `request_checkin` action for better granularity

---

## Recommendations

1. **Fix duplicate route** in API Gateway (`/api/reports`)
2. **Add RBACGuard** to RBACMigrationController
3. **Add RBACGuard** to SuperuserController (for consistency)
4. **Consider specific actions** for check-in requests
5. **Document acceptable exceptions** for `/me` endpoints (returns own data)

---

**End of API Surface Map Report**



