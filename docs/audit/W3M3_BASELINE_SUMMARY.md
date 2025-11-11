# W3.M3 Baseline Discovery Summary

## Application Structure

- **Main Module**: `services/core-api/src/app.module.ts`
- **Bootstrap**: `services/core-api/src/main.ts`
- **Global Guards**: Registered via `@UseGuards()` decorators at controller level
- **Test Framework**: Jest (configured in `package.json`)

## Existing Infrastructure

### Guards
- `JwtAuthGuard` - Authentication guard (`services/core-api/src/modules/auth/guards/jwt-auth.guard.ts`)
- `RBACGuard` - RBAC authorization guard (`services/core-api/src/modules/rbac/rbac.guard.ts`)
- `PermissionGuard` - Permission-based guard (`services/core-api/src/modules/permissions/permission.guard.ts`)
- `TenantIsolationGuard` - Tenant isolation guard (deprecated, logic moved to services)

### Modules
- All modules registered in `AppModule`
- Global modules: `PrismaModule`, `RedisModule`, `RBACModule`, `AuditModule`
- Module pattern: Each feature has its own module with controller/service

### Health/Status Endpoints
- **None found** - No existing health/status endpoint

### Rate Limiting
- **None found** - No existing rate limiting middleware or guard

### Test Infrastructure
- **Test Runner**: Jest
- **Test Location**: `services/core-api/src/modules/*/*.spec.ts`
- **Existing Tests**: 
  - `checkin-request.service.spec.ts`
  - `rbac.integration.spec.ts`
  - `rbac.service.spec.ts`
  - `visibility-policy.spec.ts`
- **Test Pattern**: Uses `@nestjs/testing` with `Test.createTestingModule()`
- **No smoke test folder**: Will create `services/core-api/test/smoke/`

## Critical Endpoints to Protect

### Check-in Request Mutations
- `POST /okr/checkin-requests` - Creates check-in requests (requires `request_checkin` action)

### RBAC Assignment Mutations
- `POST /rbac/assignments/assign` - Assigns roles (requires `manage_users` action)
- `DELETE /rbac/assignments/:assignmentId` - Revokes roles (requires `manage_users` action)

### Exec Whitelist Mutations
- `POST /rbac/whitelist/:tenantId/add` - Add to whitelist (requires `manage_tenant_settings` action)
- `POST /rbac/whitelist/:tenantId/remove` - Remove from whitelist (requires `manage_tenant_settings` action)
- `POST /rbac/whitelist/:tenantId/set` - Set entire whitelist (requires `manage_tenant_settings` action)
- `DELETE /rbac/whitelist/:tenantId` - Clear whitelist (requires `manage_tenant_settings` action)

### OKR Mutations
- `POST /objectives` - Create objective (requires `create_okr` action)
- `PATCH /objectives/:id` - Update objective (requires `edit_okr` action)
- `DELETE /objectives/:id` - Delete objective (requires `edit_okr` action)

## Next Steps

1. Create `SystemModule` with `/system/status` endpoint
2. Create `RateLimitGuard` in `services/core-api/src/common/guards/rate-limit.guard.ts`
3. Apply guard to all mutation endpoints listed above
4. Create smoke test suite in `services/core-api/test/smoke/`
5. Wire CI script to run smoke tests
6. Document enforcement policy





